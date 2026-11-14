import type { ReactiveController, ReactiveControllerHost } from 'lit'
import { DEFAULT_ROW_HEADER_WIDTH } from '../../core/constants'
import { propagateAutoSchedule, type AutoScheduleOptions } from '../../core/auto-schedule'
import {
  applyGridCellEdit,
  findAdjacentEditableCell,
  formatGridRangeToTsv,
  isGridCellEditable,
  isGridColumnPinned,
  normalizeGridColumns,
  parseTsvString,
  partitionGridColumns,
  resolveGridCellRange,
} from '../../core/grid'
import type { GanttCommandType } from '../../core/history'
import type { PluginManager } from '../../core/plugin'
import type {
  BeforeCellEditHookDetail,
  CellCopyEventDetail,
  CellEditEventDetail,
  CellPasteEventDetail,
  CellSelectionChangeEventDetail,
  ColumnReorderEventDetail,
  ColumnResizeEventDetail,
  ColumnSortEventDetail,
  GanttChartOption,
  GanttColumn,
  GanttRow,
  GridCellCoord,
  GridCellNavigationDirection,
  GridCellRange,
  GridSortDirection,
  GridSortState,
  RowHeaderResizeEventDetail,
} from '../../core/types'
import { computeRowWbsCodes } from '../../core/wbs'

export interface GridControllerHost extends ReactiveControllerHost, HTMLElement {
  option: GanttChartOption
  rows: GanttRow[]
  displayRows: GanttRow[]
  shadowRoot: ShadowRoot | null
  currentRowHeaderWidth: number
  baseRowHeaderWidth: number
  effectiveRowHeaderWidth: number
  effectiveZoomScale: number
  isScaleRowHeaderEnabled: boolean
  effectivePxPerMonth: number | undefined
  calendarHeight: number
  currentScrollTop: number
  virtualScrollTop: number
  focusedTaskId: string | null
  focusedRowId: string | null
  pluginManager: PluginManager
  getScrollContainer(): HTMLElement | null
  getAutoScheduleOptions(): AutoScheduleOptions
  calculateLayout(): { layouts: Array<{ top: number; height: number }>; taskCoords: any; totalHeight: number }
  invalidateLayoutCache(): void
  syncHorizontalVirtualRange(scrollLeft: number): void
  maybeAutoExtendCalendar(minDate: Date, maxDate: Date, isDragging: boolean): void
  applyRowsChangeWithCommand(
    previousRows: GanttRow[],
    nextRows: GanttRow[],
    commandInfo: { type: GanttCommandType; description: string },
  ): void
}

/**
 * マルチカラムデータグリッドの状態・選択・TSV連携・インライン編集・列リサイズ/並び替え/ソート・横スクロールを統括するコントローラー
 */
export class GridController implements ReactiveController {
  private host: GridControllerHost

  public currentGridColumns: GanttColumn[] | null = null
  public currentGridScrollLeft = 0
  public columnDropTarget: { columnId: string; position: 'left' | 'right' } | null = null
  public currentSortState: GridSortState | null = null
  public selectedCellRange: GridCellRange | null = null
  public isResizingHeader = false

  private _lastExplicitSortStateKey: string | null = null
  private _isDraggingCellSelection = false
  public _userResizedHeaderWidth: number | null = null
  private _lastExplicitOptionWidth: number | undefined = undefined
  public _userColumnWidths: Map<string, number> = new Map()
  private _lastExplicitColumnWidths: Map<string, number | undefined> = new Map()
  public _userColumnOrder: string[] | null = null
  private _lastExplicitColumnOrderKey: string | null = null

  constructor(host: GridControllerHost) {
    this.host = host
    host.addController(this)
  }

  hostConnected(): void {}

  hostDisconnected(): void {
    this._isDraggingCellSelection = false
  }

  /**
   * `option` プロパティ更新時にグリッド列幅・並び順・ソート状態・ヘッダー幅を同期する
   */
  public syncWithOption(hadPreviousOption: boolean): void {
    this.currentGridColumns = null
    const option = this.host.option

    if (option?.grid?.sortState !== undefined) {
      const nextSort = option.grid.sortState
      const sortKey = nextSort ? `${nextSort.columnId}:${nextSort.direction}` : 'null'
      if (sortKey !== this._lastExplicitSortStateKey) {
        this._lastExplicitSortStateKey = sortKey
        this.currentSortState = nextSort
          ? { columnId: nextSort.columnId, direction: nextSort.direction }
          : null
        this.host.invalidateLayoutCache()
      }
    }

    if (option?.grid?.columns) {
      const explicitOrder = option.grid.columns
        .filter((col): col is GanttColumn => typeof col === 'object' && col !== null)
        .map((col) => col.id)
      const orderKey = explicitOrder.join(',')
      if (orderKey !== this._lastExplicitColumnOrderKey) {
        this._lastExplicitColumnOrderKey = orderKey
        this._userColumnOrder = null
      }

      for (const col of option.grid.columns) {
        if (typeof col === 'object' && col !== null) {
          const prevExplicit = this._lastExplicitColumnWidths.get(col.id)
          if (col.width !== prevExplicit) {
            this._lastExplicitColumnWidths.set(col.id, col.width)
            if (typeof col.width === 'number') {
              this._userColumnWidths.set(col.id, col.width)
            } else {
              this._userColumnWidths.delete(col.id)
            }
          }
        }
      }
    }

    const optionWidth = option?.grid?.width ?? option?.rowHeader?.width
    const isExplicitWidthChange = optionWidth !== undefined && optionWidth !== this._lastExplicitOptionWidth
    this._lastExplicitOptionWidth = optionWidth

    if (!this.isResizingHeader) {
      if (isExplicitWidthChange) {
        this.host.baseRowHeaderWidth = optionWidth
        this.host.currentRowHeaderWidth = this.host.effectiveRowHeaderWidth
        this._userResizedHeaderWidth = this.host.currentRowHeaderWidth
      } else if (this._userResizedHeaderWidth !== null) {
        this.host.baseRowHeaderWidth = this.host.isScaleRowHeaderEnabled
          ? Math.max(60, Math.round(this._userResizedHeaderWidth / this.host.effectiveZoomScale))
          : this._userResizedHeaderWidth
        this.host.currentRowHeaderWidth = this.host.effectiveRowHeaderWidth
      } else if (!hadPreviousOption) {
        this.host.baseRowHeaderWidth = optionWidth ?? DEFAULT_ROW_HEADER_WIDTH
        this.host.currentRowHeaderWidth = this.host.effectiveRowHeaderWidth
      }
    }

    this.clampGridScrollLeft()
  }

  public get effectiveGridColumns(): GanttColumn[] | undefined {
    const gridOpt = this.host.option?.grid
    if (!gridOpt || gridOpt.enabled === false) return undefined
    if (!gridOpt.columns && gridOpt.enabled !== true) return undefined
    const baseColumns = this.currentGridColumns ?? gridOpt.columns
    const isMonthMode =
      this.host.effectivePxPerMonth !== undefined || this.host.option?.calendar?.pxPerMonth !== undefined
    const isTimeMode = !!this.host.option?.calendar?.showTime
    const normalized = normalizeGridColumns(baseColumns, this.host.option?.locale, isMonthMode, isTimeMode)
    let result = normalized.map((col) => {
      const userW = this._userColumnWidths.get(col.id)
      return userW !== undefined ? { ...col, width: userW } : col
    })
    if (this._userColumnOrder && this._userColumnOrder.length > 0) {
      const orderMap = new Map(this._userColumnOrder.map((id, idx) => [id, idx]))
      result = [...result].sort((a, b) => {
        const pinnedDiff = (isGridColumnPinned(a) ? 0 : 1) - (isGridColumnPinned(b) ? 0 : 1)
        if (pinnedDiff !== 0) return pinnedDiff
        const idxA = orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER
        const idxB = orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER
        return idxA - idxB
      })
    }
    return result
  }

  public getGridColumnById(columnId: string): GanttColumn | undefined {
    const columns = this.effectiveGridColumns
    if (!columns) return undefined
    return columns.find((c) => c.id === columnId)
  }

  public get isGridCellSelectionEnabled(): boolean {
    if (this.host.option?.grid?.cellSelection === false) return false
    return Boolean(this.effectiveGridColumns && this.effectiveGridColumns.length > 0)
  }

  private getMaxGridScrollLeft(columns?: GanttColumn[]): number {
    const cols = columns ?? this.effectiveGridColumns
    if (!cols) return 0
    const visibleColumns = cols.filter((c) => c.visible !== false)
    const { pinnedWidth, scrollableWidth } = partitionGridColumns(visibleColumns)
    const scrollableViewportWidth = Math.max(0, this.host.currentRowHeaderWidth - pinnedWidth)
    return Math.max(0, scrollableWidth - scrollableViewportWidth)
  }

  public clampGridScrollLeft(): void {
    const maxScroll = this.getMaxGridScrollLeft()
    if (this.currentGridScrollLeft > maxScroll) {
      this.currentGridScrollLeft = maxScroll
      this.host.requestUpdate()
    }
  }

  public handleHeaderResizeStart = (e: PointerEvent): void => {
    if (e.cancelable) e.preventDefault()
    e.stopPropagation()
    this.isResizingHeader = true
    this.host.requestUpdate()
    const startX = e.clientX
    const startWidth = this.host.currentRowHeaderWidth
    const target = e.target as HTMLElement
    if (typeof target.setPointerCapture === 'function') {
      try {
        target.setPointerCapture(e.pointerId)
      } catch {
        // ignore
      }
    }

    const minWidth = this.host.option.rowHeader?.minWidth ?? 50
    const maxWidth = this.host.option.rowHeader?.maxWidth ?? Number.MAX_SAFE_INTEGER

    const handleMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX
      const newWidth = startWidth + dx
      this.host.currentRowHeaderWidth = Math.max(minWidth, Math.min(maxWidth, newWidth))
      this.clampGridScrollLeft()
    }

    const handleUp = () => {
      this.isResizingHeader = false
      if (typeof target.releasePointerCapture === 'function') {
        try {
          target.releasePointerCapture(e.pointerId)
        } catch {
          // ignore
        }
      }
      target.removeEventListener('pointermove', handleMove)
      target.removeEventListener('pointerup', handleUp)
      target.removeEventListener('pointercancel', handleUp)

      const finalWidth = Math.round(this.host.currentRowHeaderWidth)
      this.host.currentRowHeaderWidth = finalWidth
      this._userResizedHeaderWidth = finalWidth
      this.host.baseRowHeaderWidth = this.host.isScaleRowHeaderEnabled
        ? Math.max(60, Math.round(finalWidth / this.host.effectiveZoomScale))
        : finalWidth
      this.clampGridScrollLeft()
      this.host.syncHorizontalVirtualRange((this.host as any).currentScrollLeft ?? 0)
      this.host.requestUpdate()

      this.host.dispatchEvent(
        new CustomEvent<RowHeaderResizeEventDetail>('row-header-resize', {
          detail: { width: finalWidth },
          bubbles: true,
          composed: true,
        }),
      )
    }

    target.addEventListener('pointermove', handleMove)
    target.addEventListener('pointerup', handleUp)
    target.addEventListener('pointercancel', handleUp)
  }

  public handleColumnResize = (e: CustomEvent<ColumnResizeEventDetail>): void => {
    if (e.detail.columnId && typeof e.detail.width === 'number') {
      this._userColumnWidths.set(e.detail.columnId, e.detail.width)
    }
    this.currentGridColumns = e.detail.columns
    this.clampGridScrollLeft()
    this.host.requestUpdate()
    this.host.dispatchEvent(
      new CustomEvent<ColumnResizeEventDetail>('column-resize', {
        detail: e.detail,
        bubbles: true,
        composed: true,
      }),
    )
  }

  public handleColumnDragOver = (
    e: CustomEvent<{ columnId: string | null; position: 'left' | 'right' | null }>,
  ): void => {
    const { columnId, position } = e.detail ?? {}
    const next = columnId && position ? { columnId, position } : null
    if (
      this.columnDropTarget?.columnId !== next?.columnId ||
      this.columnDropTarget?.position !== next?.position
    ) {
      this.columnDropTarget = next
      this.host.requestUpdate()
    }
  }

  public handleColumnReorder = (e: CustomEvent<ColumnReorderEventDetail>): void => {
    this.columnDropTarget = null
    if (Array.isArray(e.detail.columnIds) && e.detail.columnIds.length > 0) {
      this._userColumnOrder = [...e.detail.columnIds]
    } else if (Array.isArray(e.detail.columns)) {
      this._userColumnOrder = e.detail.columns.map((c) => c.id)
    }
    this.currentGridColumns = e.detail.columns
    this.host.requestUpdate()
    this.host.dispatchEvent(
      new CustomEvent<ColumnReorderEventDetail>('column-reorder', {
        detail: e.detail,
        bubbles: true,
        composed: true,
      }),
    )
  }

  public handleColumnSort = (e: CustomEvent<ColumnSortEventDetail>): void => {
    this.currentSortState = e.detail.sortState
    this.host.invalidateLayoutCache()
    this.host.requestUpdate()
    this.host.dispatchEvent(
      new CustomEvent<ColumnSortEventDetail>('column-sort', {
        detail: e.detail,
        bubbles: true,
        composed: true,
      }),
    )
  }

  public sortByColumn(columnId: string | null, direction?: GridSortDirection | null): void {
    if (!columnId) {
      this.currentSortState = null
      this.host.invalidateLayoutCache()
      this.host.requestUpdate()
      this.host.dispatchEvent(
        new CustomEvent<ColumnSortEventDetail>('column-sort', {
          detail: {
            columnId: null,
            direction: null,
            sortState: null,
          },
          bubbles: true,
          composed: true,
        }),
      )
      return
    }

    const col = this.getGridColumnById(columnId)
    let nextDirection: GridSortDirection | null = direction ?? 'asc'
    if (direction === undefined && this.currentSortState?.columnId === columnId) {
      if (this.currentSortState.direction === 'asc') {
        nextDirection = 'desc'
      } else if (this.currentSortState.direction === 'desc') {
        nextDirection = null
      }
    }

    const nextState: GridSortState | null = nextDirection
      ? { columnId, direction: nextDirection }
      : null
    this.currentSortState = nextState
    this.host.invalidateLayoutCache()
    this.host.requestUpdate()

    this.host.dispatchEvent(
      new CustomEvent<ColumnSortEventDetail>('column-sort', {
        detail: {
          columnId: nextDirection ? columnId : null,
          direction: nextDirection,
          sortState: nextState,
          column: col,
        },
        bubbles: true,
        composed: true,
      }),
    )
  }

  public getSortState(): GridSortState | null {
    return this.currentSortState ? { ...this.currentSortState } : null
  }

  public handleGridWheel = (e: WheelEvent): boolean => {
    const columns = this.effectiveGridColumns
    if (!columns) return false

    const path = e.composedPath()
    let isOverHeader = false
    let isOverRowHeader = false

    for (const node of path) {
      if (!(node instanceof HTMLElement)) continue
      if (
        node.classList.contains('label-placeholder') ||
        node.classList.contains('grid-header-cell') ||
        node.classList.contains('grid-header-container')
      ) {
        isOverHeader = true
        break
      }
      if (
        node.classList.contains('row-header') ||
        node.classList.contains('grid-cell') ||
        node.classList.contains('grid-row-container')
      ) {
        isOverRowHeader = true
        break
      }
    }

    const container =
      this.host.getScrollContainer() ??
      (this.host.shadowRoot?.querySelector('.scroll-container') as HTMLElement | null)
    let isMouseInGrid = false
    if (container) {
      const rect = container.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      isMouseInGrid = mouseX >= 0 && mouseX <= this.host.currentRowHeaderWidth
    }

    const isInGridArea = isOverHeader || isOverRowHeader || isMouseInGrid
    if (!isInGridArea) {
      return false
    }

    const maxScroll = this.getMaxGridScrollLeft(columns)
    if (maxScroll <= 0) return false

    let dx = 0
    if (e.deltaX !== 0) {
      dx = e.deltaX
    } else if (e.shiftKey && e.deltaY !== 0) {
      dx = e.deltaY
    } else if (isOverHeader && e.deltaY !== 0) {
      dx = e.deltaY
    }

    if (dx !== 0) {
      e.preventDefault()
      e.stopPropagation()
      const next = Math.max(0, Math.min(maxScroll, this.currentGridScrollLeft + dx))
      if (next !== this.currentGridScrollLeft) {
        this.currentGridScrollLeft = next
        this.host.requestUpdate()
      }
      return true
    }

    return false
  }

  private emitCellSelectionChange(): void {
    const columns = (this.effectiveGridColumns ?? []).filter((c) => c.visible !== false)
    const resolved = resolveGridCellRange(this.host.displayRows, columns, this.selectedCellRange)
    this.host.dispatchEvent(
      new CustomEvent<CellSelectionChangeEventDetail>('cell-selection-change', {
        detail: {
          range: this.selectedCellRange
            ? {
                start: { ...this.selectedCellRange.start },
                end: { ...this.selectedCellRange.end },
              }
            : null,
          rowIds: resolved ? resolved.rowIds : [],
          columnIds: resolved ? resolved.columnIds : [],
        },
        bubbles: true,
        composed: true,
      }),
    )
  }

  public selectGridCells(range: GridCellRange | null): void {
    const prev = this.selectedCellRange
    const isSame =
      prev === range ||
      Boolean(
        prev &&
          range &&
          prev.start.rowId === range.start.rowId &&
          prev.start.columnId === range.start.columnId &&
          prev.end.rowId === range.end.rowId &&
          prev.end.columnId === range.end.columnId,
      )
    this.selectedCellRange = range
      ? {
          start: { ...range.start },
          end: { ...range.end },
        }
      : null
    if (range) {
      this.host.focusedTaskId = null
      this.host.focusedRowId = null
    }
    this.host.requestUpdate()
    if (!isSame) {
      this.emitCellSelectionChange()
    }
  }

  public getSelectedGridCells(): GridCellRange | null {
    return this.selectedCellRange
      ? {
          start: { ...this.selectedCellRange.start },
          end: { ...this.selectedCellRange.end },
        }
      : null
  }

  public moveGridCellSelection(
    dRow: number,
    dCol: number,
    extendRange: boolean,
    wrapRow = false,
  ): boolean {
    if (!this.isGridCellSelectionEnabled || !this.selectedCellRange) return false
    const columns = (this.effectiveGridColumns ?? []).filter((c) => c.visible !== false)
    const rows = this.host.displayRows
    if (rows.length === 0 || columns.length === 0) return false

    const targetCoord = extendRange ? this.selectedCellRange.end : this.selectedCellRange.start
    const rIdx = rows.findIndex((r) => r.id === targetCoord.rowId)
    const cIdx = columns.findIndex((c) => c.id === targetCoord.columnId)
    if (rIdx === -1 || cIdx === -1) return false

    let nextRIdx = rIdx + dRow
    let nextCIdx = cIdx + dCol
    if (wrapRow && dCol !== 0) {
      if (nextCIdx >= columns.length) {
        if (rIdx + 1 < rows.length) {
          nextRIdx = rIdx + 1
          nextCIdx = 0
        } else {
          nextRIdx = rIdx
          nextCIdx = columns.length - 1
        }
      } else if (nextCIdx < 0) {
        if (rIdx - 1 >= 0) {
          nextRIdx = rIdx - 1
          nextCIdx = columns.length - 1
        } else {
          nextRIdx = rIdx
          nextCIdx = 0
        }
      }
    } else {
      nextRIdx = Math.max(0, Math.min(rows.length - 1, nextRIdx))
      nextCIdx = Math.max(0, Math.min(columns.length - 1, nextCIdx))
    }

    const nextCoord: GridCellCoord = {
      rowId: rows[nextRIdx].id,
      columnId: columns[nextCIdx].id,
    }

    if (extendRange) {
      this.selectGridCells({
        start: { ...this.selectedCellRange.start },
        end: nextCoord,
      })
    } else {
      this.selectGridCells({
        start: nextCoord,
        end: nextCoord,
      })
    }

    this.scrollGridCellIntoView(nextCoord.rowId, nextCoord.columnId)
    return true
  }

  public handleRowCellPointerDown = (
    e: CustomEvent<{
      rowId: string
      columnId: string
      isNameOrTreeCell: boolean
      event: PointerEvent
    }>,
  ): void => {
    if (!this.isGridCellSelectionEnabled) return
    const { rowId, columnId, isNameOrTreeCell, event } = e.detail
    const coord: GridCellCoord = { rowId, columnId }

    if (event.shiftKey && this.selectedCellRange) {
      this.selectGridCells({
        start: { ...this.selectedCellRange.start },
        end: coord,
      })
    } else {
      this.selectGridCells({
        start: coord,
        end: coord,
      })
    }

    const canReorderRow = Boolean(
      this.host.option.enableRowReordering && !this.host.option.readOnly && isNameOrTreeCell,
    )
    if (canReorderRow) return

    this._isDraggingCellSelection = true
    const handlePointerUp = () => {
      this._isDraggingCellSelection = false
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)
  }

  public handleRowCellPointerEnter = (
    e: CustomEvent<{
      rowId: string
      columnId: string
      event: PointerEvent
    }>,
  ): void => {
    if (!this._isDraggingCellSelection || !this.selectedCellRange) return
    const { rowId, columnId } = e.detail
    if (
      this.selectedCellRange.end.rowId === rowId &&
      this.selectedCellRange.end.columnId === columnId
    ) {
      return
    }
    this.selectGridCells({
      start: { ...this.selectedCellRange.start },
      end: { rowId, columnId },
    })
  }

  public copySelectedCellsToTsv(): string {
    if (!this.selectedCellRange) return ''
    const columns = (this.effectiveGridColumns ?? []).filter((c) => c.visible !== false)
    if (columns.length === 0) return ''

    const isMonthMode = this.host.option.calendar.pxPerMonth !== undefined
    const isTimeMode = !!this.host.option.calendar.showTime
    const wbsCodes = computeRowWbsCodes(this.host.rows)

    const { tsv, rowIds, columnIds } = formatGridRangeToTsv(
      this.host.displayRows,
      columns,
      this.selectedCellRange,
      {
        locale: this.host.option.locale,
        isMonthMode,
        isTimeMode,
        wbsCodes,
        calendarOptions: this.host.getAutoScheduleOptions(),
      },
    )

    if (!tsv && rowIds.length === 0) return ''

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(tsv).catch(() => {
        // ignore clipboard permission errors in headless/restricted environments
      })
    }

    this.host.dispatchEvent(
      new CustomEvent<CellCopyEventDetail>('cell-copy', {
        detail: {
          range: {
            start: { ...this.selectedCellRange.start },
            end: { ...this.selectedCellRange.end },
          },
          tsv,
          rowIds,
          columnIds,
        },
        bubbles: true,
        composed: true,
      }),
    )

    return tsv
  }

  public pasteTsvToCells(
    tsv: string,
    targetRowId?: string,
    targetColumnId?: string,
  ): number {
    if (this.host.option?.readOnly || !tsv) return 0
    const columns = (this.effectiveGridColumns ?? []).filter((c) => c.visible !== false)
    if (columns.length === 0) return 0

    const dispRows = this.host.displayRows
    if (dispRows.length === 0) return 0

    let startRowIndex = -1
    let startColIndex = -1

    if (targetRowId && targetColumnId) {
      startRowIndex = dispRows.findIndex((r) => r.id === targetRowId)
      startColIndex = columns.findIndex((c) => c.id === targetColumnId)
    } else if (this.selectedCellRange) {
      const resolved = resolveGridCellRange(dispRows, columns, this.selectedCellRange)
      if (resolved) {
        startRowIndex = resolved.startRowIndex
        startColIndex = resolved.startColumnIndex
      }
    }

    if (startRowIndex === -1 || startColIndex === -1) return 0

    const matrix = parseTsvString(tsv)
    if (matrix.length === 0) return 0

    let effectiveMatrix = matrix
    if (matrix.length === 1 && matrix[0].length === 1 && !targetRowId && this.selectedCellRange) {
      const resolved = resolveGridCellRange(dispRows, columns, this.selectedCellRange)
      if (
        resolved &&
        (resolved.endRowIndex > resolved.startRowIndex ||
          resolved.endColumnIndex > resolved.startColumnIndex)
      ) {
        const singleVal = matrix[0][0]
        const rowSpan = resolved.endRowIndex - resolved.startRowIndex + 1
        const colSpan = resolved.endColumnIndex - resolved.startColumnIndex + 1
        effectiveMatrix = Array.from({ length: rowSpan }, () =>
          Array.from({ length: colSpan }, () => singleVal),
        )
      }
    }

    const isMonthMode = this.host.option.calendar.pxPerMonth !== undefined
    const isTimeMode = !!this.host.option.calendar.showTime
    const wbsCodes = computeRowWbsCodes(this.host.rows)
    const calendarOptions = this.host.getAutoScheduleOptions()
    const gridEditable = this.host.option.grid?.editable === true

    const rowsWithChildren = new Set<string>()
    for (const r of this.host.rows) {
      if (r.parentId) rowsWithChildren.add(r.parentId)
    }

    const previousRows = this.host.rows
    const clonedRowsMap = new Map<string, GanttRow>()
    for (const origRow of this.host.rows) {
      clonedRowsMap.set(origRow.id, {
        ...origRow,
        tasks: (origRow.tasks ?? []).map((t) => ({
          ...t,
          start: t.start instanceof Date ? new Date(t.start.getTime()) : t.start,
          end: t.end instanceof Date ? new Date(t.end.getTime()) : t.end,
          dependencies: t.dependencies ? [...t.dependencies] : undefined,
        })),
      })
    }

    const changes: CellPasteEventDetail['changes'] = []
    const changedTaskIds: string[] = []
    let minDate: Date | null = null
    let maxDate: Date | null = null

    for (let rOffset = 0; rOffset < effectiveMatrix.length; rOffset++) {
      const dispRow = dispRows[startRowIndex + rOffset]
      if (!dispRow) break
      const clonedRow = clonedRowsMap.get(dispRow.id)
      if (!clonedRow) continue

      const rowCells = effectiveMatrix[rOffset]
      const hasChildren = rowsWithChildren.has(clonedRow.id)

      for (let cOffset = 0; cOffset < rowCells.length; cOffset++) {
        const col = columns[startColIndex + cOffset]
        if (!col) break

        if (!isGridCellEditable(col, clonedRow, clonedRow.tasks, hasChildren, gridEditable)) {
          continue
        }

        const rawVal = rowCells[cOffset]
        const res = applyGridCellEdit(
          col,
          clonedRow,
          rawVal,
          isMonthMode,
          isTimeMode,
          wbsCodes.get(clonedRow.id),
          calendarOptions,
        )

        if (res.changed) {
          changes.push({
            rowId: clonedRow.id,
            columnId: col.id,
            oldValue: res.oldValue,
            newValue: res.newValue,
          })
          const normalTasks = (clonedRow.tasks ?? []).filter(
            (t) => t.type !== 'summary' && !(t as any).isSummary,
          )
          if (normalTasks.length === 1) {
            const st = normalTasks[0]
            if (!changedTaskIds.includes(st.id)) {
              changedTaskIds.push(st.id)
            }
            if (st.start && (!minDate || st.start.getTime() < minDate.getTime())) {
              minDate = st.start
            }
            if (st.end && (!maxDate || st.end.getTime() > maxDate.getTime())) {
              maxDate = st.end
            }
          }
        }
      }
    }

    if (changes.length === 0) return 0

    let nextRows = this.host.rows.map((r) => clonedRowsMap.get(r.id) ?? r)

    if (this.host.option.dependency?.autoSchedule && changedTaskIds.length > 0) {
      const scheduleResult = propagateAutoSchedule(
        nextRows,
        changedTaskIds,
        this.host.getAutoScheduleOptions(),
      )
      if (scheduleResult.hasChanges) {
        nextRows = scheduleResult.rows
      }
    }

    this.host.applyRowsChangeWithCommand(previousRows, nextRows, {
      type: 'cell-edit',
      description: `セルの一括貼り付け (${changes.length}件)`,
    })

    if (minDate && maxDate) {
      this.host.maybeAutoExtendCalendar(minDate, maxDate, false)
    }

    const startCoord: GridCellCoord = {
      rowId: dispRows[startRowIndex].id,
      columnId: columns[startColIndex].id,
    }

    this.host.dispatchEvent(
      new CustomEvent<CellPasteEventDetail>('cell-paste', {
        detail: {
          start: startCoord,
          tsv,
          changes,
          rows: this.host.rows,
        },
        bubbles: true,
        composed: true,
      }),
    )

    return changes.length
  }

  public handleClipboardCopy = (e: ClipboardEvent): void => {
    const path = e.composedPath()
    const target = path[0] as HTMLElement | undefined
    if (target && target !== this.host && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
      return
    }
    if (!this.selectedCellRange) return
    const tsv = this.copySelectedCellsToTsv()
    if (tsv && e.clipboardData) {
      e.clipboardData.setData('text/plain', tsv)
      e.preventDefault()
    }
  }

  public handleClipboardPaste = (e: ClipboardEvent): void => {
    const path = e.composedPath()
    const target = path[0] as HTMLElement | undefined
    if (target && target !== this.host && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
      return
    }
    if (this.host.option?.readOnly || !this.selectedCellRange) return
    const text = e.clipboardData?.getData('text/plain')
    if (text) {
      e.preventDefault()
      this.pasteTsvToCells(text)
    }
  }

  public handleRowCellEdit = (
    e: CustomEvent<{
      rowId: string
      columnId: string
      rawValue: any
      navigationDirection?: GridCellNavigationDirection
    }>,
  ): void => {
    if (this.host.option?.readOnly) return
    const { rowId, columnId, rawValue, navigationDirection } = e.detail
    const columns = this.effectiveGridColumns
    if (!columns) return
    const col = columns.find((c) => c.id === columnId)
    if (!col) return

    const rowIndex = this.host.rows.findIndex((r) => r.id === rowId)
    if (rowIndex === -1) return

    const isMonthMode = this.host.option.calendar.pxPerMonth !== undefined
    const isTimeMode = !!this.host.option.calendar.showTime
    const wbsCodes = computeRowWbsCodes(this.host.rows)
    const wbsCode = wbsCodes.get(rowId)

    const previousRows = this.host.rows
    const origRow = this.host.rows[rowIndex]
    const clonedRow: GanttRow = {
      ...origRow,
      tasks: (origRow.tasks ?? []).map((t) => ({
        ...t,
        start: t.start instanceof Date ? new Date(t.start.getTime()) : t.start,
        end: t.end instanceof Date ? new Date(t.end.getTime()) : t.end,
        dependencies: t.dependencies ? [...t.dependencies] : undefined,
      })),
    }
    const calendarOptions = {
      calendarMode: this.host.option.calendar?.calendarMode,
      isHoliday: this.host.option.calendar?.isHoliday,
      nonWorkingDays: this.host.option.calendar?.nonWorkingDays,
    }
    const editResult = applyGridCellEdit(
      col,
      clonedRow,
      rawValue,
      isMonthMode,
      isTimeMode,
      wbsCode,
      calendarOptions,
    )

    if (!editResult.changed) {
      if (navigationDirection) {
        this.navigateCellEdit(rowId, columnId, navigationDirection)
      }
      return
    }

    const origNormalTasks = (origRow.tasks ?? []).filter(
      (t) => t.type !== 'summary' && !(t as any).isSummary,
    )
    const origSingleTask = origNormalTasks.length === 1 ? origNormalTasks[0] : undefined

    const beforeDetail: BeforeCellEditHookDetail = {
      rowId,
      columnId,
      column: col,
      oldValue: editResult.oldValue,
      newValue: editResult.newValue,
      rawValue,
      row: origRow,
      task: origSingleTask,
    }

    const commitEdit = () => {
      let nextRows = [...this.host.rows]
      nextRows[rowIndex] = clonedRow

      const editedNormalTasks = (clonedRow.tasks ?? []).filter(
        (t) => t.type !== 'summary' && !(t as any).isSummary,
      )
      const editedSingleTask = editedNormalTasks.length === 1 ? editedNormalTasks[0] : undefined

      if (this.host.option.dependency?.autoSchedule && editedSingleTask) {
        const scheduleResult = propagateAutoSchedule(nextRows, [editedSingleTask.id], {
          mode: this.host.option.dependency.scheduleMode,
          respectMovable: this.host.option.dependency.respectMovable,
          calendarMode: this.host.option.calendar?.calendarMode,
          isHoliday: this.host.option.calendar?.isHoliday,
          nonWorkingDays: this.host.option.calendar?.nonWorkingDays,
        })
        if (scheduleResult.hasChanges) {
          nextRows = scheduleResult.rows
        }
      }

      this.host.applyRowsChangeWithCommand(previousRows, nextRows, {
        type: 'cell-edit',
        description: `${col.title ?? col.id} の編集`,
      })

      const updatedRow = this.host.rows.find((r) => r.id === rowId) ?? clonedRow
      const normalTasks = (updatedRow.tasks ?? []).filter(
        (t) => t.type !== 'summary' && !(t as any).isSummary,
      )
      const singleTask = normalTasks.length === 1 ? normalTasks[0] : undefined

      if (singleTask && singleTask.start && singleTask.end) {
        this.host.maybeAutoExtendCalendar(singleTask.start, singleTask.end, false)
      }

      const afterDetail: CellEditEventDetail = {
        rowId,
        columnId,
        column: col,
        oldValue: editResult.oldValue,
        newValue: editResult.newValue,
        row: updatedRow,
        previousRow: origRow,
        task: singleTask,
        rows: this.host.rows,
      }

      this.host.dispatchEvent(
        new CustomEvent<CellEditEventDetail>('cell-edit', {
          detail: afterDetail,
          bubbles: true,
          composed: true,
        }),
      )

      this.host.pluginManager.executeAfterCellEdit(afterDetail)

      if (navigationDirection) {
        this.navigateCellEdit(rowId, columnId, navigationDirection)
      }
    }

    this.host.pluginManager.runBeforeHook('beforeCellEdit', beforeDetail, commitEdit, () => {
      this.host.requestUpdate()
    })
  }

  public startCellEdit(rowId: string, columnId: string): boolean {
    if (this.host.option?.readOnly) return false
    const columns = this.effectiveGridColumns
    if (!columns) return false
    const col = columns.find((c) => c.id === columnId && c.visible !== false)
    if (!col) return false

    const targetRow = this.host.displayRows.find((r) => r.id === rowId)
    if (!targetRow) return false

    const rowsWithChildren = new Set<string>()
    for (const r of this.host.rows) {
      if (r.parentId) rowsWithChildren.add(r.parentId)
    }
    const gridEditable = this.host.option?.grid?.editable === true
    if (
      !isGridCellEditable(
        col,
        targetRow,
        targetRow.tasks,
        rowsWithChildren.has(rowId),
        gridEditable,
      )
    ) {
      return false
    }

    if (this.isGridCellSelectionEnabled) {
      this.selectGridCells({
        start: { rowId, columnId },
        end: { rowId, columnId },
      })
    }

    this.scrollGridCellIntoView(rowId, columnId)

    const rowElements = Array.from(
      this.host.shadowRoot?.querySelectorAll('gantt-row') ?? [],
    ) as Array<
      HTMLElement & {
        row?: GanttRow
        editingColumnId?: string | null
        commitCellEdit?: (val?: any) => boolean
        startCellEdit?: (colId: string) => boolean
      }
    >
    for (const el of rowElements) {
      if (el.row?.id !== rowId && el.editingColumnId) {
        el.commitCellEdit?.()
      }
    }

    const targetRowEl = rowElements.find((el) => el.row?.id === rowId)
    if (targetRowEl && typeof targetRowEl.startCellEdit === 'function') {
      const latestRow = this.host.displayRows.find((r) => r.id === rowId)
      if (latestRow && targetRowEl.row !== latestRow) {
        targetRowEl.row = latestRow
      }
      return targetRowEl.startCellEdit(columnId)
    }

    this.host.updateComplete.then(() => {
      const updatedRowElements = Array.from(
        this.host.shadowRoot?.querySelectorAll('gantt-row') ?? [],
      ) as Array<
        HTMLElement & {
          row?: GanttRow
          startCellEdit?: (colId: string) => boolean
        }
      >
      const updatedTargetRowEl = updatedRowElements.find((el) => el.row?.id === rowId)
      if (updatedTargetRowEl && typeof updatedTargetRowEl.startCellEdit === 'function') {
        updatedTargetRowEl.startCellEdit(columnId)
      }
    })
    return true
  }

  public navigateCellEdit(
    fromRowId: string,
    fromColumnId: string,
    direction: GridCellNavigationDirection,
  ): boolean {
    if (this.host.option?.readOnly) return false
    const columns = this.effectiveGridColumns
    if (!columns) return false
    const gridEditable = this.host.option?.grid?.editable === true

    const nextCell = findAdjacentEditableCell(
      this.host.displayRows,
      this.host.rows,
      columns,
      fromRowId,
      fromColumnId,
      direction,
      gridEditable,
    )
    if (!nextCell) return false

    return this.startCellEdit(nextCell.rowId, nextCell.columnId)
  }

  public scrollGridCellIntoView(rowId: string, columnId: string): void {
    const columns = this.effectiveGridColumns
    if (columns) {
      const visibleCols = columns.filter((c) => c.visible !== false)
      const { pinnedColumns, scrollableColumns, pinnedWidth, scrollableWidth } =
        partitionGridColumns(visibleCols)

      const isPinned = pinnedColumns.some((c) => c.id === columnId)
      if (!isPinned) {
        let colLeft = 0
        let colWidth = 0
        let found = false
        for (const c of scrollableColumns) {
          const w = c.width ?? 100
          if (c.id === columnId) {
            colWidth = w
            found = true
            break
          }
          colLeft += w
        }
        if (found) {
          const scrollableViewportWidth = Math.max(0, this.host.currentRowHeaderWidth - pinnedWidth)
          const maxGridScroll = Math.max(0, scrollableWidth - scrollableViewportWidth)
          let nextGridScroll = this.currentGridScrollLeft
          if (colLeft < nextGridScroll) {
            nextGridScroll = colLeft
          } else if (colLeft + colWidth > nextGridScroll + scrollableViewportWidth) {
            nextGridScroll = Math.max(0, colLeft + colWidth - scrollableViewportWidth)
          }
          nextGridScroll = Math.max(0, Math.min(maxGridScroll, nextGridScroll))
          if (nextGridScroll !== this.currentGridScrollLeft) {
            this.currentGridScrollLeft = nextGridScroll
            this.host.requestUpdate()
          }
        }
      }
    }

    const rowIndex = this.host.displayRows.findIndex((r) => r.id === rowId)
    if (rowIndex === -1) return

    const { layouts } = this.host.calculateLayout()
    const layout = layouts[rowIndex]
    if (!layout) return

    const container =
      this.host.getScrollContainer() ??
      (this.host.shadowRoot?.querySelector('.scroll-container') as HTMLElement | null)
    if (!container || container.clientHeight <= 0) return

    const visibleTop = container.scrollTop
    const visibleBottom =
      container.scrollTop + Math.max(0, container.clientHeight - this.host.calendarHeight)

    let nextTop: number | undefined
    if (layout.top < visibleTop) {
      nextTop = Math.max(0, layout.top)
    } else if (layout.top + layout.height > visibleBottom) {
      nextTop = Math.max(
        0,
        layout.top + layout.height - Math.max(0, container.clientHeight - this.host.calendarHeight),
      )
    }

    if (nextTop !== undefined && nextTop !== container.scrollTop) {
      container.scrollTop = nextTop
      this.host.currentScrollTop = nextTop
      this.host.virtualScrollTop = nextTop
      this.host.requestUpdate()
    }
  }

  public commitCellEdit(
    overrideValue?: any,
    navigationDirection?: GridCellNavigationDirection,
  ): boolean {
    const rowElements = Array.from(
      this.host.shadowRoot?.querySelectorAll('gantt-row') ?? [],
    ) as Array<
      HTMLElement & {
        editingColumnId?: string | null
        commitCellEdit?: (val?: any, navDir?: GridCellNavigationDirection) => boolean
      }
    >
    const editingRowEl = rowElements.find(
      (el) => el.editingColumnId !== null && el.editingColumnId !== undefined,
    )
    if (!editingRowEl || typeof editingRowEl.commitCellEdit !== 'function') {
      return false
    }
    return editingRowEl.commitCellEdit(overrideValue, navigationDirection)
  }

  public cancelCellEdit(): void {
    const rowElements = Array.from(
      this.host.shadowRoot?.querySelectorAll('gantt-row') ?? [],
    ) as Array<
      HTMLElement & {
        editingColumnId?: string | null
        cancelCellEdit?: () => void
      }
    >
    for (const el of rowElements) {
      if (el.editingColumnId && typeof el.cancelCellEdit === 'function') {
        el.cancelCellEdit()
      }
    }
  }
}

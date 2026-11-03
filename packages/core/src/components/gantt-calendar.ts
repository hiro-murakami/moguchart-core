import { LitElement, html, css, render } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import type {
  GanttChartOption,
  CalendarQuarterCellContext,
  CalendarMonthCellContext,
  CalendarDayCellContext,
  CalendarWeekCellContext,
  CalendarHourCellContext,
  GanttColumn,
  ColumnResizeEventDetail,
  ColumnReorderEventDetail,
} from '../core/types'
import { jaLocale } from '../core/i18n'
import { DEFAULT_ROW_HEADER_WIDTH } from '../core/constants'
import { createCustomHolidayResolver } from '../core/auto-schedule'
import { getCalendarColor, getThemeColors, getTotalDays, dateToX } from '../core/utils'
import { normalizeGridColumns, reorderGridColumns } from '../core/grid'
import dayjs from 'dayjs'

interface PositionedRange {
  left: number
  width: number
}

interface CachedMonthItem extends PositionedRange {
  year: number
  month: number
  count: number
  start: Date
  end: Date
}

interface CachedYearItem extends PositionedRange {
  year: number
  count: number
  start: Date
  end: Date
}

interface CachedQuarterItem extends PositionedRange {
  quarter: 1 | 2 | 3 | 4
  fiscalYear: number
  count: number
  start: Date
  end: Date
}

interface CachedWeekItem extends PositionedRange {
  weekNumber: number
  startDate: Date
  count: number
}

interface CachedDayItem extends PositionedRange {
  date: Date
  index: number
}

interface ShowTimeSeg extends PositionedRange {
  date: Date
  hStart: number
  hEnd: number
  segIndex: number
}

function slicePositionedRange<T extends PositionedRange>(
  items: T[],
  startX: number,
  endX: number,
  useVirtualX: boolean,
): { slice: T[]; offsetLeft: number } {
  if (items.length === 0) return { slice: [], offsetLeft: 0 }
  if (!useVirtualX || !Number.isFinite(endX)) {
    return { slice: items, offsetLeft: items[0].left }
  }

  let lo = 0
  let hi = items.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (items[mid].left + items[mid].width <= startX) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  const firstIdx = lo
  if (firstIdx >= items.length || items[firstIdx].left >= endX) {
    return { slice: [], offsetLeft: 0 }
  }

  lo = firstIdx
  hi = items.length - 1
  let lastIdx = firstIdx
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1
    if (items[mid].left < endX) {
      lastIdx = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }

  return {
    slice: items.slice(firstIdx, lastIdx + 1),
    offsetLeft: items[firstIdx].left,
  }
}

@customElement('gantt-calendar')
export class GanttCalendarElement extends LitElement {
  @property({ type: Object }) option!: GanttChartOption
  @property({ type: String })
  theme: 'light' | 'dark' = 'light'
  @property({ type: Object }) currentTime = new Date()
  @property({ type: Boolean }) isExporting = false
  @property({ type: String }) hoveredMilestoneId: string | null = null
  @property({ attribute: false }) cornerContent?: () => string | unknown
  @property({ attribute: false }) calendarQuarterContent?: (context: CalendarQuarterCellContext) => string | unknown
  @property({ attribute: false }) calendarMonthContent?: (context: CalendarMonthCellContext) => string | unknown
  @property({ attribute: false }) calendarDayContent?: (context: CalendarDayCellContext) => string | unknown
  @property({ attribute: false }) calendarWeekContent?: (context: CalendarWeekCellContext) => string | unknown
  @property({ attribute: false }) calendarHourContent?: (context: CalendarHourCellContext) => string | unknown
  @property({ type: Number }) gridScrollLeft = 0
  @property({ type: Array }) gridColumns?: GanttColumn[]
  @property({ type: Number }) visibleStartX = 0
  @property({ type: Number }) visibleEndX = Number.POSITIVE_INFINITY

  @state() private _draggingColumnId: string | null = null
  @state() private _dragOverColumnId: string | null = null
  @state() private _dragOverColumnPosition: 'left' | 'right' | null = null
  private _columnDragGhostEl: HTMLElement | null = null

  disconnectedCallback(): void {
    super.disconnectedCallback()
    this.removeColumnDragGhost()
  }

  private removeColumnDragGhost(): void {
    if (this._columnDragGhostEl) {
      if (this._columnDragGhostEl.parentNode) {
        this._columnDragGhostEl.parentNode.removeChild(this._columnDragGhostEl)
      }
      this._columnDragGhostEl = null
    }
  }

  private createColumnDragGhost(
    columnId: string,
    sourceCol: GanttColumn,
    startX: number,
    startY: number,
  ): { el: HTMLElement; offsetX: number; offsetY: number } {
    this.removeColumnDragGhost()
    const colors = getThemeColors(this.theme, this.option.customTheme)
    const headerCell = this.shadowRoot?.querySelector(
      `.grid-header-cell[data-column-id="${columnId}"]`,
    ) as HTMLElement | null
    const headerRect = headerCell?.getBoundingClientRect()
    const colWidth =
      (headerRect && headerRect.width > 0 ? headerRect.width : sourceCol.width) ?? 100
    const headerHeight = headerRect && headerRect.height > 0 ? headerRect.height : 28
    const offsetX =
      headerRect && headerRect.width > 0
        ? Math.max(0, Math.min(colWidth, startX - headerRect.left))
        : Math.min(20, colWidth / 2)
    const offsetY =
      headerRect && headerRect.height > 0
        ? Math.max(0, Math.min(headerHeight, startY - headerRect.top))
        : 14

    const ghost = document.createElement('div')
    ghost.className = 'moguchart-column-drag-ghost'
    ghost.style.position = 'fixed'
    ghost.style.top = '0px'
    ghost.style.left = '0px'
    ghost.style.width = `${colWidth}px`
    ghost.style.display = 'flex'
    ghost.style.flexDirection = 'column'
    ghost.style.pointerEvents = 'none'
    ghost.style.zIndex = '99999'
    ghost.style.opacity = '0.6'
    ghost.style.boxShadow =
      '0 8px 20px -4px rgba(0, 0, 0, 0.22), 0 4px 8px -2px rgba(0, 0, 0, 0.12)'
    ghost.style.border = '1.5px solid #3b82f6'
    ghost.style.borderRadius = '6px'
    ghost.style.overflow = 'hidden'
    ghost.style.background = colors.bg
    ghost.style.color = colors.text
    ghost.style.fontFamily = 'var(--moguchart-font-family, sans-serif)'

    const cellPadding = this.option.grid?.cellPadding ?? 6
    const justify =
      sourceCol.align === 'center'
        ? 'center'
        : sourceCol.align === 'right'
          ? 'flex-end'
          : 'flex-start'

    const ghostHeader = document.createElement('div')
    ghostHeader.className = 'moguchart-column-drag-ghost-header'
    ghostHeader.style.width = `${colWidth}px`
    ghostHeader.style.height = `${headerHeight}px`
    ghostHeader.style.boxSizing = 'border-box'
    ghostHeader.style.display = 'flex'
    ghostHeader.style.alignItems = 'center'
    ghostHeader.style.justifyContent = justify
    ghostHeader.style.padding = `0 ${cellPadding}px`
    ghostHeader.style.background =
      this.theme === 'dark' ? 'rgba(59, 130, 246, 0.24)' : 'rgba(59, 130, 246, 0.12)'
    ghostHeader.style.color = colors.text
    ghostHeader.style.fontSize = headerCell
      ? window.getComputedStyle(headerCell).fontSize || '12px'
      : '12px'
    ghostHeader.style.fontWeight = 'bold'
    ghostHeader.style.whiteSpace = 'nowrap'
    ghostHeader.style.overflow = 'hidden'
    ghostHeader.style.textOverflow = 'ellipsis'
    ghostHeader.style.borderBottom = `1px solid ${colors.border}`
    ghostHeader.textContent = sourceCol.title ?? sourceCol.id
    ghost.appendChild(ghostHeader)

    const root = this.getRootNode() as ShadowRoot | Document | null
    const rowEls = root ? (Array.from(root.querySelectorAll('gantt-row')) as HTMLElement[]) : []
    const maxPreviewRows = 8
    const previewRows = rowEls.slice(0, maxPreviewRows)

    previewRows.forEach((rowEl, idx) => {
      const cellEl = rowEl.shadowRoot?.querySelector(
        `.grid-cell[data-column-id="${columnId}"]`,
      ) as HTMLElement | null
      if (!cellEl) return
      const cellClone = cellEl.cloneNode(true) as HTMLElement
      const comp = window.getComputedStyle(cellEl)
      const rowHeight = rowEl.offsetHeight || parseFloat(comp.height) || 36
      cellClone.style.width = `${colWidth}px`
      cellClone.style.minWidth = `${colWidth}px`
      cellClone.style.maxWidth = `${colWidth}px`
      cellClone.style.height = `${rowHeight}px`
      cellClone.style.boxSizing = 'border-box'
      cellClone.style.display = 'flex'
      cellClone.style.alignItems = 'center'
      cellClone.style.justifyContent = justify
      cellClone.style.padding = comp.padding || `0 ${cellPadding}px`
      cellClone.style.background =
        comp.backgroundColor && comp.backgroundColor !== 'rgba(0, 0, 0, 0)'
          ? comp.backgroundColor
          : colors.bg
      cellClone.style.color = comp.color || colors.text
      cellClone.style.fontSize = comp.fontSize || '12px'
      cellClone.style.overflow = 'hidden'
      cellClone.style.whiteSpace = 'nowrap'
      cellClone.style.textOverflow = 'ellipsis'
      cellClone.style.borderRight = 'none'
      cellClone.style.borderBottom =
        idx < previewRows.length - 1 || rowEls.length > maxPreviewRows
          ? `1px solid ${colors.border}`
          : 'none'
      ghost.appendChild(cellClone)
    })

    if (rowEls.length > maxPreviewRows) {
      const moreBadge = document.createElement('div')
      moreBadge.className = 'moguchart-column-drag-ghost-more'
      moreBadge.style.padding = '3px 6px'
      moreBadge.style.background = colors.bg
      moreBadge.style.color = colors.text
      moreBadge.style.opacity = '0.7'
      moreBadge.style.fontSize = '11px'
      moreBadge.style.textAlign = 'center'
      moreBadge.textContent = `+ ${rowEls.length - maxPreviewRows} more`
      ghost.appendChild(moreBadge)
    }

    document.body.appendChild(ghost)
    this._columnDragGhostEl = ghost
    return { el: ghost, offsetX, offsetY }
  }

  /**
   * カスタムレンダリング関数の返却値をターゲット要素に注入するヘルパー
   * HTMLElement の場合は appendChild、文字列の場合は textContent、Lit TemplateResult の場合は render で設定する
   */
  private injectCustomContent(target: HTMLElement, content: unknown, className: string) {
    // 既存のカスタムコンテンツを削除（再レンダリング時の重複防止）
    const existing = target.querySelector(`.${className}`)
    if (existing) existing.remove()
    if (content instanceof HTMLElement) {
      content.classList.add(className)
      target.appendChild(content)
    } else if (typeof content === 'string') {
      const wrapper = document.createElement('span')
      wrapper.classList.add(className)
      // textContent で安全に挿入（innerHTML による XSS を防止）
      wrapper.textContent = content
      target.appendChild(wrapper)
    } else if (content !== null && content !== undefined && typeof content === 'object') {
      const wrapper = document.createElement('span')
      wrapper.classList.add(className)
      render(content, wrapper)
      target.appendChild(wrapper)
    }
  }

  private get isGridEnabled(): boolean {
    return (
      (this.option?.grid?.enabled === true ||
        (this.option?.grid?.columns !== undefined && this.option?.grid?.enabled !== false)) &&
      (!!this.gridColumns || !!this.option?.grid?.columns)
    )
  }

  protected updated() {
    // cornerContent が指定されている場合、corner-content-slot または label-placeholder に DOM 要素を注入する
    const placeholder = this.shadowRoot?.querySelector('.label-placeholder') as HTMLElement | null
    if (!placeholder) return
    // 既存の cornerContent 要素を削除（再レンダリング時の重複防止）
    const existing = placeholder.querySelector('.corner-content-root')
    if (existing) existing.remove()
    if (this.cornerContent) {
      const content = this.cornerContent()
      const targetSlot = (placeholder.querySelector('.corner-content-slot') as HTMLElement | null) ?? placeholder
      if (content instanceof HTMLElement) {
        content.classList.add('corner-content-root')
        targetSlot.appendChild(content)
      }
    }

    // カレンダーセルのカスタムレンダリング注入
    this.injectCalendarCustomContent()
  }

  /**
   * カラムヘッダー幅リサイズの開始ハンドラー
   */
  private handleColumnResizeStart(e: PointerEvent, columnId: string) {
    e.stopPropagation()
    e.preventDefault()
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)

    const isMonthMode = this.option.calendar.pxPerMonth !== undefined
    const isTimeMode = !!this.option.calendar.showTime
    const columns = normalizeGridColumns(
      this.gridColumns ?? this.option.grid?.columns,
      this.option.locale,
      isMonthMode,
      isTimeMode,
    )
    const targetCol = columns.find((c) => c.id === columnId)
    if (!targetCol) return

    const startX = e.clientX
    const startWidth = targetCol.width ?? 100
    const minWidth = targetCol.minWidth ?? 40
    const maxWidth = targetCol.maxWidth ?? 800

    const handleMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX
      const newWidth = Math.max(minWidth, Math.min(maxWidth, Math.round(startWidth + dx)))
      targetCol.width = newWidth
      this.dispatchEvent(
        new CustomEvent<ColumnResizeEventDetail>('column-resize', {
          detail: {
            columnId,
            width: newWidth,
            previousWidth: startWidth,
            isFinal: false,
            columns: [...columns],
          },
          bubbles: true,
          composed: true,
        }),
      )
    }

    const handleUp = () => {
      target.releasePointerCapture(e.pointerId)
      target.removeEventListener('pointermove', handleMove)
      target.removeEventListener('pointerup', handleUp)
      target.removeEventListener('pointercancel', handleUp)
      this.dispatchEvent(
        new CustomEvent<ColumnResizeEventDetail>('column-resize', {
          detail: {
            columnId,
            width: targetCol.width ?? startWidth,
            previousWidth: startWidth,
            isFinal: true,
            columns: [...columns],
          },
          bubbles: true,
          composed: true,
        }),
      )
    }

    target.addEventListener('pointermove', handleMove)
    target.addEventListener('pointerup', handleUp)
    target.addEventListener('pointercancel', handleUp)
  }

  /**
   * カラムヘッダードラッグによる列入れ替えの開始ハンドラー
   */
  private handleColumnDragStart(e: PointerEvent, columnId: string) {
    if (e.button !== undefined && e.button !== 0) return
    const eventTarget = e.target as HTMLElement | null
    if (eventTarget?.closest?.('.column-resizer')) return
    if (this.option?.grid?.reorderable === false) return

    const isMonthMode = this.option.calendar.pxPerMonth !== undefined
    const isTimeMode = !!this.option.calendar.showTime
    const columns = normalizeGridColumns(
      this.gridColumns ?? this.option.grid?.columns,
      this.option.locale,
      isMonthMode,
      isTimeMode,
    )
    const visibleColumns = columns.filter((c) => c.visible !== false)
    if (visibleColumns.length < 2) return

    const sourceCol = visibleColumns.find((c) => c.id === columnId)
    if (!sourceCol || sourceCol.reorderable === false) return

    const startX = e.clientX
    const startY = e.clientY ?? 0
    let isDragging = false
    let ghostInfo: { el: HTMLElement; offsetX: number; offsetY: number } | null = null

    const resolveDropTarget = (
      clientX: number,
    ): { targetColumnId: string; position: 'left' | 'right' } | null => {
      const cellEls = Array.from(
        this.shadowRoot?.querySelectorAll('.grid-header-cell') ?? [],
      ) as HTMLElement[]
      const rects = cellEls.map((el) => el.getBoundingClientRect())
      const hasLayoutRects = rects.some((r) => r.width > 0)

      let accLeft = 0
      const bounds = visibleColumns.map((col, idx) => {
        const w = col.width ?? 100
        if (hasLayoutRects && rects[idx] && rects[idx].width > 0) {
          return {
            id: col.id,
            left: rects[idx].left,
            right: rects[idx].right,
            width: rects[idx].width,
            reorderable: col.reorderable !== false,
          }
        }
        const item = {
          id: col.id,
          left: accLeft,
          right: accLeft + w,
          width: w,
          reorderable: col.reorderable !== false,
        }
        accLeft += w
        return item
      })

      if (bounds.length === 0) return null

      let targetBound = bounds[0]
      let position: 'left' | 'right' = 'left'

      if (clientX <= bounds[0].left) {
        targetBound = bounds[0]
        position = 'left'
      } else if (clientX >= bounds[bounds.length - 1].right) {
        targetBound = bounds[bounds.length - 1]
        position = 'right'
      } else {
        for (const b of bounds) {
          if (clientX >= b.left && clientX <= b.right) {
            targetBound = b
            position = clientX < b.left + b.width / 2 ? 'left' : 'right'
            break
          }
        }
      }

      if (!targetBound.reorderable) return null

      const sourceVisIdx = visibleColumns.findIndex((c) => c.id === columnId)
      const targetVisIdx = visibleColumns.findIndex((c) => c.id === targetBound.id)
      if (targetBound.id === columnId) return null
      if (position === 'right' && targetVisIdx === sourceVisIdx - 1) return null
      if (position === 'left' && targetVisIdx === sourceVisIdx + 1) return null

      return { targetColumnId: targetBound.id, position }
    }

    const handleMove = (ev: PointerEvent) => {
      if (!isDragging) {
        if (Math.abs(ev.clientX - startX) < 4) return
        isDragging = true
        this._draggingColumnId = columnId
        ghostInfo = this.createColumnDragGhost(columnId, sourceCol, startX, startY)
      }
      ev.preventDefault()
      if (ghostInfo) {
        const gx = Math.round(ev.clientX - ghostInfo.offsetX)
        const gy = Math.round((ev.clientY ?? startY) - ghostInfo.offsetY)
        ghostInfo.el.style.transform = `translate3d(${gx}px, ${gy}px, 0)`
      }
      const dropTarget = resolveDropTarget(ev.clientX)
      const nextTargetId = dropTarget?.targetColumnId ?? null
      const nextPos = dropTarget?.position ?? null
      if (this._dragOverColumnId !== nextTargetId || this._dragOverColumnPosition !== nextPos) {
        this._dragOverColumnId = nextTargetId
        this._dragOverColumnPosition = nextPos
        this.dispatchEvent(
          new CustomEvent<{ columnId: string | null; position: 'left' | 'right' | null }>(
            'column-drag-over',
            {
              detail: { columnId: nextTargetId, position: nextPos },
              bubbles: true,
              composed: true,
            },
          ),
        )
      }
    }

    const cleanup = () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleCancel)
      window.removeEventListener('keydown', handleKeyDown, true)
      this.removeColumnDragGhost()
      ghostInfo = null

      const hadDragState =
        this._draggingColumnId !== null ||
        this._dragOverColumnId !== null ||
        this._dragOverColumnPosition !== null
      this._draggingColumnId = null
      this._dragOverColumnId = null
      this._dragOverColumnPosition = null
      if (hadDragState) {
        this.dispatchEvent(
          new CustomEvent<{ columnId: string | null; position: 'left' | 'right' | null }>(
            'column-drag-over',
            {
              detail: { columnId: null, position: null },
              bubbles: true,
              composed: true,
            },
          ),
        )
      }
    }

    const handleKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        ev.preventDefault()
        ev.stopPropagation()
        cleanup()
      }
    }

    const handleCancel = () => {
      cleanup()
    }

    const handleUp = (ev: PointerEvent) => {
      const wasDragging = isDragging
      const finalTarget = wasDragging
        ? (resolveDropTarget(ev.clientX) ??
          (this._dragOverColumnId && this._dragOverColumnPosition
            ? { targetColumnId: this._dragOverColumnId, position: this._dragOverColumnPosition }
            : null))
        : null

      cleanup()

      if (!wasDragging || !finalTarget) return

      const reordered = reorderGridColumns(
        columns,
        columnId,
        finalTarget.targetColumnId,
        finalTarget.position,
      )
      const changed = reordered.some((c, i) => c.id !== columns[i]?.id)
      if (!changed) return

      this.dispatchEvent(
        new CustomEvent<ColumnReorderEventDetail>('column-reorder', {
          detail: {
            columnId,
            targetColumnId: finalTarget.targetColumnId,
            position: finalTarget.position,
            columns: reordered,
            columnIds: reordered.map((c) => c.id),
          },
          bubbles: true,
          composed: true,
        }),
      )
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleCancel)
    window.addEventListener('keydown', handleKeyDown, true)
  }

  /**
   * マルチカラムグリッドのヘッダーを描画する
   */
  private renderGridHeaders(colors: ReturnType<typeof getThemeColors>) {
    if (!this.isGridEnabled) return ''

    const isMonthMode = this.option.calendar.pxPerMonth !== undefined
    const isTimeMode = !!this.option.calendar.showTime
    const columns = normalizeGridColumns(
      this.gridColumns ?? this.option.grid?.columns,
      this.option.locale,
      isMonthMode,
      isTimeMode,
    )
    const visibleColumns = columns.filter((c) => c.visible !== false)
    const totalWidth = visibleColumns.reduce((sum, c) => sum + (c.width ?? 100), 0)
    const hasCornerTop = Boolean(this.cornerContent)
    const gridReorderable = this.option.grid?.reorderable !== false && visibleColumns.length >= 2

    return html`
      <div
        class="grid-header-container"
        style="
          display: flex;
          ${hasCornerTop ? 'flex: 1; min-height: 22px;' : 'height: 100%;'}
          width: ${totalWidth}px;
          min-width: 100%;
          transform: translateX(-${this.gridScrollLeft}px);
          box-sizing: border-box;
        "
      >
        ${visibleColumns.map((col) => {
          const isReorderable = gridReorderable && col.reorderable !== false
          const isDragging = this._draggingColumnId === col.id
          const isDropLeft =
            this._dragOverColumnId === col.id && this._dragOverColumnPosition === 'left'
          const isDropRight =
            this._dragOverColumnId === col.id && this._dragOverColumnPosition === 'right'
          return html`
            <div
              class="grid-header-cell grid-header-cell-${col.id} ${isReorderable ? 'is-reorderable' : ''} ${isDragging ? 'is-dragging' : ''} ${isDropLeft ? 'drop-target-left' : ''} ${isDropRight ? 'drop-target-right' : ''}"
              data-column-id="${col.id}"
              style="
                width: ${col.width}px;
                min-width: ${col.minWidth ?? 40}px;
                max-width: ${col.maxWidth ? `${col.maxWidth}px` : 'none'};
                box-sizing: border-box;
                display: flex;
                align-items: center;
                justify-content: ${col.align === 'center' ? 'center' : col.align === 'right' ? 'flex-end' : 'flex-start'};
                padding: 0 ${this.option.grid?.cellPadding ?? 6}px;
                ${this.option.grid?.showBorders !== false ? `border-right: 1px solid ${colors.border};` : ''}
                position: relative;
                user-select: none;
                overflow: hidden;
                white-space: nowrap;
                text-overflow: ellipsis;
                font-size: calc(12px * var(--moguchart-font-scale, 1));
                font-weight: bold;
                flex-shrink: 0;
              "
              @pointerdown="${(e: PointerEvent) => this.handleColumnDragStart(e, col.id)}"
            >
              <span class="grid-header-title" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                ${col.title}
              </span>
              ${col.resizable !== false
                ? html`
                    <div
                      class="column-resizer"
                      @pointerdown="${(e: PointerEvent) => this.handleColumnResizeStart(e, col.id)}"
                    ></div>
                  `
                : ''}
            </div>
          `
        })}
      </div>
    `
  }

  /**
   * カレンダーセルのカスタムレンダリングコンテンツを注入する
   */
  private injectCalendarCustomContent() {
    if (this.calendarQuarterContent) {
      const cells = this.shadowRoot?.querySelectorAll('[data-calendar-quarter]')
      cells?.forEach((cell) => {
        const el = cell as HTMLElement
        const quarter = (parseInt(el.dataset.calendarQuarter ?? '1', 10) || 1) as 1 | 2 | 3 | 4
        const fiscalYear = parseInt(el.dataset.calendarQuarterFiscalYear ?? '0', 10)
        const startDate = new Date(el.dataset.calendarQuarterStart ?? '')
        const width = parseFloat(el.dataset.calendarQuarterWidth ?? '0')
        const defaultLabel = el.dataset.calendarQuarterLabel ?? ''
        const context: CalendarQuarterCellContext = { quarter, fiscalYear, startDate, width, defaultLabel }
        const content = this.calendarQuarterContent!(context)
        this.injectCustomContent(el, content, 'custom-quarter-content')
      })
    }

    if (this.calendarMonthContent) {
      const cells = this.shadowRoot?.querySelectorAll('[data-calendar-month]')
      cells?.forEach((cell) => {
        const el = cell as HTMLElement
        const year = parseInt(el.dataset.calendarMonthYear ?? '0', 10)
        const month = parseInt(el.dataset.calendarMonth ?? '0', 10)
        const width = parseFloat(el.dataset.calendarMonthWidth ?? '0')
        const defaultLabel = el.dataset.calendarMonthLabel ?? ''
        const context: CalendarMonthCellContext = { year, month, width, defaultLabel }
        const content = this.calendarMonthContent!(context)
        this.injectCustomContent(el, content, 'custom-month-content')
      })
    }

    if (this.calendarDayContent) {
      const cells = this.shadowRoot?.querySelectorAll('[data-calendar-day]')
      cells?.forEach((cell) => {
        const el = cell as HTMLElement
        const dateStr = el.dataset.calendarDay ?? ''
        const date = new Date(dateStr)
        const width = parseFloat(el.dataset.calendarDayWidth ?? '0')
        const isSaturday = el.dataset.calendarDaySaturday === 'true'
        const isSunday = el.dataset.calendarDaySunday === 'true'
        const isHoliday = el.dataset.calendarDayHoliday === 'true'
        const defaultLabel = el.dataset.calendarDayLabel ?? ''
        const context: CalendarDayCellContext = { date, width, isSaturday, isSunday, isHoliday, defaultLabel }
        const content = this.calendarDayContent!(context)
        this.injectCustomContent(el, content, 'custom-day-content')
      })
    }

    if (this.calendarWeekContent) {
      const cells = this.shadowRoot?.querySelectorAll('[data-calendar-week]')
      cells?.forEach((cell) => {
        const el = cell as HTMLElement
        const weekNumber = parseInt(el.dataset.calendarWeek ?? '0', 10)
        const startDateStr = el.dataset.calendarWeekStart ?? ''
        const startDate = new Date(startDateStr)
        const width = parseFloat(el.dataset.calendarWeekWidth ?? '0')
        const defaultLabel = el.dataset.calendarWeekLabel ?? ''
        const context: CalendarWeekCellContext = { weekNumber, startDate, width, defaultLabel }
        const content = this.calendarWeekContent!(context)
        this.injectCustomContent(el, content, 'custom-week-content')
      })
    }

    if (this.calendarHourContent) {
      const cells = this.shadowRoot?.querySelectorAll('[data-calendar-hour]')
      cells?.forEach((cell) => {
        const el = cell as HTMLElement
        const hour = parseInt(el.dataset.calendarHour ?? '0', 10)
        const width = parseFloat(el.dataset.calendarHourWidth ?? '0')
        const dateStr = el.dataset.calendarHourDate ?? ''
        const date = new Date(dateStr)
        const context: CalendarHourCellContext = { hour, width, date }
        const content = this.calendarHourContent!(context)
        this.injectCustomContent(el, content, 'custom-hour-content')
      })
    }
  }

  // days/months/years/quarters/weeks のキャッシュ
  private _cachedDays: Date[] | null = null
  private _cachedDayItems: CachedDayItem[] | null = null
  private _cachedMonths: CachedMonthItem[] | null = null
  private _cachedYears: CachedYearItem[] | null = null
  private _cachedQuarters: CachedQuarterItem[] | null = null
  private _cachedWeeks: CachedWeekItem[] | null = null
  private _cachedStartTime = 0
  private _cachedEndTime = 0
  private _cachedPxPerDay = 0
  private _cachedPxPerMonth: number | undefined = undefined
  private _cachedWeekStartDay: number = -1
  private _cachedQuarterStartMonth: number = -1

  private get totalDays() {
    return getTotalDays(this.option.calendar.start, this.option.calendar.end)
  }

  static styles = css`
    :host {
      display: flex;
      width: fit-content;
      min-width: 100%;
      box-sizing: border-box;
      position: sticky;
      top: 0;
      z-index: 500;
    }
    .label-placeholder {
      flex-shrink: 0;
      box-sizing: border-box;
      position: sticky;
      left: 0;
      z-index: 100;
      background: inherit;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding-right: 4px;
      overflow: hidden;
    }
    .column-resizer {
      position: absolute;
      top: 0;
      right: 0;
      width: 6px;
      height: 100%;
      cursor: col-resize;
      z-index: 10;
      touch-action: none;
    }
    .column-resizer::before {
      content: '';
      position: absolute;
      top: 0;
      bottom: 0;
      left: -6px;
      right: -4px;
    }
    .column-resizer:hover,
    .column-resizer:active {
      background-color: #3b82f6;
    }
    .grid-header-cell.is-reorderable {
      cursor: grab;
    }
    .grid-header-cell.is-reorderable:active {
      cursor: grabbing;
    }
    .grid-header-cell.is-dragging {
      opacity: 0.45;
      background-color: rgba(59, 130, 246, 0.12);
      cursor: grabbing;
    }
    .grid-header-cell.drop-target-left::after,
    .grid-header-cell.drop-target-right::after {
      content: '';
      position: absolute;
      top: 0;
      bottom: 0;
      width: 3px;
      background-color: #3b82f6;
      z-index: 20;
      pointer-events: none;
    }
    .grid-header-cell.drop-target-left::after {
      left: 0;
    }
    .grid-header-cell.drop-target-right::after {
      right: 0;
    }
    .calendar-group {
      display: flex;
      flex-direction: column;
      position: relative;
      z-index: 70;
    }
    .quarters-container {
      display: flex;
    }
    .quarter-cell {
      box-sizing: border-box;
      padding: 3px 6px;
      font-size: calc(11px * var(--moguchart-font-scale, 1));
      font-weight: 700;
      flex-shrink: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .months-container {
      display: flex;
    }
    .month-cell {
      box-sizing: border-box;
      padding: 4px 8px;
      font-size: calc(12px * var(--moguchart-font-scale, 1));
      font-weight: bold;
      flex-shrink: 0;
      white-space: nowrap;
      overflow: hidden;
    }
    .weeks-container {
      display: flex;
    }
    .week-cell {
      box-sizing: border-box;
      padding: 4px 0;
      font-size: calc(10px * var(--moguchart-font-scale, 1));
      font-weight: bold;
      text-align: center;
      flex-shrink: 0;
      white-space: nowrap;
      overflow: hidden;
    }
    .days-container {
      display: flex;
    }
    .day-cell {
      text-align: center;
      font-size: calc(10px * var(--moguchart-font-scale, 1));
      padding: 6px 0;
      flex-shrink: 0;
      box-sizing: border-box;
      word-break: break-all;
      line-height: 1.1;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .hours-container {
      display: flex;
    }
    .hour-cell {
      text-align: center;
      font-size: calc(10px * var(--moguchart-font-scale, 1));
      padding: 2px 0;
      flex-shrink: 0;
      box-sizing: border-box;
      overflow: hidden;
    }
    .current-time-badge {
      position: absolute;
      bottom: 0;
      transform: translateX(-50%);
      padding: 2px 4px;
      border-radius: 4px;
      font-size: calc(10px * var(--moguchart-font-scale, 1));
      font-weight: bold;
      white-space: nowrap;
      z-index: 10;
      pointer-events: none;
    }
    .milestone-badge {
      position: absolute;
      top: 0;
      transform: translateX(-50%);
      padding: 2px 4px;
      border-radius: 4px;
      font-size: calc(10px * var(--moguchart-font-scale, 1));
      font-weight: bold;
      white-space: nowrap;
      z-index: 9;
      pointer-events: auto;
      color: #ffffff;
      transition: opacity 0.2s ease;
      cursor: default;
    }
    .milestone-badge.milestone-hovered {
      z-index: 200;
    }
    .milestone-connector {
      position: absolute;
      top: 19px;
      bottom: 0px;
      transform: translateX(-50%);
      z-index: 8;
      pointer-events: auto;
      transition: opacity 0.2s ease;
      cursor: default;
    }
    .milestone-connector.milestone-hovered {
      z-index: 199;
    }
  `

  private getDateX(date: Date) {
    return dateToX(date, this.option.calendar.start, this.option.calendar.pxPerDay, this.option.calendar.pxPerMonth)
  }

  private formatTime(date: Date) {
    const h = date.getHours().toString().padStart(2, '0')
    const m = date.getMinutes().toString().padStart(2, '0')
    return `${h}:${m}`
  }

  private _buildDayItems(days: Date[]): CachedDayItem[] {
    const pxPerDay = this.option.calendar.pxPerDay
    const total = this.totalDays
    let accLeft = 0
    return days.map((day, index) => {
      let width = pxPerDay
      if (index + 1 > total) {
        width = (total - index) * pxPerDay
      }
      const item: CachedDayItem = {
        date: day,
        index,
        left: accLeft,
        width,
      }
      accLeft += width
      return item
    })
  }

  private _buildWeeks(days: Date[], weekStartDay: number): CachedWeekItem[] {
    const getWeekNumber = (date: Date): number => {
      const d = new Date(date.getTime())
      d.setHours(0, 0, 0, 0)
      const dayOfWeek = d.getDay()
      const daysSinceWeekStart = (dayOfWeek - weekStartDay + 7) % 7
      const weekStart = new Date(d.getTime())
      weekStart.setDate(weekStart.getDate() - daysSinceWeekStart)
      const yearStart = new Date(weekStart.getFullYear(), 0, 1)
      const dayOfYear = Math.floor((weekStart.getTime() - yearStart.getTime()) / 86400000)
      return Math.floor(dayOfYear / 7) + 1
    }
    const rawWeeks: { weekNumber: number; startDate: Date; count: number }[] = []
    days.forEach((day) => {
      const dayOfWeek = day.getDay()
      const isWeekStart = dayOfWeek === weekStartDay
      const last = rawWeeks[rawWeeks.length - 1]
      if (last && !isWeekStart) {
        last.count++
      } else {
        rawWeeks.push({ weekNumber: getWeekNumber(day), startDate: new Date(day), count: 1 })
      }
    })
    return this._applyWeekPositions(rawWeeks)
  }

  private _applyWeekPositions(
    rawWeeks: { weekNumber: number; startDate: Date; count: number }[],
  ): CachedWeekItem[] {
    const pxPerDay = this.option.calendar.pxPerDay
    let accLeft = 0
    return rawWeeks.map((w) => {
      const width = w.count * pxPerDay
      const item: CachedWeekItem = {
        weekNumber: w.weekNumber,
        startDate: w.startDate,
        count: w.count,
        left: accLeft,
        width,
      }
      accLeft += width
      return item
    })
  }

  private _buildQuarters(days: Date[], quarterStartMonth: number): CachedQuarterItem[] {
    const startMonth0 = ((quarterStartMonth - 1) % 12 + 12) % 12
    const quarters: CachedQuarterItem[] = []

    days.forEach((day) => {
      const m0 = day.getMonth()
      const y = day.getFullYear()
      const offsetMonths = (m0 - startMonth0 + 12) % 12
      const quarter = (Math.floor(offsetMonths / 3) + 1) as 1 | 2 | 3 | 4
      const fiscalYear = m0 < startMonth0 ? y - 1 : y

      const last = quarters[quarters.length - 1]
      if (last && last.fiscalYear === fiscalYear && last.quarter === quarter) {
        last.count++
        const end = new Date(day)
        end.setDate(end.getDate() + 1)
        last.end = end
      } else {
        const start = new Date(day)
        start.setHours(0, 0, 0, 0)
        const end = new Date(day)
        end.setDate(end.getDate() + 1)
        quarters.push({
          quarter,
          fiscalYear,
          count: 1,
          start,
          end,
          left: 0,
          width: 0,
        })
      }
    })

    quarters.forEach((q) => {
      const left = Math.max(0, this.getDateX(q.start))
      const right = this.getDateX(q.end)
      q.left = left
      q.width = Math.max(0, right - left)
    })

    return quarters
  }

  private _renderQuartersRow(
    quarters: CachedQuarterItem[],
    colors: ReturnType<typeof getThemeColors>,
    useVirtualX: boolean,
  ) {
    if (!this.option.calendar.showQuarters) return ''
    const { slice, offsetLeft } = slicePositionedRange(quarters, this.visibleStartX, this.visibleEndX, useVirtualX)
    const quarterFormat = this.option.calendar.quarterFormat
    const quarterTextAlign = this.option.calendar.quarterTextAlign ?? 'center'
    const quarterStartMonth = this.option.calendar.quarterStartMonth ?? 1
    const showYearInLabel = !this.option.calendar.showMonthsRow || quarterStartMonth !== 1

    return html`
      <div
        class="quarters-container"
        style="background: ${colors.bg}; border-bottom: 1px solid ${colors.border}; position: relative; z-index: 2;"
      >
        ${offsetLeft > 0 ? html`<div style="width: ${offsetLeft}px; flex-shrink: 0;"></div>` : ''}
        ${slice.map((q) => {
          const defaultLabel = quarterFormat
            ? quarterFormat(q.quarter, q.fiscalYear, q.start)
            : showYearInLabel
              ? quarterStartMonth !== 1
                ? `FY${q.fiscalYear} Q${q.quarter}`
                : `${q.fiscalYear} Q${q.quarter}`
              : `Q${q.quarter}`
          return html`<div
            class="quarter-cell"
            style="width: ${q.width}px; border-right: 1px solid ${colors.monthGridLine ||
            colors.border}; text-align: ${quarterTextAlign};"
            data-calendar-quarter="${q.quarter}"
            data-calendar-quarter-fiscal-year="${q.fiscalYear}"
            data-calendar-quarter-start="${q.start.toISOString()}"
            data-calendar-quarter-width="${q.width}"
            data-calendar-quarter-label="${defaultLabel}"
          >
            ${this.calendarQuarterContent ? '' : defaultLabel}
          </div>`
        })}
      </div>
    `
  }

  render() {
    const colors = getThemeColors(this.theme, this.option.customTheme)

    // start/end が変わった時だけ days/months/years/quarters を再計算する
    const startTime = this.option.calendar.start.getTime()
    const endTime = this.option.calendar.end.getTime()
    const pxPerDay = this.option.calendar.pxPerDay
    const pxPerMonth = this.option.calendar.pxPerMonth
    const weekStartDay = this.option.calendar.weekStartDay ?? 1
    const quarterStartMonth = this.option.calendar.quarterStartMonth ?? 1
    const needsRebuild = !this._cachedDays || startTime !== this._cachedStartTime || endTime !== this._cachedEndTime
    const needsWidthRecalc = pxPerDay !== this._cachedPxPerDay || pxPerMonth !== this._cachedPxPerMonth

    if (needsRebuild) {
      this._cachedStartTime = startTime
      this._cachedEndTime = endTime
      this._cachedPxPerDay = pxPerDay
      this._cachedPxPerMonth = pxPerMonth

      const days = Array.from({ length: Math.ceil(this.totalDays) }, (_, i) => {
        const d = new Date(this.option.calendar.start)
        d.setDate(d.getDate() + i)
        return d
      })
      this._cachedDays = days
      this._cachedDayItems = this._buildDayItems(days)

      const months: CachedMonthItem[] = []
      days.forEach((day) => {
        const year = day.getFullYear()
        const month = day.getMonth()
        const last = months[months.length - 1]
        if (last && last.year === year && last.month === month) {
          last.count++
          const end = new Date(day)
          end.setDate(end.getDate() + 1)
          last.end = end
        } else {
          const start = new Date(day)
          start.setHours(0, 0, 0, 0)
          const end = new Date(day)
          end.setDate(end.getDate() + 1)
          months.push({ year, month, count: 1, start, end, left: 0, width: 0 })
        }
      })
      months.forEach((m) => {
        const left = Math.max(0, this.getDateX(m.start))
        const right = this.getDateX(m.end)
        m.left = left
        m.width = Math.max(0, right - left)
      })
      this._cachedMonths = months

      // years（showMonthsRow 用）
      const years: CachedYearItem[] = []
      days.forEach((day) => {
        const year = day.getFullYear()
        const last = years[years.length - 1]
        if (last && last.year === year) {
          last.count++
          const end = new Date(day)
          end.setDate(end.getDate() + 1)
          last.end = end
        } else {
          const start = new Date(day)
          start.setHours(0, 0, 0, 0)
          const end = new Date(day)
          end.setDate(end.getDate() + 1)
          years.push({ year, count: 1, start, end, left: 0, width: 0 })
        }
      })
      years.forEach((y) => {
        const left = Math.max(0, this.getDateX(y.start))
        const right = this.getDateX(y.end)
        y.left = left
        y.width = Math.max(0, right - left)
      })
      this._cachedYears = years

      this._cachedQuarterStartMonth = quarterStartMonth
      this._cachedQuarters = this._buildQuarters(days, quarterStartMonth)

      // weeks（showWeeks 用）
      this._cachedWeekStartDay = weekStartDay
      this._cachedWeeks = this._buildWeeks(days, weekStartDay)
    } else if (needsWidthRecalc) {
      this._cachedPxPerDay = pxPerDay
      this._cachedPxPerMonth = pxPerMonth
      this._cachedDayItems = this._buildDayItems(this._cachedDays!)
      this._cachedMonths!.forEach((m) => {
        const left = Math.max(0, this.getDateX(m.start))
        const right = this.getDateX(m.end)
        m.left = left
        m.width = Math.max(0, right - left)
      })
      this._cachedYears!.forEach((y) => {
        const left = Math.max(0, this.getDateX(y.start))
        const right = this.getDateX(y.end)
        y.left = left
        y.width = Math.max(0, right - left)
      })
      if (quarterStartMonth !== this._cachedQuarterStartMonth) {
        this._cachedQuarterStartMonth = quarterStartMonth
        this._cachedQuarters = this._buildQuarters(this._cachedDays!, quarterStartMonth)
      } else {
        this._cachedQuarters!.forEach((q) => {
          const left = Math.max(0, this.getDateX(q.start))
          const right = this.getDateX(q.end)
          q.left = left
          q.width = Math.max(0, right - left)
        })
      }
      if (weekStartDay !== this._cachedWeekStartDay) {
        this._cachedWeekStartDay = weekStartDay
        this._cachedWeeks = this._buildWeeks(this._cachedDays!, weekStartDay)
      } else {
        this._cachedWeeks = this._applyWeekPositions(this._cachedWeeks!)
      }
    } else {
      if (weekStartDay !== this._cachedWeekStartDay) {
        this._cachedWeekStartDay = weekStartDay
        this._cachedWeeks = this._buildWeeks(this._cachedDays!, weekStartDay)
      }
      if (quarterStartMonth !== this._cachedQuarterStartMonth) {
        this._cachedQuarterStartMonth = quarterStartMonth
        this._cachedQuarters = this._buildQuarters(this._cachedDays!, quarterStartMonth)
      }
    }

    const dayItems = this._cachedDayItems!
    const months = this._cachedMonths!
    const years = this._cachedYears!
    const quarters = this._cachedQuarters!

    const useVirtualX =
      !this.isExporting &&
      this.option.calendar.virtualScrollX !== false &&
      Number.isFinite(this.visibleEndX)

    const backgroundStyle = `
      background-image: linear-gradient(90deg, transparent ${this.option.calendar.pxPerDay - 1}px, ${colors.border} ${this.option.calendar.pxPerDay - 1}px);
      background-size: ${this.option.calendar.pxPerDay}px 100%;
    `

    const hourWidth = this.option.calendar.pxPerDay / 24
    const dayWidth = this.option.calendar.pxPerDay
    const dayLineColor = this.option.customTheme?.showTimeDateLine ?? colors.monthGridLine ?? colors.border
    // 開始時刻が0時でない場合、背景グリッドをオフセットする
    const startDate = this.option.calendar.start
    const startOffsetMs =
      startDate.getHours() * 60 * 60 * 1000 + startDate.getMinutes() * 60 * 1000 + startDate.getSeconds() * 1000
    const startOffsetPx = (startOffsetMs / (24 * 60 * 60 * 1000)) * dayWidth
    const hourOffsetPx = startOffsetPx % hourWidth
    const dayBgPos = startOffsetPx === 0 ? '0px 0' : `${-startOffsetPx}px 0`
    const hourBgPos = hourOffsetPx === 0 ? '0px 0' : `${-hourOffsetPx}px 0`
    const hourBackgroundStyle = `
      background-image: linear-gradient(90deg, transparent ${dayWidth - 1}px, ${dayLineColor} ${dayWidth - 1}px), linear-gradient(90deg, transparent ${hourWidth - 1}px, ${colors.border} ${hourWidth - 1}px);
      background-size: ${dayWidth}px 100%, ${hourWidth}px 100%;
      background-position: ${dayBgPos}, ${hourBgPos};
    `
    // showTime モード: 深夜0時を日付境界とする日ごとのセグメントを生成
    const showTimeDays: ShowTimeSeg[] = []
    if (this.option.calendar.showTime) {
      const calStart = this.option.calendar.start
      const calEnd = this.option.calendar.end
      let cur = new Date(calStart)
      cur.setHours(0, 0, 0, 0)
      let accShowTimeLeft = 0
      let segIdx = 0
      while (cur.getTime() < calEnd.getTime()) {
        const segStart = cur.getTime() < calStart.getTime() ? calStart : cur
        const nextDay = new Date(cur)
        nextDay.setDate(nextDay.getDate() + 1)
        const segEnd = nextDay.getTime() > calEnd.getTime() ? calEnd : nextDay
        const hStart = segStart.getHours()
        const hEndRaw = segEnd.getHours()
        const hasFraction = segEnd.getMinutes() > 0 || segEnd.getSeconds() > 0 || segEnd.getMilliseconds() > 0
        const hEnd = hEndRaw === 0 && !hasFraction ? 24 : hasFraction ? hEndRaw + 1 : hEndRaw
        const durationHours = (segEnd.getTime() - segStart.getTime()) / (1000 * 60 * 60)
        const widthPx = durationHours * hourWidth
        showTimeDays.push({
          date: new Date(cur),
          hStart,
          hEnd,
          left: accShowTimeLeft,
          width: widthPx,
          segIndex: segIdx++,
        })
        accShowTimeLeft += widthPx
        cur = new Date(nextDay)
      }
    }

    const visibleShowTime = this.option.calendar.showTime
      ? slicePositionedRange(showTimeDays, this.visibleStartX, this.visibleEndX, useVirtualX)
      : { slice: [] as ShowTimeSeg[], offsetLeft: 0 }

    // 月単位モード（pxPerMonth 設定時）では、最後の月セルの終端（翌月1日の位置）を totalWidth とする
    const lastMonth = months[months.length - 1]
    const totalWidth =
      this.option.calendar.pxPerMonth !== undefined && lastMonth?.end
        ? this.getDateX(lastMonth.end)
        : this.getDateX(this.option.calendar.end)

    return html`
      <style>
        :host {
          background: ${colors.calendarBg};
          border-bottom: 2px solid ${colors.border};
          color: ${colors.text};
        }
        .label-placeholder {
          border-right: 1px solid ${colors.border};
        }
        .months-container {
          background: ${colors.bg};
          border-bottom: 1px solid ${colors.border};
        }
        .hours-container {
          border-top: 1px solid ${colors.border};
        }
      </style>
      <div
        class="label-placeholder"
        style="width: ${this.option.rowHeader?.width ?? DEFAULT_ROW_HEADER_WIDTH}px; background-color: ${this.option
          .rowHeader?.backgroundColor ?? colors.rowHeaderBg}; ${this.isGridEnabled && this.cornerContent
          ? 'flex-direction: column; align-items: stretch; justify-content: flex-end; padding-right: 0;'
          : ''}"
      >
        ${this.isGridEnabled && this.cornerContent
          ? html`<div
              class="corner-content-slot"
              style="display: flex; align-items: center; justify-content: flex-end; padding-right: 4px; flex: 1; min-height: 22px; border-bottom: 1px solid ${colors.border}; box-sizing: border-box;"
            ></div>`
          : ''}
        ${this.renderGridHeaders(colors)}
      </div>
      <div class="calendar-group" style="width: ${totalWidth}px; overflow: hidden;">
        ${this.option.calendar.showMonthsRow
          ? (() => {
              const monthTextAlign = this.option.calendar.monthTextAlign ?? 'center'
              const visibleYears = slicePositionedRange(years, this.visibleStartX, this.visibleEndX, useVirtualX)
              const visibleMonths = slicePositionedRange(months, this.visibleStartX, this.visibleEndX, useVirtualX)

              return html`<div class="months-container" style="position: relative; z-index: 2;">
                  ${visibleYears.offsetLeft > 0
                    ? html`<div style="width: ${visibleYears.offsetLeft}px; flex-shrink: 0;"></div>`
                    : ''}
                  ${visibleYears.slice.map(
                    (y) =>
                      html`<div
                        class="month-cell"
                        style="width: ${y.width}px;"
                      >
                        ${y.year}
                      </div>`,
                  )}
                </div>
                ${this._renderQuartersRow(quarters, colors, useVirtualX)}
                <div
                  class="weeks-container"
                  style="background: ${colors.bg}; border-bottom: 1px solid ${colors.border}; position: relative;"
                >
                  ${visibleMonths.offsetLeft > 0
                    ? html`<div style="width: ${visibleMonths.offsetLeft}px; flex-shrink: 0;"></div>`
                    : ''}
                  ${visibleMonths.slice.map((m) => {
                    const monthRowFormat = (this.option.locale ?? jaLocale).monthRowFormat
                    const monthLabel = dayjs(new Date(m.year, m.month)).format(monthRowFormat)
                    const cellWidth = m.width
                    return html`<div
                      class="week-cell"
                      style="width: ${cellWidth}px; text-align: ${monthTextAlign}; padding: 0 2px;"
                      data-calendar-month="${m.month}"
                      data-calendar-month-year="${m.year}"
                      data-calendar-month-width="${cellWidth}"
                      data-calendar-month-label="${monthLabel}"
                    >
                      ${this.calendarMonthContent ? '' : monthLabel}
                    </div>`
                  })}
                </div>`
            })()
          : html`${this._renderQuartersRow(quarters, colors, useVirtualX)}`}
        ${this.option.calendar.showMonths !== false && !this.option.calendar.showMonthsRow
          ? (() => {
              const visibleMonths = slicePositionedRange(months, this.visibleStartX, this.visibleEndX, useVirtualX)
              return html`<div class="months-container" style="position: relative;">
                ${visibleMonths.offsetLeft > 0
                  ? html`<div style="width: ${visibleMonths.offsetLeft}px; flex-shrink: 0;"></div>`
                  : ''}
                ${visibleMonths.slice.map((m) => {
                  const format = this.option.calendar.monthFormat || (this.option.locale ?? jaLocale).monthFormat
                  const text = dayjs(new Date(m.year, m.month)).format(format)
                  const cellWidth = m.width
                  return html`<div
                    class="month-cell"
                    style="width: ${cellWidth}px;"
                    data-calendar-month="${m.month}"
                    data-calendar-month-year="${m.year}"
                    data-calendar-month-width="${cellWidth}"
                    data-calendar-month-label="${text}"
                  >
                    ${this.calendarMonthContent ? '' : text}
                  </div>`
                })}
              </div>`
            })()
          : ''}
        ${this.option.calendar.showWeeks
          ? (() => {
              const weeks = this._cachedWeeks!
              const visibleWeeks = slicePositionedRange(weeks, this.visibleStartX, this.visibleEndX, useVirtualX)

              const weekBackgroundStyle = `
                background: ${colors.bg};
                border-bottom: 1px solid ${colors.border};
              `

              const weekFormat = this.option.calendar.weekFormat
              const weekTextAlign = this.option.calendar.weekTextAlign ?? 'center'
              return html`<div class="weeks-container" style="${weekBackgroundStyle}">
                ${visibleWeeks.offsetLeft > 0
                  ? html`<div style="width: ${visibleWeeks.offsetLeft}px; flex-shrink: 0;"></div>`
                  : ''}
                ${visibleWeeks.slice.map((w) => {
                  const label = weekFormat ? weekFormat(w.weekNumber, w.startDate) : `W${w.weekNumber}`
                  const cellWidth = w.width
                  return html`<div
                    class="week-cell"
                    style="width: ${cellWidth}px; border-right: 1px solid ${colors.border}; text-align: ${weekTextAlign}; padding: 0 2px;"
                    data-calendar-week="${w.weekNumber}"
                    data-calendar-week-start="${w.startDate.toISOString()}"
                    data-calendar-week-width="${cellWidth}"
                    data-calendar-week-label="${label}"
                  >
                    ${this.calendarWeekContent ? '' : label}
                  </div>`
                })}
              </div>`
            })()
          : ''}
        ${this.option.calendar.showDays !== false
          ? (() => {
              const holidayResolver = createCustomHolidayResolver({
                isHoliday: this.option.calendar.isHoliday,
                nonWorkingDays: this.option.calendar.nonWorkingDays,
              })
              if (this.option.calendar.showTime) {
                return html`<div class="days-container">
                  ${visibleShowTime.offsetLeft > 0
                    ? html`<div style="width: ${visibleShowTime.offsetLeft}px; flex-shrink: 0;"></div>`
                    : ''}
                  ${visibleShowTime.slice.map((seg) => {
                    const backgroundColor = getCalendarColor(
                      seg.date,
                      colors,
                      this.option.calendar.isHoliday,
                      this.option.calendar,
                    )
                    const isLastSeg = seg.segIndex === showTimeDays.length - 1
                    const dateBorderColor = colors.showTimeDateLine ?? colors.monthGridLine ?? colors.border
                    const defaultLabel = (this.option.locale ?? jaLocale).timeUnitDateFormat(seg.date)
                    const isHolidayDay = holidayResolver.isHolidayDate(seg.date)
                    return html`
                      <div
                        class="day-cell"
                        style="width: ${seg.width}px; border-right: ${isLastSeg
                          ? 'none'
                          : `1px solid ${dateBorderColor}`}; ${backgroundColor
                          ? `background-color: ${backgroundColor};`
                          : ''} font-size: calc(12px * var(--moguchart-font-scale, 1)); font-weight: 700; justify-content: flex-start; padding-left: 4px;"
                        data-calendar-day="${seg.date.toISOString()}"
                        data-calendar-day-width="${seg.width}"
                        data-calendar-day-saturday="${seg.date.getDay() === 6}"
                        data-calendar-day-sunday="${seg.date.getDay() === 0}"
                        data-calendar-day-holiday="${isHolidayDay}"
                        data-calendar-day-label="${defaultLabel}"
                      >
                        ${this.calendarDayContent ? '' : defaultLabel}
                      </div>
                    `
                  })}
                </div>`
              }

              const visibleDays = slicePositionedRange(dayItems, this.visibleStartX, this.visibleEndX, useVirtualX)
              return html`<div class="days-container" style="${backgroundStyle}">
                ${visibleDays.offsetLeft > 0
                  ? html`<div style="width: ${visibleDays.offsetLeft}px; flex-shrink: 0;"></div>`
                  : ''}
                ${visibleDays.slice.map(({ date: day, width }) => {
                  const backgroundColor = getCalendarColor(
                    day,
                    colors,
                    this.option.calendar.isHoliday,
                    this.option.calendar,
                  )
                  const defaultLabel = String(day.getDate())
                  const isHolidayDay = holidayResolver.isHolidayDate(day)
                  return html`
                    <div
                      class="day-cell"
                      style="width: ${width}px; ${backgroundColor ? `background-color: ${backgroundColor};` : ''}"
                      data-calendar-day="${day.toISOString()}"
                      data-calendar-day-width="${width}"
                      data-calendar-day-saturday="${day.getDay() === 6}"
                      data-calendar-day-sunday="${day.getDay() === 0}"
                      data-calendar-day-holiday="${isHolidayDay}"
                      data-calendar-day-label="${defaultLabel}"
                    >
                      ${this.calendarDayContent ? '' : defaultLabel}
                    </div>
                  `
                })}
              </div>`
            })()
          : ''}
        ${this.option.calendar.showTime
          ? html`
              <div class="hours-container" style="${hourBackgroundStyle}">
                ${visibleShowTime.offsetLeft > 0
                  ? html`<div style="width: ${visibleShowTime.offsetLeft}px; flex-shrink: 0;"></div>`
                  : ''}
                ${visibleShowTime.slice.map((seg) => {
                  return Array.from({ length: seg.hEnd - seg.hStart }, (_, i) => seg.hStart + i).map((h) => {
                    return html` <div
                      class="hour-cell"
                      style="width: ${hourWidth}px;"
                      data-calendar-hour="${h}"
                      data-calendar-hour-width="${hourWidth}"
                      data-calendar-hour-date="${seg.date.toISOString()}"
                    >${this.calendarHourContent ? '' : h}</div> `
                  })
                })}
              </div>
            `
          : ''}
        ${(() => {
          const isMonthMode =
            this.option.calendar.showMonthsRow ||
            (this.option.calendar.showDays === false && !this.option.calendar.showWeeks)
          const startX = this.getDateX(this.option.calendar.start)
          const endX = this.getDateX(this.option.calendar.end)
          const lines: unknown[] = []
          for (const m of months) {
            if (!m.start) continue
            const x = this.getDateX(m.start)
            if (x <= startX) continue
            if (useVirtualX && (x < this.visibleStartX - 2 || x > this.visibleEndX + 2)) continue
            const isYearBoundary = m.month === 0
            let lineColor
            let lineZIndex = 1
            if (isYearBoundary) {
              lineColor = colors.yearGridLine || colors.monthGridLine || colors.border
              lineZIndex = 3
            } else {
              lineColor = isMonthMode ? colors.border : colors.monthGridLine || colors.border
              lineZIndex = 1
            }
            lines.push(
              html`<div
                style="position: absolute; top: 0; bottom: 0; left: ${x -
                1}px; width: 1px; background-color: ${lineColor}; pointer-events: none; z-index: ${lineZIndex};"
              ></div>`,
            )
          }
          // 最後の月の右端（calendar.end の位置）にも縦線を描画する
          const lastMonthItem = months[months.length - 1]
          if (
            lastMonthItem &&
            endX > startX &&
            (!useVirtualX || (endX >= this.visibleStartX - 2 && endX <= this.visibleEndX + 2))
          ) {
            const lastIsYearBoundary = lastMonthItem.month === 11
            const endLineColor = lastIsYearBoundary
              ? colors.yearGridLine || colors.monthGridLine || colors.border
              : isMonthMode
                ? colors.border
                : colors.monthGridLine || colors.border
            const endLineZIndex = lastIsYearBoundary ? 3 : 1
            lines.push(
              html`<div
                style="position: absolute; top: 0; bottom: 0; left: ${endX -
                1}px; width: 1px; background-color: ${endLineColor}; pointer-events: none; z-index: ${endLineZIndex};"
              ></div>`,
            )
          }
          return lines
        })()}
        ${!this.isExporting &&
        this.option.calendar.showCurrentTime &&
        this.option.calendar.showCurrentTimeBadge === true &&
        this.currentTime >= this.option.calendar.start &&
        this.currentTime <= this.option.calendar.end
          ? html`
              <div
                class="current-time-badge"
                style="
                  left: ${this.getDateX(this.currentTime)}px;
                  background-color: ${colors.currentTimeLine};
                  color: ${colors.currentTimeLineText};
                "
              >
                ${this.formatTime(this.currentTime)}
              </div>
            `
          : ''}
        ${(this.option.calendar.milestones ?? []).map((ms) => {
          const msX = this.getDateX(ms.start)
          if (useVirtualX && (msX < this.visibleStartX - 200 || msX > this.visibleEndX + 200)) {
            return ''
          }
          return html`
            <div
              class="milestone-connector ${this.hoveredMilestoneId === ms.id ? 'milestone-hovered' : ''}"
              style="
                left: ${msX + 1}px;
                width: ${ms.width ?? 2}px;
                background-color: ${ms.color};
                opacity: ${this.hoveredMilestoneId === ms.id ? 1 : 0.5};
              "
              @mouseenter="${() => {
                this.dispatchEvent(
                  new CustomEvent('milestone-hover-change', {
                    detail: { milestoneId: ms.id },
                    bubbles: true,
                    composed: true,
                  }),
                )
              }}"
              @mouseleave="${() => {
                this.dispatchEvent(
                  new CustomEvent('milestone-hover-change', {
                    detail: { milestoneId: null },
                    bubbles: true,
                    composed: true,
                  }),
                )
              }}"
            ></div>
            <div
              class="milestone-badge ${this.hoveredMilestoneId === ms.id ? 'milestone-hovered' : ''}"
              style="
                left: ${msX}px;
                background-color: ${ms.color};
                opacity: ${this.hoveredMilestoneId === ms.id ? 1 : 0.5};
              "
              @mouseenter="${() => {
                this.dispatchEvent(
                  new CustomEvent('milestone-hover-change', {
                    detail: { milestoneId: ms.id },
                    bubbles: true,
                    composed: true,
                  }),
                )
              }}"
              @mouseleave="${() => {
                this.dispatchEvent(
                  new CustomEvent('milestone-hover-change', {
                    detail: { milestoneId: null },
                    bubbles: true,
                    composed: true,
                  }),
                )
              }}"
            >
              ${ms.name}
            </div>
          `
        })}
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gantt-calendar': GanttCalendarElement
  }
}

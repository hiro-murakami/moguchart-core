import type { ReactiveController, ReactiveControllerHost } from 'lit'
import type {
  FilterChangeEventDetail,
  GanttChartOption,
  GanttColumn,
  GanttRow,
  GanttTask,
  GridSortState,
  RowToggleCollapseEventDetail,
} from '../../core/types.js'
import {
  evaluateRowFilter,
  isFilterConfigActive,
  type GanttFilterConfig,
  type GanttFilterResult,
} from '../../core/filter.js'
import {
  computeChildRowIds,
  computeRowWbsCodes,
  computeSummaryTask,
  computeVisibleTreeRows,
} from '../../core/wbs.js'
import { sortGridRowsHierarchically } from '../../core/grid.js'
import type { AutoScheduleOptions } from '../../core/auto-schedule.js'

export interface TreeControllerHost extends ReactiveControllerHost, HTMLElement {
  rows: GanttRow[]
  option: GanttChartOption
  effectiveGridColumns?: GanttColumn[]
  getEffectiveSortState?: () => GridSortState | null
  getGridColumnById?: (columnId: string) => GanttColumn | undefined
  getAutoScheduleOptions?: () => AutoScheduleOptions
  invalidateLayoutCache?: () => void
}

export class TreeController implements ReactiveController {
  private host: TreeControllerHost

  public collapsedRowIds = new Set<string>()
  private prevExternalCollapsed = new Map<string, boolean | undefined>()
  private _hasFilterOverride = false
  private _filterOverride: GanttFilterConfig | null = null
  private _lastExplicitOptionFilter: GanttFilterConfig | null | undefined = undefined

  constructor(host: TreeControllerHost) {
    this.host = host
    host.addController(this)
  }

  hostConnected(): void {}
  hostDisconnected(): void {}

  /**
   * 外部から渡されたrows配列の各行のcollapsedフラグと内部のSetを同期する
   */
  public syncCollapsedWithRows(rows: GanttRow[]): { rows: GanttRow[]; hasChanges: boolean } {
    const currentRowIds = new Set(rows.map((r) => r.id))
    for (const id of this.collapsedRowIds) {
      if (!currentRowIds.has(id)) {
        this.collapsedRowIds.delete(id)
        this.prevExternalCollapsed.delete(id)
      }
    }

    let hasCollapsedChanges = false
    const updatedRows = rows.map((row) => {
      const prevExternal = this.prevExternalCollapsed.get(row.id)
      const currentExternal = row.collapsed

      if (currentExternal !== prevExternal) {
        // 外部が明示的に変更した（初回、または外部から値が変わった場合）
        this.prevExternalCollapsed.set(row.id, currentExternal)
        if (currentExternal === true) {
          this.collapsedRowIds.add(row.id)
        } else if (currentExternal === false) {
          this.collapsedRowIds.delete(row.id)
        }
      }

      const isCollapsed = this.collapsedRowIds.has(row.id)
      if (Boolean(row.collapsed) !== isCollapsed) {
        hasCollapsedChanges = true
        return { ...row, collapsed: isCollapsed }
      }
      return row
    })

    return { rows: updatedRows, hasChanges: hasCollapsedChanges }
  }

  /**
   * 現在有効なフィルタ設定を取得する（プログラムからの上書きがあればそれを優先）
   */
  public getFilter(): GanttFilterConfig | null {
    if (this._hasFilterOverride) {
      return this._filterOverride
    }
    return this.host.option?.filter ?? null
  }

  /**
   * 現在の行配列に対するフィルタ評価結果を取得する
   */
  public getFilterResult(): GanttFilterResult {
    return evaluateRowFilter(this.host.rows, this.getFilter(), {
      columns: this.host.effectiveGridColumns ?? this.host.option?.grid?.columns,
      includeHidden: Boolean(this.host.option?.showHiddenRows),
    })
  }

  /**
   * フィルタ設定をプログラムから設定し、`filter-change` イベントを発火する
   */
  public setFilter(filter: GanttFilterConfig | null): GanttFilterResult {
    this._hasFilterOverride = true
    this._filterOverride = filter
    this.host.invalidateLayoutCache?.()
    const result = this.getFilterResult()
    this.host.requestUpdate()
    this.host.dispatchEvent(
      new CustomEvent<FilterChangeEventDetail>('filter-change', {
        detail: {
          filter,
          result,
        },
        bubbles: true,
        composed: true,
      }),
    )
    return result
  }

  /**
   * 現在適用されているフィルタ設定を解除する
   */
  public clearFilter(): GanttFilterResult {
    return this.setFilter(null)
  }

  /**
   * `option.filter` の宣言的変更を検知して内部状態と同期する
   */
  public syncFilterWithOption(hadPreviousOption: boolean): void {
    const nextFilter = this.host.option?.filter
    if (nextFilter !== this._lastExplicitOptionFilter) {
      this._lastExplicitOptionFilter = nextFilter
      this._hasFilterOverride = false
      this._filterOverride = null
      this.host.invalidateLayoutCache?.()
      if (hadPreviousOption) {
        const effectiveFilter = this.getFilter()
        const result = this.getFilterResult()
        this.host.dispatchEvent(
          new CustomEvent<FilterChangeEventDetail>('filter-change', {
            detail: {
              filter: effectiveFilter,
              result,
            },
            bubbles: true,
            composed: true,
          }),
        )
      }
    }
  }

  /**
   * 現在の展開状態・フィルタ設定・ツリーオプションに基づいて表示対象の行配列を計算する
   */
  public getDisplayRows(): GanttRow[] {
    const treeEnabled = this.host.option?.tree?.enabled !== false
    const showHiddenRows = this.host.option?.showHiddenRows ?? false
    const filterConfig = this.getFilter()
    const filterResult = isFilterConfigActive(filterConfig) ? this.getFilterResult() : null

    let sourceRowsForSummary = this.host.rows
    let baseRows: GanttRow[]

    if (!filterResult) {
      baseRows = treeEnabled
        ? computeVisibleTreeRows(this.host.rows, showHiddenRows)
        : showHiddenRows
          ? this.host.rows
          : this.host.rows.filter((row) => row.visible !== false)
    } else if (filterResult.mode === 'dim') {
      const dimmedSourceRows = this.host.rows.map((row) => {
        const isRowDimmed = !filterResult.visibleRowIds.has(row.id)
        const prevTasks = row.tasks ?? []
        let tasksChanged = false
        const nextTasks = prevTasks.map((task) => {
          if (task.type === 'summary') return task
          const isTaskDimmed = !filterResult.matchedTaskIds.has(task.id)
          if (isTaskDimmed && !(task as any)._isFilteredOut) {
            tasksChanged = true
            return { ...task, _isFilteredOut: true } as GanttTask
          }
          return task
        })
        if (isRowDimmed || tasksChanged) {
          const cloned: GanttRow = tasksChanged ? { ...row, tasks: nextTasks } : { ...row }
          if (isRowDimmed) {
            ;(cloned as any)._isFilteredOut = true
          }
          return cloned
        }
        return row
      })
      sourceRowsForSummary = dimmedSourceRows

      let treeInputRows = dimmedSourceRows
      if (treeEnabled && filterConfig?.autoExpandMatches === true) {
        const rowMap = new Map(dimmedSourceRows.map((r) => [r.id, r]))
        const ancestorsToExpand = new Set<string>()
        for (const visibleId of filterResult.visibleRowIds) {
          let currParentId = rowMap.get(visibleId)?.parentId
          const visited = new Set<string>([visibleId])
          while (currParentId && !visited.has(currParentId)) {
            visited.add(currParentId)
            ancestorsToExpand.add(currParentId)
            currParentId = rowMap.get(currParentId)?.parentId
          }
        }
        treeInputRows = dimmedSourceRows.map((r) =>
          r.collapsed && ancestorsToExpand.has(r.id) ? { ...r, collapsed: false } : r,
        )
      }

      baseRows = treeEnabled
        ? computeVisibleTreeRows(treeInputRows, showHiddenRows)
        : showHiddenRows
          ? treeInputRows
          : treeInputRows.filter((row) => row.visible !== false)
    } else {
      // mode: 'hide' (デフォルト)
      const autoExpand = filterConfig?.autoExpandMatches !== false
      let workingRows = this.host.rows
      if (treeEnabled && autoExpand) {
        const rowMap = new Map(this.host.rows.map((r) => [r.id, r]))
        const ancestorsToExpand = new Set<string>()
        for (const visibleId of filterResult.visibleRowIds) {
          let currParentId = rowMap.get(visibleId)?.parentId
          const visited = new Set<string>([visibleId])
          while (currParentId && !visited.has(currParentId)) {
            visited.add(currParentId)
            ancestorsToExpand.add(currParentId)
            currParentId = rowMap.get(currParentId)?.parentId
          }
        }
        if (ancestorsToExpand.size > 0) {
          workingRows = this.host.rows.map((r) =>
            r.collapsed && ancestorsToExpand.has(r.id) ? { ...r, collapsed: false } : r,
          )
        }
      }

      const visibleTreeRows = treeEnabled
        ? computeVisibleTreeRows(workingRows, showHiddenRows)
        : showHiddenRows
          ? workingRows
          : workingRows.filter((row) => row.visible !== false)
      baseRows = visibleTreeRows.filter((row) => filterResult.visibleRowIds.has(row.id))
    }

    const autoSummary = this.host.option?.tree?.autoSummary !== false
    if (!treeEnabled || !autoSummary) {
      return this.applyHierarchicalSortIfNeeded(baseRows)
    }

    // 子を持つ行を特定
    const rowsWithChildren = new Set<string>()
    for (const r of sourceRowsForSummary) {
      if (r.parentId) rowsWithChildren.add(r.parentId)
    }

    const resultRows = baseRows.map((row) => {
      const isParent = rowsWithChildren.has(row.id)
      const needsSummary = row.isSummary || isParent
      if (needsSummary && isParent) {
        const childIds = computeChildRowIds(sourceRowsForSummary, row.id, true)
        const childRows = sourceRowsForSummary.filter((r) => childIds.includes(r.id))
        const allChildTasks = childRows.flatMap((r) => r.tasks)
        if (allChildTasks.length > 0) {
          const effectiveColor = row.summaryColor || this.host.option?.tree?.summaryColor

          // 子タスクが全て半透明化（フィルタアウト）されているかを判定
          const leafTasks = allChildTasks.filter((t) => t.type !== 'summary')
          const tasksToCheck = leafTasks.length > 0 ? leafTasks : allChildTasks
          const isTaskFilteredOut = (t: any) =>
            t._isFilteredOut === true ||
            (typeof t.style === 'string' && /opacity:\s*0(\.\d+)?/i.test(t.style))

          const isParentDirectlyMatched =
            filterResult?.mode === 'dim' && filterResult.matchedRowIds.has(row.id)
          const allChildrenFilteredOut =
            !isParentDirectlyMatched &&
            tasksToCheck.length > 0 &&
            tasksToCheck.every((t) => isTaskFilteredOut(t))

          let summaryStyle = effectiveColor ? `background-color: ${effectiveColor};` : ''
          if (allChildrenFilteredOut) {
            const separator = summaryStyle && !summaryStyle.trim().endsWith(';') ? ';' : ''
            summaryStyle = `${summaryStyle}${separator} opacity: 0.2;`.trim()
          }

          const summaryTask = computeSummaryTask(allChildTasks, {
            id: `${row.id}-summary`,
            name: row.name,
            style: summaryStyle || undefined,
            labelStyle: allChildrenFilteredOut ? 'opacity: 0.2;' : undefined,
          })
          if (summaryTask) {
            if (allChildrenFilteredOut) {
              ;(summaryTask as any)._isFilteredOut = true
              if (summaryTask.baseline) {
                const bStyle = summaryTask.baseline.style || ''
                const bSep = bStyle && !bStyle.trim().endsWith(';') ? ';' : ''
                summaryTask.baseline = {
                  ...summaryTask.baseline,
                  style: `${bStyle}${bSep} opacity: 0.2;`.trim(),
                }
              }
            }

            const normalTasks = (row.tasks || []).filter(
              (t) => t.id !== summaryTask.id && t.type !== 'summary',
            )
            return {
              ...row,
              tasks: [summaryTask, ...normalTasks],
            }
          }
        }
      }
      return row
    })

    return this.applyHierarchicalSortIfNeeded(resultRows)
  }

  private applyHierarchicalSortIfNeeded(rows: GanttRow[]): GanttRow[] {
    const sortState = this.host.getEffectiveSortState?.()
    if (!sortState || !sortState.columnId || !sortState.direction) {
      return rows
    }
    const column = this.host.getGridColumnById?.(sortState.columnId)
    if (!column) {
      return rows
    }
    const wbsCodes = computeRowWbsCodes(this.host.rows)
    const calendarOptions = this.host.getAutoScheduleOptions?.()
    return sortGridRowsHierarchically(rows, column, sortState.direction, {
      wbsCodes,
      calendarOptions,
    })
  }

  /**
   * 指定した行の折りたたみ状態を切り替えます。
   */
  public toggleRowCollapse(rowId: string, collapsed?: boolean): boolean {
    const targetRow = this.host.rows.find((r) => r.id === rowId)
    if (!targetRow) return false

    const newCollapsed = collapsed !== undefined ? collapsed : !this.collapsedRowIds.has(rowId)

    if (newCollapsed) {
      this.collapsedRowIds.add(rowId)
    } else {
      this.collapsedRowIds.delete(rowId)
    }
    this.prevExternalCollapsed.set(rowId, newCollapsed)

    this.host.rows = this.host.rows.map((r) =>
      r.id === rowId ? { ...r, collapsed: newCollapsed } : r,
    )

    this.host.dispatchEvent(
      new CustomEvent<RowToggleCollapseEventDetail>('row-toggle-collapse', {
        detail: {
          rowId,
          collapsed: newCollapsed,
          row: this.host.rows.find((r) => r.id === rowId) ?? targetRow,
        },
        bubbles: true,
        composed: true,
      }),
    )

    this.host.dispatchEvent(
      new CustomEvent<GanttRow[]>('rows-change', {
        detail: this.host.rows,
        bubbles: true,
        composed: true,
      }),
    )

    this.host.requestUpdate()
    return true
  }

  /**
   * 子行を持つすべての親行を折りたたみます。
   */
  public collapseAll(): void {
    const rowsWithChildren = new Set<string>()
    for (const r of this.host.rows) {
      if (r.parentId) rowsWithChildren.add(r.parentId)
    }

    for (const id of rowsWithChildren) {
      this.collapsedRowIds.add(id)
      this.prevExternalCollapsed.set(id, true)
    }

    this.host.rows = this.host.rows.map((r) =>
      rowsWithChildren.has(r.id) ? { ...r, collapsed: true } : r,
    )

    this.host.dispatchEvent(
      new CustomEvent<GanttRow[]>('rows-change', {
        detail: this.host.rows,
        bubbles: true,
        composed: true,
      }),
    )

    this.host.requestUpdate()
  }

  /**
   * すべての行を展開（折りたたみ解除）します。
   */
  public expandAll(): void {
    for (const id of this.collapsedRowIds) {
      this.prevExternalCollapsed.set(id, false)
    }
    this.collapsedRowIds.clear()

    this.host.rows = this.host.rows.map((r) =>
      r.collapsed ? { ...r, collapsed: false } : r,
    )

    this.host.dispatchEvent(
      new CustomEvent<GanttRow[]>('rows-change', {
        detail: this.host.rows,
        bubbles: true,
        composed: true,
      }),
    )

    this.host.requestUpdate()
  }

  /**
   * 行折りたたみトグルイベントハンドラ
   */
  public handleRowToggleCollapse(e: CustomEvent<RowToggleCollapseEventDetail>): void {
    const { rowId, collapsed } = e.detail
    this.toggleRowCollapse(rowId, collapsed)
  }
}

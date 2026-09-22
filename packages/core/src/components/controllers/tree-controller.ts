import type { ReactiveController, ReactiveControllerHost } from 'lit'
import type { GanttChartOption, GanttRow, RowToggleCollapseEventDetail } from '../../core/types'
import {
  computeChildRowIds,
  computeSummaryTask,
  computeVisibleTreeRows,
} from '../../core/wbs'

export interface TreeControllerHost extends ReactiveControllerHost, HTMLElement {
  rows: GanttRow[]
  option: GanttChartOption
}

export class TreeController implements ReactiveController {
  private host: TreeControllerHost

  public collapsedRowIds = new Set<string>()
  private prevExternalCollapsed = new Map<string, boolean | undefined>()

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
   * 現在の展開状態やツリーオプションに基づいて表示対象の行配列を計算する
   */
  public getDisplayRows(): GanttRow[] {
    const treeEnabled = this.host.option?.tree?.enabled !== false
    const baseRows = treeEnabled
      ? computeVisibleTreeRows(this.host.rows, this.host.option?.showHiddenRows ?? false)
      : (this.host.option?.showHiddenRows
          ? this.host.rows
          : this.host.rows.filter((row) => row.visible !== false))

    const autoSummary = this.host.option?.tree?.autoSummary !== false
    if (!treeEnabled || !autoSummary) {
      return baseRows
    }

    // 子を持つ行を特定
    const rowsWithChildren = new Set<string>()
    for (const r of this.host.rows) {
      if (r.parentId) rowsWithChildren.add(r.parentId)
    }

    return baseRows.map((row) => {
      const isParent = rowsWithChildren.has(row.id)
      const needsSummary = row.isSummary || isParent
      if (needsSummary && isParent) {
        const childIds = computeChildRowIds(this.host.rows, row.id, true)
        const childRows = this.host.rows.filter((r) => childIds.includes(r.id))
        const allChildTasks = childRows.flatMap((r) => r.tasks)
        if (allChildTasks.length > 0) {
          const effectiveColor = row.summaryColor || this.host.option?.tree?.summaryColor
          const summaryTask = computeSummaryTask(allChildTasks, {
            id: `${row.id}-summary`,
            name: row.name,
            style: effectiveColor ? `background-color: ${effectiveColor};` : undefined,
          })
          if (summaryTask) {
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

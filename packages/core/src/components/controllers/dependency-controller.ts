import type { ReactiveController, ReactiveControllerHost } from 'lit'
import type {
  BarSelectionChangeEventDetail,
  DependencyClickEventDetail,
  DependencyCreateEventDetail,
  DependencyDeleteEventDetail,
  DependencyEndpoint,
  DependencySelectEventDetail,
  GanttChartOption,
  GanttRow,
  GanttTask,
  RowSelectionChangeEventDetail,
} from '../../core/types'
import type { GanttCommandType } from '../../core/history'

export interface ConnectorDragState {
  sourceTaskId: string
  sourceEndpoint: DependencyEndpoint
  startX: number
  startY: number
  currentClientX: number
  currentClientY: number
  targetTaskId: string | null
  targetEndpoint: DependencyEndpoint | null
}

export interface DependencyControllerHost extends ReactiveControllerHost, HTMLElement {
  option: GanttChartOption
  rows: GanttRow[]
  displayRows: GanttRow[]
  currentRowHeaderWidth: number
  calendarHeight: number
  selectedRows: Set<string>
  selectedTasks: Set<string>
  calculateLayout(): { layouts: any; taskCoords: Map<string, any>; totalHeight: number }
  applyRowsChangeWithCommand(
    previousRows: GanttRow[],
    newRows: GanttRow[],
    commandInfo: { type: GanttCommandType; description: string },
  ): void
  clearTooltip(): void
}

export class DependencyController implements ReactiveController {
  private host: DependencyControllerHost

  public selectedDependency: { sourceTaskId: string; targetTaskId: string } | null = null
  public connectorDrag: ConnectorDragState | null = null

  constructor(host: DependencyControllerHost) {
    this.host = host
    host.addController(this)
  }

  hostConnected(): void {}

  hostDisconnected(): void {}

  /**
   * 依存関係線の選択状態を解除する
   */
  public clearDependencySelection(): void {
    if (!this.selectedDependency) return
    this.selectedDependency = null
    this.host.requestUpdate()
    this.host.dispatchEvent(
      new CustomEvent<DependencySelectEventDetail>('dependency-select', {
        detail: {
          selected: null,
        },
        bubbles: true,
        composed: true,
      }),
    )
  }

  /**
   * 依存関係線を選択状態にする
   */
  public selectDependency(sourceTaskId: string, targetTaskId: string): void {
    if (
      this.selectedDependency &&
      this.selectedDependency.sourceTaskId === sourceTaskId &&
      this.selectedDependency.targetTaskId === targetTaskId
    ) {
      return
    }

    this.selectedDependency = { sourceTaskId, targetTaskId }
    this.host.requestUpdate()
    this.host.dispatchEvent(
      new CustomEvent<DependencySelectEventDetail>('dependency-select', {
        detail: {
          selected: { sourceTaskId, targetTaskId },
        },
        bubbles: true,
        composed: true,
      }),
    )
  }

  /**
   * 依存関係の削除リクエストイベントを発火する
   */
  public triggerDependencyDelete(sourceTaskId: string, targetTaskId: string, originalEvent?: Event): void {
    if (this.host.option.readOnly || this.host.option.dependency?.deletable === false) return

    let sourceTask: GanttTask | undefined
    let targetTask: GanttTask | undefined
    for (const row of this.host.rows) {
      for (const t of row.tasks) {
        if (t.id === sourceTaskId) sourceTask = t
        if (t.id === targetTaskId) targetTask = t
      }
    }

    if (targetTask && targetTask.dependencies?.includes(sourceTaskId)) {
      const previousRows = this.host.rows
      const newRows = previousRows.map((row) => ({
        ...row,
        tasks: row.tasks.map((t) => {
          if (t.id === targetTaskId && t.dependencies) {
            return {
              ...t,
              dependencies: t.dependencies.filter((id) => id !== sourceTaskId),
            }
          }
          return t
        }),
      }))

      this.host.applyRowsChangeWithCommand(previousRows, newRows, {
        type: 'dependency-delete',
        description: `タスク「${sourceTask?.name || sourceTaskId}」から「${targetTask?.name || targetTaskId}」への接続線を削除`,
      })
    }

    this.host.dispatchEvent(
      new CustomEvent<DependencyDeleteEventDetail>('dependency-delete', {
        detail: {
          sourceTaskId,
          targetTaskId,
          originalEvent,
        },
        bubbles: true,
        composed: true,
      }),
    )

    if (
      this.selectedDependency &&
      this.selectedDependency.sourceTaskId === sourceTaskId &&
      this.selectedDependency.targetTaskId === targetTaskId
    ) {
      this.clearDependencySelection()
    }
  }

  /**
   * コネクタードラッグ開始ハンドラ
   */
  public handleConnectorDragStart(e: CustomEvent): void {
    if (this.host.option.readOnly || this.host.option.dependency?.creatable === false) return
    const { taskId, endpoint, clientX, clientY } = e.detail
    e.stopPropagation()

    const { taskCoords } = this.host.calculateLayout()
    const coord = taskCoords.get(taskId)
    if (coord?.isSummary) return

    const labelWidth = this.host.currentRowHeaderWidth
    let startX = e.detail.startX + labelWidth
    let startY = e.detail.startY

    if (coord) {
      startX = endpoint === 'start' ? coord.x : coord.x + coord.width
      startY = coord.y + coord.height / 2
    }

    this.connectorDrag = {
      sourceTaskId: taskId,
      sourceEndpoint: endpoint,
      startX,
      startY,
      currentClientX: clientX,
      currentClientY: clientY,
      targetTaskId: null,
      targetEndpoint: null,
    }

    this.host.clearTooltip()
    this.host.requestUpdate()
  }

  /**
   * コネクタードラッグ中ハンドラ
   */
  public handleConnectorDragMove(e: CustomEvent): void {
    if (!this.connectorDrag) return
    e.stopPropagation()

    const { clientX, clientY } = e.detail

    const container = this.host.shadowRoot?.querySelector('.scroll-container') as HTMLElement | null
    if (!container) return

    const rect = container.getBoundingClientRect()
    const contentX = clientX - rect.left + container.scrollLeft
    const contentY = clientY - rect.top + container.scrollTop - this.host.calendarHeight

    const { taskCoords } = this.host.calculateLayout()
    let closestTaskId: string | null = null
    let closestEndpoint: DependencyEndpoint | null = null
    let minDist = 30 // スナップ閾値（px）

    for (const [taskId, coord] of taskCoords) {
      if (taskId === this.connectorDrag.sourceTaskId) continue
      if (coord.isSummary) continue

      const centerY = coord.y + coord.height / 2
      const leftX = coord.x
      const rightX = coord.x + coord.width

      const distLeft = Math.sqrt((contentX - leftX) ** 2 + (contentY - centerY) ** 2)
      const distRight = Math.sqrt((contentX - rightX) ** 2 + (contentY - centerY) ** 2)

      if (distLeft < minDist) {
        minDist = distLeft
        closestTaskId = taskId
        closestEndpoint = 'start'
      }
      if (distRight < minDist) {
        minDist = distRight
        closestTaskId = taskId
        closestEndpoint = 'end'
      }
    }

    const prevTargetId = this.connectorDrag.targetTaskId
    if (prevTargetId !== closestTaskId) {
      if (prevTargetId) {
        this.setConnectorDropTarget(prevTargetId, false)
      }
      if (closestTaskId) {
        this.setConnectorDropTarget(closestTaskId, true)
      }
    }

    this.connectorDrag = {
      ...this.connectorDrag,
      currentClientX: clientX,
      currentClientY: clientY,
      targetTaskId: closestTaskId,
      targetEndpoint: closestEndpoint,
    }

    this.host.requestUpdate()
  }

  /**
   * コネクタードラッグ終了ハンドラ
   */
  public handleConnectorDragEnd(e: CustomEvent): void {
    if (!this.connectorDrag) return
    e.stopPropagation()

    const { cancelled } = e.detail
    const { sourceTaskId, sourceEndpoint, targetTaskId, targetEndpoint } = this.connectorDrag

    if (targetTaskId) {
      this.setConnectorDropTarget(targetTaskId, false)
    }

    if (!cancelled && targetTaskId && targetEndpoint && sourceTaskId !== targetTaskId) {
      const { taskCoords } = this.host.calculateLayout()
      const sourceCoord = taskCoords.get(sourceTaskId)
      const targetCoord = taskCoords.get(targetTaskId)
      if (!sourceCoord?.isSummary && !targetCoord?.isSummary) {
        let sourceTask: GanttTask | undefined
        let targetTask: GanttTask | undefined
        for (const row of this.host.rows) {
          for (const t of row.tasks) {
            if (t.id === sourceTaskId) sourceTask = t
            if (t.id === targetTaskId) targetTask = t
          }
        }

        const currentDeps = targetTask?.dependencies ?? []
        if (targetTask && !currentDeps.includes(sourceTaskId)) {
          const previousRows = this.host.rows
          const newRows = previousRows.map((row) => ({
            ...row,
            tasks: row.tasks.map((t) => {
              if (t.id === targetTaskId) {
                return {
                  ...t,
                  dependencies: [...(t.dependencies ?? []), sourceTaskId],
                }
              }
              return t
            }),
          }))

          this.host.applyRowsChangeWithCommand(previousRows, newRows, {
            type: 'dependency-create',
            description: `タスク「${sourceTask?.name || sourceTaskId}」から「${targetTask?.name || targetTaskId}」への接続線を追加`,
          })
        }

        this.host.dispatchEvent(
          new CustomEvent<DependencyCreateEventDetail>('dependency-create', {
            detail: {
              sourceTaskId,
              sourceEndpoint,
              targetTaskId,
              targetEndpoint,
            },
            bubbles: true,
            composed: true,
          }),
        )
      }
    }

    this.connectorDrag = null
    this.host.requestUpdate()
  }

  /**
   * 指定タスクIDのgantt-bar要素にconnectorDropTarget属性をセットする
   */
  public setConnectorDropTarget(taskId: string, value: boolean): void {
    const rows = this.host.shadowRoot?.querySelectorAll('gantt-row')
    if (!rows) return
    for (const row of rows) {
      const bars = (row as any).shadowRoot?.querySelectorAll('gantt-bar')
      if (!bars) continue
      for (const bar of bars) {
        if ((bar as any).task?.id === taskId) {
          ;(bar as any).connectorDropTarget = value
          return
        }
      }
    }
  }

  /**
   * 依存関係線クリックハンドラ
   */
  public handleDependencyLineClick(event: MouseEvent, targetTaskId: string, sourceTaskId: string): void {
    if (this.host.selectedRows.size > 0 || this.host.selectedTasks.size > 0) {
      if (this.host.selectedRows.size > 0) {
        this.host.selectedRows = new Set()
        this.host.dispatchEvent(
          new CustomEvent<RowSelectionChangeEventDetail>('row-selection-change', {
            detail: { selectedIds: [] },
            bubbles: true,
            composed: true,
          }),
        )
      }
      if (this.host.selectedTasks.size > 0) {
        this.host.selectedTasks = new Set()
        this.host.dispatchEvent(
          new CustomEvent<BarSelectionChangeEventDetail>('bar-selection-change', {
            detail: { selectedIds: [] },
            bubbles: true,
            composed: true,
          }),
        )
      }
    }

    this.selectDependency(sourceTaskId, targetTaskId)

    this.host.dispatchEvent(
      new CustomEvent<DependencyClickEventDetail>('dependency-click', {
        detail: {
          event,
          sourceTaskId,
          targetTaskId,
        },
        bubbles: true,
        composed: true,
      }),
    )
  }
}

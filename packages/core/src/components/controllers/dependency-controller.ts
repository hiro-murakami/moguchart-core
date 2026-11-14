import type { ReactiveController, ReactiveControllerHost } from 'lit'
import type {
  BarSelectionChangeEventDetail,
  BeforeDependencyUpdateHookDetail,
  DependencyClickEventDetail,
  DependencyCreateEventDetail,
  DependencyDeleteEventDetail,
  DependencyEditEventDetail,
  DependencyEndpoint,
  DependencySelectEventDetail,
  DependencyType,
  DependencyUpdateEventDetail,
  DependencyUpdateInput,
  GanttChartOption,
  GanttDependencyLink,
  GanttRow,
  GanttTask,
  RowSelectionChangeEventDetail,
} from '../../core/types'
import type { GanttCommandType } from '../../core/history'
import type { PluginManager } from '../../core/plugin'
import {
  createDependencyEntry,
  endpointsToDependencyType,
  getDependencyTaskId,
  hasDependencyTarget,
  normalizeDependencyLink,
  propagateAutoSchedule,
  removeDependencyTarget,
} from '../../core/auto-schedule'

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

export interface DependencyEditPopoverState {
  sourceTaskId: string
  targetTaskId: string
  sourceTaskName: string
  targetTaskName: string
  draftType: DependencyType
  draftLagInUnit: number
  unitMinutes: number
  stepInUnit: number
  unitKey: 'days' | 'hours' | 'minutes' | 'months'
  anchorContentX: number
  anchorContentY: number
  anchorClientX?: number
  anchorClientY?: number
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
  pluginManager?: PluginManager
  clearTooltip(): void
}

export class DependencyController implements ReactiveController {
  private host: DependencyControllerHost

  public selectedDependency: { sourceTaskId: string; targetTaskId: string } | null = null
  public connectorDrag: ConnectorDragState | null = null
  public editingPopover: DependencyEditPopoverState | null = null
  private _outsidePointerDownHandler: ((e: PointerEvent) => void) | null = null

  constructor(host: DependencyControllerHost) {
    this.host = host
    host.addController(this)
  }

  hostConnected(): void {}

  hostDisconnected(): void {
    this.detachOutsidePointerDown()
  }

  private attachOutsidePointerDown(): void {
    if (this._outsidePointerDownHandler || typeof window === 'undefined') return
    this._outsidePointerDownHandler = (e: PointerEvent) => {
      if (!this.editingPopover) return
      const path = e.composedPath()
      const clickedInside = path.some((node) => {
        const el = node as HTMLElement | SVGElement | null
        return Boolean(
          el?.classList?.contains?.('dependency-edit-popover') ||
            el?.classList?.contains?.('dependency-edit-btn'),
        )
      })
      if (!clickedInside) {
        this.closeEditPopover()
      }
    }
    window.addEventListener('pointerdown', this._outsidePointerDownHandler, true)
  }

  private detachOutsidePointerDown(): void {
    if (this._outsidePointerDownHandler && typeof window !== 'undefined') {
      window.removeEventListener('pointerdown', this._outsidePointerDownHandler, true)
    }
    this._outsidePointerDownHandler = null
  }

  /**
   * 依存関係線の選択状態を解除する
   */
  public clearDependencySelection(): void {
    if (this.editingPopover) {
      this.closeEditPopover()
    }
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

    const detail: DependencyDeleteEventDetail = {
      sourceTaskId,
      targetTaskId,
      originalEvent,
    }

    const commitDelete = () => {
      let sourceTask: GanttTask | undefined
      let targetTask: GanttTask | undefined
      for (const row of this.host.rows) {
        for (const t of row.tasks) {
          if (t.id === sourceTaskId) sourceTask = t
          if (t.id === targetTaskId) targetTask = t
        }
      }

      if (targetTask && hasDependencyTarget(targetTask.dependencies, sourceTaskId)) {
        const previousRows = this.host.rows
        const newRows = previousRows.map((row) => ({
          ...row,
          tasks: row.tasks.map((t) => {
            if (t.id === targetTaskId && t.dependencies) {
              return {
                ...t,
                dependencies: removeDependencyTarget(t.dependencies, sourceTaskId),
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
          detail,
          bubbles: true,
          composed: true,
        }),
      )

      if (
        this.editingPopover &&
        this.editingPopover.sourceTaskId === sourceTaskId &&
        this.editingPopover.targetTaskId === targetTaskId
      ) {
        this.closeEditPopover()
      }

      if (
        this.selectedDependency &&
        this.selectedDependency.sourceTaskId === sourceTaskId &&
        this.selectedDependency.targetTaskId === targetTaskId
      ) {
        this.clearDependencySelection()
      }

      this.host.pluginManager?.executeAfterDependencyDelete(detail)
    }

    if (this.host.pluginManager) {
      this.host.pluginManager.runBeforeHook('beforeDependencyDelete', detail, commitDelete)
    } else {
      commitDelete()
    }
  }

  /**
   * カレンダー粒度に応じたラグ表示単位（日数・時間・分・月）を算出する
   */
  private resolveLagUnitSpec(): {
    unitMinutes: number
    stepInUnit: number
    unitKey: 'days' | 'hours' | 'minutes' | 'months'
  } {
    const isMonthMode = this.host.option?.calendar?.pxPerMonth !== undefined
    if (isMonthMode) {
      return { unitMinutes: 43200, stepInUnit: 1, unitKey: 'months' }
    }
    const snapMinutes = this.host.option?.snapDuration ?? 1440
    if (snapMinutes >= 1440 && snapMinutes % 1440 === 0) {
      return { unitMinutes: 1440, stepInUnit: snapMinutes / 1440, unitKey: 'days' }
    }
    if (snapMinutes >= 60 && snapMinutes % 60 === 0) {
      return { unitMinutes: 60, stepInUnit: snapMinutes / 60, unitKey: 'hours' }
    }
    return { unitMinutes: 1, stepInUnit: Math.max(1, snapMinutes), unitKey: 'minutes' }
  }

  /**
   * 依存関係線の編集操作（鉛筆ボタンクリックやダブルクリック等）を処理する
   */
  public handleDependencyEdit(
    sourceTaskId: string,
    targetTaskId: string,
    anchor?: { contentX?: number; contentY?: number; clientX?: number; clientY?: number },
    originalEvent?: MouseEvent,
  ): void {
    if (this.host.option?.readOnly) return

    const editEvent = new CustomEvent<DependencyEditEventDetail>('dependency-edit', {
      detail: {
        sourceTaskId,
        targetTaskId,
        event: originalEvent,
      },
      bubbles: true,
      composed: true,
      cancelable: true,
    })
    this.host.dispatchEvent(editEvent)

    if (!editEvent.defaultPrevented && this.host.option?.dependency?.enableEditPopover !== false) {
      this.openEditPopover(sourceTaskId, targetTaskId, anchor)
    }
  }

  /**
   * 組み込みの依存関係編集ポップオーバーを開く
   */
  public openEditPopover(
    sourceTaskId: string,
    targetTaskId: string,
    anchor?: { contentX?: number; contentY?: number; clientX?: number; clientY?: number },
  ): boolean {
    if (this.host.option?.readOnly || this.host.option?.dependency?.enableEditPopover === false) {
      return false
    }

    let sourceTask: GanttTask | undefined
    let targetTask: GanttTask | undefined
    for (const row of this.host.rows) {
      for (const task of row.tasks) {
        if (task.id === sourceTaskId) sourceTask = task
        if (task.id === targetTaskId) targetTask = task
      }
    }
    if (!sourceTask || !targetTask || !targetTask.dependencies) {
      return false
    }

    const rawDep = targetTask.dependencies.find((d) => getDependencyTaskId(d) === sourceTaskId)
    if (!rawDep) {
      return false
    }

    const link = normalizeDependencyLink(rawDep)
    const { unitMinutes, stepInUnit, unitKey } = this.resolveLagUnitSpec()
    const draftLagInUnit = Math.round((link.lag / unitMinutes) * 100) / 100

    let anchorContentX = anchor?.contentX
    let anchorContentY = anchor?.contentY
    if (anchorContentX === undefined || anchorContentY === undefined) {
      const { taskCoords } = this.host.calculateLayout()
      const srcCoord = taskCoords.get(sourceTaskId)
      const tgtCoord = taskCoords.get(targetTaskId)
      if (srcCoord && tgtCoord) {
        anchorContentX = (srcCoord.x + srcCoord.width + tgtCoord.x) / 2
        anchorContentY = (srcCoord.y + srcCoord.height / 2 + tgtCoord.y + tgtCoord.height / 2) / 2
      } else {
        anchorContentX = 200
        anchorContentY = 80
      }
    }

    this.selectDependency(sourceTaskId, targetTaskId)
    this.host.clearTooltip()

    this.editingPopover = {
      sourceTaskId,
      targetTaskId,
      sourceTaskName: sourceTask.name || sourceTask.id,
      targetTaskName: targetTask.name || targetTask.id,
      draftType: link.type,
      draftLagInUnit,
      unitMinutes,
      stepInUnit,
      unitKey,
      anchorContentX,
      anchorContentY,
      anchorClientX: anchor?.clientX,
      anchorClientY: anchor?.clientY,
    }

    this.attachOutsidePointerDown()
    this.host.requestUpdate()
    return true
  }

  /**
   * 組み込みの依存関係編集ポップオーバーを閉じる
   */
  public closeEditPopover(): void {
    if (!this.editingPopover) return
    this.editingPopover = null
    this.detachOutsidePointerDown()
    this.host.requestUpdate()
  }

  /**
   * ポップオーバー編集中の依存関係種別ドラフトを更新する
   */
  public setDraftType(type: DependencyType): void {
    if (!this.editingPopover) return
    this.editingPopover = {
      ...this.editingPopover,
      draftType: type,
    }
    this.host.requestUpdate()
  }

  /**
   * ポップオーバー編集中のラグ数値ドラフトを更新する
   */
  public setDraftLagInUnit(value: number): void {
    if (!this.editingPopover || Number.isNaN(value)) return
    this.editingPopover = {
      ...this.editingPopover,
      draftLagInUnit: value,
    }
    this.host.requestUpdate()
  }

  /**
   * ポップオーバー編集中のラグをステップ単位で増減する
   */
  public stepDraftLag(direction: -1 | 1): void {
    if (!this.editingPopover) return
    const next =
      Math.round((this.editingPopover.draftLagInUnit + direction * this.editingPopover.stepInUnit) * 100) /
      100
    this.setDraftLagInUnit(next)
  }

  /**
   * ポップオーバーの現在のドラフト内容を保存して閉じる
   */
  public commitEditPopover(): boolean {
    if (!this.editingPopover) return false
    const { sourceTaskId, targetTaskId, draftType, draftLagInUnit, unitMinutes } = this.editingPopover
    const lagMinutes = Math.round(draftLagInUnit * unitMinutes)
    const updated = this.updateDependency(sourceTaskId, targetTaskId, {
      type: draftType,
      lag: lagMinutes,
    })
    this.closeEditPopover()
    return updated
  }

  /**
   * 依存関係の種別（FS/SS/FF/SF）またはラグを更新し、履歴記録・自動スケジューリング連動・`dependency-update` イベント発火を行う
   */
  public updateDependency(
    sourceTaskId: string,
    targetTaskId: string,
    updates: DependencyUpdateInput,
  ): boolean {
    if (this.host.option?.readOnly) return false

    let sourceTask: GanttTask | undefined
    let targetTask: GanttTask | undefined
    for (const row of this.host.rows) {
      for (const task of row.tasks) {
        if (task.id === sourceTaskId) sourceTask = task
        if (task.id === targetTaskId) targetTask = task
      }
    }
    if (!sourceTask || !targetTask || !targetTask.dependencies) return false

    const rawDep = targetTask.dependencies.find((d) => getDependencyTaskId(d) === sourceTaskId)
    if (!rawDep) return false

    const previousDependency = normalizeDependencyLink(rawDep)
    const nextType: DependencyType = updates.type ?? previousDependency.type
    const nextLag: number =
      updates.lag !== undefined && !Number.isNaN(updates.lag)
        ? updates.lag
        : updates.lagDays !== undefined && !Number.isNaN(updates.lagDays)
          ? Math.round(updates.lagDays * 1440)
          : previousDependency.lag

    const nextDependency: Required<GanttDependencyLink> = {
      taskId: sourceTaskId,
      type: nextType,
      lag: nextLag,
    }

    if (
      nextDependency.type === previousDependency.type &&
      nextDependency.lag === previousDependency.lag
    ) {
      return false
    }

    const beforeDetail: BeforeDependencyUpdateHookDetail = {
      sourceTaskId,
      targetTaskId,
      dependency: nextDependency,
      previousDependency,
    }

    let applied = false
    const commitUpdate = () => {
      const previousRows = this.host.rows
      const oldTaskSnapshot = new Map<string, { rowId: string; start: Date; end: Date }>()
      for (const row of previousRows) {
        for (const task of row.tasks) {
          oldTaskSnapshot.set(task.id, {
            rowId: row.id,
            start: new Date(task.start),
            end: new Date(task.end),
          })
        }
      }

      const updatedEntry = createDependencyEntry(sourceTaskId, nextType, nextLag)
      let newRows = previousRows.map((row) => ({
        ...row,
        tasks: row.tasks.map((task) => {
          if (task.id === targetTaskId && task.dependencies) {
            return {
              ...task,
              dependencies: task.dependencies.map((dep) =>
                getDependencyTaskId(dep) === sourceTaskId ? updatedEntry : dep,
              ),
            }
          }
          return task
        }),
      }))

      let affectedTasks: DependencyUpdateEventDetail['affectedTasks']
      if (this.host.option.dependency?.autoSchedule) {
        const scheduleResult = propagateAutoSchedule(newRows, [sourceTaskId], {
          mode: this.host.option.dependency.scheduleMode ?? 'strict',
          respectMovable: this.host.option.dependency.respectMovable,
          calendarMode: this.host.option.calendar?.calendarMode,
          isHoliday: this.host.option.calendar?.isHoliday,
          nonWorkingDays: this.host.option.calendar?.nonWorkingDays,
        })
        if (scheduleResult.hasChanges) {
          newRows = scheduleResult.rows
          const updatedIdSet = new Set(scheduleResult.updatedTaskIds)
          affectedTasks = []
          for (const row of newRows) {
            for (const task of row.tasks) {
              if (updatedIdSet.has(task.id)) {
                const prev = oldTaskSnapshot.get(task.id)
                if (prev) {
                  affectedTasks.push({
                    task,
                    rowId: row.id,
                    oldStart: prev.start,
                    oldEnd: prev.end,
                  })
                }
              }
            }
          }
        }
      }

      this.host.applyRowsChangeWithCommand(previousRows, newRows, {
        type: 'dependency-update',
        description: `タスク「${sourceTask?.name || sourceTaskId}」から「${targetTask?.name || targetTaskId}」への接続線を変更`,
      })

      const eventDetail: DependencyUpdateEventDetail = {
        sourceTaskId,
        targetTaskId,
        dependency: nextDependency,
        previousDependency,
        ...(affectedTasks && affectedTasks.length > 0 ? { affectedTasks } : {}),
      }

      this.host.dispatchEvent(
        new CustomEvent<DependencyUpdateEventDetail>('dependency-update', {
          detail: eventDetail,
          bubbles: true,
          composed: true,
        }),
      )

      this.host.pluginManager?.executeAfterDependencyUpdate(eventDetail)
      applied = true
    }

    if (this.host.pluginManager) {
      this.host.pluginManager.runBeforeHook('beforeDependencyUpdate', beforeDetail, commitUpdate)
    } else {
      commitUpdate()
    }

    return applied
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
    let minDist = e.detail?.pointerType === 'touch' ? 42 : 30 // スナップ閾値（px）

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

    this.connectorDrag = null
    this.host.requestUpdate()

    if (!cancelled && targetTaskId && targetEndpoint && sourceTaskId !== targetTaskId) {
      const { taskCoords } = this.host.calculateLayout()
      const sourceCoord = taskCoords.get(sourceTaskId)
      const targetCoord = taskCoords.get(targetTaskId)
      if (!sourceCoord?.isSummary && !targetCoord?.isSummary) {
        const depType = endpointsToDependencyType(sourceEndpoint, targetEndpoint)
        const detail: DependencyCreateEventDetail = {
          sourceTaskId,
          sourceEndpoint,
          targetTaskId,
          targetEndpoint,
          type: depType,
        }

        const commitCreate = () => {
          let sourceTask: GanttTask | undefined
          let targetTask: GanttTask | undefined
          for (const row of this.host.rows) {
            for (const t of row.tasks) {
              if (t.id === sourceTaskId) sourceTask = t
              if (t.id === targetTaskId) targetTask = t
            }
          }

          const depEntry = createDependencyEntry(sourceTaskId, depType)
          const currentDeps = targetTask?.dependencies ?? []
          if (targetTask && !hasDependencyTarget(currentDeps, sourceTaskId)) {
            const previousRows = this.host.rows
            let newRows = previousRows.map((row) => ({
              ...row,
              tasks: row.tasks.map((t) => {
                if (t.id === targetTaskId) {
                  return {
                    ...t,
                    dependencies: [...(t.dependencies ?? []), depEntry],
                  }
                }
                return t
              }),
            }))

            if (this.host.option.dependency?.autoSchedule) {
              const scheduleResult = propagateAutoSchedule(newRows, [sourceTaskId], {
                mode: this.host.option.dependency.scheduleMode,
                respectMovable: this.host.option.dependency.respectMovable,
                calendarMode: this.host.option.calendar?.calendarMode,
                isHoliday: this.host.option.calendar?.isHoliday,
                nonWorkingDays: this.host.option.calendar?.nonWorkingDays,
              })
              if (scheduleResult.hasChanges) {
                newRows = scheduleResult.rows
              }
            }

            this.host.applyRowsChangeWithCommand(previousRows, newRows, {
              type: 'dependency-create',
              description: `タスク「${sourceTask?.name || sourceTaskId}」から「${targetTask?.name || targetTaskId}」への接続線を追加`,
            })
          }

          this.host.dispatchEvent(
            new CustomEvent<DependencyCreateEventDetail>('dependency-create', {
              detail,
              bubbles: true,
              composed: true,
            }),
          )

          this.host.pluginManager?.executeAfterDependencyCreate(detail)
        }

        if (this.host.pluginManager) {
          this.host.pluginManager.runBeforeHook('beforeDependencyCreate', detail, commitCreate)
        } else {
          commitCreate()
        }
      }
    }
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

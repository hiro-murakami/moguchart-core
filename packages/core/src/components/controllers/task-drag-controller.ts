import type { ReactiveController, ReactiveControllerHost } from 'lit'
import { html, render } from 'lit'
import type {
  GanttChartOption,
  GanttRow,
  GanttTask,
  GanttTaskMoveMode,
  TaskUpdateEventDetail,
} from '../../core/types'
import type { GanttCommandType } from '../../core/history'
import { calculateTaskLanes, getThemeColors, formatDuration, xToDate } from '../../core/utils'
import { jaLocale } from '../../core/i18n'
import { DEFAULT_BAR_MARGIN } from '../../core/constants'

export interface DragOverlayInfo {
  id: string
  name?: string
  start: Date
  end: Date
  currentStart: Date
  currentEnd: Date
  targetRow?: GanttRow
  visible: boolean
  clientX?: number
  clientY?: number
  barX?: number
  barTop?: number
  barBottom?: number
}

export interface DragPreviewState {
  task: GanttTask
  currentStart: Date
  currentEnd: Date
  rowId: string
}

export interface DraggingTaskState {
  id: string
  name?: string
  start: Date
  end: Date
  currentStart: Date
  currentEnd: Date
  mode?: GanttTaskMoveMode
}

export interface TaskDragControllerHost extends ReactiveControllerHost, HTMLElement {
  rows: GanttRow[]
  displayRows: GanttRow[]
  option: GanttChartOption
  theme: 'light' | 'dark'
  selectedTasks: Set<string>
  effectivePxPerDay: number
  effectivePxPerMonth: number | undefined
  effectiveBarHeight: number
  calendarHeight: number
  currentRowHeaderWidth: number
  calculateLayout(): { layouts: Array<{ top: number; height: number }>; totalHeight: number }
  getDateX(date: Date): number
  applyRowsChangeWithCommand(
    previousRows: GanttRow[],
    newRows: GanttRow[],
    commandInfo: { type: GanttCommandType; description: string },
  ): void
  clearTooltip?(): void
}

/**
 * ガントチャートのタスクドラッグ・移動・リサイズ・ドラッグオーバーレイ・外部ドロップを管理するコントローラー
 */
export class TaskDragController implements ReactiveController {
  private host: TaskDragControllerHost

  public draggingTask: DraggingTaskState | null = null
  public draggingTaskIds: string[] = []
  public multiDragDx = 0
  public multiDragDy = 0
  public multiDragSameRow = false
  public dragTargetRowIndex: number | null = null
  public dragOverlayInfo: DragOverlayInfo | null = null
  public dragPreview: DragPreviewState | null = null

  constructor(host: TaskDragControllerHost) {
    this.host = host
    host.addController(this)
  }

  hostConnected(): void {}
  hostDisconnected(): void {}

  public isMultiDrag(taskId: string): boolean {
    return this.host.selectedTasks.size >= 2 && this.host.selectedTasks.has(taskId)
  }

  /**
   * 選択中の全タスクが同じ行に属しているかを判定する。
   * 同じ行なら縦方向（行間）の移動を許可する。
   */
  public isMultiDragSameRow(): boolean {
    if (this.host.selectedTasks.size < 2) return false
    let commonRowId: string | null = null
    for (const row of this.host.rows) {
      for (const task of row.tasks) {
        if (this.host.selectedTasks.has(task.id)) {
          if (commonRowId === null) {
            commonRowId = row.id
          } else if (commonRowId !== row.id) {
            return false
          }
        }
      }
    }
    return commonRowId !== null
  }

  /**
   * ドラッグ状態を初期化・クリーンアップする
   */
  public cleanupDragState(): void {
    this.draggingTask = null
    this.draggingTaskIds = []
    this.multiDragDx = 0
    this.multiDragDy = 0
    this.multiDragSameRow = false
    this.dragTargetRowIndex = null
    if (this.dragOverlayInfo) {
      this.dragOverlayInfo = { ...this.dragOverlayInfo, visible: false }
      this.hideDragOverlay()
    }
    this.host.requestUpdate()
  }

  /**
   * ドラッグオーバーレイを直接DOM操作で更新する。
   * Litの再レンダリングサイクルを回避し、高速描画する。
   */
  public updateDragOverlay(): void {
    if (!this.dragOverlayInfo || this.host.option.showDragInfoOverlay === false) return
    const colors = getThemeColors(this.host.theme, this.host.option.customTheme)
    const dragInfoEl = this.host.shadowRoot?.querySelector('.drag-info-overlay') as HTMLElement
    if (!dragInfoEl) return

    dragInfoEl.classList.toggle('visible', this.dragOverlayInfo.visible)
    const { targetRow } = this.dragOverlayInfo
    const content = this.host.option.customRendering?.dragInfo
      ? this.host.option.customRendering.dragInfo(
          {
            id: this.dragOverlayInfo.id,
            name: this.dragOverlayInfo.name,
            start: this.dragOverlayInfo.start,
            end: this.dragOverlayInfo.end,
          } as GanttTask,
          this.dragOverlayInfo.currentStart,
          this.dragOverlayInfo.currentEnd,
          targetRow,
        )
      : undefined

    if (content) {
      render(content, dragInfoEl)
    } else {
      const locale = this.host.option.locale ?? jaLocale
      const isMonthlyMode = !!this.host.option.calendar.pxPerMonth
      let startLabel: string
      let endLabel: string
      if (isMonthlyMode) {
        const endForDisplay = new Date(this.dragOverlayInfo.currentEnd)
        endForDisplay.setMonth(endForDisplay.getMonth() - 1)
        startLabel = locale.yearMonthFormat(this.dragOverlayInfo.currentStart)
        endLabel = locale.yearMonthFormat(endForDisplay)
      } else {
        startLabel = locale.dateTimeFormat(this.dragOverlayInfo.currentStart)
        endLabel = locale.dateTimeFormat(this.dragOverlayInfo.currentEnd)
      }
      render(
        html`
          <div style="font-weight: bold;">
            ${this.dragOverlayInfo.name || locale.dragOverlay.noTitle}
          </div>
          <div class="drag-info-sub">
            ${startLabel} -
            ${endLabel}
            (${formatDuration(this.dragOverlayInfo.currentStart, this.dragOverlayInfo.currentEnd, this.host.option.locale)})
          </div>
          ${targetRow
            ? html`<div class="drag-info-sub" style="margin-top: 4px; border-top: 1px solid ${colors.dragOverlayDivider}; padding-top: 4px; width: 100%;">${(this.host.option.locale ?? jaLocale).dragOverlay.moveTo(targetRow.name)}</div>`
            : ''}
        `,
        dragInfoEl,
      )
    }

    // --- タスクバーに追従するポジショニング ---
    if (this.dragOverlayInfo.barTop !== undefined || this.dragOverlayInfo.clientY !== undefined) {
      const mouseX = this.dragOverlayInfo.clientX ?? 0
      const mouseY = this.dragOverlayInfo.clientY ?? 0
      const hostRect = this.host.getBoundingClientRect()

      // マウスがガントチャートの外にある場合はオーバーレイを非表示
      if (
        this.dragOverlayInfo.clientY !== undefined &&
        (mouseX < hostRect.left || mouseX > hostRect.right ||
        mouseY < hostRect.top || mouseY > hostRect.bottom)
      ) {
        dragInfoEl.classList.remove('visible')
        return
      }

      const overlayWidth = dragInfoEl.offsetWidth || 200
      const overlayHeight = dragInfoEl.offsetHeight || 60
      const gap = 10 // バーとオーバーレイの間隔(px)
      const margin = 8 // ビューポート端からの最小マージン(px)
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      const targetX = this.dragOverlayInfo.barX ?? mouseX
      const targetTop = this.dragOverlayInfo.barTop ?? mouseY
      const targetBottom = this.dragOverlayInfo.barBottom ?? mouseY

      // X方向: バーの中心に配置し、画面端でクランプ
      let left = targetX - overlayWidth / 2
      left = Math.max(margin, Math.min(left, viewportWidth - overlayWidth - margin))

      // Y方向: デフォルトはバーの上に表示
      let top = targetTop - overlayHeight - gap

      // 上にはみ出す場合はバーの下に表示
      if (top < margin) {
        top = targetBottom + gap
      }

      // 下にはみ出す場合はクランプ
      if (top + overlayHeight > viewportHeight - margin) {
        top = viewportHeight - overlayHeight - margin
      }

      dragInfoEl.style.left = `${left}px`
      dragInfoEl.style.transform = 'none'
      dragInfoEl.style.top = `${top}px`
      dragInfoEl.style.bottom = 'auto'
    }
  }

  public hideDragOverlay(): void {
    const dragInfoEl = this.host.shadowRoot?.querySelector('.drag-info-overlay') as HTMLElement
    if (dragInfoEl) {
      dragInfoEl.classList.remove('visible')
    }
  }

  public handleTaskUpdate(e: CustomEvent<TaskUpdateEventDetail & { mode?: GanttTaskMoveMode }>): void {
    e.stopPropagation()
    const { id, start, end, dx, isDragging, mode } = e.detail
    let { dy } = e.detail

    const isMulti = this.isMultiDrag(id)
    const sameRow = isMulti && this.isMultiDragSameRow()

    // 複数選択移動時：異なる行のバーが含まれる場合はdy=0に固定（行移動を無効化）
    // 同じ行のバーのみ選択されている場合は縦移動を許可
    if (isMulti && !sameRow) {
      dy = 0
    }

    let newStart = start
    let newEnd = end

    if (dx !== undefined) {
      const pxPerDay = this.host.effectivePxPerDay
      const pxPerMonth = this.host.effectivePxPerMonth
      const startX = this.host.getDateX(start)
      const endX = this.host.getDateX(end)
      newStart = xToDate(startX + dx, this.host.option.calendar.start, pxPerDay, pxPerMonth)
      newEnd = xToDate(endX + dx, this.host.option.calendar.start, pxPerDay, pxPerMonth)
    }

    // 月単位モードではsnapDurationに関わらず1ヶ月単位でスナップ
    if (this.host.option.calendar.pxPerMonth) {
      if (newStart.getDate() > 15) newStart.setMonth(newStart.getMonth() + 1)
      newStart.setDate(1)
      newStart.setHours(0, 0, 0, 0)
      if (newEnd.getDate() > 15) newEnd.setMonth(newEnd.getMonth() + 1)
      newEnd.setDate(1)
      newEnd.setHours(0, 0, 0, 0)
    } else if (this.host.option.snapDuration && this.host.option.snapDuration >= 43200) {
      if (newStart.getDate() > 15) newStart.setMonth(newStart.getMonth() + 1)
      newStart.setDate(1)
      newStart.setHours(0, 0, 0, 0)
      if (newEnd.getDate() > 15) newEnd.setMonth(newEnd.getMonth() + 1)
      newEnd.setDate(1)
      newEnd.setHours(0, 0, 0, 0)
    }

    let sourceRowIndex = -1
    let taskToMove: GanttTask | undefined
    let taskIndexInSource = -1

    this.host.rows.find((r, index) => {
      const taskI = r.tasks.findIndex((t) => t.id === id)
      if (taskI !== -1) {
        sourceRowIndex = index
        taskToMove = r.tasks[taskI]
        taskIndexInSource = taskI
        return true
      }
      return false
    })

    if (sourceRowIndex === -1 || !taskToMove) return

    const { layouts: rowLayouts } = this.host.calculateLayout()
    const sourceRowIndexInDisplay = this.host.displayRows.findIndex((r) => r.id === this.host.rows[sourceRowIndex].id)
    if (sourceRowIndexInDisplay === -1) return

    const dragStartRowTop = rowLayouts[sourceRowIndexInDisplay].top

    const displayRow = this.host.displayRows[sourceRowIndexInDisplay]
    const { tasksWithLanes } = calculateTaskLanes(displayRow.tasks)
    const taskWithLane = tasksWithLanes.find((t) => t.id === id)
    const lane = taskWithLane ? taskWithLane.lane : 0
    const barHeight = this.host.effectiveBarHeight
    const barMargin = this.host.option.bar?.margin ?? DEFAULT_BAR_MARGIN

    const taskInitialY = lane * (barHeight + barMargin) + barMargin
    const currentY = dragStartRowTop + taskInitialY + dy + barHeight / 2

    const allowCrossRowMove = this.host.option.enableCrossRowMove !== false
    let targetRowIndex = -1
    if (allowCrossRowMove) {
      for (let i = 0; i < rowLayouts.length; i++) {
        const rowLayout = rowLayouts[i]
        if (currentY >= rowLayout.top && currentY < rowLayout.top + rowLayout.height) {
          targetRowIndex = i
          break
        }
      }
    } else {
      const sourceRow = this.host.rows[sourceRowIndex]
      targetRowIndex = this.host.displayRows.findIndex((r) => r.id === sourceRow.id)
    }

    const targetRowId = targetRowIndex !== -1 ? this.host.displayRows[targetRowIndex].id : undefined

    // 外部に通知するイベントに複数選択情報を含める
    const selectedIds = isMulti ? [...this.host.selectedTasks] : undefined

    this.host.dispatchEvent(
      new CustomEvent('task-update', {
        detail: {
          ...e.detail,
          dy,
          start: newStart,
          end: newEnd,
          targetRowId,
          selectedTaskIds: selectedIds,
        },
        bubbles: true,
        composed: true,
      }),
    )

    if (isDragging) {
      this.host.clearTooltip?.()

      if (e.detail.isOutside || (allowCrossRowMove && targetRowIndex === -1)) {
        // ガントチャート外または行外にあるときは、ドラッグ状態の表示を初期状態（移動なし）に戻す
        this.multiDragDx = 0
        this.multiDragDy = 0
        this.dragTargetRowIndex = null
        if (this.dragOverlayInfo) {
          this.dragOverlayInfo = { ...this.dragOverlayInfo, visible: false }
          this.hideDragOverlay()
        }
        this.host.requestUpdate()
        return
      }

      // draggingTaskの更新は、IDが変わった時やドラッグ開始時のみ行う
      // 座標が変わるたびに更新すると全行の再レンダリングが走ってしまうため
      if (!this.draggingTask || this.draggingTask.id !== id) {
        this.draggingTask = {
          id,
          name: e.detail.name,
          start,
          end,
          currentStart: newStart,
          currentEnd: newEnd,
          mode,
        }

        // 複数選択時はドラッグ中のタスクIDリストを設定
        if (isMulti) {
          this.draggingTaskIds = [...this.host.selectedTasks]
        } else {
          this.draggingTaskIds = []
        }
      }

      // 複数ドラッグ中のdx/dy値は毎フレーム更新（ゴースト表示位置の追従のため）
      if (isMulti) {
        this.multiDragDx = dx ?? 0
        this.multiDragSameRow = sameRow
        if (sameRow) {
          this.multiDragDy = dy
        } else {
          this.multiDragDy = 0
        }
      } else if (this.multiDragDx !== 0 || this.multiDragDy !== 0) {
        this.multiDragDx = 0
        this.multiDragDy = 0
      }

      // 複数選択移動時：異なる行のバーが含まれる場合はtargetRowIndexを更新しない
      // 同じ行のバーのみの場合はtargetRowIndexを更新（行移動を有効化）
      if (!isMulti || sameRow) {
        const newDragTargetRowIndex = targetRowIndex >= 0 ? targetRowIndex : null
        if (this.dragTargetRowIndex !== newDragTargetRowIndex) {
          this.dragTargetRowIndex = newDragTargetRowIndex
        }
      }

      // ドラッグオーバーレイ: 複数選択時は件数を表示
      if (isMulti) {
        this.dragOverlayInfo = {
          id,
          name: (this.host.option.locale ?? jaLocale).dragOverlay.movingTasks(this.host.selectedTasks.size),
          start,
          end,
          currentStart: newStart,
          currentEnd: newEnd,
          visible: true,
          clientX: e.detail.x,
          clientY: e.detail.y,
          barX: e.detail.barX,
          barTop: e.detail.barTop,
          barBottom: e.detail.barBottom,
        }
      } else {
        this.dragOverlayInfo = {
          id,
          name: e.detail.name,
          start,
          end,
          currentStart: newStart,
          currentEnd: newEnd,
          targetRow:
            targetRowIndex >= 0 && this.host.displayRows[targetRowIndex]?.id !== this.host.rows[sourceRowIndex]?.id
              ? this.host.displayRows[targetRowIndex]
              : undefined,
          visible: true,
          clientX: e.detail.x,
          clientY: e.detail.y,
          barX: e.detail.barX,
          barTop: e.detail.barTop,
          barBottom: e.detail.barBottom,
        }
      }
      this.updateDragOverlay()
      this.host.requestUpdate()
      return
    }

    // ドロップ時の処理
    const droppedMulti = this.draggingTaskIds.length >= 2
    const droppedSameRow = this.multiDragSameRow
    this.cleanupDragState()

    // キャンセル、チャート外、または行が存在しない場所でドロップされた場合は、タスク移動を適用しない
    if (e.detail.isCancel || e.detail.isOutside || (allowCrossRowMove && targetRowIndex === -1)) {
      return
    }

    // targetRowIndex は displayRows のインデックスなので、this.host.rows のインデックスに変換
    let targetRowIndexInRows = -1
    if (targetRowIndex !== -1) {
      const targetRow = this.host.displayRows[targetRowIndex]
      targetRowIndexInRows = this.host.rows.findIndex((r) => r.id === targetRow.id)
    }

    const previousRows = this.host.rows

    // 複数バー移動のドロップ処理
    if (droppedMulti && dx !== undefined) {
      const pxPerDay = this.host.effectivePxPerDay
      const pxPerMonth = this.host.effectivePxPerMonth

      // 同一行の複数バーが別の行にドロップされた場合の行移動処理
      const needsRowMove = droppedSameRow && targetRowIndexInRows !== -1 && sourceRowIndex !== targetRowIndexInRows

      if (needsRowMove) {
        // 全選択タスクをソース行から取り出してターゲット行に移動
        const newRows = [...this.host.rows]
        const sourceRow = { ...newRows[sourceRowIndex] }
        const targetRow = { ...newRows[targetRowIndexInRows] }
        sourceRow.tasks = [...sourceRow.tasks]
        targetRow.tasks = [...targetRow.tasks]

        const movedTasks: GanttTask[] = []
        sourceRow.tasks = sourceRow.tasks.filter((t) => {
          if (this.host.selectedTasks.has(t.id)) {
            const tStartX = this.host.getDateX(t.start)
            const tEndX = this.host.getDateX(t.end)
            const ns = xToDate(tStartX + dx, this.host.option.calendar.start, pxPerDay, pxPerMonth)
            const ne = xToDate(tEndX + dx, this.host.option.calendar.start, pxPerDay, pxPerMonth)
            if (this.host.option.calendar.pxPerMonth) {
              if (ns.getDate() > 15) ns.setMonth(ns.getMonth() + 1)
              ns.setDate(1)
              ns.setHours(0, 0, 0, 0)
              if (ne.getDate() > 15) ne.setMonth(ne.getMonth() + 1)
              ne.setDate(1)
              ne.setHours(0, 0, 0, 0)
            } else if (this.host.option.snapDuration && this.host.option.snapDuration >= 43200) {
              if (ns.getDate() > 15) ns.setMonth(ns.getMonth() + 1)
              ns.setDate(1)
              ns.setHours(0, 0, 0, 0)
              if (ne.getDate() > 15) ne.setMonth(ne.getMonth() + 1)
              ne.setDate(1)
              ne.setHours(0, 0, 0, 0)
            }
            movedTasks.push({ ...t, start: ns, end: ne })
            return false
          }
          return true
        })
        targetRow.tasks.push(...movedTasks)
        newRows[sourceRowIndex] = sourceRow
        newRows[targetRowIndexInRows] = targetRow

        requestAnimationFrame(() => {
          this.host.applyRowsChangeWithCommand(previousRows, newRows, {
            type: 'task-move',
            description: '複数タスクの移動',
          })
        })
      } else {
        // 同じ行内での水平移動のみ
        const newRows = this.host.rows.map((row) => {
          const hasSelectedTask = row.tasks.some((t) => this.host.selectedTasks.has(t.id))
          if (!hasSelectedTask) return row

          return {
            ...row,
            tasks: row.tasks.map((t) => {
              if (!this.host.selectedTasks.has(t.id)) return t
              const tStartX = this.host.getDateX(t.start)
              const tEndX = this.host.getDateX(t.end)
              const ns = xToDate(tStartX + dx, this.host.option.calendar.start, pxPerDay, pxPerMonth)
              const ne = xToDate(tEndX + dx, this.host.option.calendar.start, pxPerDay, pxPerMonth)
              // 月単位モードではsnapDurationに関わらず1ヶ月単位でスナップ
              if (this.host.option.calendar.pxPerMonth) {
                if (ns.getDate() > 15) ns.setMonth(ns.getMonth() + 1)
                ns.setDate(1)
                ns.setHours(0, 0, 0, 0)
                if (ne.getDate() > 15) ne.setMonth(ne.getMonth() + 1)
                ne.setDate(1)
                ne.setHours(0, 0, 0, 0)
              } else if (this.host.option.snapDuration && this.host.option.snapDuration >= 43200) {
                if (ns.getDate() > 15) ns.setMonth(ns.getMonth() + 1)
                ns.setDate(1)
                ns.setHours(0, 0, 0, 0)
                if (ne.getDate() > 15) ne.setMonth(ne.getMonth() + 1)
                ne.setDate(1)
                ne.setHours(0, 0, 0, 0)
              }
              return {
                ...t,
                start: ns,
                end: ne,
              }
            }),
          }
        })

        // 月単位モードは重いので rAF で rows 更新を次フレームに遅延させる
        requestAnimationFrame(() => {
          this.host.applyRowsChangeWithCommand(previousRows, newRows, {
            type: 'task-move',
            description: '複数タスクの移動',
          })
        })
      }
      return
    }

    if (mode === 'copy') {
      if (targetRowIndexInRows !== -1) {
        const newRows = [...this.host.rows]
        const targetRow = { ...newRows[targetRowIndexInRows] }
        targetRow.tasks = [...targetRow.tasks]

        // 新しいIDを生成
        const newId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

        const newTask = {
          ...taskToMove,
          id: newId,
          start: newStart,
          end: newEnd,
          dependencies: [],
        }

        targetRow.tasks.push(newTask)
        newRows[targetRowIndexInRows] = targetRow

        requestAnimationFrame(() => {
          this.host.applyRowsChangeWithCommand(previousRows, newRows, {
            type: 'custom',
            description: 'タスクの複製',
          })
        })
      }
    } else {
      const newRows = [...this.host.rows]
      const sourceRow = { ...newRows[sourceRowIndex] }
      sourceRow.tasks = [...sourceRow.tasks]
      newRows[sourceRowIndex] = sourceRow

      if (targetRowIndexInRows !== -1 && sourceRowIndex !== targetRowIndexInRows) {
        const targetRow = { ...newRows[targetRowIndexInRows] }
        targetRow.tasks = [...targetRow.tasks]
        newRows[targetRowIndexInRows] = targetRow

        const [movedTask] = sourceRow.tasks.splice(taskIndexInSource, 1)
        targetRow.tasks.push({ ...movedTask, start: newStart, end: newEnd })
      } else {
        sourceRow.tasks[taskIndexInSource] = {
          ...taskToMove,
          start: newStart,
          end: newEnd,
        }
      }

      const isResize = dx === undefined
      requestAnimationFrame(() => {
        this.host.applyRowsChangeWithCommand(previousRows, newRows, {
          type: isResize ? 'task-resize' : 'task-move',
          description: isResize ? 'タスク期間の変更' : 'タスクの移動',
        })
      })
    }
  }


  public handleExternalTaskDrop(e: DragEvent, taskJson: string): void {
    try {
      const parsed = JSON.parse(taskJson)

      if (
        !parsed ||
        typeof parsed !== 'object' ||
        typeof parsed.id !== 'string' ||
        typeof parsed.name !== 'string' ||
        !parsed.start ||
        !parsed.end
      ) {
        console.warn('Invalid dropped task data: missing required fields (id, name, start, end)')
        return
      }

      const start = new Date(parsed.start)
      const end = new Date(parsed.end)
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        console.warn('Invalid dropped task data: start or end is not a valid date')
        return
      }

      const task: GanttTask = { ...parsed, start, end }
      const container = this.host.shadowRoot?.querySelector('.scroll-container') as HTMLElement
      if (!container) return

      const rect = container.getBoundingClientRect()
      const scrollLeft = container.scrollLeft
      const scrollTop = container.scrollTop
      const labelWidth = this.host.currentRowHeaderWidth

      // X座標 -> 日時
      const x = e.clientX - rect.left + scrollLeft - labelWidth
      const pxPerDay = this.host.effectivePxPerDay
      const pxPerMonth = this.host.effectivePxPerMonth
      const dropDate = xToDate(x, this.host.option.calendar.start, pxPerDay, pxPerMonth)

      // Y座標 -> 行
      const yInRows = e.clientY - rect.top + scrollTop - this.host.calendarHeight

      const { layouts } = this.host.calculateLayout()
      let targetRowId: string | undefined

      for (let i = 0; i < layouts.length; i++) {
        const layout = layouts[i]
        if (yInRows >= layout.top && yInRows < layout.top + layout.height) {
          targetRowId = this.host.displayRows[i].id
          break
        }
      }

      if (targetRowId) {
        this.host.dispatchEvent(
          new CustomEvent('task-drop', {
            detail: { task, dropDate, targetRowId },
            bubbles: true,
            composed: true,
          }),
        )
      }
    } catch {
      console.warn('Failed to parse dropped task JSON')
    }
  }

}

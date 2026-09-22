import type { ReactiveController, ReactiveControllerHost } from 'lit'
import { html, render } from 'lit'
import type {
  GanttChartOption,
  GanttRow,
  GanttTask,
  GanttTaskMoveMode,
  RowReorderEventDetail,
  TaskUpdateEventDetail,
} from '../../core/types'
import type { GanttCommandType } from '../../core/history'
import { calculateTaskLanes, getThemeColors, formatDuration, xToDate } from '../../core/utils'
import { jaLocale } from '../../core/i18n'
import { DEFAULT_BAR_MARGIN } from '../../core/constants'
import { canDropRow, computeChildRowIds } from '../../core/wbs'
import type { GanttRowElement } from '../gantt-row'

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

export interface DragDropControllerHost extends ReactiveControllerHost, HTMLElement {
  rows: GanttRow[]
  displayRows: GanttRow[]
  option: GanttChartOption
  theme: 'light' | 'dark'
  selectedTasks: Set<string>
  selectedRows: Set<string>
  effectivePxPerDay: number
  effectivePxPerMonth: number | undefined
  effectiveBarHeight: number
  calendarHeight: number
  currentRowHeaderWidth: number
  externalDraggingTask: GanttTask | null
  _collapsedRowIds: Set<string>
  calculateLayout(): { layouts: Array<{ top: number; height: number }>; totalHeight: number }
  getDateX(date: Date): number
  applyRowsChangeWithCommand(
    previousRows: GanttRow[],
    newRows: GanttRow[],
    commandInfo: { type: GanttCommandType; description: string },
  ): void
  clearTooltip?(): void
}

export class DragDropController implements ReactiveController {
  private host: DragDropHostInternal

  public draggingTask: DraggingTaskState | null = null
  public draggingTaskIds: string[] = []
  public multiDragDx = 0
  public multiDragDy = 0
  public multiDragSameRow = false
  public dragTargetRowIndex: number | null = null
  public dragOverlayInfo: DragOverlayInfo | null = null
  public dragOverRowId: string | null = null
  public dragOverPosition: 'top' | 'bottom' | null = null
  public dragPreview: DragPreviewState | null = null
  public _draggingRowId: string | null = null

  constructor(host: DragDropControllerHost) {
    this.host = host as DragDropHostInternal
    host.addController(this)
  }

  hostConnected(): void {}

  hostDisconnected(): void {}

  /**
   * 複数バー移動かどうかを判定する。
   * ドラッグ中のバーが選択中バーに含まれ、選択数が2以上の場合にtrue。
   */
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

  public async reorderRows(sourceIds: string | string[], targetId: string, position: 'top' | 'bottom'): Promise<void> {
    const previousRows = this.host.rows
    const initialIds = Array.isArray(sourceIds) ? sourceIds : [sourceIds]

    // 循環参照・階層ルールガード: 移動対象自身または自身の子孫へのドロップ、親ブロック外移動は禁止
    if (!canDropRow(this.host.rows, initialIds, targetId, position)) {
      return
    }

    // ブロック連動: 親行が移動対象の場合、その配下の子孫行も一緒に移動対象に含める
    const allMovingIdsSet = new Set<string>()
    for (const id of initialIds) {
      allMovingIdsSet.add(id)
      const descendantIds = computeChildRowIds(this.host.rows, id, true)
      for (const descId of descendantIds) {
        allMovingIdsSet.add(descId)
      }
    }

    // 元の配列の順序を保った移動対象IDリスト
    const ids = this.host.rows
      .filter((r) => allMovingIdsSet.has(r.id))
      .map((r) => r.id)

    const rowElements = Array.from(this.host.shadowRoot?.querySelectorAll('gantt-row') ?? []) as GanttRowElement[]
    const positions = new Map<string, number>()
    rowElements.forEach((el) => {
      if (el.row) {
        positions.set(el.row.id, el.getBoundingClientRect().top)
      }
    })

    const newRows = [...this.host.rows]
    const movingRows: GanttRow[] = []
    const targetIndex = newRows.findIndex((r) => r.id === targetId)
    if (targetIndex === -1) return

    ids.forEach((id) => {
      const index = newRows.findIndex((r) => r.id === id)
      if (index !== -1) {
        movingRows.push(newRows[index])
      }
    })

    const filteredRows = newRows.filter((r) => !ids.includes(r.id))

    if (ids.includes(targetId)) return

    let newTargetIndex = filteredRows.findIndex((r) => r.id === targetId)

    if (position === 'bottom') {
      const targetRow = filteredRows[newTargetIndex]
      const isTargetCollapsed = targetRow && (targetRow.collapsed || this.host._collapsedRowIds.has(targetId))
      if (isTargetCollapsed) {
        // 折りたたまれた親行の下にドロップした場合、配下の全子孫行の末尾の後ろに配置する
        const descendantIds = new Set(computeChildRowIds(filteredRows, targetId, true))
        if (descendantIds.size > 0) {
          for (let i = newTargetIndex + 1; i < filteredRows.length; i++) {
            if (descendantIds.has(filteredRows[i].id)) {
              newTargetIndex = i
            }
          }
        }
      }
      newTargetIndex++
    }

    const targetRowInOrig = this.host.rows.find((r) => r.id === targetId)
    const firstParentId = movingRows[0]?.parentId ?? null

    // 新しい親IDの決定:
    // 1) ターゲットが自身の直接の親行（targetRow.id === firstParentId）の場合:
    //    - bottom: 親配下の先頭に移動（親はそのまま firstParentId）
    //    - top: 親行の前へ移動（親は targetRow.parentId）
    // 2) ターゲットがそれ以外の行の場合:
    //    - 常に targetRow.parentId が新しい親IDとなる
    const newParentId =
      firstParentId !== null && targetRowInOrig && targetRowInOrig.id === firstParentId && position === 'bottom'
        ? firstParentId
        : (targetRowInOrig?.parentId ?? null)

    // 移動した直接の対象行（initialIds）の parentId を newParentId に更新
    const updatedMovingRows = movingRows.map((row) => {
      if (initialIds.includes(row.id)) {
        if ((row.parentId ?? null) !== newParentId) {
          return { ...row, parentId: newParentId }
        }
      }
      return row
    })

    filteredRows.splice(newTargetIndex, 0, ...updatedMovingRows)

    this.host.applyRowsChangeWithCommand(previousRows, filteredRows, {
      type: 'row-reorder',
      description: '行の並び替え',
    })

    await this.host.updateComplete

    const newRowElements = Array.from(this.host.shadowRoot?.querySelectorAll('gantt-row') ?? []) as GanttRowElement[]

    newRowElements.forEach((el) => {
      if (el.row) {
        const oldTop = positions.get(el.row.id)
        if (oldTop !== undefined) {
          const newTop = el.getBoundingClientRect().top
          const dy = oldTop - newTop
          if (dy !== 0) {
            el.animate(
              [
                { transform: `translateY(${dy}px)`, zIndex: '1' },
                { transform: 'translateY(0)', zIndex: '1' },
              ],
              {
                duration: 300,
                easing: 'ease-out',
              },
            )
          }
        }
      }
    })

    this.host.dispatchEvent(
      new CustomEvent<RowReorderEventDetail>('row-reordered', {
        detail: {
          sourceId: ids[0],
          sourceIds: ids,
          targetId,
          position,
          rows: this.host.rows,
        },
        bubbles: true,
        composed: true,
      }),
    )
  }

  public handleContainerDragOver(e: DragEvent): void {
    const isExternalTask = !!(e.dataTransfer && e.dataTransfer.types.includes('application/json'))

    if (!this.host.option.enableRowReordering && !isExternalTask) {
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'none'
      }
      return
    }

    const container = this.host.shadowRoot?.querySelector('.scroll-container') as HTMLElement
    if (!container) return

    const rect = container.getBoundingClientRect()
    const y = e.clientY - rect.top + container.scrollTop
    const yInRows = y - this.host.calendarHeight

    const { layouts } = this.host.calculateLayout()

    let foundIndex = -1
    for (let i = 0; i < layouts.length; i++) {
      const layout = layouts[i]
      if (yInRows >= layout.top && yInRows < layout.top + layout.height) {
        foundIndex = i
        break
      }
    }

    if (foundIndex !== -1) {
      const row = this.host.displayRows[foundIndex]

      if (isExternalTask) {
        e.preventDefault()
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'copy'
        }

        if (this.dragOverRowId !== row.id || this.dragOverPosition !== null) {
          this.dragOverRowId = row.id
          this.dragOverPosition = null
          this.host.requestUpdate()
        }

        // ゴースト表示の計算
        if (this.host.externalDraggingTask) {
          const labelWidth = this.host.currentRowHeaderWidth
          const scrollLeft = container.scrollLeft
          const x = e.clientX - rect.left + scrollLeft - labelWidth
          const pxPerDay = this.host.effectivePxPerDay
          const pxPerMonth = this.host.effectivePxPerMonth

          // スナップ計算
          const snapDuration = this.host.option.snapDuration ?? 1440
          const pxPerMinute = pxPerDay / (24 * 60)
          const snapPx = pxPerMinute * snapDuration
          const snappedX = Math.round(x / snapPx) * snapPx

          // 日時計算
          const currentStart = xToDate(snappedX, this.host.option.calendar.start, pxPerDay, pxPerMonth)
          const durationMs = this.host.externalDraggingTask.end.getTime() - this.host.externalDraggingTask.start.getTime()
          const currentEnd = new Date(currentStart.getTime() + durationMs)

          if (
            !this.dragPreview ||
            this.dragPreview.rowId !== row.id ||
            this.dragPreview.currentStart.getTime() !== currentStart.getTime()
          ) {
            this.dragPreview = {
              task: this.host.externalDraggingTask,
              currentStart,
              currentEnd,
              rowId: row.id,
            }
            this.host.requestUpdate()
          }
        }
      } else {
        const layout = layouts[foundIndex]
        const relativeY = yInRows - layout.top
        const position = relativeY < layout.height / 2 ? 'top' : 'bottom'

        // 行ドラッグ中の場合、移動可否をチェックして不可ならドロップインジケータを表示せず禁止マークにする
        let canDrop = true
        const draggingId =
          this._draggingRowId ||
          (typeof window !== 'undefined' ? (window as any).__moguchart_dragging_row_id : null)

        if (draggingId) {
          const sourceIds =
            this.host.selectedRows.has(draggingId) && this.host.selectedRows.size > 1
              ? Array.from(this.host.selectedRows)
              : [draggingId]
          canDrop = canDropRow(this.host.rows, sourceIds, row.id, position)
        }

        if (!canDrop) {
          if (this.dragOverRowId !== null || this.dragOverPosition !== null) {
            this.dragOverRowId = null
            this.dragOverPosition = null
            this.host.requestUpdate()
          }
          if (e.dataTransfer) {
            e.dataTransfer.dropEffect = 'none'
          }
          return
        }

        // ドロップ可能な場合のみ preventDefault() を呼び出し、dropEffect = 'move' を設定
        e.preventDefault()
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'move'
        }

        if (this.dragOverRowId !== row.id || this.dragOverPosition !== position) {
          this.dragOverRowId = row.id
          this.dragOverPosition = position
          this.host.requestUpdate()
        }
      }
    } else {
      let changed = false
      if (this.dragOverRowId !== null || this.dragOverPosition !== null || this.dragPreview !== null) {
        changed = true
      }
      this.dragOverRowId = null
      this.dragOverPosition = null
      this.dragPreview = null
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'none'
      }
      if (changed) {
        this.host.requestUpdate()
      }
    }
  }

  public handleRowDragStart(e: CustomEvent<{ rowId: string }>): void {
    this._draggingRowId = e.detail.rowId
    if (typeof window !== 'undefined') {
      ;(window as any).__moguchart_dragging_row_id = e.detail.rowId
    }
  }

  public handleRowDragEnd(): void {
    this._draggingRowId = null
    if (typeof window !== 'undefined') {
      delete (window as any).__moguchart_dragging_row_id
    }
    this.dragOverRowId = null
    this.dragOverPosition = null
    this.host.requestUpdate()
  }

  public handleContainerDragLeave(e: DragEvent): void {
    const container = this.host.shadowRoot?.querySelector('.scroll-container') as HTMLElement
    const related = e.relatedTarget as HTMLElement
    if (container && container.contains(related)) return

    this.dragOverRowId = null
    this.dragOverPosition = null
    this.dragPreview = null
    this.host.requestUpdate()
  }

  public handleContainerDrop(e: DragEvent): void {
    e.preventDefault()

    const taskJson = e.dataTransfer?.getData('application/json')
    if (taskJson) {
      this.handleExternalTaskDrop(e, taskJson)
      this.dragOverRowId = null
      this.dragOverPosition = null
      this.dragPreview = null
      this._draggingRowId = null
      if (typeof window !== 'undefined') {
        delete (window as any).__moguchart_dragging_row_id
      }
      this.host.requestUpdate()
      return
    }

    if (!this.host.option.enableRowReordering) return
    const sourceId = e.dataTransfer?.getData('text/plain') || this._draggingRowId
    const targetId = this.dragOverRowId
    const position = this.dragOverPosition

    this.dragOverRowId = null
    this.dragOverPosition = null
    this.dragPreview = null
    this._draggingRowId = null
    if (typeof window !== 'undefined') {
      delete (window as any).__moguchart_dragging_row_id
    }
    this.host.requestUpdate()

    if (sourceId && targetId && sourceId !== targetId && position) {
      const sourceIds =
        this.host.selectedRows.has(sourceId) && this.host.selectedRows.size > 1
          ? Array.from(this.host.selectedRows)
          : [sourceId]

      if (!canDropRow(this.host.rows, sourceIds, targetId, position)) {
        return
      }

      this.reorderRows(sourceIds, targetId, position)
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

// 内部用型
type DragDropHostInternal = DragDropControllerHost & {
  clearTooltip?(): void
}

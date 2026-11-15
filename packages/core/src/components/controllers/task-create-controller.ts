import type { ReactiveController, ReactiveControllerHost } from 'lit'
import type {
  BarSelectionChangeEventDetail,
  BeforeTaskCreateHookDetail,
  GanttChartOption,
  GanttChartOptionTaskCreation,
  GanttRow,
  GanttTask,
  GanttTaskCreationTrigger,
  TaskCreateEventDetail,
} from '../../core/types'
import type { GanttCommandType } from '../../core/history'
import type { PluginManager } from '../../core/plugin'
import type { DragOverlayInfo, DragPreviewState } from './task-drag-controller'
import { dateToX, xToDate } from '../../core/utils'
import { jaLocale } from '../../core/i18n'

export interface ResolvedTaskCreationConfig {
  enabled: boolean
  trigger: GanttTaskCreationTrigger
  defaultDurationMinutes?: number
  defaultTaskName?: string
  defaultBarColor?: string
  allowOnSummaryRow: boolean
  createTask?: (context: { row: GanttRow; start: Date; end: Date }) => Partial<GanttTask>
}

/**
 * オプションから新規タスク作成設定を正規化して返す（無効または readOnly 時は null）
 */
export function resolveTaskCreationConfig(
  option?: GanttChartOption,
): ResolvedTaskCreationConfig | null {
  if (!option || option.readOnly === true) return null
  const raw = option.taskCreation
  if (!raw) return null
  if (typeof raw === 'object' && raw.enabled === false) return null

  const cfg: GanttChartOptionTaskCreation = typeof raw === 'object' ? raw : {}
  return {
    enabled: true,
    trigger: cfg.trigger ?? 'alt-drag-or-dblclick',
    defaultDurationMinutes: cfg.defaultDurationMinutes,
    defaultTaskName: cfg.defaultTaskName,
    defaultBarColor: cfg.defaultBarColor,
    allowOnSummaryRow: cfg.allowOnSummaryRow === true,
    createTask: cfg.createTask,
  }
}

export interface TaskCreateControllerHost extends ReactiveControllerHost, HTMLElement {
  rows: GanttRow[]
  displayRows: GanttRow[]
  option: GanttChartOption
  selectedTasks: Set<string>
  effectivePxPerDay: number
  effectivePxPerMonth: number | undefined
  effectiveBarHeight: number
  effectiveSnapDuration: number
  calendarHeight: number
  currentRowHeaderWidth: number
  calculateLayout(): { layouts: Array<{ top: number; height: number }>; totalHeight: number }
  applyRowsChangeWithCommand(
    previousRows: GanttRow[],
    newRows: GanttRow[],
    commandInfo: { type: GanttCommandType; description: string },
  ): void
  pluginManager?: PluginManager
  dragOverlayInfo: DragOverlayInfo | null
  updateDragOverlay(): void
  hideDragOverlay(): void
  invalidateLayoutCache(): void
  clearTooltip?(): void
}

const EXCLUDED_CREATE_TARGET_SELECTOR =
  '.bar, .task-group, .handle-left, .handle-right, .handle-progress, .handle-deadline, .connector-left, .connector-right, .marker-wrapper, .milestone-line, .header-resizer, .dependency-hit-area, .dependency-delete-btn, .dependency-edit-btn, .dependency-edit-popover, .row-header, .grid-footer-row, gantt-calendar'

let createdTaskSeq = 0

/**
 * タイムライン空白部でのドラッグ（Alt+ドラッグ等）およびダブルクリックによる
 * 新規タスク作成・ゴーストプレビュー・履歴連携を管理するコントローラー
 */
export class TaskCreateController implements ReactiveController {
  private host: TaskCreateControllerHost

  public createPreview: DragPreviewState | null = null
  public isCreatingDrag = false
  public justFinishedCreate = false

  private dragSession: {
    row: GanttRow
    rowTop: number
    rowHeight: number
    startClientX: number
    startClientY: number
    startTimelineX: number
    currentStart: Date
    currentEnd: Date
    previewTask: GanttTask
  } | null = null

  private autoScrollTimer: number | null = null
  private lastPointerEvent: PointerEvent | null = null

  constructor(host: TaskCreateControllerHost) {
    this.host = host
    host.addController(this)
  }

  hostConnected(): void {}

  hostDisconnected(): void {
    this.cleanup()
  }

  public cleanup(): void {
    this.stopAutoScroll()
    window.removeEventListener('pointermove', this.handlePointerMove)
    window.removeEventListener('pointerup', this.handlePointerUp)
    window.removeEventListener('pointercancel', this.handlePointerCancel)
    window.removeEventListener('keydown', this.handleKeyDown, true)
    if (this.createPreview) {
      this.createPreview = null
      this.host.invalidateLayoutCache()
      this.host.requestUpdate()
    }
    this.isCreatingDrag = false
    this.dragSession = null
    this.lastPointerEvent = null
  }

  private isExcludedEventTarget(e: Event): boolean {
    const target = e.target as HTMLElement | null
    if (!target) return true
    const path = typeof e.composedPath === 'function' ? e.composedPath() : []
    if (
      (typeof target.closest === 'function' && target.closest(EXCLUDED_CREATE_TARGET_SELECTOR)) ||
      path.some(
        (el) =>
          el instanceof Element &&
          typeof el.matches === 'function' &&
          el.matches(EXCLUDED_CREATE_TARGET_SELECTOR),
      )
    ) {
      return true
    }
    return false
  }

  private isSummaryRow(row: GanttRow): boolean {
    if (this.host.option?.tree?.enabled === false) return false
    if (this.host.option?.tree?.autoSummary === false) return false
    return this.host.rows.some((r) => r.parentId === row.id)
  }

  private resolveRowAtPoint(
    clientX: number,
    clientY: number,
  ): {
    row: GanttRow
    rowTop: number
    rowHeight: number
    timelineX: number
    container: HTMLElement
  } | null {
    const container = this.host.shadowRoot?.querySelector('.scroll-container') as HTMLElement | null
    if (!container) return null

    const rect = container.getBoundingClientRect()
    const labelWidth = this.host.currentRowHeaderWidth
    const viewportX = clientX - rect.left
    const contentX = viewportX + container.scrollLeft
    const yInRows = clientY - rect.top + container.scrollTop - this.host.calendarHeight

    if (viewportX < labelWidth || contentX < labelWidth || yInRows < 0) {
      return null
    }

    const { layouts } = this.host.calculateLayout()
    for (let i = 0; i < layouts.length; i++) {
      const layout = layouts[i]
      if (yInRows >= layout.top && yInRows < layout.top + layout.height) {
        const row = this.host.displayRows[i]
        if (!row || row.visible === false) return null
        return {
          row,
          rowTop: layout.top,
          rowHeight: layout.height,
          timelineX: Math.max(0, contentX - labelWidth),
          container,
        }
      }
    }
    return null
  }

  private computeSnappedRangeFromX(x0: number, x1: number, cfg: ResolvedTaskCreationConfig): { start: Date; end: Date } {
    const calStart = this.host.option.calendar.start
    const pxPerDay = this.host.effectivePxPerDay
    const pxPerMonth = this.host.effectivePxPerMonth
    const minX = Math.max(0, Math.min(x0, x1))
    const maxX = Math.max(0, Math.max(x0, x1))

    if (pxPerMonth !== undefined) {
      const rawMin = xToDate(minX, calStart, pxPerDay, pxPerMonth)
      const rawMax = xToDate(maxX, calStart, pxPerDay, pxPerMonth)
      const start = new Date(rawMin.getFullYear(), rawMin.getMonth(), 1, 0, 0, 0, 0)
      const end = new Date(rawMax.getFullYear(), rawMax.getMonth() + 1, 1, 0, 0, 0, 0)
      if (end.getTime() <= start.getTime()) {
        end.setMonth(start.getMonth() + 1)
      }
      return { start, end }
    }

    const snapMinutes = Math.max(1, this.host.effectiveSnapDuration || 1440)
    const stepMs = snapMinutes * 60 * 1000
    const originMs = new Date(
      calStart.getFullYear(),
      calStart.getMonth(),
      calStart.getDate(),
      0,
      0,
      0,
      0,
    ).getTime()

    const rawMin = xToDate(minX, calStart, pxPerDay, pxPerMonth)
    const rawMax = xToDate(maxX, calStart, pxPerDay, pxPerMonth)

    const snappedStartMs = originMs + Math.floor((rawMin.getTime() - originMs) / stepMs) * stepMs
    let snappedEndMs = originMs + Math.ceil((rawMax.getTime() - originMs) / stepMs) * stepMs

    const minDurationMs = cfg.defaultDurationMinutes
      ? Math.min(stepMs, Math.max(60 * 1000, cfg.defaultDurationMinutes * 60 * 1000))
      : stepMs
    if (snappedEndMs - snappedStartMs < minDurationMs) {
      snappedEndMs = snappedStartMs + Math.max(stepMs, minDurationMs)
    }

    return {
      start: new Date(snappedStartMs),
      end: new Date(snappedEndMs),
    }
  }

  private computeDefaultRangeAtX(x: number, cfg: ResolvedTaskCreationConfig): { start: Date; end: Date } {
    const calStart = this.host.option.calendar.start
    const pxPerDay = this.host.effectivePxPerDay
    const pxPerMonth = this.host.effectivePxPerMonth

    if (pxPerMonth !== undefined) {
      const raw = xToDate(Math.max(0, x), calStart, pxPerDay, pxPerMonth)
      const start = new Date(raw.getFullYear(), raw.getMonth(), 1, 0, 0, 0, 0)
      const monthsToAdd = cfg.defaultDurationMinutes
        ? Math.max(1, Math.round(cfg.defaultDurationMinutes / (1440 * 30)))
        : 1
      const end = new Date(raw.getFullYear(), raw.getMonth() + monthsToAdd, 1, 0, 0, 0, 0)
      return { start, end }
    }

    const snapMinutes = Math.max(1, this.host.effectiveSnapDuration || 1440)
    const stepMs = snapMinutes * 60 * 1000
    const originMs = new Date(
      calStart.getFullYear(),
      calStart.getMonth(),
      calStart.getDate(),
      0,
      0,
      0,
      0,
    ).getTime()

    const raw = xToDate(Math.max(0, x), calStart, pxPerDay, pxPerMonth)
    const snappedStartMs = originMs + Math.floor((raw.getTime() - originMs) / stepMs) * stepMs

    const defaultMinutes =
      cfg.defaultDurationMinutes ?? (snapMinutes < 1440 ? Math.max(snapMinutes, 60) : 1440)
    const durationMs = Math.max(stepMs, defaultMinutes * 60 * 1000)

    return {
      start: new Date(snappedStartMs),
      end: new Date(snappedStartMs + durationMs),
    }
  }

  private generateUniqueTaskId(): string {
    const existingIds = new Set<string>()
    for (const row of this.host.rows) {
      for (const t of row.tasks) {
        existingIds.add(t.id)
      }
    }
    let candidate = ''
    do {
      createdTaskSeq += 1
      candidate = `task-${Date.now()}-${createdTaskSeq}`
    } while (existingIds.has(candidate))
    return candidate
  }

  /**
   * タイムライン空白部の pointerdown を処理する。
   * タスク作成ドラッグとしてイベントを引き受けた場合は true を返し、Marquee 選択を抑止する。
   */
  public handlePointerDown = (e: PointerEvent): boolean => {
    if (e.button !== 0) return false
    if (e.pointerType === 'touch' && this.host.option?.touch?.enabled !== false) return false

    const cfg = resolveTaskCreationConfig(this.host.option)
    if (!cfg) return false

    if (cfg.trigger === 'dblclick') return false
    if ((cfg.trigger === 'alt-drag' || cfg.trigger === 'alt-drag-or-dblclick') && !e.altKey) {
      return false
    }

    if (this.isExcludedEventTarget(e)) return false

    const hit = this.resolveRowAtPoint(e.clientX, e.clientY)
    if (!hit) return false
    if (!cfg.allowOnSummaryRow && this.isSummaryRow(hit.row)) return false

    const locale = this.host.option.locale ?? jaLocale
    const initialRange = this.computeSnappedRangeFromX(hit.timelineX, hit.timelineX, cfg)
    const previewTask: GanttTask = {
      id: '__creating-task-preview__',
      name: cfg.defaultTaskName ?? locale.taskCreation?.defaultName ?? 'New Task',
      start: initialRange.start,
      end: initialRange.end,
      progress: 0,
      ...(cfg.defaultBarColor ? { barColor: cfg.defaultBarColor } : {}),
    }

    this.dragSession = {
      row: hit.row,
      rowTop: hit.rowTop,
      rowHeight: hit.rowHeight,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startTimelineX: hit.timelineX,
      currentStart: initialRange.start,
      currentEnd: initialRange.end,
      previewTask,
    }
    this.isCreatingDrag = false
    this.lastPointerEvent = e

    window.addEventListener('pointermove', this.handlePointerMove)
    window.addEventListener('pointerup', this.handlePointerUp)
    window.addEventListener('pointercancel', this.handlePointerCancel)
    window.addEventListener('keydown', this.handleKeyDown, true)
    return true
  }

  private handlePointerMove = (e: PointerEvent): void => {
    if (!this.dragSession) return
    this.lastPointerEvent = e

    const cfg = resolveTaskCreationConfig(this.host.option)
    if (!cfg) {
      this.cancelDragCreate()
      return
    }

    const dist = Math.hypot(
      e.clientX - this.dragSession.startClientX,
      e.clientY - this.dragSession.startClientY,
    )
    if (!this.isCreatingDrag && dist < 4) {
      return
    }

    if (!this.isCreatingDrag) {
      this.isCreatingDrag = true
      this.host.clearTooltip?.()
    }

    e.preventDefault()
    window.getSelection()?.removeAllRanges()

    this.updatePreviewFromPointer(e, cfg)
    this.updateAutoScroll(e, cfg)
  }

  private updatePreviewFromPointer(e: PointerEvent, cfg: ResolvedTaskCreationConfig): void {
    if (!this.dragSession) return
    const container = this.host.shadowRoot?.querySelector('.scroll-container') as HTMLElement | null
    if (!container) return

    const rect = container.getBoundingClientRect()
    const labelWidth = this.host.currentRowHeaderWidth
    const currentTimelineX = Math.max(0, e.clientX - rect.left + container.scrollLeft - labelWidth)

    const { start, end } = this.computeSnappedRangeFromX(
      this.dragSession.startTimelineX,
      currentTimelineX,
      cfg,
    )

    this.dragSession.currentStart = start
    this.dragSession.currentEnd = end

    this.createPreview = {
      task: this.dragSession.previewTask,
      currentStart: start,
      currentEnd: end,
      rowId: this.dragSession.row.id,
    }

    const calStart = this.host.option.calendar.start
    const startX = dateToX(start, calStart, this.host.effectivePxPerDay, this.host.effectivePxPerMonth)
    const endX = dateToX(end, calStart, this.host.effectivePxPerDay, this.host.effectivePxPerMonth)
    const barCenterClientX =
      rect.left + labelWidth - container.scrollLeft + (startX + endX) / 2
    const barTopClientY =
      rect.top + this.host.calendarHeight - container.scrollTop + this.dragSession.rowTop
    const barBottomClientY = barTopClientY + this.dragSession.rowHeight

    this.host.dragOverlayInfo = {
      id: this.dragSession.previewTask.id,
      name: this.dragSession.previewTask.name,
      start,
      end,
      currentStart: start,
      currentEnd: end,
      visible: true,
      clientX: e.clientX,
      clientY: e.clientY,
      barX: barCenterClientX,
      barTop: barTopClientY,
      barBottom: barBottomClientY,
    }

    this.host.invalidateLayoutCache()
    this.host.requestUpdate()
    this.host.updateDragOverlay()
  }

  private updateAutoScroll(e: PointerEvent, cfg: ResolvedTaskCreationConfig): void {
    const container = this.host.shadowRoot?.querySelector('.scroll-container') as HTMLElement | null
    if (!container) return
    const rect = container.getBoundingClientRect()
    const leftEdge = rect.left + this.host.currentRowHeaderWidth + 36
    const rightEdge = rect.right - 36

    let dx = 0
    if (e.clientX < leftEdge) {
      dx = -12
    } else if (e.clientX > rightEdge) {
      dx = 12
    }

    if (dx === 0) {
      this.stopAutoScroll()
      return
    }

    if (this.autoScrollTimer === null) {
      this.autoScrollTimer = window.setInterval(() => {
        if (!this.dragSession || !this.lastPointerEvent) {
          this.stopAutoScroll()
          return
        }
        container.scrollLeft = Math.max(0, container.scrollLeft + dx)
        this.updatePreviewFromPointer(this.lastPointerEvent, cfg)
      }, 16)
    }
  }

  private stopAutoScroll(): void {
    if (this.autoScrollTimer !== null) {
      window.clearInterval(this.autoScrollTimer)
      this.autoScrollTimer = null
    }
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this.dragSession) {
      e.preventDefault()
      e.stopPropagation()
      this.justFinishedCreate = true
      this.cancelDragCreate()
    }
  }

  private handlePointerCancel = (): void => {
    this.cancelDragCreate()
  }

  private cancelDragCreate(): void {
    this.stopAutoScroll()
    window.removeEventListener('pointermove', this.handlePointerMove)
    window.removeEventListener('pointerup', this.handlePointerUp)
    window.removeEventListener('pointercancel', this.handlePointerCancel)
    window.removeEventListener('keydown', this.handleKeyDown, true)

    this.dragSession = null
    this.isCreatingDrag = false
    this.lastPointerEvent = null
    this.createPreview = null
    if (this.host.dragOverlayInfo) {
      this.host.dragOverlayInfo = { ...this.host.dragOverlayInfo, visible: false }
      this.host.hideDragOverlay()
    }
    this.host.invalidateLayoutCache()
    this.host.requestUpdate()
  }

  private handlePointerUp = (_e: PointerEvent): void => {
    const session = this.dragSession
    const wasDragging = this.isCreatingDrag
    this.cancelDragCreate()

    if (!session || !wasDragging) return

    const cfg = resolveTaskCreationConfig(this.host.option)
    if (!cfg) return

    this.justFinishedCreate = true
    this.commitTaskCreation(session.row, session.currentStart, session.currentEnd, cfg, 'drag')
  }

  /**
   * タイムライン空白部のダブルクリックによる新規タスク作成を処理する
   */
  public handleDblClick = (e: MouseEvent): boolean => {
    const cfg = resolveTaskCreationConfig(this.host.option)
    if (!cfg) return false
    if (cfg.trigger !== 'dblclick' && cfg.trigger !== 'alt-drag-or-dblclick') {
      return false
    }
    if (this.isExcludedEventTarget(e)) return false

    const hit = this.resolveRowAtPoint(e.clientX, e.clientY)
    if (!hit) return false
    if (!cfg.allowOnSummaryRow && this.isSummaryRow(hit.row)) return false

    e.preventDefault()
    window.getSelection()?.removeAllRanges()

    const { start, end } = this.computeDefaultRangeAtX(hit.timelineX, cfg)
    this.commitTaskCreation(hit.row, start, end, cfg, 'dblclick')
    return true
  }

  private commitTaskCreation(
    targetRow: GanttRow,
    start: Date,
    end: Date,
    cfg: ResolvedTaskCreationConfig,
    source: 'drag' | 'dblclick',
  ): void {
    const locale = this.host.option.locale ?? jaLocale
    const baseTask: GanttTask = {
      id: this.generateUniqueTaskId(),
      name: cfg.defaultTaskName ?? locale.taskCreation?.defaultName ?? 'New Task',
      start,
      end,
      progress: 0,
      ...(cfg.defaultBarColor ? { barColor: cfg.defaultBarColor } : {}),
    }

    const customPartial = cfg.createTask
      ? cfg.createTask({ row: targetRow, start, end })
      : undefined

    const newTask: GanttTask = {
      ...baseTask,
      ...customPartial,
      id: customPartial?.id || baseTask.id,
      start: customPartial?.start ?? baseTask.start,
      end: customPartial?.end ?? baseTask.end,
    }

    const beforeDetail: BeforeTaskCreateHookDetail = {
      task: newTask,
      rowId: targetRow.id,
      row: targetRow,
      source,
    }

    const finalize = () => {
      const previousRows = this.host.rows
      let updatedRow: GanttRow = targetRow
      const nextRows = previousRows.map((r) => {
        if (r.id !== targetRow.id) return r
        updatedRow = {
          ...r,
          tasks: [...r.tasks, newTask],
        }
        return updatedRow
      })

      this.host.applyRowsChangeWithCommand(previousRows, nextRows, {
        type: 'task-create',
        description: locale.taskCreation?.commandDescription ?? 'Create task',
      })

      this.host.selectedTasks = new Set([newTask.id])
      this.host.dispatchEvent(
        new CustomEvent<BarSelectionChangeEventDetail>('bar-selection-change', {
          detail: { selectedIds: [newTask.id] },
          bubbles: true,
          composed: true,
        }),
      )

      const createDetail: TaskCreateEventDetail = {
        task: newTask,
        rowId: targetRow.id,
        row: updatedRow,
        source,
      }

      this.host.dispatchEvent(
        new CustomEvent<TaskCreateEventDetail>('task-create', {
          detail: createDetail,
          bubbles: true,
          composed: true,
        }),
      )

      this.host.pluginManager?.executeAfterTaskCreate(createDetail)
    }

    if (this.host.pluginManager) {
      this.host.pluginManager.runBeforeHook('beforeTaskCreate', beforeDetail, finalize)
    } else {
      finalize()
    }
  }
}

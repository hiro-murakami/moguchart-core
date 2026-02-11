import { DEFAULT_BAR_HEIGHT, DEFAULT_BAR_MARGIN, DEFAULT_ROW_HEADER_WIDTH } from '@/constants'
import type {
  BarHoverEventDetail,
  BarSelectionChangeEventDetail,
  GanttChartOption,
  GanttRow,
  GanttTask,
  GanttTaskMoveMode,
  RowHeaderResizeEventDetail,
  RowSelectionChangeEventDetail,
  TaskUpdateEventDetail,
} from '@/types'
import { calculateTaskLanes, getThemeColors, getTotalDays } from '@/utils'
import { LitElement, css, html, svg, type PropertyValues } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { repeat } from 'lit/directives/repeat.js'
import { throttle } from 'lodash'
import './gantt-calendar'
import './gantt-row'
import type { GanttRowElement } from './gantt-row'

@customElement('gantt-chart')
export class GanttChartElement extends LitElement {
  @property({ type: Array }) rows: GanttRow[] = []
  @property({ type: Object }) option!: GanttChartOption
  @property({ type: String, reflect: true })
  theme: 'light' | 'dark' = 'light'

  @property({ type: Array })
  selectedRowIds: string[] = []
  @property({ type: Array })
  selectedTaskIds: string[] = []
  @property({ attribute: false })
  externalDraggingTask: GanttTask | null = null

  @state() private selectedRows = new Set<string>()
  @state() private selectedTasks = new Set<string>()
  @state() private lastClickedRowId: string | null = null
  @state() private virtualScrollTop = 0
  @state() private dragTargetRowIndex: number | null = null
  @state() private draggingTask: {
    id: string
    name?: string
    start: Date
    end: Date
    currentStart: Date
    currentEnd: Date
    mode?: GanttTaskMoveMode
  } | null = null
  @state() private viewportHeight = 400
  private dragOverlayInfo: {
    id: string
    name?: string
    start: Date
    end: Date
    currentStart: Date
    currentEnd: Date
    targetRow?: GanttRow
    visible: boolean
  } | null = null
  @state() private calendarHeight = 0
  @state() private tooltip: {
    task: GanttTask
    x: number
    y: number
    visible: boolean
  } | null = null
  @state() private dragOverRowId: string | null = null
  @state() private dragOverPosition: 'top' | 'bottom' | null = null
  private hoverTimer: number | undefined
  @state() private currentTime = new Date()
  @state() private dragPreview: {
    task: GanttTask
    currentStart: Date
    currentEnd: Date
    rowId: string
  } | null = null
  @state() private currentRowHeaderWidth = DEFAULT_ROW_HEADER_WIDTH
  @state() private isResizingHeader = false
  private _systemThemeMediaQuery: MediaQueryList | null = null

  private _layoutCache: {
    layouts: any[]
    taskCoords: any
    totalHeight: number
  } | null = null
  private resizeObserver: ResizeObserver | null = null
  private _cachedSelectedTaskIds: string[] = []
  private _cachedSelectedTasksSize = -1
  private _cachedCurrentOption: GanttChartOption | null = null
  private _lastOptionRef: GanttChartOption | null = null
  private _lastLabelWidth: number = -1

  private get totalDays() {
    return getTotalDays(this.option.calendar.start, this.option.calendar.end)
  }

  private get displayRows() {
    if (this.option.showHiddenRows) {
      return this.rows
    }
    return this.rows.filter((row) => row.visible !== false)
  }

  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      box-sizing: border-box;
      position: relative;
    }
    .scroll-container {
      width: 100%;
      height: 100%;
      overflow: auto;
      position: relative;
      overflow-anchor: none;
    }
    .dependency-lines {
      position: absolute;
      top: 0;
      left: 0;
      pointer-events: none;
      z-index: 10;
    }
    .tooltip {
      position: fixed;
      transform: translate(-50%, -100%);
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      white-space: nowrap;
      pointer-events: none;
      z-index: 1000;
      margin-top: -6px;
      text-align: left;
      line-height: 1.4;
      opacity: 0;
      transition: opacity 0.2s ease;
    }
    .tooltip.visible {
      opacity: 1;
    }
    .tooltip-row {
      display: block;
    }
    .tooltip::after {
      content: '';
      position: absolute;
      top: 100%;
      left: 50%;
      margin-left: -4px;
      border-width: 4px;
      border-style: solid;
    }
    .drag-info-overlay {
      position: fixed;
      top: 80px;
      left: 50%;
      transform: translateX(-50%);
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 14px;
      pointer-events: none;
      z-index: 2000;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      text-align: center;
      opacity: 0;
      transition: opacity 0.2s ease;
    }
    .drag-info-overlay.visible {
      opacity: 1;
    }
    .drag-info-sub {
      font-size: 12px;
    }
    .dependency-line {
      stroke-width: 2;
      fill: none;
    }
    .current-time-line {
      position: absolute;
      width: 2px;
      z-index: 80;
      pointer-events: none;
    }
    .current-time-line::before {
      content: '';
      position: absolute;
      top: -8px;
      left: 50%;
      transform: translateX(-50%);
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: inherit;
    }
  `

  protected firstUpdated() {
    this.setupCurrentTimeTimer()

    const calendar = this.shadowRoot?.getElementById('calendar')
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === this) {
          this.viewportHeight = entry.contentRect.height
        } else if (entry.target === calendar) {
          this.calendarHeight = (entry.target as HTMLElement).offsetHeight
        }
      }
    })
    this.resizeObserver.observe(this)
    if (calendar) {
      this.resizeObserver.observe(calendar)
    }
  }

  connectedCallback(): void {
    super.connectedCallback()
    this._systemThemeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    this._systemThemeMediaQuery.addEventListener('change', this.handleSystemThemeChange)
    // 初期テーマ設定
    if (this.option?.theme === 'system' || (this.option?.theme !== 'light' && this.option?.theme !== 'dark')) {
      this.theme = this._systemThemeMediaQuery.matches ? 'dark' : 'light'
    } else {
      this.theme = this.option.theme
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.resizeObserver?.disconnect()
    this.stopCurrentTimeTimer()
    this._systemThemeMediaQuery?.removeEventListener('change', this.handleSystemThemeChange)
  }

  private handleSystemThemeChange = (e: MediaQueryListEvent) => {
    if (this.option?.theme === 'system' || (this.option?.theme !== 'light' && this.option?.theme !== 'dark')) {
      this.theme = e.matches ? 'dark' : 'light'
    }
  }

  protected willUpdate(changedProperties: PropertyValues): void {
    if (changedProperties.has('option')) {
      if (this.option?.theme === 'light' || this.option?.theme === 'dark') {
        this.theme = this.option.theme
      } else if (this._systemThemeMediaQuery) {
        // 'system' or undefined
        this.theme = this._systemThemeMediaQuery.matches ? 'dark' : 'light'
      }
    }
    if (changedProperties.has('option')) {
      this.setupCurrentTimeTimer()
      if (!this.isResizingHeader) {
        this.currentRowHeaderWidth = this.option.rowHeader?.width ?? DEFAULT_ROW_HEADER_WIDTH
      }
    }
    if (
      changedProperties.has('rows') ||
      changedProperties.has('option') ||
      changedProperties.has('currentRowHeaderWidth')
    ) {
      this._layoutCache = null
    }

    if (changedProperties.has('selectedRowIds')) {
      const newSelectedIds = new Set(this.selectedRowIds)
      if (
        newSelectedIds.size !== this.selectedRows.size ||
        ![...newSelectedIds].every((id) => this.selectedRows.has(id))
      ) {
        this.selectedRows = newSelectedIds
      }
    }

    if (changedProperties.has('selectedTaskIds')) {
      const newSelectedIds = new Set(this.selectedTaskIds)
      if (
        newSelectedIds.size !== this.selectedTasks.size ||
        ![...newSelectedIds].every((id) => this.selectedTasks.has(id))
      ) {
        this.selectedTasks = newSelectedIds
      }
    }

    // selectedTasksが変化した時だけ配列を再生成する（参照が毎回変わると全行が再レンダリングされるため）
    if (changedProperties.has('selectedTasks') || this._cachedSelectedTasksSize !== this.selectedTasks.size) {
      this._cachedSelectedTaskIds = [...this.selectedTasks]
      this._cachedSelectedTasksSize = this.selectedTasks.size
    }
  }

  protected updated(changedProperties: PropertyValues): void {
    super.updated(changedProperties)

    if (this.tooltip) {
      const tooltipEl = this.shadowRoot?.querySelector('.tooltip') as HTMLElement
      if (tooltipEl) {
        tooltipEl.innerHTML = ''
        this.dispatchEvent(
          new CustomEvent('render-tooltip', {
            detail: {
              container: tooltipEl,
              task: this.tooltip.task,
              x: this.tooltip.x,
              y: this.tooltip.y,
            },
            bubbles: true,
            composed: true,
          }),
        )

        if (tooltipEl.innerHTML === '') {
          const formatDate = (d: Date) => {
            return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
          }
          const duration = Math.round(
            (this.tooltip.task.end.getTime() - this.tooltip.task.start.getTime()) / (1000 * 60 * 60 * 24),
          )
          tooltipEl.innerHTML = `
            <div style="font-weight: bold;">${this.tooltip.task.name}</div>
            <div class="tooltip-row">
              ${formatDate(this.tooltip.task.start)} -
              ${formatDate(this.tooltip.task.end)}
            </div>
            <div class="tooltip-row">所要日数: ${duration}日</div>`
        }
      }
    }
  }

  /**
   * ドラッグオーバーレイを直接DOM操作で更新する。
   * @state() を使わないことで、Litの再レンダリングサイクルを回避する。
   */
  private updateDragOverlay() {
    if (!this.dragOverlayInfo || this.option.showDragInfoOverlay === false) return
    const colors = getThemeColors(this.theme, this.option.customTheme)
    const dragInfoEl = this.shadowRoot?.querySelector('.drag-info-overlay') as HTMLElement
    if (!dragInfoEl) return

    dragInfoEl.classList.toggle('visible', this.dragOverlayInfo.visible)
    dragInfoEl.innerHTML = ''

    const { targetRow } = this.dragOverlayInfo
    this.dispatchEvent(
      new CustomEvent('render-drag-info', {
        detail: {
          container: dragInfoEl,
          task: {
            id: this.dragOverlayInfo.id,
            name: this.dragOverlayInfo.name,
            start: this.dragOverlayInfo.start,
            end: this.dragOverlayInfo.end,
          },
          newStart: this.dragOverlayInfo.currentStart,
          newEnd: this.dragOverlayInfo.currentEnd,
          targetRow,
        },
        bubbles: true,
        composed: true,
      }),
    )

    if (dragInfoEl.innerHTML === '') {
      const formatDate = (d: Date) => {
        const date = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
        const h = d.getHours()
        const m = d.getMinutes()
        if (h === 0 && m === 0) return date
        const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
        return `${date} ${time}`
      }
      dragInfoEl.innerHTML = `
          <div style="font-weight: bold;">
            ${this.dragOverlayInfo.name || 'No Title'}
          </div>
          <div class="drag-info-sub">
            ${formatDate(this.dragOverlayInfo.currentStart)} -
            ${formatDate(this.dragOverlayInfo.currentEnd)}
          </div>
          ${
            targetRow
              ? `<div class="drag-info-sub" style="margin-top: 4px; border-top: 1px solid ${colors.dragOverlayDivider}; padding-top: 4px; width: 100%;">移動先: ${targetRow.name}</div>`
              : ''
          }`
    }
  }

  private hideDragOverlay() {
    const dragInfoEl = this.shadowRoot?.querySelector('.drag-info-overlay') as HTMLElement
    if (dragInfoEl) {
      dragInfoEl.classList.remove('visible')
    }
  }

  private currentTimeTimer: number | undefined

  private setupCurrentTimeTimer() {
    this.stopCurrentTimeTimer()
    const interval = this.option.calendar.currentTimeUpdateInterval
    if (interval && interval > 0) {
      this.currentTimeTimer = window.setInterval(() => {
        this.currentTime = new Date()
      }, interval)
    }
  }

  private stopCurrentTimeTimer() {
    if (this.currentTimeTimer !== undefined) {
      window.clearInterval(this.currentTimeTimer)
      this.currentTimeTimer = undefined
    }
  }

  private handleHeaderResizeStart(e: PointerEvent) {
    e.preventDefault()
    e.stopPropagation()
    this.isResizingHeader = true
    const startX = e.clientX
    const startWidth = this.currentRowHeaderWidth
    const target = e.target as HTMLElement
    target.setPointerCapture(e.pointerId)

    const minWidth = this.option.rowHeader?.minWidth ?? 50
    const maxWidth = this.option.rowHeader?.maxWidth ?? Number.MAX_SAFE_INTEGER

    const handleMove = (e: PointerEvent) => {
      const dx = e.clientX - startX
      const newWidth = startWidth + dx
      this.currentRowHeaderWidth = Math.max(minWidth, Math.min(maxWidth, newWidth))
    }

    const handleUp = () => {
      this.isResizingHeader = false
      target.releasePointerCapture(e.pointerId)
      target.removeEventListener('pointermove', handleMove)
      target.removeEventListener('pointerup', handleUp)

      const finalWidth = Math.round(this.currentRowHeaderWidth)
      this.currentRowHeaderWidth = finalWidth

      this.dispatchEvent(
        new CustomEvent<RowHeaderResizeEventDetail>('row-header-resize', {
          detail: { width: finalWidth },
          bubbles: true,
          composed: true,
        }),
      )
    }

    target.addEventListener('pointermove', handleMove)
    target.addEventListener('pointerup', handleUp)
  }

  private handleScroll = (e: Event) => {
    const target = e.target as HTMLElement
    this.updateScrollTop(target.scrollTop)

    if (this.hoverTimer !== undefined) {
      window.clearTimeout(this.hoverTimer)
    }
    if (this.tooltip) {
      this.tooltip = { ...this.tooltip, visible: false }
    }
  }

  private updateScrollTop = throttle((scrollTop: number) => {
    this.virtualScrollTop = scrollTop
  }, 100)

  private getDateX(date: Date) {
    const d = new Date(date)
    const start = new Date(this.option.calendar.start)
    start.setHours(0, 0, 0, 0)
    const diff = d.getTime() - start.getTime()
    const days = diff / (1000 * 60 * 60 * 24)
    return days * (this.option.calendar.pxPerDay ?? 50)
  }

  private calculateLayout() {
    if (this._layoutCache) {
      return this._layoutCache
    }

    let top = 0
    const labelWidth = this.currentRowHeaderWidth
    const taskCoords = new Map<
      string,
      {
        x: number
        y: number
        width: number
        height: number
        dependencies?: string[]
      }
    >()

    const layouts = this.displayRows.map((row) => {
      const { tasksWithLanes, laneCount } = calculateTaskLanes(row.tasks)
      const barHeight = this.option.bar?.height ?? DEFAULT_BAR_HEIGHT
      const barMargin = this.option.bar?.margin ?? DEFAULT_BAR_MARGIN

      tasksWithLanes.forEach((task: any) => {
        const x = this.getDateX(task.start) + labelWidth
        const endX = this.getDateX(task.end) + labelWidth
        const width = endX - x
        const y = top + task.lane * (barHeight + barMargin) + barMargin
        taskCoords.set(task.id, {
          x,
          y,
          width,
          height: barHeight,
          dependencies: task.dependencies,
        })
      })

      const height = laneCount * (barHeight + barMargin) + barMargin
      const layout = { top, height }
      top += height
      return layout
    })

    const result = { layouts, taskCoords, totalHeight: top }
    this._layoutCache = result
    return result
  }

  private handleTaskUpdate(e: CustomEvent<TaskUpdateEventDetail & { mode?: GanttTaskMoveMode }>) {
    e.stopPropagation()
    const { id, start, end, dx, dy, isDragging, mode } = e.detail

    let newStart = start
    let newEnd = end

    if (dx !== undefined) {
      const msPerPx = (24 * 60 * 60 * 1000) / this.option.calendar.pxPerDay
      const timeDiff = dx * msPerPx
      newStart = new Date(start.getTime() + timeDiff)
      newEnd = new Date(end.getTime() + timeDiff)
    }

    let sourceRowIndex = -1
    let taskToMove: GanttTask | undefined
    let taskIndexInSource = -1

    this.rows.find((r, index) => {
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

    const { layouts: rowLayouts } = this.calculateLayout()
    const sourceRowIndexInDisplay = this.displayRows.findIndex((r) => r.id === this.rows[sourceRowIndex].id)
    if (sourceRowIndexInDisplay === -1) return

    const dragStartRowTop = rowLayouts[sourceRowIndexInDisplay].top

    const { tasksWithLanes } = calculateTaskLanes(this.rows[sourceRowIndex].tasks)
    const taskWithLane = tasksWithLanes.find((t) => t.id === id)
    const lane = taskWithLane ? taskWithLane.lane : 0
    const barHeight = this.option.bar?.height ?? DEFAULT_BAR_HEIGHT
    const barMargin = this.option.bar?.margin ?? DEFAULT_BAR_MARGIN

    const taskInitialY = lane * (barHeight + barMargin) + barMargin
    const currentY = dragStartRowTop + taskInitialY + dy + barHeight / 2

    let targetRowIndex = -1
    for (let i = 0; i < rowLayouts.length; i++) {
      const rowLayout = rowLayouts[i]
      if (currentY >= rowLayout.top && currentY < rowLayout.top + rowLayout.height) {
        targetRowIndex = i
        break
      }
    }

    const targetRowId = targetRowIndex !== -1 ? this.displayRows[targetRowIndex].id : undefined

    this.dispatchEvent(
      new CustomEvent('task-update', {
        detail: {
          ...e.detail,
          start: newStart,
          end: newEnd,
          targetRowId,
        },
        bubbles: true,
        composed: true,
      }),
    )

    if (isDragging) {
      if (this.hoverTimer !== undefined) {
        window.clearTimeout(this.hoverTimer)
      }
      // ドラッグ中はツールチップを非表示にする
      if (this.tooltip) {
        this.tooltip = null
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
      } // 元の日付を保持（表示ズレ防止）しつつ、現在の日付も保持
      const newDragTargetRowIndex = targetRowIndex >= 0 ? targetRowIndex : null
      if (this.dragTargetRowIndex !== newDragTargetRowIndex) {
        this.dragTargetRowIndex = newDragTargetRowIndex
      }

      this.dragOverlayInfo = {
        id,
        name: e.detail.name,
        start,
        end,
        currentStart: newStart,
        currentEnd: newEnd,
        targetRow: targetRowIndex >= 0 ? this.displayRows[targetRowIndex] : undefined,
        visible: true,
      }
      this.updateDragOverlay()
      return
    }

    // ドロップ時の処理
    this.draggingTask = null
    this.dragTargetRowIndex = null
    if (this.dragOverlayInfo) {
      this.dragOverlayInfo = { ...this.dragOverlayInfo, visible: false }
      this.hideDragOverlay()
    }
    if (this.tooltip) {
      this.tooltip = { ...this.tooltip, visible: false }
    }

    // targetRowIndex は displayRows のインデックスなので、this.rows のインデックスに変換
    let targetRowIndexInRows = -1
    if (targetRowIndex !== -1) {
      const targetRow = this.displayRows[targetRowIndex]
      targetRowIndexInRows = this.rows.findIndex((r) => r.id === targetRow.id)
    }

    if (mode === 'copy') {
      if (targetRowIndexInRows !== -1) {
        const newRows = [...this.rows]
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
        this.rows = newRows

        this.dispatchEvent(
          new CustomEvent('rows-change', {
            detail: this.rows,
            bubbles: true,
            composed: true,
          }),
        )
      }
    } else {
      const newRows = [...this.rows]
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

      this.rows = newRows
      this.dispatchEvent(
        new CustomEvent('rows-change', {
          detail: this.rows,
          bubbles: true,
          composed: true,
        }),
      )
    }
  }

  private handleBarMouseEnter(e: CustomEvent<BarHoverEventDetail>) {
    // ドラッグ中、またはshowTooltipがfalseの場合はツールチップを表示しない
    if (this.draggingTask || this.option.showTooltip === false) {
      return
    }
    if (this.hoverTimer !== undefined) {
      window.clearTimeout(this.hoverTimer)
    }
    const delay = this.option.tooltipDelay ?? 0
    if (delay > 0) {
      this.hoverTimer = window.setTimeout(() => {
        this.tooltip = { ...e.detail, visible: true }
      }, delay)
    } else {
      this.tooltip = { ...e.detail, visible: true }
    }
  }

  private handleBarMouseLeave() {
    if (this.hoverTimer !== undefined) {
      window.clearTimeout(this.hoverTimer)
    }
    if (this.tooltip) {
      this.tooltip = { ...this.tooltip, visible: false }
    }
  }

  private async reorderRows(sourceId: string, targetId: string, position: 'top' | 'bottom') {
    const rowElements = Array.from(this.shadowRoot?.querySelectorAll('gantt-row') ?? []) as GanttRowElement[]
    const positions = new Map<string, number>()
    rowElements.forEach((el) => {
      if (el.row) {
        positions.set(el.row.id, el.getBoundingClientRect().top)
      }
    })

    const newRows = [...this.rows]
    const sourceIndex = newRows.findIndex((r) => r.id === sourceId)
    if (sourceIndex === -1) return

    const [removed] = newRows.splice(sourceIndex, 1)

    let targetIndex = newRows.findIndex((r) => r.id === targetId)
    if (targetIndex === -1) return

    if (position === 'bottom') {
      targetIndex++
    }

    newRows.splice(targetIndex, 0, removed)

    this.rows = newRows

    await this.updateComplete

    const newRowElements = Array.from(this.shadowRoot?.querySelectorAll('gantt-row') ?? []) as GanttRowElement[]

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

    this.dispatchEvent(
      new CustomEvent('row-reordered', {
        detail: {
          sourceId,
          targetId,
          position,
          rows: this.rows,
        },
        bubbles: true,
        composed: true,
      }),
    )

    this.dispatchEvent(
      new CustomEvent('rows-change', {
        detail: this.rows,
        bubbles: true,
        composed: true,
      }),
    )
  }

  private handleContainerDragOver(e: DragEvent) {
    e.preventDefault()
    // JSONデータが含まれているか、またはプロパティ経由でタスクが渡されている場合
    const isExternalTask = e.dataTransfer && e.dataTransfer.types.includes('application/json')

    if (isExternalTask) {
      e.dataTransfer!.dropEffect = 'copy'
    }

    if (!this.option.enableRowReordering && !isExternalTask) return
    const container = this.shadowRoot?.querySelector('.scroll-container') as HTMLElement
    if (!container) return

    const rect = container.getBoundingClientRect()
    const y = e.clientY - rect.top + container.scrollTop
    const yInRows = y - this.calendarHeight

    const { layouts } = this.calculateLayout()

    let foundIndex = -1
    for (let i = 0; i < layouts.length; i++) {
      const layout = layouts[i]
      if (yInRows >= layout.top && yInRows < layout.top + layout.height) {
        foundIndex = i
        break
      }
    }

    if (foundIndex !== -1) {
      const row = this.displayRows[foundIndex]

      if (isExternalTask) {
        if (this.dragOverRowId !== row.id || this.dragOverPosition !== null) {
          this.dragOverRowId = row.id
          this.dragOverPosition = null
        }

        // ゴースト表示の計算
        if (this.externalDraggingTask) {
          const labelWidth = this.currentRowHeaderWidth
          const scrollLeft = container.scrollLeft
          const x = e.clientX - rect.left + scrollLeft - labelWidth
          const pxPerDay = this.option.calendar.pxPerDay ?? 50

          // スナップ計算
          const snapDuration = this.option.snapDuration ?? 1440
          const pxPerMinute = pxPerDay / (24 * 60)
          const snapPx = pxPerMinute * snapDuration
          const snappedX = Math.round(x / snapPx) * snapPx

          // 日時計算
          const daysFromStart = snappedX / pxPerDay
          const currentStart = new Date(this.option.calendar.start.getTime() + daysFromStart * 24 * 60 * 60 * 1000)
          const durationMs = this.externalDraggingTask.end.getTime() - this.externalDraggingTask.start.getTime()
          const currentEnd = new Date(currentStart.getTime() + durationMs)

          if (
            !this.dragPreview ||
            this.dragPreview.rowId !== row.id ||
            this.dragPreview.currentStart.getTime() !== currentStart.getTime()
          ) {
            this.dragPreview = {
              task: this.externalDraggingTask,
              currentStart,
              currentEnd,
              rowId: row.id,
            }
          }
        }
      } else {
        const layout = layouts[foundIndex]
        const relativeY = yInRows - layout.top
        const position = relativeY < layout.height / 2 ? 'top' : 'bottom'
        if (this.dragOverRowId !== row.id || this.dragOverPosition !== position) {
          this.dragOverRowId = row.id
          this.dragOverPosition = position
        }
      }
    } else {
      this.dragOverRowId = null
      this.dragOverPosition = null
      this.dragPreview = null
    }
  }

  private handleContainerDragLeave(e: DragEvent) {
    const container = this.shadowRoot?.querySelector('.scroll-container') as HTMLElement
    const related = e.relatedTarget as HTMLElement
    if (container && container.contains(related)) return

    this.dragOverRowId = null
    this.dragOverPosition = null
    this.dragPreview = null
  }

  private handleContainerDrop(e: DragEvent) {
    e.preventDefault()

    const taskJson = e.dataTransfer?.getData('application/json')
    if (taskJson) {
      this.handleExternalTaskDrop(e, taskJson)
      this.dragOverRowId = null
      this.dragOverPosition = null
      this.dragPreview = null
      return
    }

    if (!this.option.enableRowReordering) return
    const sourceId = e.dataTransfer?.getData('text/plain')
    const targetId = this.dragOverRowId
    const position = this.dragOverPosition

    this.dragOverRowId = null
    this.dragOverPosition = null
    this.dragPreview = null

    if (sourceId && targetId && sourceId !== targetId && position) {
      this.reorderRows(sourceId, targetId, position)
    }
  }

  private handleExternalTaskDrop(e: DragEvent, taskJson: string) {
    try {
      const task = JSON.parse(taskJson) as GanttTask
      const container = this.shadowRoot?.querySelector('.scroll-container') as HTMLElement
      if (!container) return

      const rect = container.getBoundingClientRect()
      const scrollLeft = container.scrollLeft
      const scrollTop = container.scrollTop
      const labelWidth = this.currentRowHeaderWidth

      // X座標 -> 日時
      const x = e.clientX - rect.left + scrollLeft - labelWidth
      const pxPerDay = this.option.calendar.pxPerDay ?? 50
      const daysFromStart = x / pxPerDay
      const dropDate = new Date(this.option.calendar.start.getTime() + daysFromStart * 24 * 60 * 60 * 1000)

      // Y座標 -> 行
      const yInRows = e.clientY - rect.top + scrollTop - this.calendarHeight

      const { layouts } = this.calculateLayout()
      let targetRowId: string | undefined

      for (let i = 0; i < layouts.length; i++) {
        const layout = layouts[i]
        if (yInRows >= layout.top && yInRows < layout.top + layout.height) {
          targetRowId = this.displayRows[i].id
          break
        }
      }

      if (targetRowId) {
        this.dispatchEvent(
          new CustomEvent('task-drop', {
            detail: { task, dropDate, targetRowId },
            bubbles: true,
            composed: true,
          }),
        )
      }
    } catch (err) {
      console.warn('Failed to parse dropped task data', err)
    }
  }

  private handleRowClicked(e: CustomEvent<{ rowId: string; event: MouseEvent }>) {
    const { rowId, event } = e.detail
    const { shiftKey, ctrlKey, metaKey } = event

    const newSelectedRows = new Set(this.selectedRows)

    if (shiftKey && this.lastClickedRowId) {
      const lastIndex = this.rows.findIndex((r) => r.id === this.lastClickedRowId)
      const currentIndex = this.rows.findIndex((r) => r.id === rowId)

      if (lastIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(lastIndex, currentIndex)
        const end = Math.max(lastIndex, currentIndex)
        for (let i = start; i <= end; i++) {
          newSelectedRows.add(this.rows[i].id)
        }
      }
    } else if (ctrlKey || metaKey) {
      if (newSelectedRows.has(rowId)) {
        newSelectedRows.delete(rowId)
      } else {
        newSelectedRows.add(rowId)
      }
      this.lastClickedRowId = rowId
    } else {
      if (newSelectedRows.has(rowId)) {
        this.lastClickedRowId = rowId
        return
      }
      newSelectedRows.clear()
      newSelectedRows.add(rowId)
      this.lastClickedRowId = rowId
    }

    this.selectedRows = newSelectedRows
    this.dispatchEvent(
      new CustomEvent<RowSelectionChangeEventDetail>('row-selection-change', {
        detail: {
          selectedIds: Array.from(this.selectedRows),
        },
        bubbles: true,
        composed: true,
      }),
    )
  }

  private handleRowContextMenu(e: CustomEvent<{ rowId: string; event: MouseEvent }>) {
    if (this.selectedRows.has(e.detail.rowId)) {
      return
    }
    this.handleRowClicked(e)
  }

  private handleContainerClick(e: MouseEvent) {
    // 行ヘッダーなどのクリックイベントが伝播してきた場合はここで処理しない
    // (gantt-row側でstopPropagationしているはずだが念のため)
    if (e.defaultPrevented) return

    this.clearSelection()
  }

  private handleContainerContextMenu(e: MouseEvent) {
    // 行ヘッダーなどの右クリックはここで処理しない
    if (e.defaultPrevented) return

    this.clearSelection()
  }

  private clearSelection() {
    if (this.selectedRows.size === 0 && this.selectedTasks.size === 0) return

    if (this.selectedRows.size > 0) {
      this.selectedRows = new Set()
      this.dispatchEvent(
        new CustomEvent<RowSelectionChangeEventDetail>('row-selection-change', {
          detail: {
            selectedIds: [],
          },
          bubbles: true,
          composed: true,
        }),
      )
    }

    if (this.selectedTasks.size > 0) {
      this.selectedTasks = new Set()
      this.dispatchEvent(
        new CustomEvent<BarSelectionChangeEventDetail>('bar-selection-change', {
          detail: {
            selectedIds: [],
          },
          bubbles: true,
          composed: true,
        }),
      )
    }
  }

  private handleBarClick(e: CustomEvent<{ task: GanttTask; event: MouseEvent; isMultiSelect: boolean }>) {
    e.stopPropagation()
    const { task, isMultiSelect } = e.detail

    // ドラッグ操作がなかった（クリック扱い）場合でも、ドラッグ関連の状態をクリーンアップ
    this.draggingTask = null
    this.dragTargetRowIndex = null
    if (this.dragOverlayInfo) {
      this.dragOverlayInfo = { ...this.dragOverlayInfo, visible: false }
      this.hideDragOverlay()
    }

    let newSelectedTasks: Set<string>

    if (isMultiSelect) {
      // Ctrl/Cmd+クリック: トグル選択
      newSelectedTasks = new Set(this.selectedTasks)
      if (newSelectedTasks.has(task.id)) {
        newSelectedTasks.delete(task.id)
      } else {
        newSelectedTasks.add(task.id)
      }
    } else {
      // 通常クリック: 単一選択
      newSelectedTasks = new Set([task.id])
    }

    this.selectedTasks = newSelectedTasks

    this.dispatchEvent(
      new CustomEvent<BarSelectionChangeEventDetail>('bar-selection-change', {
        detail: {
          selectedIds: [...newSelectedTasks],
        },
        bubbles: true,
        composed: true,
      }),
    )
  }

  private handleBarContextMenu(e: CustomEvent<{ task: GanttTask; event: MouseEvent }>) {
    const { task } = e.detail

    // 選択済みバーの右クリックは選択を保持
    if (this.selectedTasks.has(task.id)) {
      return
    }

    // 未選択バーの右クリックは単一選択に切り替え
    this.selectedTasks = new Set([task.id])
    this.dispatchEvent(
      new CustomEvent<BarSelectionChangeEventDetail>('bar-selection-change', {
        detail: {
          selectedIds: [task.id],
        },
        bubbles: true,
        composed: true,
      }),
    )
  }

  render() {
    const colors = getThemeColors(this.theme, this.option.customTheme)

    const { layouts: rowLayouts, taskCoords, totalHeight } = this.calculateLayout()
    const labelWidth = this.currentRowHeaderWidth

    // currentOptionはoption参照またはlabelWidthが変わった時だけ再生成
    // 毎回新オブジェクトを作ると全gantt-rowが再レンダリングされる
    if (this._lastOptionRef !== this.option || this._lastLabelWidth !== labelWidth) {
      this._cachedCurrentOption = {
        ...this.option,
        rowHeader: {
          ...this.option.rowHeader,
          width: labelWidth,
        },
      }
      this._lastOptionRef = this.option
      this._lastLabelWidth = labelWidth
    }
    const currentOption = this._cachedCurrentOption!

    const buffer = 5
    let startIndex = 0
    let endIndex = this.displayRows.length - 1

    for (let i = 0; i < rowLayouts.length; i++) {
      if (rowLayouts[i].top + rowLayouts[i].height > this.virtualScrollTop) {
        startIndex = Math.max(0, i - buffer)
        break
      }
    }

    for (let i = startIndex; i < rowLayouts.length; i++) {
      if (rowLayouts[i].top > this.virtualScrollTop + this.viewportHeight) {
        endIndex = Math.min(this.displayRows.length - 1, i + buffer)
        break
      }
    }

    const visibleRows = this.displayRows.slice(startIndex, endIndex + 1)
    const paddingTop = rowLayouts[startIndex] ? rowLayouts[startIndex].top : 0
    const lastVisibleRowLayout = rowLayouts[endIndex]
    const renderedBottom = lastVisibleRowLayout ? lastVisibleRowLayout.top + lastVisibleRowLayout.height : 0
    const paddingBottom = Math.max(0, totalHeight - renderedBottom)

    // タスク間の接続線を描く
    const lines = []
    for (const [_, task] of taskCoords) {
      if (task.dependencies) {
        for (const depId of task.dependencies) {
          const depTask = taskCoords.get(depId)
          if (depTask) {
            const startX = depTask.x + depTask.width
            const startY = depTask.y + depTask.height / 2
            const endX = task.x
            const endY = task.y + task.height / 2
            const midX = (startX + endX) / 2

            lines.push(
              svg`<path class="dependency-line" d="M ${startX} ${startY} C ${midX} ${startY} ${midX} ${endY} ${endX} ${endY}" />`,
            )
          }
        }
      }
    }

    return html`
      <style>
        :host {
          background: ${colors.bg};
          border: 1px solid ${colors.border};
          border-radius: 8px;
          overflow: hidden;
          color: ${colors.text};
        }
        .tooltip {
          background-color: ${colors.tooltipBg};
          color: ${colors.tooltipText};
        }
        .tooltip::after {
          border-color: ${colors.tooltipBg} transparent transparent transparent;
        }
        .drag-info-overlay {
          background: ${colors.dragOverlayBg};
          color: ${colors.dragOverlayText};
        }
        .drag-info-sub {
          color: ${colors.dragOverlaySubText};
        }
        .dependency-line {
          stroke: ${colors.dependencyLine};
        }
        .header-resizer {
          width: 4px;
          cursor: col-resize;
          z-index: 100;
          background-color: transparent;
          transition: background-color 0.2s;
        }
        .header-resizer:hover,
        .header-resizer.resizing {
          background-color: ${colors.border};
        }
      </style>
      <div
        class="scroll-container"
        @scroll="${this.handleScroll}"
        @bar-mouseenter="${this.handleBarMouseEnter}"
        @bar-mouseleave="${this.handleBarMouseLeave}"
        @dragover="${this.handleContainerDragOver}"
        @dragleave="${this.handleContainerDragLeave}"
        @drop="${this.handleContainerDrop}"
        @click="${this.handleContainerClick}"
        @contextmenu="${this.handleContainerContextMenu}"
      >
        ${this.option.rowHeader?.resizable !== false
          ? html`
              <div
                style="
                  position: sticky;
                  left: ${labelWidth - 2}px;
                  top: 0;
                  width: 0;
                  height: 0;
                  z-index: 100;
                  overflow: visible;
                "
              >
                <div
                  class="header-resizer ${this.isResizingHeader ? 'resizing' : ''}"
                  style="height: ${Math.max(totalHeight, this.viewportHeight)}px;"
                  @pointerdown="${this.handleHeaderResizeStart}"
                ></div>
              </div>
            `
          : ''}
        <gantt-calendar
          id="calendar"
          .option="${currentOption}"
          .theme="${this.theme}"
          .currentTime="${this.currentTime}"
        ></gantt-calendar>

        <svg
          class="dependency-lines"
          style="top: ${this.calendarHeight}px;"
          width="${this.totalDays * (this.option.calendar.pxPerDay ?? 50) + labelWidth}"
          height="${totalHeight}"
        >
          ${lines}
        </svg>

        ${this.option.calendar.showCurrentTime
          ? html`
              <div
                class="current-time-line"
                style="
                  top: ${this.calendarHeight}px;
                  left: ${this.getDateX(this.currentTime) + labelWidth}px;
                  height: ${totalHeight}px;
                  background-color: ${colors.currentTimeLine};
                "
              ></div>
            `
          : ''}

        <div style="height: ${paddingTop}px; width: 1px;"></div>

        ${repeat(
          visibleRows,
          (row) => row.id,
          (row, index) => {
            const originalIndex = startIndex + index
            return html`
              <gantt-row
                .row="${row}"
                .option="${currentOption}"
                .isSelected="${this.selectedRows.has(row.id)}"
                .isDragTarget="${this.dragTargetRowIndex === originalIndex ||
                (this.dragOverRowId === row.id && this.dragOverPosition === null)}"
                .draggingTask="${this.draggingTask}"
                .theme="${this.theme}"
                .dropPosition="${this.dragOverRowId === row.id ? this.dragOverPosition : null}"
                .externalDragTask="${this.dragPreview?.rowId === row.id ? this.dragPreview : null}"
                .selectedTaskIds="${this._cachedSelectedTaskIds}"
                @task-update="${this.handleTaskUpdate}"
                @row-clicked="${this.handleRowClicked}"
                @row-header-contextmenu="${this.handleRowContextMenu}"
                @bar-click="${this.handleBarClick}"
                @task-contextmenu="${this.handleBarContextMenu}"
              />
            `
          },
        )}

        <div style="height: ${paddingBottom}px; width: 1px;"></div>
      </div>

      ${this.option.showDragInfoOverlay !== false ? html` <div class="drag-info-overlay"></div> ` : ''}
      ${this.tooltip
        ? html`
            <div
              class="tooltip ${this.tooltip.visible ? 'visible' : ''}"
              style="top: ${this.tooltip.y}px; left: ${this.tooltip.x}px;"
            />
          `
        : ''}
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gantt-chart': GanttChartElement
  }
}

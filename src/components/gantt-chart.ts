import {
  DEFAULT_BAR_HEIGHT,
  DEFAULT_BAR_MARGIN,
  DEFAULT_ROW_HEADER_WIDTH,
} from '@/constants'
import type {
  BarHoverEventDetail,
  GanttChartOption,
  GanttRow,
  GanttTask,
  TaskUpdateEventDetail,
} from '@/types'
import { calculateTaskLanes } from '@/utils'
import { LitElement, css, html, svg, type PropertyValues } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { throttle } from 'lodash'
import './gantt-calendar'
import './gantt-row'

@customElement('gantt-chart')
export class GanttChartElement extends LitElement {
  @property({ type: Array }) rows: GanttRow[] = []
  @property({ type: Object }) option!: GanttChartOption
  @property({ type: Number }) totalDays = 60

  @state() private virtualScrollTop = 0
  @state() private dragTargetRowIndex: number | null = null
  @state() private draggingTask: {
    id: string
    name?: string
    start: Date
    end: Date
    currentStart: Date
    currentEnd: Date
  } | null = null
  @state() private viewportHeight = 400
  @state() private calendarHeight = 0
  @state() private tooltip: { task: GanttTask; x: number; y: number } | null =
    null
  private hoverTimer: number | undefined

  private resizeObserver: ResizeObserver | null = null

  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      box-sizing: border-box;
      background: white;
      border: 1px solid #e2e8f0;
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
      background-color: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      white-space: nowrap;
      pointer-events: none;
      z-index: 1000;
      margin-top: -6px;
      text-align: left;
      line-height: 1.4;
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
      border-color: rgba(0, 0, 0, 0.8) transparent transparent transparent;
    }
    .drag-info-overlay {
      position: fixed;
      top: 80px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.85);
      color: white;
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
    }
    .drag-info-sub {
      font-size: 12px;
      color: #cbd5e1;
    }
  `

  protected firstUpdated() {
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

  disconnectedCallback() {
    super.disconnectedCallback()
    this.resizeObserver?.disconnect()
  }

  protected updated(changedProperties: PropertyValues): void {
    super.updated(changedProperties)

    if (this.tooltip) {
      const tooltipEl = this.shadowRoot?.querySelector(
        '.tooltip',
      ) as HTMLElement
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
            (this.tooltip.task.end.getTime() -
              this.tooltip.task.start.getTime()) /
              (1000 * 60 * 60 * 24),
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

    if (this.draggingTask && this.option.showDragInfoOverlay !== false) {
      const dragInfoEl = this.shadowRoot?.querySelector(
        '.drag-info-overlay',
      ) as HTMLElement
      if (dragInfoEl) {
        dragInfoEl.innerHTML = ''

        const targetRow =
          this.dragTargetRowIndex !== null
            ? this.rows[this.dragTargetRowIndex]
            : undefined

        this.dispatchEvent(
          new CustomEvent('render-drag-info', {
            detail: {
              container: dragInfoEl,
              task: {
                id: this.draggingTask.id,
                name: this.draggingTask.name,
                start: this.draggingTask.start,
                end: this.draggingTask.end,
              },
              newStart: this.draggingTask.currentStart,
              newEnd: this.draggingTask.currentEnd,
              targetRow,
            },
            bubbles: true,
            composed: true,
          }),
        )

        if (dragInfoEl.innerHTML === '') {
          const formatDate = (d: Date) => {
            return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
          }
          dragInfoEl.innerHTML = `
              <div style="font-weight: bold;">
                ${this.draggingTask.name || 'No Title'}
              </div>
              <div class="drag-info-sub">
                ${formatDate(this.draggingTask.currentStart)} -
                ${formatDate(this.draggingTask.currentEnd)}
              </div>
              ${
                targetRow
                  ? `<div class="drag-info-sub" style="margin-top: 4px; border-top: 1px solid #666; padding-top: 4px; width: 100%;">移動先: ${targetRow.label}</div>`
                  : ''
              }`
        }
      }
    }
  }

  private handleScroll = (e: Event) => {
    const target = e.target as HTMLElement
    this.updateScrollTop(target.scrollTop)

    if (this.hoverTimer !== undefined) {
      window.clearTimeout(this.hoverTimer)
    }
    this.tooltip = null
  }

  private updateScrollTop = throttle((scrollTop: number) => {
    this.virtualScrollTop = scrollTop
  }, 100)

  private getDateX(date: Date) {
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    const start = new Date(this.option.calendar.start)
    start.setHours(0, 0, 0, 0)
    const diff = d.getTime() - start.getTime()
    const days = diff / (1000 * 60 * 60 * 24)
    return days * (this.option.calendar.pxPerDay ?? 50)
  }

  private calculateLayout() {
    let top = 0
    const labelWidth = this.option.rowHeader?.width ?? DEFAULT_ROW_HEADER_WIDTH
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

    const layouts = this.rows.map((row) => {
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

    return { layouts, taskCoords, totalHeight: top }
  }

  private handleTaskUpdate(e: CustomEvent<TaskUpdateEventDetail>) {
    e.stopPropagation()
    const { id, start, end, dx, dy, isDragging } = e.detail

    let newStart = start
    let newEnd = end

    if (dx !== undefined) {
      const daysDiff = Math.round(dx / this.option.calendar.pxPerDay)
      newStart = new Date(start)
      newStart.setDate(start.getDate() + daysDiff)
      newEnd = new Date(end)
      newEnd.setDate(end.getDate() + daysDiff)
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
    const dragStartRowTop = rowLayouts[sourceRowIndex].top

    const { tasksWithLanes } = calculateTaskLanes(
      this.rows[sourceRowIndex].tasks,
    )
    const taskWithLane = tasksWithLanes.find((t) => t.id === id)
    const lane = taskWithLane ? taskWithLane.lane : 0
    const barHeight = this.option.bar?.height ?? DEFAULT_BAR_HEIGHT
    const barMargin = this.option.bar?.margin ?? DEFAULT_BAR_MARGIN

    const taskInitialY = lane * (barHeight + barMargin) + barMargin
    const currentY = dragStartRowTop + taskInitialY + dy + barHeight / 2

    let targetRowIndex = -1
    for (let i = 0; i < rowLayouts.length; i++) {
      const rowLayout = rowLayouts[i]
      if (
        currentY >= rowLayout.top &&
        currentY < rowLayout.top + rowLayout.height
      ) {
        targetRowIndex = i
        break
      }
    }

    const targetRowId =
      targetRowIndex !== -1 ? this.rows[targetRowIndex].id : undefined

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
      // ドラッグ中はツールチップを非表示にする
      if (this.hoverTimer !== undefined) {
        window.clearTimeout(this.hoverTimer)
      }
      this.tooltip = null

      this.draggingTask = {
        id,
        name: e.detail.name,
        start,
        end,
        currentStart: newStart,
        currentEnd: newEnd,
      } // 元の日付を保持（表示ズレ防止）しつつ、現在の日付も保持
      this.dragTargetRowIndex = targetRowIndex >= 0 ? targetRowIndex : null
      return
    }

    // ドロップ時の処理
    this.draggingTask = null
    this.dragTargetRowIndex = null

    const newRows = [...this.rows]
    const sourceRow = { ...newRows[sourceRowIndex] }
    sourceRow.tasks = [...sourceRow.tasks]
    newRows[sourceRowIndex] = sourceRow

    if (targetRowIndex !== -1 && sourceRowIndex !== targetRowIndex) {
      const targetRow = { ...newRows[targetRowIndex] }
      targetRow.tasks = [...targetRow.tasks]
      newRows[targetRowIndex] = targetRow

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

  private handleBarMouseEnter(e: CustomEvent<BarHoverEventDetail>) {
    // ドラッグ中はツールチップを表示しない
    if (this.draggingTask) {
      return
    }
    if (this.hoverTimer !== undefined) {
      window.clearTimeout(this.hoverTimer)
    }
    const delay = this.option.tooltipDelay ?? 0
    if (delay > 0) {
      this.hoverTimer = window.setTimeout(() => {
        this.tooltip = { ...e.detail }
      }, delay)
    } else {
      this.tooltip = { ...e.detail }
    }
  }

  private handleBarMouseLeave() {
    if (this.hoverTimer !== undefined) {
      window.clearTimeout(this.hoverTimer)
    }
    this.tooltip = null
  }

  render() {
    const {
      layouts: rowLayouts,
      taskCoords,
      totalHeight,
    } = this.calculateLayout()
    const labelWidth = this.option.rowHeader?.width ?? DEFAULT_ROW_HEADER_WIDTH

    const buffer = 5
    let startIndex = 0
    let endIndex = this.rows.length - 1

    for (let i = 0; i < rowLayouts.length; i++) {
      if (rowLayouts[i].top + rowLayouts[i].height > this.virtualScrollTop) {
        startIndex = Math.max(0, i - buffer)
        break
      }
    }

    for (let i = startIndex; i < rowLayouts.length; i++) {
      if (rowLayouts[i].top > this.virtualScrollTop + this.viewportHeight) {
        endIndex = Math.min(this.rows.length - 1, i + buffer)
        break
      }
    }

    const visibleRows = this.rows.slice(startIndex, endIndex + 1)
    const paddingTop = rowLayouts[startIndex] ? rowLayouts[startIndex].top : 0
    const lastVisibleRowLayout = rowLayouts[endIndex]
    const renderedBottom = lastVisibleRowLayout
      ? lastVisibleRowLayout.top + lastVisibleRowLayout.height
      : 0
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
              svg`<path d="M ${startX} ${startY} C ${midX} ${startY} ${midX} ${endY} ${endX} ${endY}" stroke="#cbd5e1" stroke-width="2" fill="none" />`,
            )
          }
        }
      }
    }

    return html`
      <div
        class="scroll-container"
        @scroll="${this.handleScroll}"
        @bar-mouseenter="${this.handleBarMouseEnter}"
        @bar-mouseleave="${this.handleBarMouseLeave}"
      >
        <gantt-calendar
          id="calendar"
          .option="${this.option}"
          .totalDays="${this.totalDays}"
        ></gantt-calendar>

        <svg
          class="dependency-lines"
          style="top: ${this.calendarHeight}px;"
          width="${this.totalDays * (this.option.calendar.pxPerDay ?? 50) +
          labelWidth}"
          height="${totalHeight}"
        >
          ${lines}
        </svg>

        <div style="height: ${paddingTop}px; width: 1px;"></div>

        ${visibleRows.map((row, index) => {
          const originalIndex = startIndex + index
          return html`
            <gantt-row
              .row="${row}"
              .option="${this.option}"
              .totalDays="${this.totalDays}"
              .isDragTarget="${this.dragTargetRowIndex === originalIndex}"
              .draggingTask="${this.draggingTask}"
              @task-update="${this.handleTaskUpdate}"
            />
          `
        })}

        <div style="height: ${paddingBottom}px; width: 1px;"></div>
      </div>

      ${this.draggingTask && this.option.showDragInfoOverlay !== false
        ? html` <div class="drag-info-overlay"></div> `
        : ''}
      ${this.tooltip
        ? html`
            <div
              class="tooltip"
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

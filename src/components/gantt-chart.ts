import { LitElement, html, css, svg } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { throttle } from 'lodash'
import './gantt-row'
import './gantt-calendar'
import type {
  GanttRow,
  GanttChartOption,
  TaskUpdateEventDetail,
  GanttTask,
} from '@/types'
import { calculateTaskLanes } from '@/utils'
import {
  DEFAULT_BAR_HEIGHT,
  DEFAULT_BAR_MARGIN,
  DEFAULT_LABEL_WIDTH,
} from '@/constants'

@customElement('gantt-chart')
export class GanttChartElement extends LitElement {
  @property({ type: Array }) rows: GanttRow[] = []
  @property({ type: Object }) option!: GanttChartOption
  @property({ type: Number }) totalDays = 60

  @state() private virtualScrollTop = 0
  @state() private dragTargetRowIndex: number | null = null
  @state() private draggingTask: { id: string; start: Date; end: Date } | null =
    null
  @state() private viewportHeight = 400
  @state() private calendarHeight = 0

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

  private handleScroll = (e: Event) => {
    const target = e.target as HTMLElement
    this.updateScrollTop(target.scrollTop)
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
    const labelWidth = this.option.label?.width ?? DEFAULT_LABEL_WIDTH
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
      this.draggingTask = { id, start, end } // 元の日付を保持（表示ズレ防止）
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

  render() {
    const {
      layouts: rowLayouts,
      taskCoords,
      totalHeight,
    } = this.calculateLayout()
    const labelWidth = this.option.label?.width ?? DEFAULT_LABEL_WIDTH

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

    const lines = []
    for (const [id, task] of taskCoords) {
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
              svg`<path d="M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}" stroke="#cbd5e1" stroke-width="2" fill="none" />`,
            )
          }
        }
      }
    }

    return html`
      <div class="scroll-container" @scroll="${this.handleScroll}">
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
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gantt-chart': GanttChartElement
  }
}

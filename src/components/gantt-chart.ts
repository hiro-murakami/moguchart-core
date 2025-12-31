import { LitElement, html, css } from 'lit'
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
import { DEFAULT_BAR_HEIGHT, DEFAULT_BAR_MARGIN } from '@/constants'

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
  `

  connectedCallback() {
    super.connectedCallback()
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        this.viewportHeight = entry.contentRect.height
      }
    })
    this.resizeObserver.observe(this)
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

  private getRowLayouts() {
    let top = 0
    const layouts = this.rows.map((row) => {
      const { laneCount } = calculateTaskLanes(row.tasks)
      const barHeight = this.option.bar?.height ?? DEFAULT_BAR_HEIGHT
      const barMargin = this.option.bar?.margin ?? DEFAULT_BAR_MARGIN

      const height = laneCount * (barHeight + barMargin) + barMargin
      const layout = { top, height }
      top += height
      return layout
    })
    return layouts
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

    const rowLayouts = this.getRowLayouts()
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
    const rowLayouts = this.getRowLayouts()
    const totalContentHeight =
      rowLayouts.length > 0
        ? rowLayouts[rowLayouts.length - 1].top +
          rowLayouts[rowLayouts.length - 1].height
        : 0

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
    const paddingBottom = Math.max(0, totalContentHeight - renderedBottom)

    return html`
      <div class="scroll-container" @scroll="${this.handleScroll}">
        <gantt-calendar
          .option="${this.option}"
          .totalDays="${this.totalDays}"
        ></gantt-calendar>

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

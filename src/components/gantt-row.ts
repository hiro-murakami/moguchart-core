import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { calculateTaskLanes } from '../utils'
import type { GanttRow, GanttChartOption } from '../types'
import './gantt-bar'
import { DEFAULT_LABEL_WIDTH } from '../constants'

@customElement('gantt-row')
export class GanttRowElement extends LitElement {
  @property({ type: Object }) row!: GanttRow
  @property({ type: Object }) option!: GanttChartOption
  @property({ type: Number }) totalDays = 30
  @property({ type: Boolean }) isDragTarget = false
  @property({ type: Object }) draggingTask: {
    id: string
    start: Date
    end: Date
  } | null = null

  static styles = css`
    :host {
      display: block;
      width: fit-content;
      min-width: 100%;
      border-bottom: 1px solid #f1f5f9;
      box-sizing: border-box;
      transition:
        height 0.2s ease-out,
        background-color 0.2s;
    }
    .row-container {
      display: flex;
      height: 100%;
      box-sizing: border-box;
      background: inherit;
    }
    .label {
      font-size: 13px;
      padding-left: 15px;
      border-right: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      flex-shrink: 0;
      box-sizing: border-box;
      position: sticky;
      left: 0;
      z-index: 20;
      background: inherit;
    }
    .bars-container {
      flex: none;
      position: relative;
    }
  `

  render() {
    const { tasksWithLanes, laneCount } = calculateTaskLanes(this.row.tasks)
    const rowHeight =
      laneCount * (this.option.barHeight + this.option.barMargin) +
      this.option.barMargin

    this.style.height = `${rowHeight}px`
    this.style.backgroundColor = this.isDragTarget ? '#f0f9ff' : '#fff'

    const backgroundStyle = `
      background-image: linear-gradient(90deg, transparent ${this.option.pxPerDay - 1}px, #f1f5f9 ${this.option.pxPerDay - 1}px);
      background-size: ${this.option.pxPerDay}px 100%;
    `

    return html`
      <div class="row-container">
        <div
          class="label"
          style="width: ${this.option.labelWidth ?? DEFAULT_LABEL_WIDTH}px"
        >
          ${this.row.label}
        </div>
        <div
          class="bars-container"
          style="${backgroundStyle}; width: ${this.totalDays *
          this.option.pxPerDay}px"
        >
          ${tasksWithLanes.map((task) => {
            const isDragging = this.draggingTask?.id === task.id
            const displayTask = isDragging
              ? {
                  ...task,
                  start: this.draggingTask!.start,
                  end: this.draggingTask!.end,
                }
              : task

            return html`
              <gantt-bar
                .task="${displayTask}"
                .option="${this.option}"
                .lane="${task.lane}"
              />
            `
          })}
        </div>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gantt-row': GanttRowElement
  }
}

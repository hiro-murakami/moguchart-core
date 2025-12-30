import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { calculateTaskLanes } from '../utils'
import type { GanttRow } from '../types'
import './gantt-bar'
import { DEFAULT_BAR_COLOR } from '../constants'

@customElement('gantt-row')
export class GanttRowElement extends LitElement {
  @property({ type: Object }) row!: GanttRow
  @property({ type: Object }) chartStart!: Date
  @property({ type: Number }) pxPerDay = 30
  @property({ type: String }) barColor = DEFAULT_BAR_COLOR
  @property({ type: Number }) barHeight = 30
  @property({ type: Number }) barMargin = 5
  @property({ type: Boolean }) isDragTarget = false
  @property({ type: Object }) draggingTask: {
    id: string
    start: Date
    end: Date
  } | null = null

  static styles = css`
    :host {
      display: block;
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
    }
    .label {
      width: var(--label-width, 150px);
      font-size: 13px;
      padding-left: 15px;
      border-right: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      flex-shrink: 0;
      box-sizing: border-box;
    }
    .bars-container {
      flex: 1;
      position: relative;
      background-size: var(--px-per-day) 100%;
      background-position: -1px 0;
    }
  `

  render() {
    const { tasksWithLanes, laneCount } = calculateTaskLanes(this.row.tasks)
    const rowHeight =
      laneCount * (this.barHeight + this.barMargin) + this.barMargin

    this.style.height = `${rowHeight}px`
    this.style.backgroundColor = this.isDragTarget ? '#f0f9ff' : 'transparent'
    this.style.setProperty('--px-per-day', `${this.pxPerDay}px`)

    const backgroundStyle = `
      background-image: linear-gradient(90deg, transparent ${this.pxPerDay - 1}px, #f1f5f9 ${this.pxPerDay - 1}px);
    `

    const option = {
      chartStart: this.chartStart,
      pxPerDay: this.pxPerDay,
      barHeight: this.barHeight,
      barMargin: this.barMargin,
    }

    return html`
      <div class="row-container">
        <div class="label">${this.row.label}</div>
        <div class="bars-container" style="${backgroundStyle}">
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
                .option="${option}"
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

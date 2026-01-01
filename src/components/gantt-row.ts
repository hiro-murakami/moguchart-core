import { LitElement, html, css, unsafeCSS, type PropertyValues } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { calculateTaskLanes } from '@/utils'
import type { GanttRow, GanttChartOption } from '@/types'
import './gantt-bar'
import './gantt-row-background'
import {
  DEFAULT_ROW_HEADER_WIDTH,
  DEFAULT_COLOR,
  DEFAULT_BAR_HEIGHT,
  DEFAULT_BAR_MARGIN,
} from '@/constants'

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
    }
    .row-container {
      display: flex;
      height: 100%;
      box-sizing: border-box;
      background: inherit;
    }
    .row-header {
      font-size: 13px;
      padding-left: 15px;
      border-right: 1px solid ${unsafeCSS(DEFAULT_COLOR.BORDER)};
      display: flex;
      align-items: center;
      flex-shrink: 0;
      box-sizing: border-box;
      position: sticky;
      left: 0;
      z-index: 60;
      background: inherit;
    }
    .bars-container {
      flex: none;
      position: relative;
    }
  `

  protected updated(changedProperties: PropertyValues): void {
    super.updated(changedProperties)

    const rowHeaderEl = this.shadowRoot?.querySelector(
      '.row-header',
    ) as HTMLElement
    if (rowHeaderEl) {
      // Clear content to avoid conflict with Lit rendering and allow customization
      rowHeaderEl.innerHTML = ''

      this.dispatchEvent(
        new CustomEvent('render-row-header', {
          detail: {
            container: rowHeaderEl,
            row: this.row,
          },
          bubbles: true,
          composed: true,
        }),
      )

      // If no content was added by the event listener, show the default label
      if (rowHeaderEl.innerHTML === '') {
        rowHeaderEl.textContent = this.row.label
      }
    }
  }

  render() {
    const { tasksWithLanes, laneCount } = calculateTaskLanes(this.row.tasks)
    const barHeight = this.option.bar?.height ?? DEFAULT_BAR_HEIGHT
    const barMargin = this.option.bar?.margin ?? DEFAULT_BAR_MARGIN

    const rowHeight = laneCount * (barHeight + barMargin) + barMargin

    this.style.height = `${rowHeight}px`
    this.style.backgroundColor = this.isDragTarget ? '#f0f9ff' : '#fff'

    const backgroundStyle = `
      background-image: linear-gradient(90deg, transparent ${this.option.calendar.pxPerDay - 1}px, #f1f5f9 ${this.option.calendar.pxPerDay - 1}px);
      background-size: ${this.option.calendar.pxPerDay}px 100%;
    `

    return html`
      <div class="row-container">
        <div
          class="row-header"
          style="width: ${this.option.rowHeader?.width ??
          DEFAULT_ROW_HEADER_WIDTH}px; background-color: ${this.option.rowHeader
            ?.backgroundColor ?? DEFAULT_COLOR.LABEL_BACKGROUND};"
        ></div>
        <div
          class="bars-container"
          style="${backgroundStyle}; width: ${this.totalDays *
          this.option.calendar.pxPerDay}px"
        >
          ${this.option.calendar.showRowBackground !== false
            ? html`<gantt-row-background
                .option="${this.option}"
                .totalDays="${this.totalDays}"
              /> `
            : ''}
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

import {
  DEFAULT_BAR_HEIGHT,
  DEFAULT_BAR_MARGIN,
  DEFAULT_ROW_HEADER_WIDTH,
} from '@/constants'
import type { GanttChartOption, GanttRow } from '@/types'
import { calculateTaskLanes, getThemeColors } from '@/utils'
import { LitElement, css, html, type PropertyValues } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import './gantt-bar'
import './gantt-row-background'

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
    name?: string
    currentStart?: Date
    currentEnd?: Date
  } | null = null
  @property({ type: String })
  theme: 'light' | 'dark' = 'light'

  @property({ type: String })
  dropPosition: 'top' | 'bottom' | null = null

  static styles = css`
    :host {
      display: block;
      width: fit-content;
      min-width: 100%;
      box-sizing: border-box;
    }
    .row-container {
      display: flex;
      height: 100%;
      box-sizing: border-box;
      background: inherit;
      position: relative;
    }
    .row-container.drop-top::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      background-color: #3b82f6;
      z-index: 70;
      pointer-events: none;
    }
    .row-container.drop-bottom::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 2px;
      background-color: #3b82f6;
      z-index: 70;
      pointer-events: none;
    }
    .row-header {
      font-size: 13px;
      padding-left: 15px;
      display: flex;
      align-items: center;
      flex-shrink: 0;
      box-sizing: border-box;
      position: sticky;
      left: 0;
      z-index: 60;
      background: inherit;
    }
    .row-header.draggable {
      cursor: grab;
    }
    .row-header.draggable:active {
      cursor: grabbing;
    }
    .bars-container {
      flex: none;
      position: relative;
    }
  `

  private handleDragStart(e: DragEvent) {
    if (e.dataTransfer) {
      e.dataTransfer.setData('text/plain', this.row.id)
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setDragImage(this, e.offsetX, e.offsetY)
    }
  }

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
    const colors = getThemeColors(this.theme, this.option.customTheme)
    const { tasksWithLanes, laneCount } = calculateTaskLanes(this.row.tasks)
    const barHeight = this.option.bar?.height ?? DEFAULT_BAR_HEIGHT
    const barMargin = this.option.bar?.margin ?? DEFAULT_BAR_MARGIN

    const rowHeight = laneCount * (barHeight + barMargin) + barMargin

    this.style.height = `${rowHeight}px`

    const backgroundStyle = `
      background-image: linear-gradient(90deg, transparent ${this.option.calendar.pxPerDay - 1}px, ${colors.gridLine} ${this.option.calendar.pxPerDay - 1}px);
      background-size: ${this.option.calendar.pxPerDay}px 100%;
    `

    return html`
      <style>
        :host {
          background-color: ${this.isDragTarget
            ? colors.dragTarget
            : colors.bg};
          border-bottom: 1px solid ${colors.border};
          color: ${colors.text};
        }
        .row-header {
          border-right: 1px solid ${colors.border};
        }
      </style>
      <div
        class="row-container ${this.dropPosition
          ? `drop-${this.dropPosition}`
          : ''}"
      >
        <div
          class="row-header ${this.option.enableRowReordering
            ? 'draggable'
            : ''}"
          style="width: ${this.option.rowHeader?.width ??
          DEFAULT_ROW_HEADER_WIDTH}px; background-color: ${this.option.rowHeader
            ?.backgroundColor ?? colors.rowHeaderBg};"
          draggable="${this.option.enableRowReordering ? 'true' : 'false'}"
          @dragstart="${this.handleDragStart}"
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
                .theme="${this.theme}"
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

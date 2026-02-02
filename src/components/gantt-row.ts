import {
  DEFAULT_BAR_HEIGHT,
  DEFAULT_BAR_MARGIN,
  DEFAULT_ROW_HEADER_WIDTH,
} from '@/constants'
import type {
  GanttChartOption,
  GanttRow,
  GanttTask,
  GanttTaskMoveMode,
} from '@/types'
import { calculateTaskLanes, getThemeColors, getTotalDays } from '@/utils'
import { LitElement, css, html, type PropertyValues } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { repeat } from 'lit/directives/repeat.js'
import './gantt-bar'
import './gantt-row-background'

@customElement('gantt-row')
export class GanttRowElement extends LitElement {
  @property({ type: Object }) row!: GanttRow
  @property({ type: Object }) option!: GanttChartOption
  @property({ type: Boolean }) isDragTarget = false
  @property({ type: Object }) draggingTask: {
    id: string
    start: Date
    end: Date
    name?: string
    currentStart?: Date
    currentEnd?: Date
    mode?: GanttTaskMoveMode
  } | null = null
  @property({ type: Object }) externalDragTask: {
    task: GanttTask
    currentStart: Date
    currentEnd: Date
  } | null = null
  @property({ type: String })
  theme: 'light' | 'dark' = 'light'

  @property({ type: Boolean })
  rowSelectionMode = false

  @property({ type: Boolean })
  isSelected = false

  @property({ type: String })
  dropPosition: 'top' | 'bottom' | null = null

  private get totalDays() {
    return getTotalDays(this.option.calendar.start, this.option.calendar.end)
  }

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
      padding-left: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
      padding-top: 0;
      flex-shrink: 0;
      box-sizing: border-box;
      position: sticky;
      left: 0;
      z-index: 60;
      background: inherit;
    }
    .row-header-content {
      flex-grow: 1;
      padding: 6px 0;
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
    .grid-background {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }
  `

  private handleDragStart(e: DragEvent) {
    if (e.dataTransfer) {
      e.dataTransfer.setData('text/plain', this.row.id)
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setDragImage(this, e.offsetX, e.offsetY)
    }
  }

  private handleCheckboxChange(e: Event) {
    const checkbox = e.target as HTMLInputElement
    this.dispatchEvent(
      new CustomEvent('_internal-row-selection-change', {
        detail: {
          rowId: this.row.id,
          checked: checkbox.checked,
        },
        bubbles: true,
        composed: true,
      }),
    )
  }

  protected updated(changedProperties: PropertyValues): void {
    super.updated(changedProperties)

    const rowHeaderContentEl = this.shadowRoot?.querySelector(
      '.row-header-content',
    ) as HTMLElement
    if (rowHeaderContentEl) {
      // Clear content to avoid conflict with Lit rendering and allow customization
      rowHeaderContentEl.innerHTML = ''

      this.dispatchEvent(
        new CustomEvent('render-row-header', {
          detail: {
            container: rowHeaderContentEl,
            row: this.row,
          },
          bubbles: true,
          composed: true,
        }),
      )

      // If no content was added by the event listener, show the default name
      if (rowHeaderContentEl.innerHTML === '') {
        rowHeaderContentEl.textContent = this.row.name
      }
    }
  }

  render() {
    const colors = getThemeColors(this.theme, this.option.customTheme)

    let displayTasks = [...this.row.tasks]
    if (this.externalDragTask) {
      const ghostTask: GanttTask = {
        ...this.externalDragTask.task,
        start: this.externalDragTask.currentStart,
        end: this.externalDragTask.currentEnd,
        style: `${this.externalDragTask.task.style || ''}; opacity: 0.6; pointer-events: none;`,
      }
      displayTasks = [...displayTasks, ghostTask]
    }

    let tasksWithLanes, laneCount

    const originalTaskInRow = this.row.tasks.find(
      (t) => this.draggingTask && t.id === this.draggingTask.id,
    )

    if (this.draggingTask?.mode === 'copy' && originalTaskInRow) {
      // For lane calculation in copy mode, filter out the dragging task
      // and add a static ghost task to prevent collision detection.
      const tasksForLaneCalc = displayTasks.filter(
        (t) => t.id !== this.draggingTask!.id,
      )
      tasksForLaneCalc.push({
        ...originalTaskInRow,
        id: `${originalTaskInRow.id}-static`,
        movable: 'none',
        resizable: false,
        style: `${originalTaskInRow.style || ''}; opacity: 0.5;`,
      })

      const result = calculateTaskLanes(tasksForLaneCalc)
      tasksWithLanes = result.tasksWithLanes
      laneCount = result.laneCount

      const staticTask = tasksWithLanes.find(
        (t) => t.id === `${originalTaskInRow.id}-static`,
      )
      if (staticTask) {
        // Add the actual dragging task back for rendering,
        // using the same lane as the ghost.
        tasksWithLanes.push({ ...originalTaskInRow, lane: staticTask.lane })
      }
    } else {
      // For move mode or other cases, calculate lanes normally.
      const result = calculateTaskLanes(displayTasks)
      tasksWithLanes = result.tasksWithLanes
      laneCount = result.laneCount
    }

    const barHeight = this.option.bar?.height ?? DEFAULT_BAR_HEIGHT
    const barMargin = this.option.bar?.margin ?? DEFAULT_BAR_MARGIN

    const rowHeight = laneCount * (barHeight + barMargin) + barMargin

    this.style.height = `${rowHeight}px`

    let backgroundStyle
    if (this.option.calendar.showTime) {
      const hourWidth = this.option.calendar.pxPerDay / 24
      const snapMinutes = this.option.snapDuration ?? 60
      const snapWidth =
        (this.option.calendar.pxPerDay / (24 * 60)) * snapMinutes

      const gradients = [
        `linear-gradient(90deg, transparent ${hourWidth - 1}px, ${colors.gridLine} ${hourWidth - 1}px)`,
        `linear-gradient(90deg, transparent ${snapWidth - 1}px, ${colors.subGridLine} ${snapWidth - 1}px)`,
      ]
      const sizes = [`${hourWidth}px 100%`, `${snapWidth}px 100%`]

      backgroundStyle = `
        background-image: ${gradients.join(', ')};
        background-size: ${sizes.join(', ')};
      `
    } else {
      const gridWidth = this.option.calendar.pxPerDay
      backgroundStyle = `
        background-image: linear-gradient(90deg, transparent ${gridWidth - 1}px, ${colors.gridLine} ${gridWidth - 1}px);
        background-size: ${gridWidth}px 100%;
      `
    }

    const canReorder = this.option.enableRowReordering && !this.option.readOnly

    return html`
      <style>
        :host {
          background-color: ${this.isDragTarget
            ? colors.dragTarget
            : this.isSelected
              ? colors.rowSelected
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
          class="row-header ${canReorder ? 'draggable' : ''}"
          style="width: ${this.option.rowHeader?.width ??
          DEFAULT_ROW_HEADER_WIDTH}px; background-color: ${this.option.rowHeader
            ?.backgroundColor ??
          (this.isSelected
            ? colors.rowSelectedHeader
            : colors.rowHeaderBg)};"
          draggable="${canReorder ? 'true' : 'false'}"
          @dragstart="${canReorder ? this.handleDragStart : undefined}"
        >
          ${this.rowSelectionMode
            ? html`<input
                type="checkbox"
                .checked=${this.isSelected}
                @change=${this.handleCheckboxChange}
              />`
            : ''}
          <div class="row-header-content"></div>
        </div>
        <div
          class="bars-container"
          style="width: ${this.totalDays * this.option.calendar.pxPerDay}px"
        >
          ${this.option.calendar.showRowBackground !== false
            ? html`<gantt-row-background
                .option="${this.option}"
                .theme="${this.theme}"
              /> `
            : ''}
          <div class="grid-background" style="${backgroundStyle}"></div>
          ${repeat(
            tasksWithLanes,
            (task) => task.id,
            (task) => {
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
            },
          )}
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

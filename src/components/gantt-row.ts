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
  RowHeaderContextMenuEventDetail,
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

  @property({ type: Boolean, reflect: true })
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
      background-color: transparent;
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
      display: flex;
      align-items: center;
      gap: 0;
      flex-shrink: 0;
      box-sizing: border-box;
      position: sticky;
      left: 0;
      z-index: 60;
    }
    .row-header-button {
      display: none;
    }
    .row-header-content {
      flex-grow: 1;
      padding: 6px 12px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
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

  private handleHeaderClick(e: MouseEvent) {
    this.dispatchEvent(
      new CustomEvent('row-clicked', {
        detail: {
          rowId: this.row.id,
          event: e,
        },
        bubbles: true,
        composed: true,
      }),
    )

    // Stop propagation to prevent other potential parent handlers from firing,
    // as we are now handling selection logic centrally in gantt-chart.
    e.stopPropagation()
  }

  private handleHeaderContextMenu(e: MouseEvent) {
    e.preventDefault()
    this.dispatchEvent(
      new CustomEvent<RowHeaderContextMenuEventDetail>(
        'row-header-contextmenu',
        {
          detail: {
            rowId: this.row.id,
            row: this.row,
            event: e,
            target: e.currentTarget as HTMLElement,
          },
          bubbles: true,
          composed: true,
        },
      ),
    )
  }

  private handleHeaderDblClick(e: MouseEvent) {
    this.dispatchEvent(
      new CustomEvent('row-header-dblclick', {
        detail: {
          rowId: this.row.id,
          row: this.row,
          event: e,
          target: e.currentTarget as HTMLElement,
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
        tasksWithLanes.push({ ...originalTaskInRow, lane: staticTask.lane })
      }
    } else {
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

    const isHidden = this.row.visible === false

    const headerBg = this.isSelected
      ? colors.rowSelectedHeader
      : isHidden
        ? colors.rowHiddenBg
        : colors.rowHeaderBg

    // Check if it's a gradient/image or simple color
    const isHeaderGradient = headerBg.includes('gradient')
    const headerStyle = isHeaderGradient
      ? `background: ${headerBg};`
      : `background-color: ${headerBg};`

    return html`
      <style>
        :host {
          color: ${colors.text};
          border-bottom: 1px solid ${colors.border};
        }
        :host([isselected]) {
          background-color: ${colors.rowSelected};
        }
        :host([isselected]) .row-header {
          color: white;
        }
        .row-header {
          cursor: ${canReorder ? 'grab' : 'pointer'};
          border-right: 1px solid ${colors.border};
        }
        .row-header:active {
          cursor: ${canReorder ? 'grabbing' : 'pointer'};
        }
        .hidden-row-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 5;
          pointer-events: none;
          opacity: 0.5;
        }
      </style>
      <div
        class="row-container ${this.dropPosition
          ? `drop-${this.dropPosition}`
          : ''}"
      >
        <div
          class="row-header"
          style="width: ${this.option.rowHeader?.width ??
          DEFAULT_ROW_HEADER_WIDTH}px; ${headerStyle}"
          draggable="${canReorder ? 'true' : 'false'}"
          @dragstart="${canReorder ? this.handleDragStart : undefined}"
          @click="${this.handleHeaderClick}"
          @dblclick="${this.handleHeaderDblClick}"
          @contextmenu="${this.handleHeaderContextMenu}"
        >
          <div class="row-header-button"></div>
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
          ${isHidden
            ? html`<div
                class="hidden-row-overlay"
                style="background: ${colors.rowHiddenBg};"
              ></div>`
            : ''}
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

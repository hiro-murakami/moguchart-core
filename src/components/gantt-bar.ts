import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import type { GanttTask, GanttChartOption } from '../types'

@customElement('gantt-bar')
export class GanttBar extends LitElement {
  @property({ type: Object }) task!: GanttTask
  @property({ type: Object }) option!: GanttChartOption
  @property({ type: String }) color = '#3b82f6'
  @property({ type: Number }) lane = 0

  static styles = css`
    :host {
      display: block;
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }
    .task-group {
      position: absolute;
      box-sizing: border-box;
      pointer-events: auto;
    }
    .task-group.dragging {
      opacity: 0.5;
    }
    .bar {
      background-color: var(--gantt-bar-fill, #3b82f6);
      border-radius: 4px;
      transition: background-color 0.3s;
      cursor: grab;
      width: 100%;
      height: 100%;
      position: absolute;
      top: 0;
      left: 0;
    }
    .handle-left,
    .handle-right {
      background: transparent;
      cursor: col-resize;
      position: absolute;
      top: 0;
      bottom: 0;
      width: 20px;
      z-index: 10;
    }
    .handle-left {
      left: -10px;
    }
    .handle-right {
      right: -10px;
    }
    .handle-left:hover,
    .handle-right:hover {
      background: rgba(255, 255, 255, 0.3);
    }
    .bar-label {
      color: white;
      font-size: 12px;
      pointer-events: none;
      user-select: none;
      position: absolute;
      top: 50%;
      left: 6px;
      transform: translateY(-50%);
      white-space: nowrap;
      z-index: 5;
    }
  `

  private getX(date: Date) {
    const diff = date.getTime() - this.option.chartStart.getTime()
    return (diff / (1000 * 60 * 60 * 24)) * this.option.pxPerDay
  }

  private onResizeStart(e: PointerEvent, handle: 'left' | 'right') {
    e.stopPropagation()
    const target = e.target as HTMLElement

    const barEl = this.shadowRoot?.querySelector('.bar') as HTMLElement
    if (!barEl) {
      return
    }
    barEl.style.pointerEvents = 'none'

    const taskGroup = this.shadowRoot?.querySelector('.task-group')
    taskGroup?.classList.add('dragging')

    target.setPointerCapture(e.pointerId)
    const startX = e.clientX
    const originalStart = new Date(this.task.start)
    const originalEnd = new Date(this.task.end)
    let currentStart = new Date(originalStart)
    let currentEnd = new Date(originalEnd)

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX
      const daysDiff = Math.round(deltaX / this.option.pxPerDay)

      let newStart = new Date(originalStart)
      let newEnd = new Date(originalEnd)

      if (handle === 'left') {
        newStart.setDate(originalStart.getDate() + daysDiff)
        if (newStart >= newEnd) {
          // 終了日を越えないように1日前に制限
          newStart = new Date(newEnd.getTime() - 86400000)
        }
      } else {
        newEnd.setDate(originalEnd.getDate() + daysDiff)
        if (newEnd <= newStart) {
          // 開始日より前にならないように1日後に制限
          newEnd = new Date(newStart.getTime() + 86400000)
        }
      }

      currentStart = newStart
      currentEnd = newEnd

      this.dispatchEvent(
        new CustomEvent('task-update', {
          detail: {
            ...this.task,
            start: newStart,
            end: newEnd,
            dy: 0,
            isDragging: true,
          },
          bubbles: true,
          composed: true,
        }),
      )
    }

    const onPointerUp = () => {
      taskGroup?.classList.remove('dragging')
      target.releasePointerCapture(e.pointerId)
      barEl.style.pointerEvents = ''
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)

      this.dispatchEvent(
        new CustomEvent('task-update', {
          detail: {
            ...this.task,
            start: currentStart,
            end: currentEnd,
            dy: 0,
            isDragging: false,
          },
          bubbles: true,
          composed: true,
        }),
      )
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  // --- 追加: 移動（Move）ロジック ---
  private onMoveStart(e: PointerEvent) {
    e.stopPropagation()
    const target = e.target as HTMLElement
    const taskGroup = this.shadowRoot?.querySelector(
      '.task-group',
    ) as HTMLElement

    if (!target || !taskGroup) {
      return
    }

    target.style.cursor = 'grabbing'
    target.setPointerCapture(e.pointerId)
    taskGroup.classList.add('dragging')

    const startX = e.clientX
    const startY = e.clientY
    // 開始時の一時的な日付を保持
    const originalStart = new Date(this.task.start)
    const originalEnd = new Date(this.task.end)

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX
      const deltaY = moveEvent.clientY - startY
      const daysDiff = Math.round(deltaX / this.option.pxPerDay)

      const newStart = new Date(originalStart)
      newStart.setDate(originalStart.getDate() + daysDiff)

      const newEnd = new Date(originalEnd)
      newEnd.setDate(originalEnd.getDate() + daysDiff)

      taskGroup.style.transform = `translateY(${deltaY}px)`

      this.dispatchEvent(
        new CustomEvent('task-update', {
          detail: {
            ...this.task,
            start: newStart,
            end: newEnd,
            dy: deltaY,
            isDragging: true,
          },
          bubbles: true,
          composed: true,
        }),
      )
    }

    const onPointerUp = (upEvent: PointerEvent) => {
      taskGroup.classList.remove('dragging')
      taskGroup.style.transform = ''
      target.style.cursor = ''
      target.releasePointerCapture(e.pointerId)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)

      const finalDeltaX = upEvent.clientX - startX
      const finalDaysDiff = Math.round(finalDeltaX / this.option.pxPerDay)
      const finalNewStart = new Date(originalStart)
      finalNewStart.setDate(originalStart.getDate() + finalDaysDiff)
      const finalNewEnd = new Date(originalEnd)
      finalNewEnd.setDate(originalEnd.getDate() + finalDaysDiff)
      const finalDeltaY = upEvent.clientY - startY

      this.dispatchEvent(
        new CustomEvent('task-update', {
          detail: {
            ...this.task,
            start: finalNewStart,
            end: finalNewEnd,
            dy: finalDeltaY,
            isDragging: false, // ドロップしたことを示す
          },
          bubbles: true,
          composed: true,
        }),
      )
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  render() {
    if (!this.task || !this.option) return html``

    const x = this.getX(this.task.start)
    const width = this.getX(this.task.end) - x
    const barColor = this.color || '#3b82f6'
    const y =
      this.lane * (this.option.barHeight + this.option.barMargin) +
      this.option.barMargin

    return html`
      <div
        class="task-group"
        style="
          left: ${x}px;
          top: ${y}px;
          width: ${width}px;
          height: ${this.option.barHeight}px;
        "
      >
        <div
          class="bar"
          style="background-color: ${barColor};"
          @pointerdown="${this.onMoveStart}"
        ></div>
        <div class="bar-label">${this.task.name}</div>
        <div
          class="handle-left"
          @pointerdown="${(e: PointerEvent) => this.onResizeStart(e, 'left')}"
        ></div>
        <div
          class="handle-right"
          @pointerdown="${(e: PointerEvent) => this.onResizeStart(e, 'right')}"
        ></div>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gantt-bar': GanttBar
  }
}

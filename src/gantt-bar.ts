import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import type { GanttTask } from './types'

@customElement('gantt-bar')
export class GanttBar extends LitElement {
  @property({ type: Object }) task!: GanttTask
  @property({ type: Object }) chartStart!: Date
  @property({ type: Number }) pxPerDay = 30
  @property({ type: String, reflect: true }) color = '#3b82f6'
  @property({ type: Number }) rowHeight = 40
  @property({ type: Number }) barHeight = 30

  static styles = css`
    :host {
      display: block;
      position: relative;
      height: var(--gantt-row-height, 40px);
    }
    .task-group {
      position: absolute;
      box-sizing: border-box;
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
    const diff = date.getTime() - this.chartStart.getTime()
    return (diff / (1000 * 60 * 60 * 24)) * this.pxPerDay
  }

  private onResizeStart(e: PointerEvent, handle: 'left' | 'right') {
    e.stopPropagation()

    const barEl = this.shadowRoot?.querySelector('.bar') as HTMLElement
    if (!barEl) {
      return
    }
    barEl.style.pointerEvents = 'none'

    document.body.style.cursor = 'col-resize'
    const startX = e.clientX
    const originalStart = new Date(this.task.start)
    const originalEnd = new Date(this.task.end)

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX
      const daysDiff = Math.round(deltaX / this.pxPerDay)

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

      this.dispatchEvent(
        new CustomEvent('task-update', {
          detail: { ...this.task, start: newStart, end: newEnd },
          bubbles: true,
          composed: true,
        }),
      )
    }

    const onPointerUp = () => {
      document.body.style.cursor = ''
      barEl.style.pointerEvents = ''
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  // --- 追加: 移動（Move）ロジック ---
  private onMoveStart(e: PointerEvent) {
    e.stopPropagation()
    const target = e.target as HTMLElement
    if (!target) {
      return
    }

    target.style.cursor = 'grabbing'

    const startX = e.clientX
    // 開始時の一時的な日付を保持
    const originalStart = new Date(this.task.start)
    const originalEnd = new Date(this.task.end)

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX
      const daysDiff = Math.round(deltaX / this.pxPerDay)

      const newStart = new Date(originalStart)
      newStart.setDate(originalStart.getDate() + daysDiff)

      const newEnd = new Date(originalEnd)
      newEnd.setDate(originalEnd.getDate() + daysDiff)

      this.dispatchEvent(
        new CustomEvent('task-update', {
          detail: { ...this.task, start: newStart, end: newEnd },
          bubbles: true,
          composed: true,
        }),
      )
    }

    const onPointerUp = () => {
      target.style.cursor = ''
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  render() {
    if (!this.task || !this.chartStart) return html``

    this.style.setProperty('--gantt-row-height', `${this.rowHeight}px`)

    const x = this.getX(this.task.start)
    const width = this.getX(this.task.end) - x
    const barColor = this.color || '#3b82f6'
    const y = (this.rowHeight - this.barHeight) / 2

    return html`
      <div
        class="task-group"
        style="
          left: ${x}px;
          top: ${y}px;
          width: ${width}px;
          height: ${this.barHeight}px;
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

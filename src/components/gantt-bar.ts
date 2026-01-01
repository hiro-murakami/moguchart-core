import { LitElement, html, css, unsafeCSS, type PropertyValues } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import type { GanttTask, GanttChartOption } from '@/types'
import {
  DEFAULT_BAR_COLOR,
  DEFAULT_BAR_HEIGHT,
  DEFAULT_BAR_MARGIN,
  DEFAULT_BAR_CORNER_RADIUS,
} from '@/constants'

@customElement('gantt-bar')
export class GanttBarElement extends LitElement {
  @property({ type: Object }) task!: GanttTask
  @property({ type: Object }) option!: GanttChartOption
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
    .task-group:hover {
      z-index: 50;
    }
    .task-group.dragging {
      opacity: 0.5;
      z-index: 15;
    }
    .bar {
      cursor: grab;
      width: 100%;
      height: 100%;
      position: absolute;
      top: 0;
      left: 0;
      background-color: ${unsafeCSS(DEFAULT_BAR_COLOR)};
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
    .tooltip {
      position: absolute;
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%);
      background-color: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      white-space: nowrap;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s;
      z-index: 40;
      margin-bottom: 6px;
      text-align: left;
      line-height: 1.4;
    }
    .tooltip-row {
      display: block;
    }
    .tooltip::after {
      content: '';
      position: absolute;
      top: 100%;
      left: 50%;
      margin-left: -4px;
      border-width: 4px;
      border-style: solid;
      border-color: rgba(0, 0, 0, 0.8) transparent transparent transparent;
    }
    .task-group:hover .tooltip {
      opacity: 1;
    }
    .task-group.dragging .tooltip {
      opacity: 0;
      display: none;
    }
  `

  private getX(date: Date) {
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    const start = new Date(this.option.calendar.start)
    start.setHours(0, 0, 0, 0)
    const diff = d.getTime() - start.getTime()
    return (diff / (1000 * 60 * 60 * 24)) * this.option.calendar.pxPerDay
  }

  private setupDragEvents(
    target: HTMLElement,
    pointerId: number,
    onMove: (e: PointerEvent) => void,
    onEnd: (isCancel: boolean, e?: PointerEvent) => void,
  ) {
    const cleanup = () => {
      target.releasePointerCapture(pointerId)
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('keydown', handleKeyDown)
    }

    const handleMove = (e: PointerEvent) => {
      onMove(e)
    }

    const handleUp = (e: PointerEvent) => {
      cleanup()
      onEnd(false, e)
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cleanup()
        onEnd(true)
      }
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('keydown', handleKeyDown)
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

    this.setupDragEvents(
      target,
      e.pointerId,
      (moveEvent) => {
        const deltaX = moveEvent.clientX - startX
        const daysDiff = Math.round(deltaX / this.option.calendar.pxPerDay)

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
      },
      (isCancel) => {
        taskGroup?.classList.remove('dragging')
        barEl.style.pointerEvents = ''

        if (isCancel) {
          this.dispatchEvent(
            new CustomEvent('task-update', {
              detail: {
                ...this.task,
                start: originalStart,
                end: originalEnd,
                dy: 0,
                isDragging: false,
              },
              bubbles: true,
              composed: true,
            }),
          )
        } else {
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
      },
    )
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

    this.setupDragEvents(
      target,
      e.pointerId,
      (moveEvent) => {
        const deltaX = moveEvent.clientX - startX
        const deltaY = moveEvent.clientY - startY

        // 横方向のスナップ処理
        const translateX =
          Math.round(deltaX / this.option.calendar.pxPerDay) *
          this.option.calendar.pxPerDay

        taskGroup.style.transform = `translate(${translateX}px, ${deltaY}px)`

        this.dispatchEvent(
          new CustomEvent('task-update', {
            detail: {
              ...this.task,
              start: originalStart,
              end: originalEnd,
              dx: translateX,
              dy: deltaY,
              isDragging: true,
            },
            bubbles: true,
            composed: true,
          }),
        )
      },
      (isCancel, upEvent) => {
        taskGroup.classList.remove('dragging')
        taskGroup.style.transform = ''
        target.style.cursor = ''

        if (isCancel) {
          this.dispatchEvent(
            new CustomEvent('task-update', {
              detail: {
                ...this.task,
                start: originalStart,
                end: originalEnd,
                dx: 0,
                dy: 0,
                isDragging: false,
              },
              bubbles: true,
              composed: true,
            }),
          )
        } else if (upEvent) {
          const finalDeltaX = upEvent.clientX - startX
          const finalTranslateX =
            Math.round(finalDeltaX / this.option.calendar.pxPerDay) *
            this.option.calendar.pxPerDay
          const finalDeltaY = upEvent.clientY - startY

          this.dispatchEvent(
            new CustomEvent('task-update', {
              detail: {
                ...this.task,
                start: originalStart,
                end: originalEnd,
                dx: finalTranslateX,
                dy: finalDeltaY,
                isDragging: false, // ドロップしたことを示す
              },
              bubbles: true,
              composed: true,
            }),
          )
        }
      },
    )
  }

  protected updated(changedProperties: PropertyValues): void {
    super.updated(changedProperties)

    const barEl = this.shadowRoot?.querySelector('.bar')
    if (barEl) {
      barEl.innerHTML = ''
      this.dispatchEvent(
        new CustomEvent('render-bar-content', {
          detail: {
            container: barEl,
            task: this.task,
          },
          bubbles: true,
          composed: true,
        }),
      )
    }
  }

  render() {
    if (!this.task || !this.option) return html``

    const x = this.getX(this.task.start)
    const width = this.getX(this.task.end) - x
    const barHeight = this.option.bar?.height ?? DEFAULT_BAR_HEIGHT
    const barMargin = this.option.bar?.margin ?? DEFAULT_BAR_MARGIN
    const barCornerRadius =
      this.option.bar?.cornerRadius ?? DEFAULT_BAR_CORNER_RADIUS

    const y = this.lane * (barHeight + barMargin) + barMargin
    const isReadOnly = this.option.readOnly
    const duration = Math.round(
      (this.task.end.getTime() - this.task.start.getTime()) /
        (1000 * 60 * 60 * 24),
    )

    const formatDate = (d: Date) => {
      return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
    }

    return html`
      <div
        class="task-group"
        style="
          left: ${x}px;
          top: ${y}px;
          width: ${width}px;
          height: ${barHeight}px;
        "
      >
        <div class="tooltip">
          <div style="font-weight: bold;">${this.task.name}</div>
          <div class="tooltip-row">
            ${formatDate(this.task.start)} - ${formatDate(this.task.end)}
          </div>
          <div class="tooltip-row">所要日数: ${duration}日</div>
        </div>
        <div
          class="bar"
          style="border-radius: ${barCornerRadius}px; ${this.task.style ||
          ''}; ${isReadOnly ? 'cursor: default;' : ''}"
          @pointerdown="${isReadOnly ? undefined : this.onMoveStart}"
        ></div>
        ${this.task.name
          ? html`<div class="bar-label">${this.task.name}</div>`
          : ''}
        ${!isReadOnly
          ? html`
              <div
                class="handle-left"
                @pointerdown="${(e: PointerEvent) =>
                  this.onResizeStart(e, 'left')}"
              ></div>
              <div
                class="handle-right"
                @pointerdown="${(e: PointerEvent) =>
                  this.onResizeStart(e, 'right')}"
              ></div>
            `
          : ''}
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gantt-bar': GanttBarElement
  }
}

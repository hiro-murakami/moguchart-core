import { LitElement, html, css, unsafeCSS, type PropertyValues } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import type { GanttTask, GanttChartOption } from '@/types'
import { getPatternStyle } from '@/pattern-utils'
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
  private _currentDragCursor: string | null = null

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
      width: 10px;
      z-index: 10;
    }
    .handle-left {
      left: 0px;
    }
    .handle-right {
      right: 0px;
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
      top: 2px;
      left: 6px;
      white-space: nowrap;
      z-index: 5;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: calc(100% - 12px);
    }
    @keyframes pop-in {
      0% {
        transform: scale(0.5);
        opacity: 0;
      }
      60% {
        transform: scale(1.1);
      }
      100% {
        transform: scale(1);
        opacity: 1;
      }
    }
    @keyframes fade-out {
      0% {
        transform: scale(1);
        opacity: 1;
      }
      100% {
        transform: scale(0.5);
        opacity: 0;
      }
    }
  `

  private getX(date: Date) {
    const d = new Date(date)
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

    const movable = this.task.movable ?? 'both'
    const resizable = this.task.resizable

    let canResize = !this.option.readOnly
    if (canResize) {
      if (resizable !== undefined) {
        canResize = resizable
      } else {
        canResize = !(movable === 'y' || movable === 'none')
      }
    }

    if (!canResize) return

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

    const snapDuration = this.option.snapDuration ?? 1440
    const pxPerMinute = this.option.calendar.pxPerDay / (24 * 60)
    const snapPx = pxPerMinute * snapDuration

    this.setupDragEvents(
      target,
      e.pointerId,
      (moveEvent) => {
        const deltaX = moveEvent.clientX - startX
        const snappedDeltaX = Math.round(deltaX / snapPx) * snapPx
        const minutesDiff = Math.round(snappedDeltaX / pxPerMinute)

        let newStart = new Date(originalStart)
        let newEnd = new Date(originalEnd)

        if (handle === 'left') {
          newStart = new Date(originalStart.getTime() + minutesDiff * 60 * 1000)
          if (newStart >= newEnd) {
            // 終了日を越えないように制限
            newStart = new Date(
              newEnd.getTime() - Math.max(snapDuration, 1) * 60 * 1000,
            )
          }
        } else {
          newEnd = new Date(originalEnd.getTime() + minutesDiff * 60 * 1000)
          if (newEnd <= newStart) {
            // 開始日より前にならないように制限
            newEnd = new Date(
              newStart.getTime() + Math.max(snapDuration, 1) * 60 * 1000,
            )
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
              x: moveEvent.clientX,
              y: moveEvent.clientY,
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

    const movable = this.task.movable ?? 'both'
    if (movable === 'none') return

    const initialCursor = e.ctrlKey || e.altKey ? 'copy' : 'grabbing'
    this._currentDragCursor = initialCursor
    target.style.cursor = initialCursor
    target.setPointerCapture(e.pointerId)
    taskGroup.classList.add('dragging')

    const startX = e.clientX
    const startY = e.clientY
    // 開始時の一時的な日付を保持
    const originalStart = new Date(this.task.start)
    const originalEnd = new Date(this.task.end)

    const snapDuration = this.option.snapDuration ?? 1440
    const pxPerMinute = this.option.calendar.pxPerDay / (24 * 60)
    const snapPx = pxPerMinute * snapDuration

    this.setupDragEvents(
      target,
      e.pointerId,
      (moveEvent) => {
        const newCursor =
          moveEvent.ctrlKey || moveEvent.altKey ? 'copy' : 'grabbing'
        this._currentDragCursor = newCursor
        target.style.cursor = newCursor

        let deltaX = moveEvent.clientX - startX
        let deltaY = moveEvent.clientY - startY

        if (movable === 'y') deltaX = 0
        if (movable === 'x') deltaY = 0

        // 横方向のスナップ処理
        const translateX = Math.round(deltaX / snapPx) * snapPx

        taskGroup.style.transform = `translate(${translateX}px, ${deltaY}px)`

        const isCopy = moveEvent.ctrlKey || moveEvent.altKey

        this.dispatchEvent(
          new CustomEvent('task-update', {
            detail: {
              ...this.task,
              start: originalStart,
              end: originalEnd,
              dx: translateX,
              dy: deltaY,
              isDragging: true,
              x: moveEvent.clientX,
              y: moveEvent.clientY,
              mode: isCopy ? 'copy' : 'move',
            },
            bubbles: true,
            composed: true,
          }),
        )
      },
      (isCancel, upEvent) => {
        this._currentDragCursor = null
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
          const finalTranslateX = Math.round(finalDeltaX / snapPx) * snapPx
          const finalDeltaY = upEvent.clientY - startY

          // 移動量が閾値以下の場合はイベントを発火しない（クリック対策）
          if (finalTranslateX === 0 && Math.abs(finalDeltaY) < 5) {
            return
          }

          const isCopy = upEvent.ctrlKey || upEvent.altKey

          this.dispatchEvent(
            new CustomEvent('task-update', {
              detail: {
                ...this.task,
                start: originalStart,
                end: originalEnd,
                dx: finalTranslateX,
                dy: finalDeltaY,
                isDragging: false, // ドロップしたことを示す
                mode: isCopy ? 'copy' : 'move',
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

    const barEl = this.shadowRoot?.querySelector('.bar') as HTMLElement
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

      if (this._currentDragCursor) {
        barEl.style.cursor = this._currentDragCursor
      } else {
        barEl.style.cursor = ''
      }
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    window.removeEventListener('keydown', this.handleKeyDown)
    window.removeEventListener('keyup', this.handleKeyUp)
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Control' || e.key === 'Alt') {
      this.updateCursor(true)
    }
  }

  private handleKeyUp = (e: KeyboardEvent) => {
    if (e.key === 'Control' || e.key === 'Alt') {
      this.updateCursor(false)
    }
  }

  private updateCursor(isCopy: boolean) {
    const barEl = this.shadowRoot?.querySelector('.bar') as HTMLElement
    // ドラッグ中は処理しない
    if (barEl && !this._currentDragCursor) {
      barEl.style.cursor = isCopy ? 'copy' : ''
    }
  }

  private onMouseEnter(e: MouseEvent) {
    const target = e.currentTarget as HTMLElement
    if (target.classList.contains('dragging')) {
      return
    }
    window.addEventListener('keydown', this.handleKeyDown)
    window.addEventListener('keyup', this.handleKeyUp)
    if (e.ctrlKey || e.altKey) {
      this.updateCursor(true)
    }
    const rect = target.getBoundingClientRect()
    this.dispatchEvent(
      new CustomEvent('bar-mouseenter', {
        detail: {
          task: this.task,
          x: rect.left + rect.width / 2,
          y: rect.top,
        },
        bubbles: true,
        composed: true,
      }),
    )
  }

  private onMouseLeave() {
    window.removeEventListener('keydown', this.handleKeyDown)
    window.removeEventListener('keyup', this.handleKeyUp)
    this.updateCursor(false)
    this.dispatchEvent(
      new CustomEvent('bar-mouseleave', {
        bubbles: true,
        composed: true,
      }),
    )
  }

  private onDblClick(e: MouseEvent) {
    this.dispatchEvent(
      new CustomEvent('task-dblclick', {
        detail: {
          task: this.task,
          event: e,
        },
        bubbles: true,
        composed: true,
      }),
    )
  }

  private onContextMenu(e: MouseEvent) {
    // MacなどでCtrl+ドラッグ（コピー操作）を行おうとした際にコンテキストメニューが出ないようにする
    if (e.ctrlKey) {
      e.preventDefault()
      e.stopPropagation()
      return
    }

    e.preventDefault()
    this.dispatchEvent(
      new CustomEvent('task-contextmenu', {
        detail: {
          task: this.task,
          event: e,
        },
        bubbles: true,
        composed: true,
      }),
    )
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
    const movable = this.task.movable ?? 'both'
    const resizable = this.task.resizable
    const canMove = !isReadOnly && movable !== 'none'

    let canResize = !isReadOnly
    if (canResize) {
      if (resizable !== undefined) {
        canResize = resizable
      } else {
        canResize = !(movable === 'y' || movable === 'none')
      }
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
        @mouseenter="${this.onMouseEnter}"
        @mouseleave="${this.onMouseLeave}"
        @dblclick="${this.onDblClick}"
        @contextmenu="${this.onContextMenu}"
      >
        <div
          class="bar"
          style="border-radius: ${barCornerRadius}px; ${this.task.style ||
          ''}; ${getPatternStyle(this.task.pattern)}; ${!canMove
            ? 'cursor: default;'
            : ''}"
          @pointerdown="${canMove ? this.onMoveStart : undefined}"
        ></div>
        ${this.task.name
          ? html`<div class="bar-label">${this.task.name}</div>`
          : ''}
        ${canResize
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

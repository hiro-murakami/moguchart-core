import { LitElement, html, css, unsafeCSS, type PropertyValues } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import type {
  GanttTask,
  GanttChartOption,
  GanttBarLabelPosition,
  DependencyEndpoint,
  TaskProgressChangeEventDetail,
} from '../core/types'
import { getPatternStyle } from '../core/patterns'
import { dateToX, xToDate, clampProgress, calculateTaskDelay, isMilestoneTask } from '../core/utils'
import { DEFAULT_BAR_COLOR, DEFAULT_BAR_HEIGHT, DEFAULT_BAR_MARGIN, DEFAULT_BAR_CORNER_RADIUS } from '../core/constants'

/**
 * タスク名ラベルの推定描画幅 (px) を算出する ('auto' 配置モードの判定用)
 */
export function estimateTaskLabelWidth(text: string, fontScale = 1): number {
  if (!text) return 0
  let width = 0
  for (const ch of text) {
    width += ch.charCodeAt(0) > 255 ? 12.5 : 7.5
  }
  return Math.ceil(width * fontScale) + 14
}

@customElement('gantt-bar')
export class GanttBarElement extends LitElement {
  @property({ type: Object }) task!: GanttTask
  @property({ type: Object }) option!: GanttChartOption
  @property({ type: Number }) lane = 0
  @property({ type: Boolean, reflect: true }) selected = false
  @property({ type: Boolean, reflect: true }) focused = false
  @property({ type: Number }) multiDragDx = 0
  @property({ type: Number }) multiDragDy = 0
  @property({ type: Boolean }) multiDragActive = false
  @property({ type: Boolean }) multiDragSameRow = false
  @property({ type: Boolean, reflect: true, attribute: 'connector-drop-target' }) connectorDropTarget = false
  @property({ type: Boolean, reflect: true }) isExporting = false
  @property({ type: Boolean, reflect: true, attribute: 'critical-path' }) isCriticalPath = false
  @property({ type: Boolean, reflect: true, attribute: 'touch-active' }) touchActive = false
  @state() private _dragProgress: number | null = null
  @state() private _isDraggingProgress = false
  private _currentDragCursor: string | null = null
  private _dragAnimationFrame: number | null = null
  private _autoScrollTimer: number | null = null
  private _longPressTimer: number | null = null
  private _wasDragging = false
  private _connectorEdgeThreshold = 30

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
    :host([isexporting]) *,
    :host([isexporting]) .bar,
    :host([isexporting]) .task-group {
      box-shadow: none !important;
    }
    .task-group {
      position: absolute;
      box-sizing: border-box;
      pointer-events: auto;
      z-index: 3;
    }
    .task-group:hover {
      z-index: 50;
    }
    .task-group.dragging {
      opacity: 0.5;
      z-index: 15;
    }
    .task-group.touch-dragging {
      opacity: 0.85;
      z-index: 25;
      filter: drop-shadow(0 6px 14px rgba(0, 0, 0, 0.35));
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
    .bar.summary-bar {
      cursor: default !important;
      background-color: var(--moguchart-summary-bar-color, #334155);
      clip-path: polygon(
        0% 0%,
        100% 0%,
        100% 100%,
        calc(100% - 6px) 55%,
        6px 55%,
        0% 100%
      );
    }
    .bar.milestone-bar {
      background-color: var(--moguchart-milestone-bar-color, #8b5cf6);
      transform: rotate(45deg) scale(0.76);
      border-radius: 2px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
    }
    :host([selected]) .bar.milestone-bar {
      outline: 2px solid #3b82f6;
      outline-offset: 1px;
      box-shadow: 0 0 8px rgba(59, 130, 246, 0.6);
    }
    :host([focused]) .bar.milestone-bar {
      outline: 2px dashed #3b82f6;
      outline-offset: 2px;
    }
    :host([selected]) .bar {
      outline: 2px solid #3b82f6;
      outline-offset: 1px;
      box-shadow: 0 0 8px rgba(59, 130, 246, 0.5);
    }
    :host([focused]) .bar {
      outline: 2px dashed #3b82f6;
      outline-offset: 2px;
    }
    :host([selected][focused]) .bar {
      outline: 2px solid #3b82f6;
      outline-offset: 1px;
      box-shadow: 0 0 8px rgba(59, 130, 246, 0.5);
    }
    .handle-left,
    .handle-right {
      background: transparent;
      cursor: col-resize;
      position: absolute;
      top: 0;
      bottom: 0;
      width: 10px;
      z-index: 11;
      touch-action: none;
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
    :host([selected]) .handle-left::after,
    :host([selected]) .handle-right::after {
      content: '';
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      width: 2px;
      height: 55%;
      max-height: 12px;
      border-radius: 1px;
      background: rgba(255, 255, 255, 0.85);
      box-shadow: 0 0 2px rgba(0, 0, 0, 0.45);
      pointer-events: none;
    }
    :host([selected]) .handle-left::after {
      left: 2px;
    }
    :host([selected]) .handle-right::after {
      right: 2px;
    }
    :host([touch-active][selected]) .handle-left::before,
    :host([touch-active][selected]) .handle-right::before {
      content: '';
      position: absolute;
      top: -4px;
      bottom: -4px;
      width: 18px;
    }
    :host([touch-active][selected]) .handle-left::before {
      left: -8px;
    }
    :host([touch-active][selected]) .handle-right::before {
      right: -8px;
    }
    @media (pointer: coarse) {
      .handle-left::before,
      .handle-right::before {
        content: '';
        position: absolute;
        top: -4px;
        bottom: -4px;
        width: 18px;
      }
      .handle-left::before {
        left: -8px;
      }
      .handle-right::before {
        right: -8px;
      }
    }
    .connector-left,
    .connector-right {
      position: absolute;
      top: 50%;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #3b82f6;
      border: 2px solid #fff;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
      transform: translateY(-50%);
      cursor: crosshair;
      z-index: 10;
      opacity: 0;
      transition: opacity 0.15s ease;
      pointer-events: auto;
      touch-action: none;
    }
    .connector-left::before,
    .connector-right::before {
      content: '';
      position: absolute;
      inset: -6px;
    }
    .connector-left.show-connector,
    .connector-right.show-connector,
    :host([touch-active][selected]) .connector-left,
    :host([touch-active][selected]) .connector-right {
      opacity: 1;
    }
    @media (pointer: coarse) {
      :host([selected]) .connector-left,
      :host([selected]) .connector-right {
        opacity: 1;
      }
      .connector-left::before,
      .connector-right::before {
        inset: -10px;
      }
    }
    .connector-left {
      left: -10px;
    }
    .connector-right {
      right: -10px;
    }
    .connector-left:hover,
    .connector-right:hover {
      background: #2563eb;
      transform: translateY(-50%) scale(1.2);
    }
    :host([connector-drop-target]) .bar {
      outline: 2px solid #3b82f6;
      outline-offset: 2px;
      box-shadow: 0 0 12px rgba(59, 130, 246, 0.6);
    }
    :host([critical-path]) .bar {
      outline: 2px solid var(--critical-path-color, rgba(220, 38, 38, 0.85));
      outline-offset: 1px;
    }
    :host([selected][critical-path]) .bar {
      outline: 2px solid #3b82f6;
      outline-offset: 1px;
      box-shadow: 0 0 8px rgba(59, 130, 246, 0.5);
    }
    .bar-label {
      color: white;
      font-size: calc(12px * var(--moguchart-font-scale, 1));
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
    .bar-label.pos-right {
      left: calc(100% + 6px);
      top: 50%;
      transform: translateY(-50%);
      color: inherit;
      max-width: none;
      overflow: visible;
      text-overflow: clip;
    }
    .bar-label.pos-left {
      left: auto;
      right: calc(100% + 6px);
      top: 50%;
      transform: translateY(-50%);
      color: inherit;
      max-width: none;
      overflow: visible;
      text-overflow: clip;
    }
    .task-group.milestone-task-group .bar-label.pos-right {
      left: calc(100% + 6px);
      font-weight: 600;
    }
    .task-group.milestone-task-group .bar-label.pos-left {
      right: calc(100% + 6px);
      font-weight: 600;
    }
    :host([isexporting]) .bar,
    :host([isexporting]) .bar * {
      text-overflow: clip !important;
    }
    .progress-bar {
      position: absolute;
      top: 0;
      left: 0;
      height: 100%;
      pointer-events: none;
      background-color: var(--moguchart-progress-color, rgba(0, 0, 0, 0.18));
      border-radius: inherit;
      transition: width 0.05s ease;
      z-index: 2;
    }
    .bar.summary-bar .progress-bar {
      background-color: var(
        --moguchart-summary-progress-color,
        rgba(255, 255, 255, 0.28)
      );
    }
    .progress-bar.dragging {
      transition: none;
    }
    .progress-bar.indicator-bottom {
      top: auto;
      bottom: 0;
      height: 4px;
      border-top-left-radius: 0;
      border-top-right-radius: 0;
    }
    .progress-bar.indicator-top {
      top: 0;
      bottom: auto;
      height: 4px;
      border-bottom-left-radius: 0;
      border-bottom-right-radius: 0;
    }
    .handle-progress {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 14px;
      margin-left: -7px;
      z-index: 12;
      pointer-events: none;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-end;
      user-select: none;
      opacity: 0;
      transition: opacity 0.15s ease;
    }
    .task-group:hover .handle-progress,
    :host([selected]) .handle-progress,
    .handle-progress.dragging {
      opacity: 1;
    }
    .handle-progress-line {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 6px;
      width: 2px;
      background: rgba(255, 255, 255, 0.9);
      box-shadow: 0 0 2px rgba(0, 0, 0, 0.7);
      pointer-events: none;
    }
    .handle-progress-knob {
      position: relative;
      width: 8px;
      height: 10px;
      margin-bottom: 1px;
      background: var(--moguchart-progress-handle, #3b82f6);
      border: 1.5px solid #ffffff;
      border-radius: 2px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
      transition: transform 0.15s ease, background-color 0.15s ease;
      pointer-events: auto;
      cursor: ew-resize;
      z-index: 1;
      touch-action: none;
    }
    .handle-progress-knob::before {
      content: '';
      position: absolute;
      inset: -4px -5px;
    }
    @media (pointer: coarse) {
      .handle-progress-knob::before {
        inset: -8px -10px;
      }
    }
    .handle-progress:hover .handle-progress-knob,
    .handle-progress.dragging .handle-progress-knob {
      transform: scale(1.3);
      background: #2563eb;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.8);
    }
    .handle-progress:hover .handle-progress-line,
    .handle-progress.dragging .handle-progress-line {
      background: #ffffff;
      box-shadow: 0 0 4px rgba(59, 130, 246, 0.8);
    }
    .progress-label {
      position: absolute;
      font-size: calc(11px * var(--moguchart-font-scale, 1));
      font-weight: bold;
      pointer-events: none;
      user-select: none;
      white-space: nowrap;
      z-index: 6;
      line-height: 1;
    }
    .progress-label.pos-inside {
      right: 6px;
      top: 50%;
      transform: translateY(-50%);
      color: rgba(255, 255, 255, 0.95);
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
    }
    .progress-label.pos-center {
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      color: rgba(255, 255, 255, 0.95);
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
    }
    .progress-label.pos-right {
      left: calc(100% + 6px);
      top: 50%;
      transform: translateY(-50%);
      color: inherit;
    }
    .progress-label.pos-left {
      right: calc(100% + 6px);
      top: 50%;
      transform: translateY(-50%);
      color: inherit;
    }
    .task-group.summary-task-group .progress-label.pos-inside {
      top: 28%;
      right: 10px;
    }
    .task-group.summary-task-group .progress-label.pos-center {
      top: 28%;
    }
    .task-group.summary-task-group .progress-label.pos-right {
      top: 28%;
    }
    .task-group.summary-task-group .progress-label.pos-left {
      top: 28%;
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
    @keyframes collab-pulse {
      0%,
      100% {
        outline-offset: 2px;
        filter: brightness(1);
      }
      50% {
        outline-offset: 3px;
        filter: brightness(1.08);
      }
    }
    .baseline-group {
      position: absolute;
      box-sizing: border-box;
      pointer-events: auto;
      z-index: 2;
    }
    .baseline-group.baseline-overlay {
      opacity: 0.4;
      z-index: 1;
      border: 1.5px dashed var(--moguchart-baseline-color, #94a3b8);
      border-radius: 4px;
      pointer-events: none;
    }
    .baseline-bar {
      width: 100%;
      height: 100%;
      position: absolute;
      top: 0;
      left: 0;
      background-color: var(--moguchart-baseline-color, #94a3b8);
      opacity: 0.85;
      transition: opacity 0.15s ease;
      cursor: pointer;
    }
    .baseline-group:hover .baseline-bar {
      opacity: 1;
    }
    .baseline-progress-bar {
      position: absolute;
      top: 0;
      left: 0;
      height: 100%;
      background-color: var(--moguchart-baseline-progress-color, rgba(0, 0, 0, 0.28));
      border-radius: inherit;
    }
    .task-group.task-delayed .bar {
      box-shadow: 0 0 0 1.5px var(--moguchart-delay-color, #ef4444);
    }
    .task-group.task-delayed::after {
      content: '';
      position: absolute;
      right: 0;
      top: 0;
      bottom: 0;
      width: 3.5px;
      background-color: var(--moguchart-delay-color, #ef4444);
      border-top-right-radius: inherit;
      border-bottom-right-radius: inherit;
      pointer-events: none;
      z-index: 6;
    }
    .task-group.task-delayed.filtered-out::after {
      opacity: 0.2;
    }
  `

  private getX(date: Date) {
    return dateToX(
      date,
      this.option.calendar.start,
      this.option.calendar.pxPerDay ?? 50,
      this.option.calendar.pxPerMonth,
    )
  }

  private _autoScrollPointerX = 0
  private _autoScrollPointerY = 0

  private safeSetPointerCapture(target: HTMLElement | null | undefined, pointerId: number) {
    if (!target || typeof target.setPointerCapture !== 'function') return
    try {
      target.setPointerCapture(pointerId)
    } catch {
      // 合成イベントや未接続要素での例外を無視
    }
  }

  private safeReleasePointerCapture(target: HTMLElement | null | undefined, pointerId: number) {
    if (!target || typeof target.releasePointerCapture !== 'function') return
    try {
      target.releasePointerCapture(pointerId)
    } catch {
      // 未キャプチャ時の例外を無視
    }
  }

  private updateAutoScrollPointer(clientX: number, clientY: number) {
    this._autoScrollPointerX = clientX
    this._autoScrollPointerY = clientY
  }

  private stopEdgeAutoScroll() {
    if (this._autoScrollTimer !== null) {
      window.clearInterval(this._autoScrollTimer)
      this._autoScrollTimer = null
    }
  }

  private clearLongPressTimer() {
    if (this._longPressTimer !== null) {
      window.clearTimeout(this._longPressTimer)
      this._longPressTimer = null
    }
  }

  private startEdgeAutoScroll(
    initialClientX: number,
    initialClientY: number,
    axes: { allowX: boolean; allowY: boolean },
    onTick: (clientX: number, clientY: number) => void,
  ) {
    this.stopEdgeAutoScroll()
    if (this.option?.calendar?.autoScrollOnDrag === false) return
    this._autoScrollPointerX = initialClientX
    this._autoScrollPointerY = initialClientY

    const chartEl = this.getGanttChartElement() as any
    const scrollContainer = chartEl?.shadowRoot?.querySelector('.scroll-container') as HTMLElement | null
    if (!scrollContainer) return

    const EDGE_THRESHOLD = 44
    const MAX_STEP = 18

    this._autoScrollTimer = window.setInterval(() => {
      if (!scrollContainer.isConnected) {
        this.stopEdgeAutoScroll()
        return
      }
      const rect = scrollContainer.getBoundingClientRect()
      const leftEdge = rect.left + (chartEl?.currentRowHeaderWidth ?? 0)
      const rightEdge = rect.right
      const topEdge = rect.top + (chartEl?.calendarHeight ?? 0)
      const bottomEdge = rect.bottom

      let stepX = 0
      let stepY = 0

      if (axes.allowX && rightEdge > leftEdge) {
        if (this._autoScrollPointerX < leftEdge + EDGE_THRESHOLD && scrollContainer.scrollLeft > 0) {
          const ratio = Math.min(1, Math.max(0.15, (leftEdge + EDGE_THRESHOLD - this._autoScrollPointerX) / EDGE_THRESHOLD))
          stepX = -Math.ceil(MAX_STEP * ratio)
        } else if (this._autoScrollPointerX > rightEdge - EDGE_THRESHOLD) {
          const maxScrollLeft = Math.max(0, scrollContainer.scrollWidth - scrollContainer.clientWidth)
          if (scrollContainer.scrollLeft < maxScrollLeft) {
            const ratio = Math.min(1, Math.max(0.15, (this._autoScrollPointerX - (rightEdge - EDGE_THRESHOLD)) / EDGE_THRESHOLD))
            stepX = Math.ceil(MAX_STEP * ratio)
          }
        }
      }

      if (axes.allowY && bottomEdge > topEdge) {
        if (this._autoScrollPointerY < topEdge + EDGE_THRESHOLD && scrollContainer.scrollTop > 0) {
          const ratio = Math.min(1, Math.max(0.15, (topEdge + EDGE_THRESHOLD - this._autoScrollPointerY) / EDGE_THRESHOLD))
          stepY = -Math.ceil(MAX_STEP * ratio)
        } else if (this._autoScrollPointerY > bottomEdge - EDGE_THRESHOLD) {
          const maxScrollTop = Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight)
          if (scrollContainer.scrollTop < maxScrollTop) {
            const ratio = Math.min(1, Math.max(0.15, (this._autoScrollPointerY - (bottomEdge - EDGE_THRESHOLD)) / EDGE_THRESHOLD))
            stepY = Math.ceil(MAX_STEP * ratio)
          }
        }
      }

      if (stepX === 0 && stepY === 0) return

      const prevLeft = scrollContainer.scrollLeft
      const prevTop = scrollContainer.scrollTop
      if (stepX !== 0) {
        scrollContainer.scrollLeft = Math.max(0, scrollContainer.scrollLeft + stepX)
      }
      if (stepY !== 0) {
        scrollContainer.scrollTop = Math.max(0, scrollContainer.scrollTop + stepY)
      }

      if (scrollContainer.scrollLeft !== prevLeft || scrollContainer.scrollTop !== prevTop) {
        onTick(this._autoScrollPointerX, this._autoScrollPointerY)
      }
    }, 20)
  }

  private setupDragEvents(
    target: HTMLElement,
    pointerId: number,
    onMove: (e: PointerEvent) => void,
    onEnd: (isCancel: boolean, e?: PointerEvent) => void,
  ) {
    const isMatchingPointer = (e: PointerEvent) => {
      if (e.pointerType === 'touch' && pointerId !== 0 && e.pointerId !== pointerId) {
        return false
      }
      return true
    }

    const cleanup = () => {
      this.stopEdgeAutoScroll()
      this.safeReleasePointerCapture(target, pointerId)
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleCancel)
      window.removeEventListener('keydown', handleKeyDown)
    }

    const handleMove = (e: PointerEvent) => {
      if (!isMatchingPointer(e)) return
      onMove(e)
    }

    const handleUp = (e: PointerEvent) => {
      if (!isMatchingPointer(e)) return
      cleanup()
      onEnd(false, e)
    }

    const handleCancel = (e: PointerEvent) => {
      if (!isMatchingPointer(e)) return
      cleanup()
      onEnd(true, e)
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cleanup()
        onEnd(true)
      }
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleCancel)
    window.addEventListener('keydown', handleKeyDown)
  }

  private onResizeStart(e: PointerEvent, handle: 'left' | 'right') {
    e.stopPropagation()
    if (e.pointerType === 'touch') {
      this.touchActive = true
      if (e.cancelable) e.preventDefault()
    }
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

    const taskGroup = this.shadowRoot?.querySelector('.task-group') as HTMLElement
    taskGroup?.classList.add('dragging')

    this.safeSetPointerCapture(target, e.pointerId)
    const chartEl = this.getGanttChartElement()
    const scrollContainer = chartEl?.shadowRoot?.querySelector('.scroll-container') as HTMLElement | null
    const initialScrollLeft = scrollContainer?.scrollLeft ?? 0

    const startX = e.clientX
    const originalStart = new Date(this.task.start)
    const originalEnd = new Date(this.task.end)
    let currentStart = new Date(originalStart)
    let currentEnd = new Date(originalEnd)

    const applyResizeAt = (clientX: number, clientY: number) => {
      const scrollDeltaX = (scrollContainer?.scrollLeft ?? 0) - initialScrollLeft
      const deltaX = clientX - startX + scrollDeltaX

      let newStart = new Date(originalStart)
      let newEnd = new Date(originalEnd)

      const pxPerDay = this.option.calendar.pxPerDay ?? 50
      const pxPerMonth = this.option.calendar.pxPerMonth
      const snapDuration = Math.max(this.option.snapDuration ?? 1440, 1)

      if (!pxPerMonth) {
        const pxPerMinute = pxPerDay / (24 * 60)
        const snapPx = pxPerMinute * snapDuration
        const snappedDeltaX = Math.round(deltaX / snapPx) * snapPx
        const minutesDiff = Math.round(snappedDeltaX / pxPerMinute)

        if (handle === 'left') {
          newStart = new Date(originalStart.getTime() + minutesDiff * 60 * 1000)
          if (newStart >= newEnd) {
            newStart = new Date(newEnd.getTime() - snapDuration * 60 * 1000)
          }
        } else {
          newEnd = new Date(originalEnd.getTime() + minutesDiff * 60 * 1000)
          if (newEnd <= newStart) {
            newEnd = new Date(newStart.getTime() + snapDuration * 60 * 1000)
          }
        }
      } else {
        const originalStartXBase = this.getX(originalStart)
        const originalEndXBase = this.getX(originalEnd)

        if (handle === 'left') {
          const rawNewStart = xToDate(originalStartXBase + deltaX, this.option.calendar.start, pxPerDay, pxPerMonth)
          if (rawNewStart.getDate() > 15) rawNewStart.setMonth(rawNewStart.getMonth() + 1)
          rawNewStart.setDate(1)
          rawNewStart.setHours(0, 0, 0, 0)
          newStart = rawNewStart
          if (newStart >= newEnd) {
            newStart = new Date(newEnd)
            newStart.setMonth(newStart.getMonth() - 1)
          }
        } else {
          const rawNewEnd = xToDate(originalEndXBase + deltaX, this.option.calendar.start, pxPerDay, pxPerMonth)
          if (rawNewEnd.getDate() > 15) rawNewEnd.setMonth(rawNewEnd.getMonth() + 1)
          rawNewEnd.setDate(1)
          rawNewEnd.setHours(0, 0, 0, 0)
          newEnd = rawNewEnd
          if (newEnd <= newStart) {
            newEnd = new Date(newStart)
            newEnd.setMonth(newEnd.getMonth() + 1)
          }
        }
      }

      currentStart = newStart
      currentEnd = newEnd

      if (taskGroup) {
        const newX = this.getX(newStart)
        const newWidth = this.getX(newEnd) - newX
        taskGroup.style.left = `${newX}px`
        taskGroup.style.width = `${newWidth}px`
      }

      if (this._dragAnimationFrame) {
        cancelAnimationFrame(this._dragAnimationFrame)
      }

      this._dragAnimationFrame = requestAnimationFrame(() => {
        const barRect = taskGroup?.getBoundingClientRect()
        this.dispatchEvent(
          new CustomEvent('task-update', {
            detail: {
              ...this.task,
              start: newStart,
              end: newEnd,
              dy: 0,
              isDragging: true,
              x: clientX,
              y: clientY,
              barX: barRect ? barRect.left + barRect.width / 2 : undefined,
              barTop: barRect?.top,
              barBottom: barRect?.bottom,
            },
            bubbles: true,
            composed: true,
          }),
        )
      })
    }

    this.startEdgeAutoScroll(
      e.clientX,
      e.clientY,
      { allowX: true, allowY: false },
      (cx, cy) => applyResizeAt(cx, cy),
    )

    this.setupDragEvents(
      target,
      e.pointerId,
      (moveEvent) => {
        this.updateAutoScrollPointer(moveEvent.clientX, moveEvent.clientY)
        applyResizeAt(moveEvent.clientX, moveEvent.clientY)
      },
      (isCancel) => {
        taskGroup?.classList.remove('dragging')
        barEl.style.pointerEvents = ''
        if (this._dragAnimationFrame) {
          cancelAnimationFrame(this._dragAnimationFrame)
          this._dragAnimationFrame = null
        }

        if (isCancel) {
          // キャンセル時：元の位置に戻してからLitの再描画を要求
          if (taskGroup) {
            const originalX = this.getX(originalStart)
            const originalWidth = this.getX(originalEnd) - originalX
            taskGroup.style.left = `${originalX}px`
            taskGroup.style.width = `${originalWidth}px`
          }
          this.requestUpdate()
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
          // 確定時：taskGroupは現在のスナップ済み位置を維持したまま、
          // rAFでLit更新を次フレームに遅らせてフリーズを防ぐ
          requestAnimationFrame(() => {
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
          })
        }
      },
    )
  }

  private getGanttChartElement(): HTMLElement | null {
    let node: Node | null = this
    while (node) {
      if (node instanceof HTMLElement && node.tagName.toLowerCase() === 'gantt-chart') {
        return node
      }
      if (node.parentNode) {
        node = node.parentNode
      } else if ((node as ShadowRoot).host) {
        node = (node as ShadowRoot).host
      } else {
        break
      }
    }
    return null
  }

  // --- 追加: 移動（Move）ロジック ---
  /** ドラッグ開始と判定するための移動閾値（px） */
  private static readonly DRAG_THRESHOLD = 3

  private onTaskGroupPointerDown = (e: PointerEvent) => {
    if (e.pointerType === 'touch' && this.option?.touch?.enabled !== false) {
      this.touchActive = true
    }
  }

  private onMoveStart(e: PointerEvent) {
    // 右クリック（button === 2）はコンテキストメニュー用なので無視
    if (e.button === 2) return
    e.stopPropagation()
    this._wasDragging = false
    this.clearLongPressTimer()

    const target = e.target as HTMLElement
    const taskGroup = this.shadowRoot?.querySelector('.task-group') as HTMLElement

    if (!target || !taskGroup) {
      return
    }

    const isTouch = e.pointerType === 'touch' && this.option?.touch?.enabled !== false
    if (isTouch) {
      this.touchActive = true
    }

    const movable = this.task.movable ?? 'both'
    if (movable === 'none') return

    const chartEl = this.getGanttChartElement()
    const scrollContainer = chartEl?.shadowRoot?.querySelector('.scroll-container') as HTMLElement | null
    let initialScrollLeft = scrollContainer?.scrollLeft ?? 0
    let initialScrollTop = scrollContainer?.scrollTop ?? 0

    const startX = e.clientX
    const startY = e.clientY
    // 開始時の一時的な日付を保持
    const originalStart = new Date(this.task.start)
    const originalEnd = new Date(this.task.end)

    const snapDuration = this.option.snapDuration ?? 1440

    // ドラッグ閾値を超えたかどうかを追跡
    let dragStarted = false
    let lastModifierCopy = false

    const checkIsOutside = (clientX: number, clientY: number) => {
      if (!chartEl) return false
      const rect = chartEl.getBoundingClientRect()
      if (
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
      ) {
        return true
      }

      // 行を跨ぐ移動が有効な場合、行が存在しないエリア（ヘッダー上や行リスト外）も外側扱いにする
      if (this.option.enableCrossRowMove !== false) {
        const rows = chartEl.shadowRoot?.querySelectorAll('gantt-row')
        if (rows && rows.length > 0) {
          const firstRowRect = rows[0].getBoundingClientRect()
          const lastRowRect = rows[rows.length - 1].getBoundingClientRect()
          if (lastRowRect.bottom > firstRowRect.top) {
            if (clientY < firstRowRect.top || clientY > lastRowRect.bottom) {
              return true
            }
          }
        }
      }
      return false
    }

    const computeSnappedMove = (clientX: number, clientY: number) => {
      const scrollDeltaX = (scrollContainer?.scrollLeft ?? 0) - initialScrollLeft
      const scrollDeltaY = (scrollContainer?.scrollTop ?? 0) - initialScrollTop
      const rawDeltaX = clientX - startX + scrollDeltaX
      const rawDeltaY = clientY - startY + scrollDeltaY

      let deltaX = rawDeltaX
      let deltaY = rawDeltaY

      if (movable === 'y') deltaX = 0
      if (movable === 'x') deltaY = 0
      if (this.option.enableCrossRowMove === false) deltaY = 0
      // 複数ドラッグ中：同じ行のバーのみ選択されている場合は縦移動を許可
      if (this.multiDragActive && !this.multiDragSameRow) deltaY = 0

      let translateX = deltaX
      if (!this.option.calendar.pxPerMonth) {
        const pxPerMinute = (this.option.calendar.pxPerDay ?? 50) / (24 * 60)
        const snapPx = pxPerMinute * snapDuration
        translateX = Math.round(deltaX / snapPx) * snapPx
      } else {
        // Monthモードでの移動時は常に1ヶ月単位でスナップ
        // 元の開始日をベースにどれだけ月をまたいだかを計算する
        const rawDate = xToDate(
          this.getX(originalStart) + deltaX,
          this.option.calendar.start,
          50,
          this.option.calendar.pxPerMonth,
        )
        const diffMonths =
          (rawDate.getFullYear() - originalStart.getFullYear()) * 12 +
          (rawDate.getMonth() - originalStart.getMonth()) +
          (rawDate.getDate() > 15 ? 1 : 0)

        const snappedStart = new Date(originalStart)
        snappedStart.setMonth(snappedStart.getMonth() + diffMonths)
        translateX = this.getX(snappedStart) - this.getX(originalStart)
      }

      return { rawDeltaX, rawDeltaY, translateX, deltaY }
    }

    const updateMoveAt = (clientX: number, clientY: number, isCopy: boolean) => {
      lastModifierCopy = isCopy
      if (!isTouch) {
        const newCursor = isCopy ? 'copy' : 'grabbing'
        this._currentDragCursor = newCursor
        target.style.cursor = newCursor
      }

      const isOutside = checkIsOutside(clientX, clientY)

      if (isOutside) {
        // ガントチャート外または行外の場合はバーを元の位置に表示
        taskGroup.style.transform = ''

        if (this._dragAnimationFrame) {
          cancelAnimationFrame(this._dragAnimationFrame)
        }

        this._dragAnimationFrame = requestAnimationFrame(() => {
          this.dispatchEvent(
            new CustomEvent('task-update', {
              detail: {
                ...this.task,
                start: originalStart,
                end: originalEnd,
                dx: 0,
                dy: 0,
                isDragging: true,
                isOutside: true,
                x: clientX,
                y: clientY,
                mode: isCopy ? 'copy' : 'move',
              },
              bubbles: true,
              composed: true,
            }),
          )
        })
        return
      }

      const { translateX, deltaY } = computeSnappedMove(clientX, clientY)
      taskGroup.style.transform = `translate(${translateX}px, ${deltaY}px)`

      if (this._dragAnimationFrame) {
        cancelAnimationFrame(this._dragAnimationFrame)
      }

      this._dragAnimationFrame = requestAnimationFrame(() => {
        const barRect = taskGroup?.getBoundingClientRect()
        this.dispatchEvent(
          new CustomEvent('task-update', {
            detail: {
              ...this.task,
              start: originalStart,
              end: originalEnd,
              dx: translateX,
              dy: deltaY,
              isDragging: true,
              isOutside: false,
              x: clientX,
              y: clientY,
              barX: barRect ? barRect.left + barRect.width / 2 : undefined,
              barTop: barRect?.top,
              barBottom: barRect?.bottom,
              mode: isCopy ? 'copy' : 'move',
            },
            bubbles: true,
            composed: true,
          }),
        )
      })
    }

    const finishMove = (isCancel: boolean, upEvent?: PointerEvent) => {
      this._currentDragCursor = null
      taskGroup.classList.remove('dragging', 'touch-dragging')
      taskGroup.style.transform = ''
      target.style.cursor = ''
      if (this._dragAnimationFrame) {
        cancelAnimationFrame(this._dragAnimationFrame)
        this._dragAnimationFrame = null
      }

      // ドラッグ閾値を超えていなかった場合はクリックとして扱う
      if (!dragStarted) {
        if (upEvent) {
          this.dispatchEvent(
            new CustomEvent('bar-click', {
              detail: {
                task: this.task,
                event: upEvent,
                isMultiSelect: upEvent.metaKey || upEvent.ctrlKey,
              },
              bubbles: true,
              composed: true,
            }),
          )
          this._wasDragging = true
        }
        return
      }

      const isOutside = upEvent ? checkIsOutside(upEvent.clientX, upEvent.clientY) : false

      if (isCancel || isOutside) {
        this._wasDragging = true
        this.requestUpdate()
        this.dispatchEvent(
          new CustomEvent('task-update', {
            detail: {
              ...this.task,
              start: originalStart,
              end: originalEnd,
              dx: 0,
              dy: 0,
              isDragging: false,
              isCancel: true,
              isOutside,
            },
            bubbles: true,
            composed: true,
          }),
        )
      } else if (upEvent) {
        const { translateX: finalTranslateX, deltaY: finalDeltaY } = computeSnappedMove(
          upEvent.clientX,
          upEvent.clientY,
        )

        // 移動量が閾値以下の場合はクリックとして扱う
        if (finalTranslateX === 0 && Math.abs(finalDeltaY) < 5) {
          // クリックイベントを発火（task-updateは発火しない）
          this.dispatchEvent(
            new CustomEvent('bar-click', {
              detail: {
                task: this.task,
                event: upEvent,
                isMultiSelect: upEvent.metaKey || upEvent.ctrlKey,
              },
              bubbles: true,
              composed: true,
            }),
          )
          // onClickでの重複発火を防止
          this._wasDragging = true
          return
        }

        const isCopy = !isTouch && (upEvent.ctrlKey || upEvent.altKey)

        // 実際にドラッグが行われたのでフラグを設定
        this._wasDragging = true

        // 複数選択ドラッグ中はbar-clickを発火しない。
        // bar-click(isMultiSelect: false)を発火すると selectedTasks が単一にリセットされ、
        // 続く task-update で isMultiDrag が false になって他バーが元の位置に戻ってしまう。
        if (!this.multiDragActive) {
          // 単一ドラッグ時のみ、ドラッグしたバーに選択を移す
          this.dispatchEvent(
            new CustomEvent('bar-click', {
              detail: {
                task: this.task,
                event: upEvent,
                isMultiSelect: false,
              },
              bubbles: true,
              composed: true,
            }),
          )
        }

        this.dispatchEvent(
          new CustomEvent('task-update', {
            detail: {
              ...this.task,
              start: originalStart,
              end: originalEnd,
              dx: finalTranslateX,
              dy: finalDeltaY,
              isDragging: false, // ドロップしたことを示す
              isOutside: false,
              mode: isCopy ? 'copy' : 'move',
            },
            bubbles: true,
            composed: true,
          }),
        )
      }
    }

    // --- タッチ入力: 短押しタップ＝選択、スワイプ＝ネイティブスクロール、長押し＝移動ドラッグ開始 ---
    if (isTouch) {
      const longPressDelay = Math.max(0, this.option?.touch?.longPressDelay ?? 250)
      const moveSlop = Math.max(1, this.option?.touch?.moveSlop ?? 8)
      const activePointerId = e.pointerId
      let latestClientX = startX
      let latestClientY = startY

      const isMatchingTouch = (ev: PointerEvent) =>
        activePointerId === 0 || ev.pointerId === 0 || ev.pointerId === activePointerId

      const preventNativeTouchScroll = (te: TouchEvent) => {
        if (dragStarted && te.cancelable) {
          te.preventDefault()
        }
      }

      const cleanupTouchListeners = () => {
        this.clearLongPressTimer()
        this.stopEdgeAutoScroll()
        this.safeReleasePointerCapture(target, activePointerId)
        window.removeEventListener('pointermove', onTouchPointerMove)
        window.removeEventListener('pointerup', onTouchPointerUp)
        window.removeEventListener('pointercancel', onTouchPointerCancel)
        window.removeEventListener('moguchart-pinch-start', onPinchStart)
        window.removeEventListener('touchmove', preventNativeTouchScroll)
        window.removeEventListener('keydown', onTouchEscape)
      }

      const activateTouchDrag = () => {
        this.clearLongPressTimer()
        initialScrollLeft = scrollContainer?.scrollLeft ?? 0
        initialScrollTop = scrollContainer?.scrollTop ?? 0
        dragStarted = true
        this.safeSetPointerCapture(target, activePointerId)
        taskGroup.classList.add('dragging', 'touch-dragging')
        window.addEventListener('touchmove', preventNativeTouchScroll, { passive: false })

        if (this.option?.touch?.hapticFeedback && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
          try {
            navigator.vibrate(10)
          } catch {
            // 非対応環境では無視
          }
        }

        this.startEdgeAutoScroll(
          latestClientX,
          latestClientY,
          {
            allowX: movable !== 'y',
            allowY: movable !== 'x' && this.option.enableCrossRowMove !== false,
          },
          (cx, cy) => updateMoveAt(cx, cy, false),
        )
        updateMoveAt(latestClientX, latestClientY, false)
      }

      const onTouchPointerMove = (moveEvent: PointerEvent) => {
        if (!isMatchingTouch(moveEvent)) return
        latestClientX = moveEvent.clientX
        latestClientY = moveEvent.clientY

        if (!dragStarted) {
          const dist = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY)
          if (dist > moveSlop) {
            // スワイプ開始とみなし、長押しタイマーを破棄してネイティブスクロールに委譲
            cleanupTouchListeners()
          }
          return
        }

        if (moveEvent.cancelable) moveEvent.preventDefault()
        this.updateAutoScrollPointer(moveEvent.clientX, moveEvent.clientY)
        updateMoveAt(moveEvent.clientX, moveEvent.clientY, false)
      }

      const onTouchPointerUp = (upEvent: PointerEvent) => {
        if (!isMatchingTouch(upEvent)) return
        const wasStarted = dragStarted
        cleanupTouchListeners()
        if (!wasStarted) {
          // 長押し成立前の離指はタスク選択タップとして扱う
          this.dispatchEvent(
            new CustomEvent('bar-click', {
              detail: {
                task: this.task,
                event: upEvent,
                isMultiSelect: false,
              },
              bubbles: true,
              composed: true,
            }),
          )
          this._wasDragging = true
          return
        }
        finishMove(false, upEvent)
      }

      const onTouchPointerCancel = (cancelEvent: PointerEvent) => {
        if (!isMatchingTouch(cancelEvent)) return
        const wasStarted = dragStarted
        cleanupTouchListeners()
        if (wasStarted) {
          finishMove(true, cancelEvent)
        }
      }

      const onPinchStart = () => {
        const wasStarted = dragStarted
        cleanupTouchListeners()
        if (wasStarted) {
          finishMove(true)
        }
      }

      const onTouchEscape = (ke: KeyboardEvent) => {
        if (ke.key === 'Escape') {
          const wasStarted = dragStarted
          cleanupTouchListeners()
          if (wasStarted) {
            finishMove(true)
          }
        }
      }

      window.addEventListener('pointermove', onTouchPointerMove)
      window.addEventListener('pointerup', onTouchPointerUp)
      window.addEventListener('pointercancel', onTouchPointerCancel)
      window.addEventListener('moguchart-pinch-start', onPinchStart)
      window.addEventListener('keydown', onTouchEscape)

      if (longPressDelay === 0) {
        activateTouchDrag()
      } else {
        this._longPressTimer = window.setTimeout(activateTouchDrag, longPressDelay)
      }
      return
    }

    // --- マウス / ペン入力 ---
    this.safeSetPointerCapture(target, e.pointerId)

    this.setupDragEvents(
      target,
      e.pointerId,
      (moveEvent) => {
        const scrollDeltaX = (scrollContainer?.scrollLeft ?? 0) - initialScrollLeft
        const scrollDeltaY = (scrollContainer?.scrollTop ?? 0) - initialScrollTop
        const rawDeltaX = moveEvent.clientX - startX + scrollDeltaX
        const rawDeltaY = moveEvent.clientY - startY + scrollDeltaY

        // ドラッグ閾値を超えていない場合は何もしない
        if (!dragStarted) {
          if (Math.abs(rawDeltaX) < GanttBarElement.DRAG_THRESHOLD && Math.abs(rawDeltaY) < GanttBarElement.DRAG_THRESHOLD) {
            return
          }
          // 閾値を超えたのでドラッグを開始
          dragStarted = true
          const initialCursor = moveEvent.ctrlKey || moveEvent.altKey ? 'copy' : 'grabbing'
          this._currentDragCursor = initialCursor
          target.style.cursor = initialCursor
          taskGroup.classList.add('dragging')
          this.startEdgeAutoScroll(
            moveEvent.clientX,
            moveEvent.clientY,
            {
              allowX: movable !== 'y',
              allowY: movable !== 'x' && this.option.enableCrossRowMove !== false,
            },
            (cx, cy) => updateMoveAt(cx, cy, lastModifierCopy),
          )
        }

        this.updateAutoScrollPointer(moveEvent.clientX, moveEvent.clientY)
        updateMoveAt(moveEvent.clientX, moveEvent.clientY, moveEvent.ctrlKey || moveEvent.altKey)
      },
      (isCancel, upEvent) => {
        finishMove(isCancel, upEvent)
      },
    )
  }

  protected updated(changedProperties: PropertyValues): void {
    super.updated(changedProperties)

    const barEl = this.shadowRoot?.querySelector('.bar') as HTMLElement
    if (barEl) {
      if (this.option.customRendering?.barContent) {
        // barContentオプションがある場合は、それを使ってレンダリング
        // render-bar-content イベントは発火するが、コンテンツはクリアしない
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
      } else {
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

      if (this._currentDragCursor) {
        barEl.style.cursor = this._currentDragCursor
      } else if (!this.option.readOnly) {
        barEl.style.cursor = ''
      }
    }

    // 複数ドラッグ中の選択バーに移動を適用
    if (changedProperties.has('multiDragDx') || changedProperties.has('multiDragDy')) {
      const taskGroup = this.shadowRoot?.querySelector('.task-group') as HTMLElement
      if (taskGroup) {
        if (this.multiDragDx !== 0 || this.multiDragDy !== 0) {
          taskGroup.style.transform = `translate(${this.multiDragDx}px, ${this.multiDragDy}px)`
          taskGroup.style.opacity = '0.6'
          taskGroup.style.pointerEvents = 'none'
        } else {
          taskGroup.style.transform = ''
          taskGroup.style.opacity = ''
          taskGroup.style.pointerEvents = ''
        }
      }
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.stopEdgeAutoScroll()
    this.clearLongPressTimer()
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

  private onMouseMoveOnBar = (e: MouseEvent) => {
    const taskGroup = this.shadowRoot?.querySelector('.task-group') as HTMLElement
    if (!taskGroup || this.option.readOnly || this.task?.type === 'summary') return
    if (this.option.dependency?.showConnectors === false || this.option.dependency?.creatable === false) return

    const rect = taskGroup.getBoundingClientRect()
    const localX = e.clientX - rect.left
    const isMilestone = isMilestoneTask(this.task)
    const nearLeft = isMilestone || localX <= this._connectorEdgeThreshold
    const nearRight = isMilestone || localX >= rect.width - this._connectorEdgeThreshold

    const connLeft = this.shadowRoot?.querySelector('.connector-left')
    const connRight = this.shadowRoot?.querySelector('.connector-right')
    if (connLeft) connLeft.classList.toggle('show-connector', nearLeft)
    if (connRight) connRight.classList.toggle('show-connector', nearRight)
  }

  private onMouseEnter(e: MouseEvent) {
    const target = e.currentTarget as HTMLElement
    if (target.classList.contains('dragging')) {
      return
    }
    if (!this.option.readOnly) {
      window.addEventListener('keydown', this.handleKeyDown)
      window.addEventListener('keyup', this.handleKeyUp)
      if (e.ctrlKey || e.altKey) {
        this.updateCursor(true)
      }
      target.addEventListener('mousemove', this.onMouseMoveOnBar)
    }
    const rect = target.getBoundingClientRect()
    this.dispatchEvent(
      new CustomEvent('bar-mouseenter', {
        detail: {
          task: this.task,
          x: rect.left + rect.width / 2,
          y: rect.top,
          barBottom: rect.bottom,
        },
        bubbles: true,
        composed: true,
      }),
    )
  }

  private onMouseLeave() {
    const taskGroup = this.shadowRoot?.querySelector('.task-group') as HTMLElement
    if (!this.option.readOnly) {
      window.removeEventListener('keydown', this.handleKeyDown)
      window.removeEventListener('keyup', this.handleKeyUp)
      this.updateCursor(false)
      if (taskGroup) {
        taskGroup.removeEventListener('mousemove', this.onMouseMoveOnBar)
      }
      // 丸印を非表示に戻す
      const connLeft = this.shadowRoot?.querySelector('.connector-left')
      const connRight = this.shadowRoot?.querySelector('.connector-right')
      if (connLeft) connLeft.classList.remove('show-connector')
      if (connRight) connRight.classList.remove('show-connector')
    }
    this.dispatchEvent(
      new CustomEvent('bar-mouseleave', {
        bubbles: true,
        composed: true,
      }),
    )
  }

  private onBaselineMouseEnter(e: MouseEvent) {
    const target = e.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()
    this.dispatchEvent(
      new CustomEvent('bar-mouseenter', {
        detail: {
          task: this.task,
          x: rect.left + rect.width / 2,
          y: rect.top,
          barBottom: rect.bottom,
          isBaseline: true,
        },
        bubbles: true,
        composed: true,
      }),
    )
  }

  private onBaselineMouseLeave() {
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

  private onClick(e: MouseEvent) {
    e.stopPropagation()
    // ドラッグ後のクリックは無視
    if (this._wasDragging) {
      this._wasDragging = false
      return
    }
    this.dispatchEvent(
      new CustomEvent('bar-click', {
        detail: {
          task: this.task,
          event: e,
          isMultiSelect: e.metaKey || e.ctrlKey,
        },
        bubbles: true,
        composed: true,
      }),
    )
  }

  private onConnectorDragStart(e: PointerEvent, endpoint: DependencyEndpoint) {
    if (this.task?.type === 'summary' || this.option.readOnly || this.option.dependency?.creatable === false) return
    e.stopPropagation()
    if (e.cancelable) e.preventDefault()
    if (e.pointerType === 'touch') {
      this.touchActive = true
    }
    const target = e.target as HTMLElement
    this.safeSetPointerCapture(target, e.pointerId)

    const taskGroup = this.shadowRoot?.querySelector('.task-group') as HTMLElement
    if (!taskGroup) return

    const barHeight = this.option.bar?.height ?? DEFAULT_BAR_HEIGHT
    const barMargin = this.option.bar?.margin ?? DEFAULT_BAR_MARGIN
    const isMilestone = isMilestoneTask(this.task)
    const diamondSize = Math.max(12, Math.round(barHeight * 0.72))
    const rawX = this.getX(this.task.start)
    const x = isMilestone ? rawX - diamondSize / 2 : rawX
    const width = isMilestone ? diamondSize : this.getX(this.task.end) - rawX
    const y = this.lane * (barHeight + barMargin) + barMargin

    // 起点座標を計算（バーの左端 or 右端の中央）
    const startX = endpoint === 'start' ? x : x + width
    const startY = y + barHeight / 2

    const emitMove = (clientX: number, clientY: number) => {
      this.dispatchEvent(
        new CustomEvent('connector-drag-move', {
          detail: {
            taskId: this.task.id,
            endpoint,
            startX,
            startY,
            clientX,
            clientY,
            pointerType: e.pointerType,
          },
          bubbles: true,
          composed: true,
        }),
      )
    }

    // ドラッグ開始を通知
    this.dispatchEvent(
      new CustomEvent('connector-drag-start', {
        detail: {
          taskId: this.task.id,
          endpoint,
          startX,
          startY,
          clientX: e.clientX,
          clientY: e.clientY,
          pointerType: e.pointerType,
        },
        bubbles: true,
        composed: true,
      }),
    )

    this.startEdgeAutoScroll(
      e.clientX,
      e.clientY,
      { allowX: true, allowY: true },
      (cx, cy) => emitMove(cx, cy),
    )

    this.setupDragEvents(
      target,
      e.pointerId,
      (moveEvent) => {
        this.updateAutoScrollPointer(moveEvent.clientX, moveEvent.clientY)
        emitMove(moveEvent.clientX, moveEvent.clientY)
      },
      (isCancel) => {
        this.dispatchEvent(
          new CustomEvent('connector-drag-end', {
            detail: {
              taskId: this.task.id,
              endpoint,
              cancelled: isCancel,
            },
            bubbles: true,
            composed: true,
          }),
        )
      },
    )
  }

  private onProgressDragStart(e: PointerEvent) {
    e.stopPropagation()
    if (e.cancelable) e.preventDefault()
    if (e.pointerType === 'touch') {
      this.touchActive = true
    }
    const target = e.currentTarget as HTMLElement
    if (!target) return
    this.safeSetPointerCapture(target, e.pointerId)

    const isReadOnly = this.option?.readOnly
    const isProgressFeatureEnabled = this.option?.progress?.enabled !== false
    const editable =
      isProgressFeatureEnabled &&
      (this.task.progressResizable !== undefined
        ? this.task.progressResizable
        : !isReadOnly && (this.option?.progress?.editable ?? false))
    if (!editable) return

    const currentProgress = clampProgress(this.task.progress ?? 0)
    const originalProgress = this.task.progress

    this._isDraggingProgress = true
    this._dragProgress = currentProgress

    const barEl = this.shadowRoot?.querySelector('.bar') as HTMLElement
    const barRect = barEl ? barEl.getBoundingClientRect() : null
    const barWidth = barRect && barRect.width > 0 ? barRect.width : 1
    const startClientX = e.clientX

    const snapStep = Math.max(1, this.option?.progress?.snapStep ?? 1)

    this.setupDragEvents(
      target,
      e.pointerId,
      (moveEvent) => {
        const deltaX = moveEvent.clientX - startClientX
        const initialPx = (currentProgress / 100) * barWidth
        const newPx = Math.max(0, Math.min(barWidth, initialPx + deltaX))
        let newPercent = (newPx / barWidth) * 100

        if (snapStep > 1) {
          newPercent = Math.round(newPercent / snapStep) * snapStep
        }
        newPercent = clampProgress(newPercent)

        this._dragProgress = newPercent
        this.requestUpdate()
      },
      (isCancel) => {
        const finalProgress = isCancel
          ? (originalProgress ?? currentProgress)
          : (this._dragProgress ?? currentProgress)
        this._isDraggingProgress = false
        this._dragProgress = null

        this.dispatchEvent(
          new CustomEvent<TaskProgressChangeEventDetail>('task-progress-change', {
            detail: {
              task: this.task,
              progress: finalProgress,
              originalProgress,
              cancelled: isCancel,
            },
            bubbles: true,
            composed: true,
          }),
        )
        this.requestUpdate()
      },
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
    e.stopPropagation()
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

    const isMilestone = isMilestoneTask(this.task)
    const rawX = this.getX(this.task.start)
    const rawWidth = this.getX(this.task.end) - rawX
    const barHeight = this.option.bar?.height ?? DEFAULT_BAR_HEIGHT
    const barMargin = this.option.bar?.margin ?? DEFAULT_BAR_MARGIN
    const barCornerRadius = this.option.bar?.cornerRadius ?? DEFAULT_BAR_CORNER_RADIUS

    const y = this.lane * (barHeight + barMargin) + barMargin
    const isReadOnly = this.option.readOnly
    const isSummary = this.task.type === 'summary'
    const movable = this.task.movable ?? 'both'
    const resizable = this.task.resizable
    const canMove = !isReadOnly && movable !== 'none' && !isSummary

    let canResize = !isReadOnly && !isSummary && !isMilestone
    if (canResize) {
      if (resizable !== undefined) {
        canResize = resizable
      } else {
        canResize = !(movable === 'y' || movable === 'none')
      }
    }

    const isBaselineFeatureEnabled = this.option.baseline?.enabled === true
    const baselineData = this.task.baseline
    const hasValidBaseline =
      isBaselineFeatureEnabled &&
      !!baselineData &&
      !!baselineData.start &&
      !!baselineData.end &&
      !isNaN(new Date(baselineData.start).getTime()) &&
      !isNaN(new Date(baselineData.end).getTime())

    const baselinePos = this.option.baseline?.position ?? 'bottom'
    const defaultBaselineHeight = Math.max(4, Math.min(10, Math.round(barHeight * 0.25)))
    const baselineHeight = this.option.baseline?.height ?? defaultBaselineHeight
    const baselineGap = 2

    let actualBarHeight = barHeight
    let actualBarY = y
    let baselineY = y

    if (hasValidBaseline) {
      if (baselinePos === 'bottom') {
        actualBarHeight = Math.max(8, barHeight - baselineHeight - baselineGap)
        actualBarY = y
        baselineY = y + actualBarHeight + baselineGap
      } else if (baselinePos === 'top') {
        actualBarHeight = Math.max(8, barHeight - baselineHeight - baselineGap)
        baselineY = y
        actualBarY = y + baselineHeight + baselineGap
      } else if (baselinePos === 'overlay') {
        actualBarHeight = barHeight
        actualBarY = y
        baselineY = y
      }
    }

    const diamondSize = Math.max(12, Math.round(actualBarHeight * 0.72))
    const x = isMilestone ? rawX - diamondSize / 2 : rawX
    const width = isMilestone ? diamondSize : rawWidth
    const groupTop = isMilestone ? actualBarY + (actualBarHeight - diamondSize) / 2 : actualBarY
    const groupHeight = isMilestone ? diamondSize : actualBarHeight
    const milestoneColor = this.option.bar?.milestoneColor ?? '#8b5cf6'

    const rawBarLabelPos: GanttBarLabelPosition =
      this.task.labelPosition ??
      (isMilestone ? 'right' : (this.option.bar?.labelPosition ?? 'inside'))
    const effectiveBarLabelPos: 'inside' | 'right' | 'left' =
      rawBarLabelPos === 'auto'
        ? isMilestone ||
          width < estimateTaskLabelWidth(this.task.name ?? '', this.option.fontScale ?? 1)
          ? 'right'
          : 'inside'
        : rawBarLabelPos

    const bx = hasValidBaseline ? this.getX(baselineData!.start) : 0
    const bwidth = hasValidBaseline ? Math.max(1, this.getX(baselineData!.end) - bx) : 0
    const baselineColor =
      baselineData?.color ?? this.option.baseline?.color ?? (isSummary ? '#64748b' : '#94a3b8')
    const baselineCornerRadius = this.option.baseline?.cornerRadius ?? 2
    const hasBaselineProgress =
      hasValidBaseline &&
      typeof baselineData?.progress === 'number' &&
      !Number.isNaN(baselineData.progress)
    const baselineProgressVal = hasBaselineProgress ? clampProgress(baselineData!.progress!) : null

    const delayInfo = hasValidBaseline ? calculateTaskDelay(this.task) : null
    const isDelayed = delayInfo?.isDelayed && (this.option.baseline?.highlightDelay !== false)
    const delayColor = this.option.baseline?.delayColor ?? '#ef4444'

    const isProgressFeatureEnabled = this.option.progress?.enabled !== false && !isMilestone
    const isProgressEditable =
      isProgressFeatureEnabled &&
      !isSummary &&
      !isMilestone &&
      (this.task.progressResizable !== undefined
        ? this.task.progressResizable
        : !isReadOnly && (this.option.progress?.editable ?? false))
    const rawProgress = this._isDraggingProgress ? this._dragProgress : this.task.progress
    const hasProgressValue = typeof rawProgress === 'number' && !Number.isNaN(rawProgress)
    const hasProgress = isProgressFeatureEnabled && (hasProgressValue || isProgressEditable)
    const progressVal = hasProgress ? clampProgress(rawProgress ?? 0) : null
    const indicatorPosition = this.option.progress?.indicatorPosition ?? 'full'
    const showProgressLabel =
      (!isSummary || (this.option.progress?.showSummaryLabel ?? true)) &&
      hasProgress &&
      hasProgressValue &&
      this.option.progress?.showLabel === true
    const labelPosition = this.option.progress?.labelPosition ?? 'inside'
    const progressLabelText =
      showProgressLabel && progressVal !== null
        ? this.option.progress?.labelFormatter
          ? this.option.progress.labelFormatter(progressVal, this.task)
          : `${Math.round(progressVal)}%`
        : ''
    const progressColorStyle = isSummary
      ? (this.option.progress?.summaryColor
          ? `background-color: ${this.option.progress.summaryColor};`
          : '')
      : (this.task.progressColor
          ? `background-color: ${this.task.progressColor};`
          : this.option.progress?.color
            ? `background-color: ${this.option.progress.color};`
            : '')

    const isFiltered =
      (this.task as any)._isFilteredOut === true ||
      (typeof this.task.style === 'string' && /opacity:\s*0(\.\d+)?/i.test(this.task.style))

    return html`
      ${hasValidBaseline
        ? html`
            <div
              class="baseline-group ${isSummary ? 'summary-baseline-group' : ''} ${baselinePos === 'overlay'
                ? 'baseline-overlay'
                : ''} ${isFiltered ? 'filtered-out' : ''}"
              style="
                left: ${bx}px;
                top: ${baselineY}px;
                width: ${bwidth}px;
                height: ${baselinePos === 'overlay' ? barHeight : baselineHeight}px;
              "
              @mouseenter="${this.onBaselineMouseEnter}"
              @mouseleave="${this.onBaselineMouseLeave}"
            >
              <div
                class="baseline-bar ${isSummary ? 'summary-baseline-bar' : ''}"
                style="
                  border-radius: ${isSummary ? 0 : baselineCornerRadius}px;
                  background-color: ${baselineColor};
                  ${baselineData?.style || ''};
                "
              >
                ${hasBaselineProgress && baselineProgressVal !== null
                  ? html`<div
                      class="baseline-progress-bar"
                      style="width: ${baselineProgressVal}%;"
                    ></div>`
                  : ''}
              </div>
            </div>
          `
        : ''}
      <div
        class="task-group ${isSummary ? 'summary-task-group' : ''} ${isMilestone ? 'milestone-task-group' : ''} ${isDelayed ? 'task-delayed' : ''} ${isFiltered ? 'filtered-out' : ''}"
        style="
          left: ${x}px;
          top: ${groupTop}px;
          width: ${width}px;
          height: ${groupHeight}px;
          ${isDelayed ? `--moguchart-delay-color: ${delayColor};` : ''}
        "
        @pointerdown="${this.onTaskGroupPointerDown}"
        @mouseenter="${this.onMouseEnter}"
        @mouseleave="${this.onMouseLeave}"
        @click="${this.onClick}"
        @dblclick="${this.onDblClick}"
        @contextmenu="${this.onContextMenu}"
      >
        <div
          class="bar ${isSummary ? 'summary-bar' : ''} ${isMilestone ? 'milestone-bar' : ''}"
          style="border-radius: ${isSummary ? 0 : isMilestone ? 2 : barCornerRadius}px; ${isMilestone
            ? `background-color: ${milestoneColor};`
            : ''} ${this.task.style || ''}; ${getPatternStyle(
            this.task.pattern,
          )}; ${!canMove ? 'cursor: pointer;' : ''}"
          @pointerdown="${canMove ? this.onMoveStart : undefined}"
        >
          ${hasProgress && progressVal !== null && (hasProgressValue || this._isDraggingProgress)
            ? html`<div
                class="progress-bar ${indicatorPosition !== 'full'
                  ? `indicator-${indicatorPosition}`
                  : ''} ${this._isDraggingProgress ? 'dragging' : ''}"
                style="width: ${progressVal}%; ${progressColorStyle} ${this.task.progressStyle || ''}"
              ></div>`
            : ''}
          ${this.option.customRendering?.barContent ? this.option.customRendering.barContent(this.task) : ''}
        </div>
        ${!this.option.customRendering?.barContent && this.task.name
          ? html`<div
              class="bar-label pos-${effectiveBarLabelPos}"
              style="${this.task.labelStyle || ''}; ${isFiltered ? 'opacity: 0.2;' : ''}"
            >${this.task.name}</div>`
          : ''}
        ${showProgressLabel && progressLabelText
          ? html`<div class="progress-label pos-${labelPosition}" style="${isFiltered ? 'opacity: 0.2;' : ''}">${progressLabelText}</div>`
          : ''}
        ${isProgressEditable && progressVal !== null
          ? html`<div
              class="handle-progress ${this._isDraggingProgress ? 'dragging' : ''}"
              style="left: ${progressVal}%;"
              @pointerdown="${this.onProgressDragStart}"
            >
              <div class="handle-progress-line"></div>
              <div class="handle-progress-knob"></div>
            </div>`
          : ''}
        ${canResize
          ? html`
              <div class="handle-left" @pointerdown="${(e: PointerEvent) => this.onResizeStart(e, 'left')}"></div>
              <div class="handle-right" @pointerdown="${(e: PointerEvent) => this.onResizeStart(e, 'right')}"></div>
            `
          : ''}
        ${!isReadOnly && !isSummary && this.option.dependency?.showConnectors !== false && this.option.dependency?.creatable !== false
          ? html`
              <div
                class="connector-left"
                @pointerdown="${(e: PointerEvent) => this.onConnectorDragStart(e, 'start')}"
              ></div>
              <div
                class="connector-right"
                @pointerdown="${(e: PointerEvent) => this.onConnectorDragStart(e, 'end')}"
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

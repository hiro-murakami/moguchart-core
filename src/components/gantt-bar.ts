import { LitElement, html, css, unsafeCSS, type PropertyValues } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import type { GanttTask, GanttChartOption, DependencyEndpoint, TaskProgressChangeEventDetail } from '../core/types'
import { getPatternStyle } from '../core/patterns'
import { dateToX, xToDate, clampProgress } from '../core/utils'
import { DEFAULT_BAR_COLOR, DEFAULT_BAR_HEIGHT, DEFAULT_BAR_MARGIN, DEFAULT_BAR_CORNER_RADIUS } from '../core/constants'

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
  @state() private _dragProgress: number | null = null
  @state() private _isDraggingProgress = false
  private _currentDragCursor: string | null = null
  private _dragAnimationFrame: number | null = null
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
    .bar {
      cursor: grab;
      width: 100%;
      height: 100%;
      position: absolute;
      top: 0;
      left: 0;
      background-color: ${unsafeCSS(DEFAULT_BAR_COLOR)};
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
      z-index: 20;
      opacity: 0;
      transition: opacity 0.15s ease;
      pointer-events: auto;
    }
    .connector-left.show-connector,
    .connector-right.show-connector {
      opacity: 1;
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
      cursor: ew-resize;
      z-index: 12;
      pointer-events: auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-end;
      user-select: none;
      opacity: 0;
      transition: opacity 0.15s ease;
    }
    .task-group:hover .handle-progress,
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
      pointer-events: none;
      z-index: 1;
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
      font-size: 11px;
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
  `

  private getX(date: Date) {
    return dateToX(
      date,
      this.option.calendar.start,
      this.option.calendar.pxPerDay ?? 50,
      this.option.calendar.pxPerMonth,
    )
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

    const taskGroup = this.shadowRoot?.querySelector('.task-group') as HTMLElement
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
            let rawNewStart = xToDate(originalStartXBase + deltaX, this.option.calendar.start, pxPerDay, pxPerMonth)
            if (rawNewStart.getDate() > 15) rawNewStart.setMonth(rawNewStart.getMonth() + 1)
            rawNewStart.setDate(1)
            rawNewStart.setHours(0, 0, 0, 0)
            newStart = rawNewStart
            if (newStart >= newEnd) {
              newStart = new Date(newEnd)
              newStart.setMonth(newStart.getMonth() - 1)
            }
          } else {
            let rawNewEnd = xToDate(originalEndXBase + deltaX, this.option.calendar.start, pxPerDay, pxPerMonth)
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
                x: moveEvent.clientX,
                y: moveEvent.clientY,
                barX: barRect ? barRect.left + barRect.width / 2 : undefined,
                barTop: barRect?.top,
                barBottom: barRect?.bottom,
              },
              bubbles: true,
              composed: true,
            }),
          )
        })
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

  private onMoveStart(e: PointerEvent) {
    // 右クリック（button === 2）はコンテキストメニュー用なので無視
    if (e.button === 2) return
    e.stopPropagation()
    const target = e.target as HTMLElement
    const taskGroup = this.shadowRoot?.querySelector('.task-group') as HTMLElement

    if (!target || !taskGroup) {
      return
    }

    const movable = this.task.movable ?? 'both'
    if (movable === 'none') return

    target.setPointerCapture(e.pointerId)

    const chartEl = this.getGanttChartElement()
    const startX = e.clientX
    const startY = e.clientY
    // 開始時の一時的な日付を保持
    const originalStart = new Date(this.task.start)
    const originalEnd = new Date(this.task.end)

    const snapDuration = this.option.snapDuration ?? 1440

    // ドラッグ閾値を超えたかどうかを追跡
    let dragStarted = false

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

    this.setupDragEvents(
      target,
      e.pointerId,
      (moveEvent) => {
        const rawDeltaX = moveEvent.clientX - startX
        const rawDeltaY = moveEvent.clientY - startY

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
        }

        const isCopy = moveEvent.ctrlKey || moveEvent.altKey
        const newCursor = isCopy ? 'copy' : 'grabbing'
        this._currentDragCursor = newCursor
        target.style.cursor = newCursor

        const isOutside = checkIsOutside(moveEvent.clientX, moveEvent.clientY)

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
                  x: moveEvent.clientX,
                  y: moveEvent.clientY,
                  mode: isCopy ? 'copy' : 'move',
                },
                bubbles: true,
                composed: true,
              }),
            )
          })
          return
        }

        let deltaX = rawDeltaX
        let deltaY = rawDeltaY

        if (movable === 'y') deltaX = 0
        if (movable === 'x') deltaY = 0
        if (this.option.enableCrossRowMove === false) deltaY = 0
        // 複数ドラッグ中：同じ行のバーのみ選択されている場合は縦移動を許可
        if (this.multiDragActive && !this.multiDragSameRow) deltaY = 0

        let translateX = deltaX
        if (!this.option.calendar.pxPerMonth) {
          const pxPerMinute = this.option.calendar.pxPerDay / (24 * 60)
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
                x: moveEvent.clientX,
                y: moveEvent.clientY,
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
      },
      (isCancel, upEvent) => {
        this._currentDragCursor = null
        taskGroup.classList.remove('dragging')
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
          const rawDeltaX = upEvent.clientX - startX
          let finalTranslateX = rawDeltaX
          if (!this.option.calendar.pxPerMonth) {
            const pxPerMinute = this.option.calendar.pxPerDay / (24 * 60)
            const snapPx = pxPerMinute * snapDuration
            finalTranslateX = Math.round(rawDeltaX / snapPx) * snapPx
          } else {
            const rawDate = xToDate(
              this.getX(originalStart) + rawDeltaX,
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
            finalTranslateX = this.getX(snappedStart) - this.getX(originalStart)
          }
          let finalDeltaY = upEvent.clientY - startY

          // movable制限をドロップ時にも適用
          if (movable === 'y') finalTranslateX = 0
          if (movable === 'x') finalDeltaY = 0
          if (this.option.enableCrossRowMove === false) finalDeltaY = 0
          // 複数ドラッグ中：同じ行のバーのみ選択されている場合は縦移動を許可
          if (this.multiDragActive && !this.multiDragSameRow) finalDeltaY = 0

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

          const isCopy = upEvent.ctrlKey || upEvent.altKey

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
    if (!taskGroup || this.option.readOnly) return
    if (this.option.dependency?.showConnectors === false) return

    const rect = taskGroup.getBoundingClientRect()
    const localX = e.clientX - rect.left
    const nearLeft = localX <= this._connectorEdgeThreshold
    const nearRight = localX >= rect.width - this._connectorEdgeThreshold

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
    e.stopPropagation()
    e.preventDefault()
    const target = e.target as HTMLElement
    target.setPointerCapture(e.pointerId)

    const taskGroup = this.shadowRoot?.querySelector('.task-group') as HTMLElement
    if (!taskGroup) return

    const barHeight = this.option.bar?.height ?? DEFAULT_BAR_HEIGHT
    const barMargin = this.option.bar?.margin ?? DEFAULT_BAR_MARGIN
    const x = this.getX(this.task.start)
    const width = this.getX(this.task.end) - x
    const y = this.lane * (barHeight + barMargin) + barMargin

    // 起点座標を計算（バーの左端 or 右端の中央）
    const startX = endpoint === 'start' ? x : x + width
    const startY = y + barHeight / 2

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
        },
        bubbles: true,
        composed: true,
      }),
    )

    this.setupDragEvents(
      target,
      e.pointerId,
      (moveEvent) => {
        this.dispatchEvent(
          new CustomEvent('connector-drag-move', {
            detail: {
              taskId: this.task.id,
              endpoint,
              startX,
              startY,
              clientX: moveEvent.clientX,
              clientY: moveEvent.clientY,
            },
            bubbles: true,
            composed: true,
          }),
        )
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
    e.preventDefault()
    const target = e.currentTarget as HTMLElement
    if (!target) return

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

    const x = this.getX(this.task.start)
    const width = this.getX(this.task.end) - x
    const barHeight = this.option.bar?.height ?? DEFAULT_BAR_HEIGHT
    const barMargin = this.option.bar?.margin ?? DEFAULT_BAR_MARGIN
    const barCornerRadius = this.option.bar?.cornerRadius ?? DEFAULT_BAR_CORNER_RADIUS

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

    const isProgressFeatureEnabled = this.option.progress?.enabled !== false
    const isProgressEditable =
      isProgressFeatureEnabled &&
      (this.task.progressResizable !== undefined
        ? this.task.progressResizable
        : !isReadOnly && (this.option.progress?.editable ?? false))
    const rawProgress = this._isDraggingProgress ? this._dragProgress : this.task.progress
    const hasProgressValue = typeof rawProgress === 'number' && !Number.isNaN(rawProgress)
    const hasProgress = isProgressFeatureEnabled && (hasProgressValue || isProgressEditable)
    const progressVal = hasProgress ? clampProgress(rawProgress ?? 0) : null
    const indicatorPosition = this.option.progress?.indicatorPosition ?? 'full'
    const showProgressLabel = hasProgress && hasProgressValue && this.option.progress?.showLabel === true
    const labelPosition = this.option.progress?.labelPosition ?? 'inside'
    const progressLabelText =
      showProgressLabel && progressVal !== null
        ? this.option.progress?.labelFormatter
          ? this.option.progress.labelFormatter(progressVal, this.task)
          : `${Math.round(progressVal)}%`
        : ''
    const progressColorStyle = this.task.progressColor
      ? `background-color: ${this.task.progressColor};`
      : this.option.progress?.color
        ? `background-color: ${this.option.progress.color};`
        : ''

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
        @click="${this.onClick}"
        @dblclick="${this.onDblClick}"
        @contextmenu="${this.onContextMenu}"
      >
        <div
          class="bar"
          style="border-radius: ${barCornerRadius}px; ${this.task.style || ''}; ${getPatternStyle(
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
          ? html`<div class="bar-label" style="${this.task.labelStyle || ''}">${this.task.name}</div>`
          : ''}
        ${showProgressLabel
          ? html`<div class="progress-label pos-${labelPosition}">${progressLabelText}</div>`
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
        ${!isReadOnly && this.option.dependency?.showConnectors !== false
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

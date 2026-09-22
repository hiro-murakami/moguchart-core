import type { ReactiveController, ReactiveControllerHost } from 'lit'
import type { GanttChartOption, BarSelectionChangeEventDetail } from '../../core/types'

export interface MarqueeSelectionState {
  startX: number
  startY: number
  currentX: number
  currentY: number
  active: boolean
}

export interface MarqueeControllerHost extends ReactiveControllerHost, HTMLElement {
  option: GanttChartOption
  currentRowHeaderWidth: number
  calendarHeight: number
  selectedTasks: Set<string>
  calculateLayout(): { layouts: any; taskCoords: Map<string, any>; totalHeight: number }
}

export class MarqueeController implements ReactiveController {
  private host: MarqueeControllerHost

  public marqueeSelection: MarqueeSelectionState | null = null
  public isMarqueeActive = false
  public justFinishedMarquee = false

  private marqueeDragStart: {
    clientX: number
    clientY: number
    contentStartX: number
    contentStartY: number
    initialSelectedTasks: Set<string>
    isMultiModifier: boolean
  } | null = null

  private marqueeAutoScrollInterval: number | null = null

  constructor(host: MarqueeControllerHost) {
    this.host = host
    host.addController(this)
  }

  hostConnected(): void {}

  hostDisconnected(): void {
    this.cleanup()
  }

  public cleanup(): void {
    this.stopMarqueeAutoScroll()
    window.removeEventListener('pointermove', this.handlePointerMove)
    window.removeEventListener('pointerup', this.handlePointerUp)
    window.removeEventListener('pointercancel', this.handlePointerUp)
  }

  public handlePointerDown = (e: PointerEvent): void => {
    // 左クリックのみ
    if (e.button !== 0) return
    // 矩形選択が無効化されている場合はスキップ
    if (this.host.option?.selection?.marquee === false) return

    // 除外ターゲット判定
    const target = e.target as HTMLElement | null
    if (!target) return

    // タスクバー、各種ハンドル、コネクタ、マーカー、マイルストーン、ヘッダーリサイザー上での操作は除外
    if (
      target.closest(
        '.bar, .task-group, .handle-left, .handle-right, .handle-progress, .connector-left, .connector-right, .marker-wrapper, .milestone-line, .header-resizer, .dependency-hit-area, .dependency-delete-btn',
      )
    ) {
      return
    }

    // カレンダーヘッダー上での操作は除外
    if (target.closest('gantt-calendar')) {
      return
    }

    const container = this.host.shadowRoot?.querySelector('.scroll-container') as HTMLElement | null
    if (!container) return

    const rect = container.getBoundingClientRect()
    const labelWidth = this.host.currentRowHeaderWidth
    const contentX = e.clientX - rect.left + container.scrollLeft
    const contentY = e.clientY - rect.top + container.scrollTop - this.host.calendarHeight

    // 行ヘッダー領域またはカレンダー領域でのクリックは除外
    if (contentX < labelWidth || contentY < 0) {
      return
    }

    const isMultiModifier = e.shiftKey || e.ctrlKey || e.metaKey

    this.marqueeDragStart = {
      clientX: e.clientX,
      clientY: e.clientY,
      contentStartX: contentX,
      contentStartY: contentY,
      initialSelectedTasks: new Set(this.host.selectedTasks),
      isMultiModifier,
    }
    this.isMarqueeActive = false

    window.addEventListener('pointermove', this.handlePointerMove)
    window.addEventListener('pointerup', this.handlePointerUp)
    window.addEventListener('pointercancel', this.handlePointerUp)
  }

  public handlePointerMove = (e: PointerEvent): void => {
    if (!this.marqueeDragStart) return

    const dist = Math.hypot(
      e.clientX - this.marqueeDragStart.clientX,
      e.clientY - this.marqueeDragStart.clientY,
    )

    // ドラッグ判定の閾値（4px）
    if (!this.isMarqueeActive && dist < 4) {
      return
    }

    if (!this.isMarqueeActive) {
      this.isMarqueeActive = true
    }

    const container = this.host.shadowRoot?.querySelector('.scroll-container') as HTMLElement | null
    if (!container) return

    const rect = container.getBoundingClientRect()
    const labelWidth = this.host.currentRowHeaderWidth
    const rawContentX = e.clientX - rect.left + container.scrollLeft
    const rawContentY = e.clientY - rect.top + container.scrollTop - this.host.calendarHeight

    const currentX = Math.max(labelWidth, rawContentX)
    const currentY = Math.max(0, rawContentY)
    const startX = this.marqueeDragStart.contentStartX
    const startY = this.marqueeDragStart.contentStartY

    const rectLeft = Math.min(startX, currentX)
    const rectRight = Math.max(startX, currentX)
    const rectTop = Math.min(startY, currentY)
    const rectBottom = Math.max(startY, currentY)

    this.marqueeSelection = {
      startX,
      startY,
      currentX,
      currentY,
      active: true,
    }

    // AABB 交差判定
    const { taskCoords } = this.host.calculateLayout()
    const intersectingTaskIds = new Set<string>()

    for (const [taskId, coord] of taskCoords) {
      const taskLeft = coord.x
      const taskRight = coord.x + coord.width
      const taskTop = coord.y
      const taskBottom = coord.y + coord.height

      if (
        taskLeft < rectRight &&
        taskRight > rectLeft &&
        taskTop < rectBottom &&
        taskBottom > rectTop
      ) {
        intersectingTaskIds.add(taskId)
      }
    }

    let newSelectedTasks: Set<string>
    if (this.marqueeDragStart.isMultiModifier) {
      newSelectedTasks = new Set([
        ...this.marqueeDragStart.initialSelectedTasks,
        ...intersectingTaskIds,
      ])
    } else {
      newSelectedTasks = intersectingTaskIds
    }

    this.host.selectedTasks = newSelectedTasks
    this.host.requestUpdate()

    // オートスクロール
    this.handleAutoScroll(e, rect, container)
  }

  public handlePointerUp = (): void => {
    window.removeEventListener('pointermove', this.handlePointerMove)
    window.removeEventListener('pointerup', this.handlePointerUp)
    window.removeEventListener('pointercancel', this.handlePointerUp)
    this.stopMarqueeAutoScroll()

    if (this.isMarqueeActive) {
      this.justFinishedMarquee = true
      this.marqueeSelection = null
      this.isMarqueeActive = false
      this.marqueeDragStart = null

      this.host.dispatchEvent(
        new CustomEvent<BarSelectionChangeEventDetail>('bar-selection-change', {
          detail: {
            selectedIds: [...this.host.selectedTasks],
          },
          bubbles: true,
          composed: true,
        }),
      )

      setTimeout(() => {
        this.justFinishedMarquee = false
      }, 100)
    } else {
      this.marqueeDragStart = null
    }

    this.host.requestUpdate()
  }

  private handleAutoScroll(e: PointerEvent, containerRect: DOMRect, container: HTMLElement): void {
    const scrollEdgeThreshold = 30
    const scrollSpeed = 10

    let scrollDx = 0
    let scrollDy = 0

    if (e.clientX < containerRect.left + this.host.currentRowHeaderWidth + scrollEdgeThreshold) {
      scrollDx = -scrollSpeed
    } else if (e.clientX > containerRect.right - scrollEdgeThreshold) {
      scrollDx = scrollSpeed
    }

    if (e.clientY < containerRect.top + this.host.calendarHeight + scrollEdgeThreshold) {
      scrollDy = -scrollSpeed
    } else if (e.clientY > containerRect.bottom - scrollEdgeThreshold) {
      scrollDy = scrollSpeed
    }

    if (scrollDx !== 0 || scrollDy !== 0) {
      if (this.marqueeAutoScrollInterval === null) {
        this.marqueeAutoScrollInterval = window.setInterval(() => {
          if (!this.isMarqueeActive) {
            this.stopMarqueeAutoScroll()
            return
          }
          if (scrollDx !== 0) container.scrollLeft += scrollDx
          if (scrollDy !== 0) container.scrollTop += scrollDy
        }, 20)
      }
    } else {
      this.stopMarqueeAutoScroll()
    }
  }

  public stopMarqueeAutoScroll(): void {
    if (this.marqueeAutoScrollInterval !== null) {
      window.clearInterval(this.marqueeAutoScrollInterval)
      this.marqueeAutoScrollInterval = null
    }
  }
}

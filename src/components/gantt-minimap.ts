import { LitElement, html, css, type PropertyValues } from 'lit'
import { customElement, property, state, query } from 'lit/decorators.js'
import type { GanttChartOption, GanttRow, MinimapMoveEventDetail, MinimapResizeEventDetail } from '../core/types'
import { calculateTaskLanes, dateToX, getThemeColors } from '../core/utils'
import { DEFAULT_BAR_HEIGHT, DEFAULT_BAR_MARGIN } from '../core/constants'

/**
 * ミニマップスクロールイベントの詳細データ
 */
export interface MinimapScrollEventDetail {
  scrollLeft: number
  scrollTop: number
}

export type { MinimapMoveEventDetail, MinimapResizeEventDetail }

/**
 * タスクのstyle属性から背景色を抽出するヘルパー
 */
function extractTaskColor(style?: string, defaultColor = '#3b82f6'): string {
  if (!style) return defaultColor
  const bgMatch = style.match(/background(?:-color)?\s*:\s*([^;]+)/i)
  if (bgMatch && bgMatch[1]) {
    return bgMatch[1].trim()
  }
  return defaultColor
}

/**
 * ガントチャートの全体俯瞰およびナビゲーションを行うフローティング小窓コンポーネント
 */
@customElement('gantt-minimap')
export class GanttMinimapElement extends LitElement {
  @property({ type: Array }) rows: GanttRow[] = []
  @property({ type: Object }) option!: GanttChartOption
  @property({ type: String }) theme: 'light' | 'dark' = 'light'
  @property({ type: Number }) scrollLeft = 0
  @property({ type: Number }) scrollTop = 0
  @property({ type: Number }) viewportWidth = 0
  @property({ type: Number }) viewportHeight = 0
  @property({ type: Number }) contentWidth = 0
  @property({ type: Number }) contentHeight = 0
  @property({ type: Number }) calendarHeight = 0
  @property({ type: Number }) rowHeaderWidth = 0
  @property({ type: Object }) currentTime = new Date()

  @state() private isCollapsed = false
  @state() private isDragging = false
  @state() private isHeaderDragging = false
  @state() private isResizing = false
  @state() private customWidth: number | null = null
  @state() private customHeight: number | null = null
  @state() private position: { x: number; y: number } | null = null

  @query('canvas') private canvasEl?: HTMLCanvasElement

  private dragStartX = 0
  private dragStartY = 0
  private dragStartScrollLeft = 0
  private dragStartScrollTop = 0

  private headerDragStartX = 0
  private headerDragStartY = 0
  private headerDragOriginX = 0
  private headerDragOriginY = 0

  private resizeHandleType = ''
  private resizeStartPointerX = 0
  private resizeStartPointerY = 0
  private resizeStartWidth = 0
  private resizeStartHeight = 0
  private resizeStartOriginX = 0
  private resizeStartOriginY = 0

  static styles = css`
    :host {
      display: block;
      position: absolute;
      right: 16px;
      bottom: 16px;
      z-index: 1000;
      user-select: none;
      -webkit-user-select: none;
    }

    .minimap-container {
      position: relative;
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18), 0 0 0 1px var(--minimap-border, #cbd5e1);
      background-color: var(--minimap-bg, rgba(255, 255, 255, 0.92));
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      overflow: visible;
      transition: opacity 0.2s ease, box-shadow 0.2s ease;
    }

    .minimap-container.resizing {
      transition: none;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28), 0 0 0 1.5px var(--minimap-viewport-border, #3b82f6);
    }

    .minimap-inner-wrapper {
      position: relative;
      border-radius: 8px;
      overflow: hidden;
    }

    .minimap-resize-handle {
      position: absolute;
      z-index: 20;
      touch-action: none;
      background: transparent;
    }

    /* 四隅（コーナー）: 14px x 14px */
    .minimap-resize-handle.nw {
      top: -4px;
      left: -4px;
      width: 14px;
      height: 14px;
      cursor: nwse-resize;
    }
    .minimap-resize-handle.ne {
      top: -4px;
      right: -4px;
      width: 14px;
      height: 14px;
      cursor: nesw-resize;
    }
    .minimap-resize-handle.sw {
      bottom: -4px;
      left: -4px;
      width: 14px;
      height: 14px;
      cursor: nesw-resize;
    }
    .minimap-resize-handle.se {
      bottom: -4px;
      right: -4px;
      width: 14px;
      height: 14px;
      cursor: nwse-resize;
    }

    /* 四辺（エッジ） */
    .minimap-resize-handle.w {
      top: 10px;
      bottom: 10px;
      left: -4px;
      width: 8px;
      cursor: ew-resize;
    }
    .minimap-resize-handle.e {
      top: 10px;
      bottom: 10px;
      right: -4px;
      width: 8px;
      cursor: ew-resize;
    }
    .minimap-resize-handle.n {
      left: 10px;
      right: 10px;
      top: -4px;
      height: 8px;
      cursor: ns-resize;
    }
    .minimap-resize-handle.s {
      left: 10px;
      right: 10px;
      bottom: -4px;
      height: 8px;
      cursor: ns-resize;
    }

    .minimap-resize-indicator {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 6px;
      height: 6px;
      border-top: 2px solid var(--minimap-text, #475569);
      border-left: 2px solid var(--minimap-text, #475569);
      border-top-left-radius: 3px;
      opacity: 0.35;
      pointer-events: none;
    }

    .minimap-container:hover {
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.22), 0 0 0 1px var(--minimap-border, #cbd5e1);
    }

    .minimap-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 5px 8px;
      font-size: 11px;
      font-weight: 600;
      color: var(--minimap-text, #475569);
      border-bottom: 1px solid var(--minimap-border, #cbd5e1);
      background: rgba(0, 0, 0, 0.03);
      cursor: grab;
      touch-action: none;
    }

    .minimap-header:active,
    .minimap-header.dragging {
      cursor: grabbing;
      background: rgba(0, 0, 0, 0.06);
    }

    .minimap-title {
      display: flex;
      align-items: center;
      gap: 5px;
      line-height: 1;
      pointer-events: none;
    }

    .minimap-drag-icon {
      opacity: 0.5;
      display: flex;
      align-items: center;
    }

    .minimap-toggle-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      border-radius: 4px;
      border: none;
      background: transparent;
      color: var(--minimap-text, #475569);
      cursor: pointer;
      padding: 0;
      transition: background-color 0.15s ease;
    }

    .minimap-toggle-btn:hover {
      background: rgba(0, 0, 0, 0.08);
    }

    .minimap-body {
      position: relative;
      cursor: crosshair;
      overflow: hidden;
    }

    canvas {
      display: block;
    }

    .minimap-viewport {
      position: absolute;
      border: 1.5px solid var(--minimap-viewport-border, #3b82f6);
      background-color: var(--minimap-viewport, rgba(59, 130, 246, 0.2));
      border-radius: 2px;
      cursor: grab;
      box-sizing: border-box;
      pointer-events: auto;
      transition: border-color 0.15s ease, background-color 0.15s ease;
    }

    .minimap-viewport.dragging {
      cursor: grabbing;
      background-color: var(--minimap-viewport-active, rgba(59, 130, 246, 0.3));
    }

    .minimap-collapsed-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      border: 1px solid var(--minimap-border, #cbd5e1);
      background-color: var(--minimap-bg, rgba(255, 255, 255, 0.92));
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      color: var(--minimap-text, #475569);
      cursor: pointer;
      padding: 0;
      transition: transform 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease;
    }

    .minimap-collapsed-btn:hover {
      transform: scale(1.05);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
    }
  `

  override connectedCallback() {
    super.connectedCallback()
    if (this.option?.minimap?.collapsed !== undefined) {
      this.isCollapsed = this.option.minimap.collapsed
    }
    if (this.option?.minimap?.position) {
      this.position = { ...this.option.minimap.position }
    }
  }

  override willUpdate(changedProperties: PropertyValues) {
    super.willUpdate(changedProperties)
    if (changedProperties.has('option')) {
      if (!this.isHeaderDragging && !this.isResizing) {
        if (this.option?.minimap?.position) {
          this.position = { ...this.option.minimap.position }
        } else if (this.option?.minimap?.position === null) {
          this.position = null
        }
        if (this.option?.minimap?.width !== undefined) {
          this.customWidth = this.option.minimap.width
        }
        if (this.option?.minimap?.height !== undefined) {
          this.customHeight = this.option.minimap.height
        }
      }
    }
  }

  override updated(changedProperties: PropertyValues) {
    super.updated(changedProperties)
    this.updateHostPosition()
    if (!this.isCollapsed) {
      this.renderCanvas()
    }
  }

  private updateHostPosition() {
    if (!this.isCollapsed && this.position) {
      this.style.left = `${this.position.x}px`
      this.style.top = `${this.position.y}px`
      this.style.right = 'auto'
      this.style.bottom = 'auto'
    } else {
      this.style.left = ''
      this.style.top = ''
      this.style.right = ''
      this.style.bottom = ''
    }
  }

  private handleHeaderPointerDown(e: PointerEvent) {
    // 最小化ボタン等をクリックした場合はドラッグを開始しない
    if ((e.target as HTMLElement).closest('.minimap-toggle-btn')) return

    e.preventDefault()
    e.stopPropagation()

    const header = e.currentTarget as HTMLElement
    header.setPointerCapture(e.pointerId)
    this.isHeaderDragging = true

    // 現在の配置（親要素に対する相対位置）を初期値として設定
    const hostRect = this.getBoundingClientRect()
    const parentRect = this.parentElement?.getBoundingClientRect() ?? this.offsetParent?.getBoundingClientRect()

    if (parentRect && (parentRect.width > 0 || parentRect.height > 0)) {
      const curX = hostRect.left - parentRect.left
      const curY = hostRect.top - parentRect.top
      this.position = { x: curX, y: curY }
    } else if (!this.position) {
      this.position = { x: hostRect.left, y: hostRect.top }
    }

    this.headerDragStartX = e.clientX
    this.headerDragStartY = e.clientY
    this.headerDragOriginX = this.position?.x ?? 0
    this.headerDragOriginY = this.position?.y ?? 0
  }

  private handleHeaderPointerMove(e: PointerEvent) {
    if (!this.isHeaderDragging) return
    e.preventDefault()
    e.stopPropagation()

    const dx = e.clientX - this.headerDragStartX
    const dy = e.clientY - this.headerDragStartY

    const nextX = this.headerDragOriginX + dx
    const nextY = this.headerDragOriginY + dy

    // 親要素の領域内でクランプ
    const parentRect = this.parentElement?.getBoundingClientRect() ?? this.offsetParent?.getBoundingClientRect()
    const parentWidth = (parentRect?.width && parentRect.width > 0)
      ? parentRect.width
      : (this.viewportWidth > 0 ? this.viewportWidth : (typeof window !== 'undefined' && window.innerWidth > 0 ? window.innerWidth : 1200))
    const parentHeight = (parentRect?.height && parentRect.height > 0)
      ? parentRect.height
      : (this.viewportHeight > 0 ? this.viewportHeight : (typeof window !== 'undefined' && window.innerHeight > 0 ? window.innerHeight : 800))

    const currentW = this.isCollapsed ? 32 : this.minimapWidth
    const currentH = this.isCollapsed ? 32 : (this.minimapHeight + 28)

    const maxX = Math.max(0, parentWidth - currentW)
    const maxY = Math.max(0, parentHeight - currentH)

    const clampedX = Math.max(0, Math.min(maxX, nextX))
    const clampedY = Math.max(0, Math.min(maxY, nextY))

    this.position = { x: clampedX, y: clampedY }
    this.updateHostPosition()
  }

  private handleHeaderPointerUp(e: PointerEvent) {
    if (!this.isHeaderDragging) return
    e.preventDefault()
    e.stopPropagation()

    const header = e.currentTarget as HTMLElement
    try {
      header.releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }
    this.isHeaderDragging = false

    if (this.position) {
      this.dispatchEvent(
        new CustomEvent<MinimapMoveEventDetail>('minimap-move', {
          detail: { x: this.position.x, y: this.position.y },
          bubbles: true,
          composed: true,
        }),
      )
    }
  }

  private get isResizable(): boolean {
    return this.option?.minimap?.resizable !== false
  }

  private get minMinimapWidth(): number {
    return this.option?.minimap?.minWidth ?? 120
  }

  private get maxMinimapWidth(): number {
    const parentW = (this.parentElement?.clientWidth && this.parentElement.clientWidth > 0)
      ? this.parentElement.clientWidth
      : (this.viewportWidth && this.viewportWidth > 0)
        ? this.viewportWidth
        : (typeof window !== 'undefined' && window.innerWidth > 0)
          ? window.innerWidth
          : 1200
    const calculatedMax = Math.max(this.minMinimapWidth, Math.round(parentW * 0.8))
    return this.option?.minimap?.maxWidth ?? Math.max(this.minMinimapWidth, Math.min(800, calculatedMax))
  }

  private get minMinimapHeight(): number {
    return this.option?.minimap?.minHeight ?? 60
  }

  private get baseMinimapWidth(): number {
    return this.customWidth ?? this.option?.minimap?.width ?? 200
  }

  private get baseMinimapHeight(): number {
    return this.customHeight ?? this.option?.minimap?.height ?? 120
  }

  private get maxMinimapHeight(): number {
    const parentH = (this.parentElement?.clientHeight && this.parentElement.clientHeight > 0)
      ? this.parentElement.clientHeight
      : (this.viewportHeight && this.viewportHeight > 0)
        ? this.viewportHeight
        : (typeof window !== 'undefined' && window.innerHeight > 0)
          ? window.innerHeight
          : 800
    const calculatedMax = Math.max(this.minMinimapHeight, Math.round(parentH * 0.8))
    return this.option?.minimap?.maxHeight ?? Math.max(this.minMinimapHeight, Math.min(600, calculatedMax))
  }

  private get preserveAspectRatio(): boolean {
    return this.option?.minimap?.preserveAspectRatio !== false
  }

  /**
   * アスペクト比維持（等倍スケーリング）時の共通スケール
   * baseMinimapWidth x baseMinimapHeight の最大バウンディングボックスに収まる最大の等倍縮尺
   */
  private get uniformScale(): number {
    const sX = this.baseMinimapWidth / this.effectiveContentWidth
    if (this.customHeight !== null) {
      const sY = this.customHeight / this.effectiveContentHeight
      return Math.min(sX, sY)
    }
    if (this.option?.minimap?.height !== undefined) {
      const sY = this.option.minimap.height / this.effectiveContentHeight
      return Math.min(sX, sY)
    }
    // option.minimap.height が未指定の場合は、幅基準（ただし maxHeight を超えない）
    const maxScaleY = this.maxMinimapHeight / this.effectiveContentHeight
    return Math.min(sX, maxScaleY)
  }

  private get scaleX(): number {
    if (this.preserveAspectRatio) {
      return this.uniformScale
    }
    return this.minimapWidth / this.effectiveContentWidth
  }

  private get scaleY(): number {
    if (this.preserveAspectRatio) {
      return this.uniformScale
    }
    return this.minimapHeight / this.effectiveContentHeight
  }

  private get minimapWidth(): number {
    if (!this.preserveAspectRatio) {
      return this.baseMinimapWidth
    }
    return Math.max(40, Math.round(this.effectiveContentWidth * this.uniformScale))
  }

  private get minimapHeight(): number {
    if (!this.preserveAspectRatio) {
      return this.baseMinimapHeight
    }
    return Math.max(20, Math.round(this.effectiveContentHeight * this.uniformScale))
  }

  private handleResizePointerDown(e: PointerEvent, handle: string) {
    e.preventDefault()
    e.stopPropagation()

    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)

    this.isResizing = true
    this.resizeHandleType = handle
    this.resizeStartPointerX = e.clientX
    this.resizeStartPointerY = e.clientY
    this.resizeStartWidth = this.minimapWidth
    this.resizeStartHeight = this.minimapHeight

    const hostRect = this.getBoundingClientRect()
    const parentRect = this.parentElement?.getBoundingClientRect() ?? this.offsetParent?.getBoundingClientRect()
    if (parentRect && (parentRect.width > 0 || parentRect.height > 0)) {
      const curX = hostRect.left - parentRect.left
      const curY = hostRect.top - parentRect.top
      this.position = { x: curX, y: curY }
    } else if (!this.position) {
      this.position = { x: hostRect.left, y: hostRect.top }
    }
    this.resizeStartOriginX = this.position?.x ?? 0
    this.resizeStartOriginY = this.position?.y ?? 0
  }

  private handleResizePointerMove(e: PointerEvent) {
    if (!this.isResizing) return
    e.preventDefault()
    e.stopPropagation()

    const dx = e.clientX - this.resizeStartPointerX
    const dy = e.clientY - this.resizeStartPointerY

    let deltaW = 0
    let deltaH = 0

    if (this.resizeHandleType.includes('e')) deltaW = dx
    if (this.resizeHandleType.includes('w')) deltaW = -dx
    if (this.resizeHandleType.includes('s')) deltaH = dy
    if (this.resizeHandleType.includes('n')) deltaH = -dy

    const minW = this.minMinimapWidth
    const maxW = this.maxMinimapWidth
    const minH = this.minMinimapHeight
    const maxH = this.maxMinimapHeight

    if (this.preserveAspectRatio) {
      const aspect = this.effectiveContentWidth / this.effectiveContentHeight
      const effectiveDelta = Math.abs(deltaW) >= Math.abs(deltaH) ? deltaW : deltaH * aspect
      const targetW = Math.max(minW, Math.min(maxW, Math.round(this.resizeStartWidth + effectiveDelta)))
      const targetH = Math.max(minH, Math.min(maxH, Math.round(targetW / aspect)))

      this.customWidth = targetW
      this.customHeight = targetH

      if (this.position) {
        let newX = this.resizeStartOriginX
        let newY = this.resizeStartOriginY

        if (this.resizeHandleType.includes('w')) {
          newX = this.resizeStartOriginX - (targetW - this.resizeStartWidth)
        }
        if (this.resizeHandleType.includes('n')) {
          newY = this.resizeStartOriginY - (targetH - this.resizeStartHeight)
        }

        this.position = { x: Math.max(0, newX), y: Math.max(0, newY) }
        this.updateHostPosition()
      }
    } else {
      if (deltaW !== 0) {
        const targetW = Math.max(minW, Math.min(maxW, Math.round(this.resizeStartWidth + deltaW)))
        this.customWidth = targetW
        if (this.position && this.resizeHandleType.includes('w')) {
          const newX = this.resizeStartOriginX - (targetW - this.resizeStartWidth)
          this.position = { ...this.position, x: Math.max(0, newX) }
        }
      }
      if (deltaH !== 0) {
        const targetH = Math.max(minH, Math.min(maxH, Math.round(this.resizeStartHeight + deltaH)))
        this.customHeight = targetH
        if (this.position && this.resizeHandleType.includes('n')) {
          const newY = this.resizeStartOriginY - (targetH - this.resizeStartHeight)
          this.position = { ...this.position, y: Math.max(0, newY) }
        }
      }
      if (this.position) {
        this.updateHostPosition()
      }
    }
  }

  private handleResizePointerUp(e: PointerEvent) {
    if (!this.isResizing) return
    e.preventDefault()
    e.stopPropagation()

    const target = e.currentTarget as HTMLElement
    try {
      target.releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }
    this.isResizing = false

    this.dispatchEvent(
      new CustomEvent<MinimapResizeEventDetail>('minimap-resize', {
        detail: {
          width: this.minimapWidth,
          height: this.minimapHeight,
          position: this.position ? { x: this.position.x, y: this.position.y } : undefined,
        },
        bubbles: true,
        composed: true,
      }),
    )

    if (this.position) {
      this.dispatchEvent(
        new CustomEvent<MinimapMoveEventDetail>('minimap-move', {
          detail: { x: this.position.x, y: this.position.y },
          bubbles: true,
          composed: true,
        }),
      )
    }
  }

  private get effectiveContentWidth(): number {
    return Math.max(this.contentWidth, this.viewportWidth, 1)
  }

  private get effectiveContentHeight(): number {
    return Math.max(this.contentHeight, this.viewportHeight, 1)
  }

  private renderCanvas() {
    const canvas = this.canvasEl
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = this.minimapWidth
    const height = this.minimapHeight
    const dpr = window.devicePixelRatio || 1

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr
      canvas.height = height * dpr
    }

    ctx.save()
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, height)

    const colors = getThemeColors(this.theme, this.option?.customTheme)
    const scaleX = this.scaleX
    const scaleY = this.scaleY

    // 全体背景描画
    ctx.fillStyle = colors.minimapBg ?? (this.theme === 'dark' ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)')
    ctx.fillRect(0, 0, width, height)

    const calHeightMini = this.calendarHeight * scaleY

    // カレンダーヘッダー領域の背景
    if (calHeightMini > 0) {
      ctx.fillStyle = colors.calendarBg ?? (this.theme === 'dark' ? '#0f172a' : '#e2e8f0')
      ctx.fillRect(0, 0, width, calHeightMini)
    }

    // 行グリッドラインおよびタスク描画
    const displayRows = this.option?.showHiddenRows
      ? this.rows
      : this.rows.filter((r) => r.visible !== false)

    const barHeight = this.option?.bar?.height ?? DEFAULT_BAR_HEIGHT
    const barMargin = this.option?.bar?.margin ?? DEFAULT_BAR_MARGIN

    let currentY = this.calendarHeight
    const startDate = this.option?.calendar?.start ?? new Date()
    const pxPerDay = this.option?.calendar?.pxPerDay ?? 30
    const pxPerMonth = this.option?.calendar?.pxPerMonth

    for (let i = 0; i < displayRows.length; i++) {
      const row = displayRows[i]
      const { tasksWithLanes, laneCount } = calculateTaskLanes(row.tasks || [])
      const rowHeight = laneCount * (barHeight + barMargin * 2)

      const rowTopMini = currentY * scaleY
      const rowHeightMini = Math.max(rowHeight * scaleY, 1)

      // 偶数行の薄いゼブラ背景（チャート領域）
      if (i % 2 === 1) {
        ctx.fillStyle = this.theme === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)'
        ctx.fillRect(0, rowTopMini, width, rowHeightMini)
      }

      // 行の区切り線
      ctx.strokeStyle = this.theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.moveTo(0, rowTopMini + rowHeightMini)
      ctx.lineTo(width, rowTopMini + rowHeightMini)
      ctx.stroke()

      // タスクの描画
      for (const task of tasksWithLanes) {
        const taskX = dateToX(task.start, startDate, pxPerDay, pxPerMonth)
        const taskEndX = dateToX(task.end, startDate, pxPerDay, pxPerMonth)
        const taskW = Math.max(taskEndX - taskX, 1)
        const taskY = currentY + task.lane * (barHeight + barMargin * 2) + barMargin

        const miniX = taskX * scaleX
        const miniY = taskY * scaleY
        const miniW = Math.max(taskW * scaleX, 1.5)
        const miniH = Math.max(barHeight * scaleY, 1.5)

        const taskColor = extractTaskColor(task.style, colors.minimapTask ?? '#3b82f6')
        ctx.fillStyle = taskColor

        // タスク矩形描画
        if (miniW > 3 && miniH > 3) {
          ctx.beginPath()
          if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(miniX, miniY, miniW, miniH, 1)
          } else {
            ctx.rect(miniX, miniY, miniW, miniH)
          }
          ctx.fill()
        } else {
          ctx.fillRect(miniX, miniY, miniW, miniH)
        }
      }

      currentY += rowHeight
    }

    // マイルストーンの描画
    if (this.option?.minimap?.showMilestones !== false && this.option?.calendar?.milestones) {
      for (const ms of this.option.calendar.milestones) {
        const msX = dateToX(ms.start, startDate, pxPerDay, pxPerMonth) * scaleX
        ctx.strokeStyle = ms.color || '#8b5cf6'
        ctx.lineWidth = 1
        ctx.setLineDash([2, 2])
        ctx.beginPath()
        ctx.moveTo(msX, calHeightMini)
        ctx.lineTo(msX, height)
        ctx.stroke()
        ctx.setLineDash([])
      }
    }

    // 現在時刻線の描画
    if (
      this.option?.minimap?.showCurrentTime !== false &&
      this.option?.calendar?.showCurrentTime
    ) {
      const now = this.currentTime || new Date()
      const nowX = dateToX(now, startDate, pxPerDay, pxPerMonth) * scaleX
      if (nowX >= 0 && nowX <= width) {
        ctx.strokeStyle = colors.currentTimeLine || 'rgba(239, 68, 68, 0.7)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(nowX, calHeightMini)
        ctx.lineTo(nowX, height)
        ctx.stroke()
      }
    }

    ctx.restore()
  }

  private handleBodyPointerDown(e: PointerEvent) {
    // ビューポートファインダー以外のミニマップ領域をクリックした場合、その位置へジャンプ
    const target = e.target as HTMLElement
    if (target.classList.contains('minimap-viewport')) return

    const rect = this.canvasEl?.getBoundingClientRect()
    if (!rect) return

    const clickX = e.clientX - rect.left
    const clickY = e.clientY - rect.top

    const scaleX = this.scaleX
    const scaleY = this.scaleY

    // クリック位置がビューポートの中心になるように計算
    const targetScrollLeft = clickX / scaleX - this.viewportWidth / 2
    const targetScrollTop = clickY / scaleY - this.viewportHeight / 2

    const maxScrollLeft = Math.max(0, this.contentWidth - this.viewportWidth)
    const maxScrollTop = Math.max(0, this.contentHeight - this.viewportHeight)

    const newScrollLeft = Math.max(0, Math.min(maxScrollLeft, targetScrollLeft))
    const newScrollTop = Math.max(0, Math.min(maxScrollTop, targetScrollTop))

    this.dispatchScroll(newScrollLeft, newScrollTop)
  }

  private handleViewportPointerDown(e: PointerEvent) {
    e.stopPropagation()
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)

    this.isDragging = true
    this.dragStartX = e.clientX
    this.dragStartY = e.clientY
    this.dragStartScrollLeft = this.scrollLeft
    this.dragStartScrollTop = this.scrollTop
  }

  private handleViewportPointerMove(e: PointerEvent) {
    if (!this.isDragging) return
    e.stopPropagation()

    const dx = e.clientX - this.dragStartX
    const dy = e.clientY - this.dragStartY

    const scaleX = this.scaleX
    const scaleY = this.scaleY

    const deltaScrollLeft = dx / scaleX
    const deltaScrollTop = dy / scaleY

    const maxScrollLeft = Math.max(0, this.contentWidth - this.viewportWidth)
    const maxScrollTop = Math.max(0, this.contentHeight - this.viewportHeight)

    const newScrollLeft = Math.max(0, Math.min(maxScrollLeft, this.dragStartScrollLeft + deltaScrollLeft))
    const newScrollTop = Math.max(0, Math.min(maxScrollTop, this.dragStartScrollTop + deltaScrollTop))

    this.dispatchScroll(newScrollLeft, newScrollTop)
  }

  private handleViewportPointerUp(e: PointerEvent) {
    if (!this.isDragging) return
    e.stopPropagation()
    const target = e.currentTarget as HTMLElement
    try {
      target.releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }
    this.isDragging = false
  }

  private dispatchScroll(scrollLeft: number, scrollTop: number) {
    this.dispatchEvent(
      new CustomEvent<MinimapScrollEventDetail>('minimap-scroll', {
        detail: { scrollLeft, scrollTop },
        bubbles: true,
        composed: true,
      }),
    )
  }

  private toggleCollapse(e: MouseEvent) {
    e.stopPropagation()
    this.isCollapsed = !this.isCollapsed
  }

  override render() {
    const collapsible = this.option?.minimap?.collapsible !== false
    const colors = getThemeColors(this.theme, this.option?.customTheme)

    const dynamicStyle = `
      --minimap-bg: ${colors.minimapBg};
      --minimap-border: ${colors.minimapBorder};
      --minimap-text: ${colors.text};
      --minimap-viewport: ${colors.minimapViewport};
      --minimap-viewport-border: ${colors.minimapViewportBorder};
    `

    if (this.isCollapsed) {
      return html`
        <div style="${dynamicStyle}">
          <button
            class="minimap-collapsed-btn"
            title="ミニマップを展開"
            aria-label="ミニマップを展開"
            @click="${this.toggleCollapse}"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"></polygon>
              <line x1="9" y1="3" x2="9" y2="18"></line>
              <line x1="15" y1="6" x2="15" y2="21"></line>
            </svg>
          </button>
        </div>
      `
    }

    const scaleX = this.scaleX
    const scaleY = this.scaleY

    const vpLeft = Math.max(0, this.scrollLeft * scaleX)
    const vpTop = Math.max(0, this.scrollTop * scaleY)
    const vpWidth = Math.min(this.minimapWidth - vpLeft, Math.max(12, this.viewportWidth * scaleX))
    const vpHeight = Math.min(this.minimapHeight - vpTop, Math.max(8, this.viewportHeight * scaleY))

    return html`
      <div class="minimap-container ${this.isResizing ? 'resizing' : ''}" style="${dynamicStyle}; width: ${this.minimapWidth}px;">
        ${this.isResizable
          ? html`
              <div
                class="minimap-resize-handle nw"
                @pointerdown="${(e: PointerEvent) => this.handleResizePointerDown(e, 'nw')}"
                @pointermove="${this.handleResizePointerMove}"
                @pointerup="${this.handleResizePointerUp}"
                @pointercancel="${this.handleResizePointerUp}"
              ></div>
              <div
                class="minimap-resize-handle ne"
                @pointerdown="${(e: PointerEvent) => this.handleResizePointerDown(e, 'ne')}"
                @pointermove="${this.handleResizePointerMove}"
                @pointerup="${this.handleResizePointerUp}"
                @pointercancel="${this.handleResizePointerUp}"
              ></div>
              <div
                class="minimap-resize-handle sw"
                @pointerdown="${(e: PointerEvent) => this.handleResizePointerDown(e, 'sw')}"
                @pointermove="${this.handleResizePointerMove}"
                @pointerup="${this.handleResizePointerUp}"
                @pointercancel="${this.handleResizePointerUp}"
              ></div>
              <div
                class="minimap-resize-handle se"
                @pointerdown="${(e: PointerEvent) => this.handleResizePointerDown(e, 'se')}"
                @pointermove="${this.handleResizePointerMove}"
                @pointerup="${this.handleResizePointerUp}"
                @pointercancel="${this.handleResizePointerUp}"
              ></div>
              <div
                class="minimap-resize-handle w"
                @pointerdown="${(e: PointerEvent) => this.handleResizePointerDown(e, 'w')}"
                @pointermove="${this.handleResizePointerMove}"
                @pointerup="${this.handleResizePointerUp}"
                @pointercancel="${this.handleResizePointerUp}"
              ></div>
              <div
                class="minimap-resize-handle e"
                @pointerdown="${(e: PointerEvent) => this.handleResizePointerDown(e, 'e')}"
                @pointermove="${this.handleResizePointerMove}"
                @pointerup="${this.handleResizePointerUp}"
                @pointercancel="${this.handleResizePointerUp}"
              ></div>
              <div
                class="minimap-resize-handle n"
                @pointerdown="${(e: PointerEvent) => this.handleResizePointerDown(e, 'n')}"
                @pointermove="${this.handleResizePointerMove}"
                @pointerup="${this.handleResizePointerUp}"
                @pointercancel="${this.handleResizePointerUp}"
              ></div>
              <div
                class="minimap-resize-handle s"
                @pointerdown="${(e: PointerEvent) => this.handleResizePointerDown(e, 's')}"
                @pointermove="${this.handleResizePointerMove}"
                @pointerup="${this.handleResizePointerUp}"
                @pointercancel="${this.handleResizePointerUp}"
              ></div>
              <div class="minimap-resize-indicator"></div>
            `
          : ''}
        <div class="minimap-inner-wrapper">
          <div
            class="minimap-header ${this.isHeaderDragging ? 'dragging' : ''}"
            @pointerdown="${this.handleHeaderPointerDown}"
            @pointermove="${this.handleHeaderPointerMove}"
            @pointerup="${this.handleHeaderPointerUp}"
            @pointercancel="${this.handleHeaderPointerUp}"
          >
            <div class="minimap-title">
              <span class="minimap-drag-icon">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="8" cy="6" r="2.5"></circle>
                  <circle cx="16" cy="6" r="2.5"></circle>
                  <circle cx="8" cy="12" r="2.5"></circle>
                  <circle cx="16" cy="12" r="2.5"></circle>
                  <circle cx="8" cy="18" r="2.5"></circle>
                  <circle cx="16" cy="18" r="2.5"></circle>
                </svg>
              </span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"></polygon>
                <line x1="9" y1="3" x2="9" y2="18"></line>
                <line x1="15" y1="6" x2="15" y2="21"></line>
              </svg>
              <span>Overview</span>
            </div>
            ${collapsible
              ? html`
                  <button
                    class="minimap-toggle-btn"
                    title="ミニマップを折りたたむ"
                    aria-label="ミニマップを折りたたむ"
                    @click="${this.toggleCollapse}"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                `
              : ''}
          </div>
          <div
            class="minimap-body"
            style="width: ${this.minimapWidth}px; height: ${this.minimapHeight}px;"
            @pointerdown="${this.handleBodyPointerDown}"
          >
            <canvas
              style="width: ${this.minimapWidth}px; height: ${this.minimapHeight}px;"
            ></canvas>
            <div
              class="minimap-viewport ${this.isDragging ? 'dragging' : ''}"
              style="left: ${vpLeft}px; top: ${vpTop}px; width: ${vpWidth}px; height: ${vpHeight}px;"
              @pointerdown="${this.handleViewportPointerDown}"
              @pointermove="${this.handleViewportPointerMove}"
              @pointerup="${this.handleViewportPointerUp}"
              @pointercancel="${this.handleViewportPointerUp}"
            ></div>
          </div>
        </div>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gantt-minimap': GanttMinimapElement
  }
}

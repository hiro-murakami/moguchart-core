import { LitElement, html, css, type PropertyValues } from 'lit'
import { customElement, property, state, query } from 'lit/decorators.js'
import type { GanttChartOption, GanttRow } from '../core/types'
import { calculateTaskLanes, dateToX, getThemeColors } from '../core/utils'
import { DEFAULT_BAR_HEIGHT, DEFAULT_BAR_MARGIN } from '../core/constants'

/**
 * ミニマップスクロールイベントの詳細データ
 */
export interface MinimapScrollEventDetail {
  scrollLeft: number
  scrollTop: number
}

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
      overflow: hidden;
      transition: width 0.2s cubic-bezier(0.4, 0, 0.2, 1),
                  height 0.2s cubic-bezier(0.4, 0, 0.2, 1),
                  opacity 0.2s ease,
                  box-shadow 0.2s ease;
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
  }

  override updated(changedProperties: PropertyValues) {
    super.updated(changedProperties)
    this.updateHostPosition()
    if (!this.isCollapsed) {
      this.renderCanvas()
    }
  }

  private updateHostPosition() {
    if (this.position) {
      this.style.left = `${this.position.x}px`
      this.style.top = `${this.position.y}px`
      this.style.right = 'auto'
      this.style.bottom = 'auto'
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

    if (parentRect) {
      const curX = hostRect.left - parentRect.left
      const curY = hostRect.top - parentRect.top
      this.position = { x: curX, y: curY }
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
    const parentWidth = parentRect?.width ?? this.viewportWidth ?? window.innerWidth
    const parentHeight = parentRect?.height ?? this.viewportHeight ?? window.innerHeight

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
  }

  private get minimapWidth(): number {
    return this.option?.minimap?.width ?? 200
  }

  private get minimapHeight(): number {
    return this.option?.minimap?.height ?? 120
  }

  private get effectiveContentWidth(): number {
    return Math.max(this.contentWidth, 1)
  }

  private get effectiveContentHeight(): number {
    return Math.max(this.contentHeight, 1)
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
    const scaleX = width / this.effectiveContentWidth
    const scaleY = height / this.effectiveContentHeight

    // 全体背景描画
    ctx.fillStyle = colors.minimapBg ?? (this.theme === 'dark' ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)')
    ctx.fillRect(0, 0, width, height)

    const labelWidthMini = this.rowHeaderWidth * scaleX
    const calHeightMini = this.calendarHeight * scaleY

    // カレンダーヘッダー領域の背景
    if (calHeightMini > 0) {
      ctx.fillStyle = colors.calendarBg ?? (this.theme === 'dark' ? '#0f172a' : '#e2e8f0')
      ctx.fillRect(0, 0, width, calHeightMini)
    }

    // 行ヘッダー領域の背景
    if (labelWidthMini > 0) {
      ctx.fillStyle = colors.rowHeaderBg ?? (this.theme === 'dark' ? '#0f172a' : '#e2e8f0')
      ctx.fillRect(0, 0, labelWidthMini, height)

      // 行ヘッダー境界線
      ctx.strokeStyle = colors.border ?? (this.theme === 'dark' ? '#263040' : '#cbd5e1')
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(labelWidthMini, 0)
      ctx.lineTo(labelWidthMini, height)
      ctx.stroke()
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
        ctx.fillRect(labelWidthMini, rowTopMini, width - labelWidthMini, rowHeightMini)
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
        const taskX = this.rowHeaderWidth + dateToX(task.start, startDate, pxPerDay, pxPerMonth)
        const taskEndX = this.rowHeaderWidth + dateToX(task.end, startDate, pxPerDay, pxPerMonth)
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
        const msX = (this.rowHeaderWidth + dateToX(ms.start, startDate, pxPerDay, pxPerMonth)) * scaleX
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
      const nowX = (this.rowHeaderWidth + dateToX(now, startDate, pxPerDay, pxPerMonth)) * scaleX
      if (nowX >= labelWidthMini && nowX <= width) {
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

    const scaleX = this.minimapWidth / this.effectiveContentWidth
    const scaleY = this.minimapHeight / this.effectiveContentHeight

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

    const scaleX = this.minimapWidth / this.effectiveContentWidth
    const scaleY = this.minimapHeight / this.effectiveContentHeight

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

    const scaleX = this.minimapWidth / this.effectiveContentWidth
    const scaleY = this.minimapHeight / this.effectiveContentHeight

    const vpLeft = Math.max(0, this.scrollLeft * scaleX)
    const vpTop = Math.max(0, this.scrollTop * scaleY)
    const vpWidth = Math.min(this.minimapWidth - vpLeft, Math.max(12, this.viewportWidth * scaleX))
    const vpHeight = Math.min(this.minimapHeight - vpTop, Math.max(8, this.viewportHeight * scaleY))

    return html`
      <div class="minimap-container" style="${dynamicStyle}; width: ${this.minimapWidth}px;">
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
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gantt-minimap': GanttMinimapElement
  }
}

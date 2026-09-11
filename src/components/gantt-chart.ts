import { DEFAULT_BAR_HEIGHT, DEFAULT_BAR_MARGIN, DEFAULT_ROW_HEADER_WIDTH } from '../core/constants'
import { jaLocale } from '../core/i18n'
import type {
  BarHoverEventDetail,
  BarSelectionChangeEventDetail,
  DependencyClickEventDetail,
  DependencyCreateEventDetail,
  DependencyEndpoint,
  DependencyLineStyle,
  GanttChartOption,
  GanttRow,
  GanttTask,
  GanttTaskMoveMode,
  RowHeaderResizeEventDetail,
  RowReorderEventDetail,
  RowSelectionChangeEventDetail,
  RowToggleCollapseEventDetail,
  TaskDeleteEventDetail,
  TaskUpdateEventDetail,
  ZoomChangeEventDetail,
} from '../core/types'
import { calculateTaskLanes, getThemeColors, formatDuration, dateToX, xToDate } from '../core/utils'
import { LitElement, html, render, svg, type PropertyValues } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { repeat } from 'lit/directives/repeat.js'

import { throttle } from 'lodash-es'
import './gantt-calendar'
import './gantt-row'
import './gantt-minimap'
import type { MinimapScrollEventDetail } from './gantt-minimap'
import type { GanttRowElement } from './gantt-row'
import { buildOrthogonalPath } from './gantt-chart-dependency-path'
import { ganttChartStyles, buildDynamicStyles } from './gantt-chart-styles'
import { exportGanttWithHtml2Canvas, type ExportImageOptions } from './gantt-chart-export'
import { computeCriticalPath } from '../core/critical-path'
import {
  computeRowLevels,
  computeRowWbsCodes,
  computeChildRowIds,
  computeVisibleTreeRows,
  computeSummaryTask,
  canDropRow,
} from '../core/wbs'


@customElement('gantt-chart')
export class GanttChartElement extends LitElement {
  @property({ type: Array }) rows: GanttRow[] = []
  @property({ type: Object }) option!: GanttChartOption
  @property({ type: String, reflect: true })
  theme: 'light' | 'dark' = 'light'

  @property({ type: Array })
  selectedRowIds: string[] = []
  @property({ type: Array })
  selectedTaskIds: string[] = []
  @property({ attribute: false })
  externalDraggingTask: GanttTask | null = null

  @state() private selectedRows = new Set<string>()
  @state() private selectedTasks = new Set<string>()
  @state() private lastClickedRowId: string | null = null
  @state() private virtualScrollTop = 0
  @state() private currentScrollLeft = 0
  @state() private currentScrollTop = 0
  @state() private viewportWidth = 800
  @state() private dragTargetRowIndex: number | null = null
  @state() private draggingTask: {
    id: string
    name?: string
    start: Date
    end: Date
    currentStart: Date
    currentEnd: Date
    mode?: GanttTaskMoveMode
  } | null = null
  @state() private draggingTaskIds: string[] = []
  @state() private multiDragDx = 0
  @state() private multiDragDy = 0
  @state() private multiDragSameRow = false
  @state() private viewportHeight = 400
  private dragOverlayInfo: {
    id: string
    name?: string
    start: Date
    end: Date
    currentStart: Date
    currentEnd: Date
    targetRow?: GanttRow
    visible: boolean
    clientX?: number
    clientY?: number
    barX?: number
    barTop?: number
    barBottom?: number
  } | null = null
  @state() private calendarHeight = 0
  @state() private tooltip: {
    task: GanttTask
    x: number
    y: number
    barBottom: number
    visible: boolean
    below: boolean
  } | null = null
  @state() private dragOverRowId: string | null = null
  @state() private dragOverPosition: 'top' | 'bottom' | null = null
  private hoverTimer: number | undefined
  @state() private currentTime = new Date()
  @state() private dragPreview: {
    task: GanttTask
    currentStart: Date
    currentEnd: Date
    rowId: string
  } | null = null
  @state() private currentRowHeaderWidth = DEFAULT_ROW_HEADER_WIDTH
  @state() private isResizingHeader = false
  @state() private hoveredMilestoneId: string | null = null
  @state() private cursorLineX: number | null = null
  @state() private connectorDrag: {
    sourceTaskId: string
    sourceEndpoint: DependencyEndpoint
    /** バーローカル座標系での起点X */
    startX: number
    /** バーローカル座標系での起点Y */
    startY: number
    /** 現在のマウスclientX */
    currentClientX: number
    /** 現在のマウスclientY */
    currentClientY: number
    /** ドロップターゲットのタスクID（ホバー中） */
    targetTaskId: string | null
    /** ドロップターゲット側のエンドポイント */
    targetEndpoint: DependencyEndpoint | null
  } | null = null
  private _systemThemeMediaQuery: MediaQueryList | null = null
  @state() private isExporting = false
  @state() private focusedTaskId: string | null = null
  @state() private focusedRowId: string | null = null
  @state() private zoomPxPerDay: number | null = null
  @state() private zoomPxPerMonth: number | null = null
  @state() private marqueeSelection: {
    startX: number
    startY: number
    currentX: number
    currentY: number
    active: boolean
  } | null = null

  private _marqueeDragStart: {
    clientX: number
    clientY: number
    contentStartX: number
    contentStartY: number
    initialSelectedTasks: Set<string>
    isMultiModifier: boolean
  } | null = null
  private _isMarqueeActive = false
  private _justFinishedMarquee = false
  private _marqueeAutoScrollInterval: number | null = null

  private _layoutCache: {
    layouts: any[]
    taskCoords: any
    totalHeight: number
  } | null = null
  private resizeObserver: ResizeObserver | null = null
  private _cachedSelectedTaskIds: string[] = []
  private _cachedSelectedTasksSize = -1
  private _cachedCurrentOption: GanttChartOption | null = null
  private _lastOptionRef: GanttChartOption | null = null
  private _lastLabelWidth: number = -1
  private _lastZoomPxPerDay: number | null = null
  private _lastZoomPxPerMonth: number | null = null
  private _scrollContainer: HTMLElement | null = null
  private _collapsedRowIds = new Set<string>()
  private _prevExternalCollapsed = new Map<string, boolean | undefined>()
  private _draggingRowId: string | null = null

  private get displayRows() {
    const treeEnabled = this.option?.tree?.enabled !== false
    const baseRows = treeEnabled
      ? computeVisibleTreeRows(this.rows, this.option?.showHiddenRows ?? false)
      : (this.option?.showHiddenRows
          ? this.rows
          : this.rows.filter((row) => row.visible !== false))

    const autoSummary = this.option?.tree?.autoSummary !== false
    if (!treeEnabled || !autoSummary) {
      return baseRows
    }

    // 子を持つ行を特定
    const rowsWithChildren = new Set<string>()
    for (const r of this.rows) {
      if (r.parentId) rowsWithChildren.add(r.parentId)
    }

    return baseRows.map((row) => {
      const isParent = rowsWithChildren.has(row.id)
      const needsSummary = row.isSummary || isParent
      if (needsSummary && isParent) {
        const childIds = computeChildRowIds(this.rows, row.id, true)
        const childRows = this.rows.filter((r) => childIds.includes(r.id))
        const allChildTasks = childRows.flatMap((r) => r.tasks)
        if (allChildTasks.length > 0) {
          const effectiveColor = row.summaryColor || this.option?.tree?.summaryColor
          const summaryTask = computeSummaryTask(allChildTasks, {
            id: `${row.id}-summary`,
            name: row.name,
            style: effectiveColor ? `background-color: ${effectiveColor};` : undefined,
          })
          if (summaryTask) {
            const normalTasks = (row.tasks || []).filter(
              (t) => t.id !== summaryTask.id && t.type !== 'summary',
            )
            return {
              ...row,
              tasks: [summaryTask, ...normalTasks],
            }
          }
        }
      }
      return row
    })
  }

  /**
   * 現在有効な pxPerDay（ズームオーバーライドがあればそちらを優先）
   */
  private get effectivePxPerDay(): number {
    return this.zoomPxPerDay ?? this.option.calendar.pxPerDay ?? 50
  }

  /**
   * 現在有効な pxPerMonth（ズームオーバーライドがあればそちらを優先）
   */
  private get effectivePxPerMonth(): number | undefined {
    return this.zoomPxPerMonth ?? this.option.calendar.pxPerMonth
  }

  static styles = ganttChartStyles

  protected firstUpdated() {
    this.setupCurrentTimeTimer()

    const calendar = this.shadowRoot?.getElementById('calendar')
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === this) {
          this.viewportHeight = entry.contentRect.height
          this.viewportWidth = entry.contentRect.width
        } else if (entry.target === calendar) {
          this.calendarHeight = (entry.target as HTMLElement).offsetHeight
        }
      }
    })
    this.resizeObserver.observe(this)
    if (calendar) {
      this.resizeObserver.observe(calendar)
    }

    // wheel イベントは scroll-container に直接登録する
    // ホスト要素に登録するとブラウザのネイティブスクロールが先に処理されてしまう
    this._scrollContainer = this.shadowRoot?.querySelector('.scroll-container') as HTMLElement | null
    if (this._scrollContainer) {
      this.currentScrollLeft = this._scrollContainer.scrollLeft
      this.currentScrollTop = this._scrollContainer.scrollTop
    }
    this._scrollContainer?.addEventListener('wheel', this.handleWheel, { passive: false })
  }

  connectedCallback(): void {
    super.connectedCallback()
    this._systemThemeMediaQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null
    this._systemThemeMediaQuery?.addEventListener('change', this.handleSystemThemeChange)
    // キーボードフォーカスを受け取れるようにする
    if (!this.hasAttribute('tabindex')) {
      this.setAttribute('tabindex', '0')
    }
    this.setAttribute('role', 'grid')
    this.setAttribute('aria-label', 'Gantt Chart')
    this.addEventListener('keydown', this.handleKeyDown)
    // 初期テーマ設定
    if (this.option?.theme === 'system' || (this.option?.theme !== 'light' && this.option?.theme !== 'dark')) {
      this.theme = this._systemThemeMediaQuery?.matches ? 'dark' : 'light'
    } else {
      this.theme = this.option.theme
    }
    window.addEventListener('dragend', this._handleGlobalDragEnd)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    window.removeEventListener('dragend', this._handleGlobalDragEnd)
    this.resizeObserver?.disconnect()
    this.stopCurrentTimeTimer()
    this.stopMarqueeAutoScroll()
    window.removeEventListener('pointermove', this.handleMarqueePointerMove)
    window.removeEventListener('pointerup', this.handleMarqueePointerUp)
    window.removeEventListener('pointercancel', this.handleMarqueePointerUp)
    this._systemThemeMediaQuery?.removeEventListener('change', this.handleSystemThemeChange)
    this.removeEventListener('keydown', this.handleKeyDown)
    this._scrollContainer?.removeEventListener('wheel', this.handleWheel)
    this._scrollContainer = null
  }

  private _handleGlobalDragEnd = () => {
    this._draggingRowId = null
    const container = this.shadowRoot?.querySelector('.scroll-container') as HTMLElement
    if (container) {
      container.classList.remove('drag-active-valid', 'drag-active-invalid')
    }
  }

  private handleSystemThemeChange = (e: MediaQueryListEvent) => {
    if (this.option?.theme === 'system' || (this.option?.theme !== 'light' && this.option?.theme !== 'dark')) {
      this.theme = e.matches ? 'dark' : 'light'
    }
  }

  protected willUpdate(changedProperties: PropertyValues): void {
    if (changedProperties.has('option')) {
      if (this.option?.theme === 'light' || this.option?.theme === 'dark') {
        this.theme = this.option.theme
      } else if (this._systemThemeMediaQuery) {
        // 'system' or undefined
        this.theme = this._systemThemeMediaQuery.matches ? 'dark' : 'light'
      }
    }
    if (changedProperties.has('option')) {
      this.setupCurrentTimeTimer()
      if (!this.isResizingHeader) {
        this.currentRowHeaderWidth = this.option.rowHeader?.width ?? DEFAULT_ROW_HEADER_WIDTH
      }
      // 利用側が option を直接変更した場合、ズームオーバーライドをリセット
      this.zoomPxPerDay = null
      this.zoomPxPerMonth = null
      if (this.option?.fontScale !== undefined) {
        this.style.setProperty('--moguchart-font-scale', String(this.option.fontScale))
      } else {
        this.style.removeProperty('--moguchart-font-scale')
      }
    }
    if (
      changedProperties.has('rows') ||
      changedProperties.has('option') ||
      changedProperties.has('currentRowHeaderWidth') ||
      changedProperties.has('zoomPxPerDay') ||
      changedProperties.has('zoomPxPerMonth')
    ) {
      this._layoutCache = null
    }

    if (changedProperties.has('rows')) {
      const currentRowIds = new Set(this.rows.map((r) => r.id))
      for (const id of this._collapsedRowIds) {
        if (!currentRowIds.has(id)) {
          this._collapsedRowIds.delete(id)
          this._prevExternalCollapsed.delete(id)
        }
      }

      let hasCollapsedChanges = false
      const updatedRows = this.rows.map((row) => {
        const prevExternal = this._prevExternalCollapsed.get(row.id)
        const currentExternal = row.collapsed

        if (currentExternal !== prevExternal) {
          // 外部が明示的に変更した（初回、または外部から値が変わった場合）
          this._prevExternalCollapsed.set(row.id, currentExternal)
          if (currentExternal === true) {
            this._collapsedRowIds.add(row.id)
          } else if (currentExternal === false) {
            this._collapsedRowIds.delete(row.id)
          }
        }

        const isCollapsed = this._collapsedRowIds.has(row.id)
        if (Boolean(row.collapsed) !== isCollapsed) {
          hasCollapsedChanges = true
          return { ...row, collapsed: isCollapsed }
        }
        return row
      })

      if (hasCollapsedChanges) {
        this.rows = updatedRows
      }
    }

    if (changedProperties.has('selectedRowIds')) {
      const newSelectedIds = new Set(this.selectedRowIds)
      if (
        newSelectedIds.size !== this.selectedRows.size ||
        ![...newSelectedIds].every((id) => this.selectedRows.has(id))
      ) {
        this.selectedRows = newSelectedIds
      }
    }

    if (changedProperties.has('selectedTaskIds')) {
      const newSelectedIds = new Set(this.selectedTaskIds)
      if (
        newSelectedIds.size !== this.selectedTasks.size ||
        ![...newSelectedIds].every((id) => this.selectedTasks.has(id))
      ) {
        this.selectedTasks = newSelectedIds
      }
    }

    // selectedTasksが変化した時だけ配列を再生成する（参照が毎回変わると全行が再レンダリングされるため）
    if (changedProperties.has('selectedTasks') || this._cachedSelectedTasksSize !== this.selectedTasks.size) {
      this._cachedSelectedTaskIds = [...this.selectedTasks]
      this._cachedSelectedTasksSize = this.selectedTasks.size
    }
  }

  protected updated(changedProperties: PropertyValues): void {
    super.updated(changedProperties)

    if (this.tooltip) {
      const tooltipEl = this.shadowRoot?.querySelector('.tooltip') as HTMLElement
      if (tooltipEl) {
        const content = this.option.customRendering?.tooltip
          ? this.option.customRendering.tooltip(this.tooltip.task)
          : undefined

        if (content) {
          if (typeof content === 'string') {
            // 文字列コンテンツは textContent で安全に挿入（XSS防止）
            tooltipEl.textContent = content
          } else {
            render(content, tooltipEl)
          }
        } else {
          const locale = this.option.locale ?? jaLocale
          const isMonthlyMode = !!this.option.calendar.pxPerMonth
          const duration = Math.round(
            (this.tooltip.task.end.getTime() - this.tooltip.task.start.getTime()) / (1000 * 60 * 60 * 24),
          )
          const hasProgress = typeof this.tooltip.task.progress === 'number' && !Number.isNaN(this.tooltip.task.progress)
          const progressRow = hasProgress
            ? html`<div class="tooltip-row">
                ${locale.tooltip.progress
                  ? locale.tooltip.progress(Math.round(this.tooltip.task.progress!))
                  : `進捗: ${Math.round(this.tooltip.task.progress!)}%`}
              </div>`
            : ''

          if (isMonthlyMode) {
            const endForDisplay = new Date(this.tooltip.task.end)
            endForDisplay.setMonth(endForDisplay.getMonth() - 1)
            render(
              html`
                <div style="font-weight: bold;">${this.tooltip.task.name}</div>
                <div class="tooltip-row">
                  ${locale.yearMonthFormat(this.tooltip.task.start)} - ${locale.yearMonthFormat(endForDisplay)}
                </div>
                <div class="tooltip-row">${locale.tooltip.duration(duration)}</div>
                ${progressRow}
              `,
              tooltipEl,
            )
          } else {
            render(
              html`
                <div style="font-weight: bold;">${this.tooltip.task.name}</div>
                <div class="tooltip-row">
                  ${locale.dateFormat(this.tooltip.task.start)} - ${locale.dateFormat(this.tooltip.task.end)}
                </div>
                <div class="tooltip-row">${locale.tooltip.duration(duration)}</div>
                ${progressRow}
              `,
              tooltipEl,
            )
          }
        }

        // ツールチップが画面外にはみ出す場合に位置を調整する
        const margin = 6
        const elRect = tooltipEl.getBoundingClientRect()

        // 上端はみ出し: バーの下に表示するようリアクティブ状態を切り替え
        // 一度 below にしたら同一ツールチップ表示中は維持する（振動防止）
        if (!this.tooltip.below && elRect.top < margin) {
          this.tooltip = { ...this.tooltip, below: true }
          return // テンプレート再描画で正しい位置に配置される
        }

        // CSS の transform: translate(-50%, ...) が適用されているため、
        // 実際の描画位置は left - width/2 で算出される。
        let adjustedLeft = this.tooltip.x

        // 右端はみ出し: 描画右端が画面幅を超える場合
        if (elRect.right > window.innerWidth - margin) {
          adjustedLeft = window.innerWidth - margin - elRect.width / 2
        }
        // 左端はみ出し: 描画左端が0を下回る場合
        if (elRect.left < margin) {
          adjustedLeft = margin + elRect.width / 2
        }

        if (adjustedLeft !== this.tooltip.x) {
          tooltipEl.style.left = `${adjustedLeft}px`
        }
      }
    }
  }

  /**
   * ドラッグオーバーレイを直接DOM操作で更新する。
   * @state() を使わないことで、Litの再レンダリングサイクルを回避する。
   */
  private updateDragOverlay() {
    if (!this.dragOverlayInfo || this.option.showDragInfoOverlay === false) return
    const colors = getThemeColors(this.theme, this.option.customTheme)
    const dragInfoEl = this.shadowRoot?.querySelector('.drag-info-overlay') as HTMLElement
    if (!dragInfoEl) return

    dragInfoEl.classList.toggle('visible', this.dragOverlayInfo.visible)
    // Lit render() でコンテンツを安全に描画（innerHTML を使わない）
    const { targetRow } = this.dragOverlayInfo
    const content = this.option.customRendering?.dragInfo
      ? this.option.customRendering.dragInfo(
        {
          id: this.dragOverlayInfo.id,
          name: this.dragOverlayInfo.name,
          start: this.dragOverlayInfo.start,
          end: this.dragOverlayInfo.end,
        } as GanttTask,
        this.dragOverlayInfo.currentStart,
        this.dragOverlayInfo.currentEnd,
        targetRow,
      )
      : undefined

    if (content) {
      render(content, dragInfoEl)
    } else {
      const locale = this.option.locale ?? jaLocale
      const isMonthlyMode = !!this.option.calendar.pxPerMonth
      let startLabel: string
      let endLabel: string
      if (isMonthlyMode) {
        const endForDisplay = new Date(this.dragOverlayInfo.currentEnd)
        endForDisplay.setMonth(endForDisplay.getMonth() - 1)
        startLabel = locale.yearMonthFormat(this.dragOverlayInfo.currentStart)
        endLabel = locale.yearMonthFormat(endForDisplay)
      } else {
        startLabel = locale.dateTimeFormat(this.dragOverlayInfo.currentStart)
        endLabel = locale.dateTimeFormat(this.dragOverlayInfo.currentEnd)
      }
      render(
        html`
          <div style="font-weight: bold;">
            ${this.dragOverlayInfo.name || locale.dragOverlay.noTitle}
          </div>
          <div class="drag-info-sub">
            ${startLabel} -
            ${endLabel}
            (${formatDuration(this.dragOverlayInfo.currentStart, this.dragOverlayInfo.currentEnd, this.option.locale)})
          </div>
          ${targetRow
            ? html`<div class="drag-info-sub" style="margin-top: 4px; border-top: 1px solid ${colors.dragOverlayDivider}; padding-top: 4px; width: 100%;">${(this.option.locale ?? jaLocale).dragOverlay.moveTo(targetRow.name)}</div>`
            : ''}
        `,
        dragInfoEl,
      )
    }

    // --- タスクバーに追従するポジショニング ---
    if (this.dragOverlayInfo.barTop !== undefined || this.dragOverlayInfo.clientY !== undefined) {
      const mouseX = this.dragOverlayInfo.clientX ?? 0
      const mouseY = this.dragOverlayInfo.clientY ?? 0
      const hostRect = this.getBoundingClientRect()

      // マウスがガントチャートの外にある場合はオーバーレイを非表示
      if (
        this.dragOverlayInfo.clientY !== undefined &&
        (mouseX < hostRect.left || mouseX > hostRect.right ||
        mouseY < hostRect.top || mouseY > hostRect.bottom)
      ) {
        dragInfoEl.classList.remove('visible')
        return
      }

      const overlayWidth = dragInfoEl.offsetWidth || 200
      const overlayHeight = dragInfoEl.offsetHeight || 60
      const gap = 10 // バーとオーバーレイの間隔(px)
      const margin = 8 // ビューポート端からの最小マージン(px)
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      const targetX = this.dragOverlayInfo.barX ?? mouseX
      const targetTop = this.dragOverlayInfo.barTop ?? mouseY
      const targetBottom = this.dragOverlayInfo.barBottom ?? mouseY

      // X方向: バーの中心に配置し、画面端でクランプ
      let left = targetX - overlayWidth / 2
      left = Math.max(margin, Math.min(left, viewportWidth - overlayWidth - margin))

      // Y方向: デフォルトはバーの上に表示
      let top = targetTop - overlayHeight - gap

      // 上にはみ出す場合はバーの下に表示
      if (top < margin) {
        top = targetBottom + gap
      }

      // 下にはみ出す場合はクランプ
      if (top + overlayHeight > viewportHeight - margin) {
        top = viewportHeight - overlayHeight - margin
      }

      dragInfoEl.style.left = `${left}px`
      dragInfoEl.style.transform = 'none'
      dragInfoEl.style.top = `${top}px`
      dragInfoEl.style.bottom = 'auto'
    }
  }

  private hideDragOverlay() {
    const dragInfoEl = this.shadowRoot?.querySelector('.drag-info-overlay') as HTMLElement
    if (dragInfoEl) {
      dragInfoEl.classList.remove('visible')
    }
  }

  private currentTimeTimer: number | undefined

  private setupCurrentTimeTimer() {
    this.stopCurrentTimeTimer()
    const interval = this.option.calendar.currentTimeUpdateInterval
    if (interval && interval > 0) {
      this.currentTimeTimer = window.setInterval(() => {
        this.currentTime = new Date()
      }, interval)
    }
  }

  private stopCurrentTimeTimer() {
    if (this.currentTimeTimer !== undefined) {
      window.clearInterval(this.currentTimeTimer)
      this.currentTimeTimer = undefined
    }
  }

  private handleHeaderResizeStart(e: PointerEvent) {
    e.preventDefault()
    e.stopPropagation()
    this.isResizingHeader = true
    const startX = e.clientX
    const startWidth = this.currentRowHeaderWidth
    const target = e.target as HTMLElement
    target.setPointerCapture(e.pointerId)

    const minWidth = this.option.rowHeader?.minWidth ?? 50
    const maxWidth = this.option.rowHeader?.maxWidth ?? Number.MAX_SAFE_INTEGER

    const handleMove = (e: PointerEvent) => {
      const dx = e.clientX - startX
      const newWidth = startWidth + dx
      this.currentRowHeaderWidth = Math.max(minWidth, Math.min(maxWidth, newWidth))
    }

    const handleUp = () => {
      this.isResizingHeader = false
      target.releasePointerCapture(e.pointerId)
      target.removeEventListener('pointermove', handleMove)
      target.removeEventListener('pointerup', handleUp)

      const finalWidth = Math.round(this.currentRowHeaderWidth)
      this.currentRowHeaderWidth = finalWidth

      this.dispatchEvent(
        new CustomEvent<RowHeaderResizeEventDetail>('row-header-resize', {
          detail: { width: finalWidth },
          bubbles: true,
          composed: true,
        }),
      )
    }

    target.addEventListener('pointermove', handleMove)
    target.addEventListener('pointerup', handleUp)
  }

  private handleScroll = (e: Event) => {
    const target = e.target as HTMLElement
    this.currentScrollLeft = target.scrollLeft
    this.currentScrollTop = target.scrollTop
    this.updateScrollTop(target.scrollTop)

    if (this.hoverTimer !== undefined) {
      window.clearTimeout(this.hoverTimer)
    }
    if (this.tooltip) {
      this.tooltip = { ...this.tooltip, visible: false }
    }
  }

  private handleMinimapScroll = (e: CustomEvent<MinimapScrollEventDetail>) => {
    const container = this.shadowRoot?.querySelector('.scroll-container') as HTMLElement | null
    if (container) {
      container.scrollLeft = e.detail.scrollLeft
      container.scrollTop = e.detail.scrollTop
      this.currentScrollLeft = e.detail.scrollLeft
      this.currentScrollTop = e.detail.scrollTop
      this.virtualScrollTop = e.detail.scrollTop
    }
  }

  private updateScrollTop = throttle((scrollTop: number) => {
    this.virtualScrollTop = scrollTop
  }, 100)

  private handleContainerMouseMove = (e: MouseEvent) => {
    if (!this.option.calendar.showCursorLine) return
    const container = this.shadowRoot?.querySelector('.scroll-container') as HTMLElement
    if (!container) return
    const rect = container.getBoundingClientRect()
    // スクロール位置を加味したコンテンツ内X座標
    const x = e.clientX - rect.left + container.scrollLeft
    const labelWidth = this.currentRowHeaderWidth
    // 行ヘッダー領域では非表示
    if (x < labelWidth) {
      this.cursorLineX = null
      return
    }
    this.cursorLineX = x
  }

  private handleContainerMouseLeave = () => {
    this.cursorLineX = null
  }

  private getDateX(date: Date) {
    return dateToX(
      date,
      this.option.calendar.start,
      this.effectivePxPerDay,
      this.effectivePxPerMonth,
    )
  }

  private calculateLayout() {
    if (this._layoutCache) {
      return this._layoutCache
    }

    let top = 0
    const labelWidth = this.currentRowHeaderWidth
    const taskCoords = new Map<
      string,
      {
        x: number
        y: number
        width: number
        height: number
        dependencies?: string[]
        isSummary?: boolean
      }
    >()

    const layouts = this.displayRows.map((row) => {
      const { tasksWithLanes, laneCount } = calculateTaskLanes(row.tasks)
      const barHeight = this.option.bar?.height ?? DEFAULT_BAR_HEIGHT
      const barMargin = this.option.bar?.margin ?? DEFAULT_BAR_MARGIN

      tasksWithLanes.forEach((task: any) => {
        const x = this.getDateX(task.start) + labelWidth
        const endX = this.getDateX(task.end) + labelWidth
        const width = endX - x
        const y = top + task.lane * (barHeight + barMargin) + barMargin
        taskCoords.set(task.id, {
          x,
          y,
          width,
          height: barHeight,
          dependencies: task.dependencies,
          isSummary: task.type === 'summary',
        })
      })

      const height = laneCount * (barHeight + barMargin) + barMargin
      const layout = { top, height }
      top += height
      return layout
    })

    const result = { layouts, taskCoords, totalHeight: top }
    this._layoutCache = result
    return result
  }

  /**
   * 複数バー移動かどうかを判定する。
   * ドラッグ中のバーが選択中バーに含まれ、選択数が2以上の場合にtrue。
   */
  private isMultiDrag(taskId: string): boolean {
    return this.selectedTasks.size >= 2 && this.selectedTasks.has(taskId)
  }

  /**
   * 選択中の全タスクが同じ行に属しているかを判定する。
   * 同じ行なら縦方向（行間）の移動を許可する。
   */
  private isMultiDragSameRow(): boolean {
    if (this.selectedTasks.size < 2) return false
    let commonRowId: string | null = null
    for (const row of this.rows) {
      for (const task of row.tasks) {
        if (this.selectedTasks.has(task.id)) {
          if (commonRowId === null) {
            commonRowId = row.id
          } else if (commonRowId !== row.id) {
            return false
          }
        }
      }
    }
    return commonRowId !== null
  }

  private handleTaskUpdate(e: CustomEvent<TaskUpdateEventDetail & { mode?: GanttTaskMoveMode }>) {
    e.stopPropagation()
    const { id, start, end, dx, isDragging, mode } = e.detail
    let { dy } = e.detail

    const isMulti = this.isMultiDrag(id)
    const sameRow = isMulti && this.isMultiDragSameRow()

    // 複数選択移動時：異なる行のバーが含まれる場合はdy=0に固定（行移動を無効化）
    // 同じ行のバーのみ選択されている場合は縦移動を許可
    if (isMulti && !sameRow) {
      dy = 0
    }

    let newStart = start
    let newEnd = end

    if (dx !== undefined) {
      const pxPerDay = this.effectivePxPerDay
      const pxPerMonth = this.effectivePxPerMonth
      const startX = this.getDateX(start)
      const endX = this.getDateX(end)
      newStart = xToDate(startX + dx, this.option.calendar.start, pxPerDay, pxPerMonth)
      newEnd = xToDate(endX + dx, this.option.calendar.start, pxPerDay, pxPerMonth)
    }

    // 月単位モードではsnapDurationに関わらず1ヶ月単位でスナップ
    if (this.option.calendar.pxPerMonth) {
      if (newStart.getDate() > 15) newStart.setMonth(newStart.getMonth() + 1)
      newStart.setDate(1)
      newStart.setHours(0, 0, 0, 0)
      if (newEnd.getDate() > 15) newEnd.setMonth(newEnd.getMonth() + 1)
      newEnd.setDate(1)
      newEnd.setHours(0, 0, 0, 0)
    } else if (this.option.snapDuration && this.option.snapDuration >= 43200) {
      if (newStart.getDate() > 15) newStart.setMonth(newStart.getMonth() + 1)
      newStart.setDate(1)
      newStart.setHours(0, 0, 0, 0)
      if (newEnd.getDate() > 15) newEnd.setMonth(newEnd.getMonth() + 1)
      newEnd.setDate(1)
      newEnd.setHours(0, 0, 0, 0)
    }

    let sourceRowIndex = -1
    let taskToMove: GanttTask | undefined
    let taskIndexInSource = -1

    this.rows.find((r, index) => {
      const taskI = r.tasks.findIndex((t) => t.id === id)
      if (taskI !== -1) {
        sourceRowIndex = index
        taskToMove = r.tasks[taskI]
        taskIndexInSource = taskI
        return true
      }
      return false
    })

    if (sourceRowIndex === -1 || !taskToMove) return

    const { layouts: rowLayouts } = this.calculateLayout()
    const sourceRowIndexInDisplay = this.displayRows.findIndex((r) => r.id === this.rows[sourceRowIndex].id)
    if (sourceRowIndexInDisplay === -1) return

    const dragStartRowTop = rowLayouts[sourceRowIndexInDisplay].top

    const displayRow = this.displayRows[sourceRowIndexInDisplay]
    const { tasksWithLanes } = calculateTaskLanes(displayRow.tasks)
    const taskWithLane = tasksWithLanes.find((t) => t.id === id)
    const lane = taskWithLane ? taskWithLane.lane : 0
    const barHeight = this.option.bar?.height ?? DEFAULT_BAR_HEIGHT
    const barMargin = this.option.bar?.margin ?? DEFAULT_BAR_MARGIN

    const taskInitialY = lane * (barHeight + barMargin) + barMargin
    const currentY = dragStartRowTop + taskInitialY + dy + barHeight / 2

    const allowCrossRowMove = this.option.enableCrossRowMove !== false
    let targetRowIndex = -1
    if (allowCrossRowMove) {
      for (let i = 0; i < rowLayouts.length; i++) {
        const rowLayout = rowLayouts[i]
        if (currentY >= rowLayout.top && currentY < rowLayout.top + rowLayout.height) {
          targetRowIndex = i
          break
        }
      }
    } else {
      const sourceRow = this.rows[sourceRowIndex]
      targetRowIndex = this.displayRows.findIndex((r) => r.id === sourceRow.id)
    }

    const targetRowId = targetRowIndex !== -1 ? this.displayRows[targetRowIndex].id : undefined

    // 外部に通知するイベントに複数選択情報を含める
    const selectedIds = isMulti ? [...this.selectedTasks] : undefined

    this.dispatchEvent(
      new CustomEvent('task-update', {
        detail: {
          ...e.detail,
          dy,
          start: newStart,
          end: newEnd,
          targetRowId,
          selectedTaskIds: selectedIds,
        },
        bubbles: true,
        composed: true,
      }),
    )

    if (isDragging) {
      if (this.hoverTimer !== undefined) {
        window.clearTimeout(this.hoverTimer)
      }
      // ドラッグ中はツールチップを非表示にする
      if (this.tooltip) {
        this.tooltip = null
      }

      if (e.detail.isOutside || (allowCrossRowMove && targetRowIndex === -1)) {
        // ガントチャート外または行外にあるときは、ドラッグ状態の表示を初期状態（移動なし）に戻す
        this.multiDragDx = 0
        this.multiDragDy = 0
        this.dragTargetRowIndex = null
        if (this.dragOverlayInfo) {
          this.dragOverlayInfo = { ...this.dragOverlayInfo, visible: false }
          this.hideDragOverlay()
        }
        return
      }

      // draggingTaskの更新は、IDが変わった時やドラッグ開始時のみ行う
      // 座標が変わるたびに更新すると全行の再レンダリングが走ってしまうため
      if (!this.draggingTask || this.draggingTask.id !== id) {
        this.draggingTask = {
          id,
          name: e.detail.name,
          start,
          end,
          currentStart: newStart,
          currentEnd: newEnd,
          mode,
        }

        // 複数選択時はドラッグ中のタスクIDリストを設定
        if (isMulti) {
          this.draggingTaskIds = [...this.selectedTasks]
        } else {
          this.draggingTaskIds = []
        }
      }

      // 複数ドラッグ中のdx/dy値は毎フレーム更新（ゴースト表示位置の追従のため）
      if (isMulti) {
        this.multiDragDx = dx ?? 0
        this.multiDragSameRow = sameRow
        if (sameRow) {
          this.multiDragDy = dy
        } else {
          this.multiDragDy = 0
        }
      } else if (this.multiDragDx !== 0 || this.multiDragDy !== 0) {
        this.multiDragDx = 0
        this.multiDragDy = 0
      }

      // 複数選択移動時：異なる行のバーが含まれる場合はtargetRowIndexを更新しない
      // 同じ行のバーのみの場合はtargetRowIndexを更新（行移動を有効化）
      if (!isMulti || sameRow) {
        const newDragTargetRowIndex = targetRowIndex >= 0 ? targetRowIndex : null
        if (this.dragTargetRowIndex !== newDragTargetRowIndex) {
          this.dragTargetRowIndex = newDragTargetRowIndex
        }
      }

      // ドラッグオーバーレイ: 複数選択時は件数を表示
      if (isMulti) {
        this.dragOverlayInfo = {
          id,
          name: (this.option.locale ?? jaLocale).dragOverlay.movingTasks(this.selectedTasks.size),
          start,
          end,
          currentStart: newStart,
          currentEnd: newEnd,
          visible: true,
          clientX: e.detail.x,
          clientY: e.detail.y,
          barX: e.detail.barX,
          barTop: e.detail.barTop,
          barBottom: e.detail.barBottom,
        }
      } else {
        this.dragOverlayInfo = {
          id,
          name: e.detail.name,
          start,
          end,
          currentStart: newStart,
          currentEnd: newEnd,
          targetRow:
            targetRowIndex >= 0 && this.displayRows[targetRowIndex]?.id !== this.rows[sourceRowIndex]?.id
              ? this.displayRows[targetRowIndex]
              : undefined,
          visible: true,
          clientX: e.detail.x,
          clientY: e.detail.y,
          barX: e.detail.barX,
          barTop: e.detail.barTop,
          barBottom: e.detail.barBottom,
        }
      }
      this.updateDragOverlay()
      return
    }

    // ドロップ時の処理
    const droppedMulti = this.draggingTaskIds.length >= 2
    const droppedSameRow = this.multiDragSameRow
    this.draggingTask = null
    this.draggingTaskIds = []
    this.multiDragDx = 0
    this.multiDragDy = 0
    this.multiDragSameRow = false
    this.dragTargetRowIndex = null
    if (this.dragOverlayInfo) {
      this.dragOverlayInfo = { ...this.dragOverlayInfo, visible: false }
      this.hideDragOverlay()
    }
    if (this.tooltip) {
      this.tooltip = { ...this.tooltip, visible: false }
    }

    // キャンセル、チャート外、または行が存在しない場所でドロップされた場合は、タスク移動を適用しない
    if (e.detail.isCancel || e.detail.isOutside || (allowCrossRowMove && targetRowIndex === -1)) {
      return
    }

    // targetRowIndex は displayRows のインデックスなので、this.rows のインデックスに変換
    let targetRowIndexInRows = -1
    if (targetRowIndex !== -1) {
      const targetRow = this.displayRows[targetRowIndex]
      targetRowIndexInRows = this.rows.findIndex((r) => r.id === targetRow.id)
    }

    // 複数バー移動のドロップ処理
    if (droppedMulti && dx !== undefined) {
      const pxPerDay = this.effectivePxPerDay
      const pxPerMonth = this.effectivePxPerMonth

      // 同一行の複数バーが別の行にドロップされた場合の行移動処理
      const needsRowMove = droppedSameRow && targetRowIndexInRows !== -1 && sourceRowIndex !== targetRowIndexInRows

      if (needsRowMove) {
        // 全選択タスクをソース行から取り出してターゲット行に移動
        const newRows = [...this.rows]
        const sourceRow = { ...newRows[sourceRowIndex] }
        const targetRow = { ...newRows[targetRowIndexInRows] }
        sourceRow.tasks = [...sourceRow.tasks]
        targetRow.tasks = [...targetRow.tasks]

        const movedTasks: GanttTask[] = []
        sourceRow.tasks = sourceRow.tasks.filter((t) => {
          if (this.selectedTasks.has(t.id)) {
            const tStartX = this.getDateX(t.start)
            const tEndX = this.getDateX(t.end)
            const ns = xToDate(tStartX + dx, this.option.calendar.start, pxPerDay, pxPerMonth)
            const ne = xToDate(tEndX + dx, this.option.calendar.start, pxPerDay, pxPerMonth)
            if (this.option.calendar.pxPerMonth) {
              if (ns.getDate() > 15) ns.setMonth(ns.getMonth() + 1)
              ns.setDate(1)
              ns.setHours(0, 0, 0, 0)
              if (ne.getDate() > 15) ne.setMonth(ne.getMonth() + 1)
              ne.setDate(1)
              ne.setHours(0, 0, 0, 0)
            } else if (this.option.snapDuration && this.option.snapDuration >= 43200) {
              if (ns.getDate() > 15) ns.setMonth(ns.getMonth() + 1)
              ns.setDate(1)
              ns.setHours(0, 0, 0, 0)
              if (ne.getDate() > 15) ne.setMonth(ne.getMonth() + 1)
              ne.setDate(1)
              ne.setHours(0, 0, 0, 0)
            }
            movedTasks.push({ ...t, start: ns, end: ne })
            return false
          }
          return true
        })
        targetRow.tasks.push(...movedTasks)
        newRows[sourceRowIndex] = sourceRow
        newRows[targetRowIndexInRows] = targetRow

        requestAnimationFrame(() => {
          this.rows = newRows
          this.dispatchEvent(
            new CustomEvent('rows-change', {
              detail: this.rows,
              bubbles: true,
              composed: true,
            }),
          )
        })
      } else {
        // 同じ行内での水平移動のみ
        const newRows = this.rows.map((row) => {
          const hasSelectedTask = row.tasks.some((t) => this.selectedTasks.has(t.id))
          if (!hasSelectedTask) return row

          return {
            ...row,
            tasks: row.tasks.map((t) => {
              if (!this.selectedTasks.has(t.id)) return t
              const tStartX = this.getDateX(t.start)
              const tEndX = this.getDateX(t.end)
              const ns = xToDate(tStartX + dx, this.option.calendar.start, pxPerDay, pxPerMonth)
              const ne = xToDate(tEndX + dx, this.option.calendar.start, pxPerDay, pxPerMonth)
              // 月単位モードではsnapDurationに関わらず1ヶ月単位でスナップ
              if (this.option.calendar.pxPerMonth) {
                if (ns.getDate() > 15) ns.setMonth(ns.getMonth() + 1)
                ns.setDate(1)
                ns.setHours(0, 0, 0, 0)
                if (ne.getDate() > 15) ne.setMonth(ne.getMonth() + 1)
                ne.setDate(1)
                ne.setHours(0, 0, 0, 0)
              } else if (this.option.snapDuration && this.option.snapDuration >= 43200) {
                if (ns.getDate() > 15) ns.setMonth(ns.getMonth() + 1)
                ns.setDate(1)
                ns.setHours(0, 0, 0, 0)
                if (ne.getDate() > 15) ne.setMonth(ne.getMonth() + 1)
                ne.setDate(1)
                ne.setHours(0, 0, 0, 0)
              }
              return {
                ...t,
                start: ns,
                end: ne,
              }
            }),
          }
        })

        // 月単位モードは重いので rAF で rows 更新を次フレームに遅延させる
        requestAnimationFrame(() => {
          this.rows = newRows
          this.dispatchEvent(
            new CustomEvent('rows-change', {
              detail: this.rows,
              bubbles: true,
              composed: true,
            }),
          )
        })
      }
      return
    }

    if (mode === 'copy') {
      if (targetRowIndexInRows !== -1) {
        const newRows = [...this.rows]
        const targetRow = { ...newRows[targetRowIndexInRows] }
        targetRow.tasks = [...targetRow.tasks]

        // 新しいIDを生成
        const newId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

        const newTask = {
          ...taskToMove,
          id: newId,
          start: newStart,
          end: newEnd,
          dependencies: [],
        }

        targetRow.tasks.push(newTask)
        newRows[targetRowIndexInRows] = targetRow

        requestAnimationFrame(() => {
          this.rows = newRows
          this.dispatchEvent(
            new CustomEvent('rows-change', {
              detail: this.rows,
              bubbles: true,
              composed: true,
            }),
          )
        })
      }
    } else {
      const newRows = [...this.rows]
      const sourceRow = { ...newRows[sourceRowIndex] }
      sourceRow.tasks = [...sourceRow.tasks]
      newRows[sourceRowIndex] = sourceRow

      if (targetRowIndexInRows !== -1 && sourceRowIndex !== targetRowIndexInRows) {
        const targetRow = { ...newRows[targetRowIndexInRows] }
        targetRow.tasks = [...targetRow.tasks]
        newRows[targetRowIndexInRows] = targetRow

        const [movedTask] = sourceRow.tasks.splice(taskIndexInSource, 1)
        targetRow.tasks.push({ ...movedTask, start: newStart, end: newEnd })
      } else {
        sourceRow.tasks[taskIndexInSource] = {
          ...taskToMove,
          start: newStart,
          end: newEnd,
        }
      }

      requestAnimationFrame(() => {
        this.rows = newRows
        this.dispatchEvent(
          new CustomEvent('rows-change', {
            detail: this.rows,
            bubbles: true,
            composed: true,
          }),
        )
      })
    }
  }

  private handleBarMouseEnter(e: CustomEvent<BarHoverEventDetail>) {
    // ドラッグ中、またはshowTooltipがfalseの場合はツールチップを表示しない
    if (this.draggingTask || this.option.showTooltip === false) {
      return
    }
    if (this.hoverTimer !== undefined) {
      window.clearTimeout(this.hoverTimer)
    }
    const delay = this.option.tooltipDelay ?? 500
    if (delay > 0) {
      this.hoverTimer = window.setTimeout(() => {
        this.tooltip = { ...e.detail, visible: true, below: false }
      }, delay)
    } else {
      this.tooltip = { ...e.detail, visible: true, below: false }
    }
  }

  private handleBarMouseLeave() {
    if (this.hoverTimer !== undefined) {
      window.clearTimeout(this.hoverTimer)
    }
    if (this.tooltip) {
      this.tooltip = { ...this.tooltip, visible: false }
    }
  }

  private async reorderRows(sourceIds: string | string[], targetId: string, position: 'top' | 'bottom') {
    const initialIds = Array.isArray(sourceIds) ? sourceIds : [sourceIds]

    // 循環参照・階層ルールガード: 移動対象自身または自身の子孫へのドロップ、親ブロック外移動は禁止
    if (!canDropRow(this.rows, initialIds, targetId, position)) {
      return
    }

    // ブロック連動: 親行が移動対象の場合、その配下の子孫行も一緒に移動対象に含める
    const allMovingIdsSet = new Set<string>()
    for (const id of initialIds) {
      allMovingIdsSet.add(id)
      const descendantIds = computeChildRowIds(this.rows, id, true)
      for (const descId of descendantIds) {
        allMovingIdsSet.add(descId)
      }
    }

    // 元の配列の順序を保った移動対象IDリスト
    const ids = this.rows
      .filter((r) => allMovingIdsSet.has(r.id))
      .map((r) => r.id)

    const rowElements = Array.from(this.shadowRoot?.querySelectorAll('gantt-row') ?? []) as GanttRowElement[]
    const positions = new Map<string, number>()
    rowElements.forEach((el) => {
      if (el.row) {
        positions.set(el.row.id, el.getBoundingClientRect().top)
      }
    })

    const newRows = [...this.rows]
    const movingRows: GanttRow[] = []
    let targetIndex = newRows.findIndex((r) => r.id === targetId)
    if (targetIndex === -1) return

    // 移動対象の行を抽出して削除
    // インデックスがずれないように後ろから削除するか、filterを使う
    // ここではまず抽出してから、元の配列から削除する
    ids.forEach((id) => {
      const index = newRows.findIndex((r) => r.id === id)
      if (index !== -1) {
        movingRows.push(newRows[index])
      }
    })

    // ID順に並べ替える必要はなく、選択順あるいは元々の順序を維持したいが、
    // ここでは newRows からの抽出順序（＝元々の表示順序）を維持する形で実装
    const filteredRows = newRows.filter((r) => !ids.includes(r.id))

    // ターゲット位置を再計算（削除によってインデックスが変わる可能性があるため）
    // targetId自体が移動対象に含まれている場合はどうするか？
    // ドラッグ＆ドロップの仕様上、ターゲットは自分自身ではないはずだが、複数選択の場合はあり得る
    // targetId が movingRows に含まれている場合、ドロップ先として無効とみなすか、
    // あるいは targetId の位置は「削除前の位置」を基準にするか。
    // ここでは filteredRows における targetId の位置を探す。
    // もし targetId も移動対象なら、targetId は filteredRows に存在しない。
    // その場合は処理を中断するか、あるいは別のロジックが必要。
    // 通常、ドラッグ中の要素の上にドロップはできない（pointer-events: noneなど）が、
    // 念のためチェック。
    if (ids.includes(targetId)) return

    let newTargetIndex = filteredRows.findIndex((r) => r.id === targetId)

    if (position === 'bottom') {
      const targetRow = filteredRows[newTargetIndex]
      const isTargetCollapsed = targetRow && (targetRow.collapsed || this._collapsedRowIds.has(targetId))
      if (isTargetCollapsed) {
        // 折りたたまれた親行の下にドロップした場合、配下の全子孫行の末尾の後ろに配置する
        const descendantIds = new Set(computeChildRowIds(filteredRows, targetId, true))
        if (descendantIds.size > 0) {
          for (let i = newTargetIndex + 1; i < filteredRows.length; i++) {
            if (descendantIds.has(filteredRows[i].id)) {
              newTargetIndex = i
            }
          }
        }
      }
      newTargetIndex++
    }

    const targetRowInOrig = this.rows.find((r) => r.id === targetId)
    const firstParentId = movingRows[0]?.parentId ?? null

    // 新しい親IDの決定:
    // 1) ターゲットが自身の直接の親行（targetRow.id === firstParentId）の場合:
    //    - bottom: 親配下の先頭に移動（親はそのまま firstParentId）
    //    - top: 親行の前へ移動（親は targetRow.parentId）
    // 2) ターゲットがそれ以外の行の場合:
    //    - 常に targetRow.parentId が新しい親IDとなる
    const newParentId =
      firstParentId !== null && targetRowInOrig && targetRowInOrig.id === firstParentId && position === 'bottom'
        ? firstParentId
        : (targetRowInOrig?.parentId ?? null)

    // 移動した直接の対象行（initialIds）の parentId を newParentId に更新
    const updatedMovingRows = movingRows.map((row) => {
      if (initialIds.includes(row.id)) {
        if ((row.parentId ?? null) !== newParentId) {
          return { ...row, parentId: newParentId }
        }
      }
      return row
    })

    filteredRows.splice(newTargetIndex, 0, ...updatedMovingRows)

    this.rows = filteredRows

    await this.updateComplete

    const newRowElements = Array.from(this.shadowRoot?.querySelectorAll('gantt-row') ?? []) as GanttRowElement[]

    newRowElements.forEach((el) => {
      if (el.row) {
        const oldTop = positions.get(el.row.id)
        if (oldTop !== undefined) {
          const newTop = el.getBoundingClientRect().top
          const dy = oldTop - newTop
          if (dy !== 0) {
            el.animate(
              [
                { transform: `translateY(${dy}px)`, zIndex: '1' },
                { transform: 'translateY(0)', zIndex: '1' },
              ],
              {
                duration: 300,
                easing: 'ease-out',
              },
            )
          }
        }
      }
    })

    this.dispatchEvent(
      new CustomEvent<RowReorderEventDetail>('row-reordered', {
        detail: {
          sourceId: ids[0], // 互換性のため
          sourceIds: ids,
          targetId,
          position,
          rows: this.rows,
        },
        bubbles: true,
        composed: true,
      }),
    )

    this.dispatchEvent(
      new CustomEvent('rows-change', {
        detail: this.rows,
        bubbles: true,
        composed: true,
      }),
    )
  }

  private handleContainerDragOver(e: DragEvent) {
    // JSONデータが含まれているか、またはプロパティ経由でタスクが渡されている場合
    const isExternalTask = e.dataTransfer && e.dataTransfer.types.includes('application/json')

    if (!this.option.enableRowReordering && !isExternalTask) {
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'none'
      }
      return
    }

    const container = this.shadowRoot?.querySelector('.scroll-container') as HTMLElement
    if (!container) return

    const rect = container.getBoundingClientRect()
    const y = e.clientY - rect.top + container.scrollTop
    const yInRows = y - this.calendarHeight

    const { layouts } = this.calculateLayout()

    let foundIndex = -1
    for (let i = 0; i < layouts.length; i++) {
      const layout = layouts[i]
      if (yInRows >= layout.top && yInRows < layout.top + layout.height) {
        foundIndex = i
        break
      }
    }

    if (foundIndex !== -1) {
      const row = this.displayRows[foundIndex]

      if (isExternalTask) {
        e.preventDefault()
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'copy'
        }

        if (this.dragOverRowId !== row.id || this.dragOverPosition !== null) {
          this.dragOverRowId = row.id
          this.dragOverPosition = null
        }

        // ゴースト表示の計算
        if (this.externalDraggingTask) {
          const labelWidth = this.currentRowHeaderWidth
          const scrollLeft = container.scrollLeft
          const x = e.clientX - rect.left + scrollLeft - labelWidth
          const pxPerDay = this.effectivePxPerDay
          const pxPerMonth = this.effectivePxPerMonth

          // スナップ計算
          const snapDuration = this.option.snapDuration ?? 1440
          const pxPerMinute = pxPerDay / (24 * 60)
          const snapPx = pxPerMinute * snapDuration
          const snappedX = Math.round(x / snapPx) * snapPx

          // 日時計算
          const currentStart = xToDate(snappedX, this.option.calendar.start, pxPerDay, pxPerMonth)
          const durationMs = this.externalDraggingTask.end.getTime() - this.externalDraggingTask.start.getTime()
          const currentEnd = new Date(currentStart.getTime() + durationMs)

          if (
            !this.dragPreview ||
            this.dragPreview.rowId !== row.id ||
            this.dragPreview.currentStart.getTime() !== currentStart.getTime()
          ) {
            this.dragPreview = {
              task: this.externalDraggingTask,
              currentStart,
              currentEnd,
              rowId: row.id,
            }
          }
        }
      } else {
        const layout = layouts[foundIndex]
        const relativeY = yInRows - layout.top
        const position = relativeY < layout.height / 2 ? 'top' : 'bottom'

        // 行ドラッグ中の場合、移動可否をチェックして不可ならドロップインジケータを表示せず禁止マークにする
        let canDrop = true
        const draggingId =
          this._draggingRowId ||
          (typeof window !== 'undefined' ? (window as any).__moguchart_dragging_row_id : null)

        if (draggingId) {
          const sourceIds =
            this.selectedRows.has(draggingId) && this.selectedRows.size > 1
              ? Array.from(this.selectedRows)
              : [draggingId]
          canDrop = canDropRow(this.rows, sourceIds, row.id, position)
        }

        if (!canDrop) {
          if (this.dragOverRowId !== null || this.dragOverPosition !== null) {
            this.dragOverRowId = null
            this.dragOverPosition = null
          }
          if (e.dataTransfer) {
            e.dataTransfer.dropEffect = 'none'
          }
          // 重要: canDrop が false のときは preventDefault() を絶対に呼ばない！
          // preventDefault() を呼ばないことで、ブラウザはデフォルトの「ドロップ禁止」として
          // OS ネイティブの禁止マーク（🚫 / not-allowed）を確実に表示する
          return
        }

        // ドロップ可能な場合のみ preventDefault() を呼び出し、dropEffect = 'move' を設定
        e.preventDefault()
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'move'
        }

        if (this.dragOverRowId !== row.id || this.dragOverPosition !== position) {
          this.dragOverRowId = row.id
          this.dragOverPosition = position
        }
      }
    } else {
      this.dragOverRowId = null
      this.dragOverPosition = null
      this.dragPreview = null
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'none'
      }
      // 余白もドロップ不可のため preventDefault() は呼ばない
    }
  }

  private handleRowDragStart(e: CustomEvent<{ rowId: string }>) {
    this._draggingRowId = e.detail.rowId
    if (typeof window !== 'undefined') {
      ;(window as any).__moguchart_dragging_row_id = e.detail.rowId
    }
  }

  private handleRowDragEnd() {
    this._draggingRowId = null
    if (typeof window !== 'undefined') {
      delete (window as any).__moguchart_dragging_row_id
    }
    this.dragOverRowId = null
    this.dragOverPosition = null
  }

  private handleContainerDragLeave(e: DragEvent) {
    const container = this.shadowRoot?.querySelector('.scroll-container') as HTMLElement
    const related = e.relatedTarget as HTMLElement
    if (container && container.contains(related)) return

    this.dragOverRowId = null
    this.dragOverPosition = null
    this.dragPreview = null
    // 注意: ドラッグ中にコンテナ内の別要素へマウスが移動した際、relatedTarget が null になる場合があるため、
    // ここで this._draggingRowId をクリアしてはならない。クリアは handleRowDragEnd / handleContainerDrop で行う。
  }

  private handleContainerDrop(e: DragEvent) {
    e.preventDefault()

    const taskJson = e.dataTransfer?.getData('application/json')
    if (taskJson) {
      this.handleExternalTaskDrop(e, taskJson)
      this.dragOverRowId = null
      this.dragOverPosition = null
      this.dragPreview = null
      this._draggingRowId = null
      if (typeof window !== 'undefined') {
        delete (window as any).__moguchart_dragging_row_id
      }
      return
    }

    if (!this.option.enableRowReordering) return
    const sourceId = e.dataTransfer?.getData('text/plain') || this._draggingRowId
    const targetId = this.dragOverRowId
    const position = this.dragOverPosition

    this.dragOverRowId = null
    this.dragOverPosition = null
    this.dragPreview = null
    this._draggingRowId = null
    if (typeof window !== 'undefined') {
      delete (window as any).__moguchart_dragging_row_id
    }

    if (sourceId && targetId && sourceId !== targetId && position) {
      // 複数行選択されており、かつドラッグ開始行が選択行に含まれている場合
      const sourceIds =
        this.selectedRows.has(sourceId) && this.selectedRows.size > 1
          ? Array.from(this.selectedRows)
          : [sourceId]

      if (!canDropRow(this.rows, sourceIds, targetId, position)) {
        return
      }

      this.reorderRows(sourceIds, targetId, position)
    }
  }

  private handleExternalTaskDrop(e: DragEvent, taskJson: string) {
    try {
      const parsed = JSON.parse(taskJson)

      // ランタイムバリデーション: 必須フィールドの存在と型を検証
      if (
        !parsed ||
        typeof parsed !== 'object' ||
        typeof parsed.id !== 'string' ||
        typeof parsed.name !== 'string' ||
        !parsed.start ||
        !parsed.end
      ) {
        console.warn('Invalid dropped task data: missing required fields (id, name, start, end)')
        return
      }

      // start / end を Date オブジェクトに安全に変換
      const start = new Date(parsed.start)
      const end = new Date(parsed.end)
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        console.warn('Invalid dropped task data: start or end is not a valid date')
        return
      }

      const task: GanttTask = { ...parsed, start, end }
      const container = this.shadowRoot?.querySelector('.scroll-container') as HTMLElement
      if (!container) return

      const rect = container.getBoundingClientRect()
      const scrollLeft = container.scrollLeft
      const scrollTop = container.scrollTop
      const labelWidth = this.currentRowHeaderWidth

      // X座標 -> 日時
      const x = e.clientX - rect.left + scrollLeft - labelWidth
      const pxPerDay = this.effectivePxPerDay
      const pxPerMonth = this.effectivePxPerMonth
      const dropDate = xToDate(x, this.option.calendar.start, pxPerDay, pxPerMonth)

      // Y座標 -> 行
      const yInRows = e.clientY - rect.top + scrollTop - this.calendarHeight

      const { layouts } = this.calculateLayout()
      let targetRowId: string | undefined

      for (let i = 0; i < layouts.length; i++) {
        const layout = layouts[i]
        if (yInRows >= layout.top && yInRows < layout.top + layout.height) {
          targetRowId = this.displayRows[i].id
          break
        }
      }

      if (targetRowId) {
        this.dispatchEvent(
          new CustomEvent('task-drop', {
            detail: { task, dropDate, targetRowId },
            bubbles: true,
            composed: true,
          }),
        )
      }
    } catch (err) {
      console.warn('Failed to parse dropped task data', err)
    }
  }

  private handleRowClicked(e: CustomEvent<{ rowId: string; event: MouseEvent }>) {
    const { rowId, event } = e.detail
    const { shiftKey, ctrlKey, metaKey } = event

    const newSelectedRows = new Set(this.selectedRows)

    if (shiftKey && this.lastClickedRowId) {
      const lastIndex = this.rows.findIndex((r) => r.id === this.lastClickedRowId)
      const currentIndex = this.rows.findIndex((r) => r.id === rowId)

      if (lastIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(lastIndex, currentIndex)
        const end = Math.max(lastIndex, currentIndex)
        for (let i = start; i <= end; i++) {
          newSelectedRows.add(this.rows[i].id)
        }
      }
    } else if (ctrlKey || metaKey) {
      if (newSelectedRows.has(rowId)) {
        newSelectedRows.delete(rowId)
      } else {
        newSelectedRows.add(rowId)
      }
      this.lastClickedRowId = rowId
    } else {
      if (newSelectedRows.has(rowId)) {
        this.lastClickedRowId = rowId
        return
      }
      newSelectedRows.clear()
      newSelectedRows.add(rowId)
      this.lastClickedRowId = rowId
    }

    this.selectedRows = newSelectedRows
    this.dispatchEvent(
      new CustomEvent<RowSelectionChangeEventDetail>('row-selection-change', {
        detail: {
          selectedIds: Array.from(this.selectedRows),
        },
        bubbles: true,
        composed: true,
      }),
    )
  }

  private handleRowContextMenu(e: CustomEvent<{ rowId: string; event: MouseEvent }>) {
    if (this.selectedRows.has(e.detail.rowId)) {
      return
    }
    this.handleRowClicked(e)
  }

  // --- 矩形範囲選択（Marquee Selection） ---

  private handleContainerPointerDown = (e: PointerEvent) => {
    // 左クリックのみ
    if (e.button !== 0) return
    // 矩形選択が無効化されている場合はスキップ
    if (this.option?.selection?.marquee === false) return

    // 除外ターゲット判定
    const target = e.target as HTMLElement | null
    if (!target) return

    // タスクバー、各種ハンドル、コネクタ、マーカー、マイルストーン、ヘッダーリサイザー上での操作は除外
    if (
      target.closest(
        '.bar, .task-group, .handle-left, .handle-right, .handle-progress, .connector-left, .connector-right, .marker-wrapper, .milestone-line, .header-resizer, .dependency-hit-area',
      )
    ) {
      return
    }

    // カレンダーヘッダー上での操作は除外
    if (target.closest('gantt-calendar')) {
      return
    }

    const container = this.shadowRoot?.querySelector('.scroll-container') as HTMLElement | null
    if (!container) return

    const rect = container.getBoundingClientRect()
    const labelWidth = this.currentRowHeaderWidth
    const contentX = e.clientX - rect.left + container.scrollLeft
    const contentY = e.clientY - rect.top + container.scrollTop - this.calendarHeight

    // 行ヘッダー領域またはカレンダー領域でのクリックは除外
    if (contentX < labelWidth || contentY < 0) {
      return
    }

    const isMultiModifier = e.shiftKey || e.ctrlKey || e.metaKey

    this._marqueeDragStart = {
      clientX: e.clientX,
      clientY: e.clientY,
      contentStartX: contentX,
      contentStartY: contentY,
      initialSelectedTasks: new Set(this.selectedTasks),
      isMultiModifier,
    }
    this._isMarqueeActive = false

    window.addEventListener('pointermove', this.handleMarqueePointerMove)
    window.addEventListener('pointerup', this.handleMarqueePointerUp)
    window.addEventListener('pointercancel', this.handleMarqueePointerUp)
  }

  private handleMarqueePointerMove = (e: PointerEvent) => {
    if (!this._marqueeDragStart) return

    const dist = Math.hypot(
      e.clientX - this._marqueeDragStart.clientX,
      e.clientY - this._marqueeDragStart.clientY,
    )

    // ドラッグ判定の閾値（4px）
    if (!this._isMarqueeActive && dist < 4) {
      return
    }

    if (!this._isMarqueeActive) {
      this._isMarqueeActive = true
    }

    const container = this.shadowRoot?.querySelector('.scroll-container') as HTMLElement | null
    if (!container) return

    const rect = container.getBoundingClientRect()
    const labelWidth = this.currentRowHeaderWidth
    const rawContentX = e.clientX - rect.left + container.scrollLeft
    const rawContentY = e.clientY - rect.top + container.scrollTop - this.calendarHeight

    const currentX = Math.max(labelWidth, rawContentX)
    const currentY = Math.max(0, rawContentY)
    const startX = this._marqueeDragStart.contentStartX
    const startY = this._marqueeDragStart.contentStartY

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
    const { taskCoords } = this.calculateLayout()
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
    if (this._marqueeDragStart.isMultiModifier) {
      newSelectedTasks = new Set([
        ...this._marqueeDragStart.initialSelectedTasks,
        ...intersectingTaskIds,
      ])
    } else {
      newSelectedTasks = intersectingTaskIds
    }

    this.selectedTasks = newSelectedTasks

    // オートスクロール
    this.handleMarqueeAutoScroll(e, rect, container)
  }

  private handleMarqueePointerUp = () => {
    window.removeEventListener('pointermove', this.handleMarqueePointerMove)
    window.removeEventListener('pointerup', this.handleMarqueePointerUp)
    window.removeEventListener('pointercancel', this.handleMarqueePointerUp)
    this.stopMarqueeAutoScroll()

    if (this._isMarqueeActive) {
      this._justFinishedMarquee = true
      this.marqueeSelection = null
      this._isMarqueeActive = false
      this._marqueeDragStart = null

      this.dispatchEvent(
        new CustomEvent<BarSelectionChangeEventDetail>('bar-selection-change', {
          detail: {
            selectedIds: [...this.selectedTasks],
          },
          bubbles: true,
          composed: true,
        }),
      )

      setTimeout(() => {
        this._justFinishedMarquee = false
      }, 100)
    } else {
      this._marqueeDragStart = null
    }
  }

  private handleMarqueeAutoScroll(e: PointerEvent, containerRect: DOMRect, container: HTMLElement) {
    const scrollEdgeThreshold = 30
    const scrollSpeed = 10

    let scrollDx = 0
    let scrollDy = 0

    if (e.clientX < containerRect.left + this.currentRowHeaderWidth + scrollEdgeThreshold) {
      scrollDx = -scrollSpeed
    } else if (e.clientX > containerRect.right - scrollEdgeThreshold) {
      scrollDx = scrollSpeed
    }

    if (e.clientY < containerRect.top + this.calendarHeight + scrollEdgeThreshold) {
      scrollDy = -scrollSpeed
    } else if (e.clientY > containerRect.bottom - scrollEdgeThreshold) {
      scrollDy = scrollSpeed
    }

    if (scrollDx !== 0 || scrollDy !== 0) {
      if (this._marqueeAutoScrollInterval === null) {
        this._marqueeAutoScrollInterval = window.setInterval(() => {
          if (!this._isMarqueeActive) {
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

  private stopMarqueeAutoScroll() {
    if (this._marqueeAutoScrollInterval !== null) {
      window.clearInterval(this._marqueeAutoScrollInterval)
      this._marqueeAutoScrollInterval = null
    }
  }

  private handleContainerClick(e: MouseEvent) {
    if (this._justFinishedMarquee) {
      this._justFinishedMarquee = false
      return
    }
    // 行ヘッダーなどのクリックイベントが伝播してきた場合はここで処理しない
    // (gantt-row側でstopPropagationしているはずだが念のため)
    if (e.defaultPrevented) return

    this.clearSelection()
  }

  private handleContainerContextMenu(e: MouseEvent) {
    // 行ヘッダーなどの右クリックはここで処理しない
    if (e.defaultPrevented) return

    e.preventDefault()

    const container = this.shadowRoot?.querySelector('.scroll-container') as HTMLElement
    if (!container) return

    const rect = container.getBoundingClientRect()
    const scrollLeft = container.scrollLeft
    const scrollTop = container.scrollTop
    const labelWidth = this.currentRowHeaderWidth
    const yInRows = e.clientY - rect.top + scrollTop - this.calendarHeight

    const { layouts } = this.calculateLayout()
    let targetRowId: string | undefined

    for (let i = 0; i < layouts.length; i++) {
      const layout = layouts[i]
      if (yInRows >= layout.top && yInRows < layout.top + layout.height) {
        targetRowId = this.displayRows[i].id
        break
      }
    }

    if (targetRowId) {
      // X座標 -> 日時
      const x = e.clientX - rect.left + scrollLeft - labelWidth
      const pxPerDay = this.effectivePxPerDay
      const pxPerMonth = this.effectivePxPerMonth
      const date = xToDate(x, this.option.calendar.start, pxPerDay, pxPerMonth)

      this.dispatchEvent(
        new CustomEvent('chart-contextmenu', {
          detail: {
            event: e,
            date,
            rowId: targetRowId,
          },
          bubbles: true,
          composed: true,
        }),
      )
    }

    this.clearSelection()
  }

  /**
   * クライアント座標から対応する行IDと日付を返す。
   * コンポーネント外部から呼び出すための公開メソッド。
   */
  public hitTest(clientX: number, clientY: number): { rowId: string; date: Date } | null {
    const container = this.shadowRoot?.querySelector('.scroll-container') as HTMLElement
    if (!container) return null

    const rect = container.getBoundingClientRect()
    const scrollLeft = container.scrollLeft
    const scrollTop = container.scrollTop
    const labelWidth = this.currentRowHeaderWidth
    const yInRows = clientY - rect.top + scrollTop - this.calendarHeight

    const { layouts } = this.calculateLayout()
    let targetRowId: string | undefined

    for (let i = 0; i < layouts.length; i++) {
      const layout = layouts[i]
      if (yInRows >= layout.top && yInRows < layout.top + layout.height) {
        targetRowId = this.displayRows[i].id
        break
      }
    }

    if (!targetRowId) return null

    const x = clientX - rect.left + scrollLeft - labelWidth
    const pxPerDay = this.effectivePxPerDay
    const pxPerMonth = this.effectivePxPerMonth
    const date = xToDate(x, this.option.calendar.start, pxPerDay, pxPerMonth)

    return { rowId: targetRowId, date }
  }


  /**
   * 各行のY座標（カレンダーヘッダーを含まない、行領域の上端からの相対位置）
   * のレイアウト情報を取得します。
   */
  public getRowPositions(): { top: number; height: number; bottom: number }[] {
    const { layouts } = this.calculateLayout()
    return layouts.map((l) => ({
      top: l.top,
      height: l.height,
      bottom: l.top + l.height,
    }))
  }

  /**
   * html2canvas を使用してガントチャートを画像としてエクスポートする。
   * (Shadow DOMネイティブ対応版 html2canvas-pro を使用)
   *
   * @param options エクスポートオプション。
   */
  public async exportImage(format: 'png' | 'pdf' = 'png', options: ExportImageOptions = {}): Promise<string | Blob> {
    const scrollContainer = this._scrollContainer || (this.shadowRoot?.querySelector('.scroll-container') as HTMLElement | null)
    const prevScrollLeft = scrollContainer ? scrollContainer.scrollLeft : 0
    const prevScrollTop = scrollContainer ? scrollContainer.scrollTop : 0

    this.isExporting = true
    await this.updateComplete
    await new Promise(r => requestAnimationFrame(r))
    try {
      return await exportGanttWithHtml2Canvas(this, format, options)
    } finally {
      this.isExporting = false
      await this.updateComplete
      if (scrollContainer) {
        scrollContainer.scrollLeft = prevScrollLeft
        scrollContainer.scrollTop = prevScrollTop
      }
    }
  }

  // --- ズーム操作 ---

  /**
   * Ctrl/Cmd + マウスホイールによるズーム処理
   */
  private handleWheel = (e: WheelEvent) => {
    // Ctrl/Meta キーが押されていない場合は通常スクロール
    if (!e.ctrlKey && !e.metaKey) return
    // ズームが無効の場合は無視
    if (this.option.zoom?.enabled !== true) return

    e.preventDefault()

    const container = this._scrollContainer
    if (!container) return

    const rect = container.getBoundingClientRect()
    const labelWidth = this.currentRowHeaderWidth

    // マウス位置のコンテンツ内X座標（行ヘッダーを除く）
    const mouseContentX = e.clientX - rect.left + container.scrollLeft - labelWidth

    // 現在のズーム値
    const isMonthMode = this.effectivePxPerMonth !== undefined
    const currentScale = isMonthMode ? this.effectivePxPerMonth! : this.effectivePxPerDay

    // ズーム倍率計算
    const step = this.option.zoom?.step ?? 1.2
    const defaultMin = isMonthMode ? 20 : 2
    const defaultMax = isMonthMode ? 600 : 200
    const min = this.option.zoom?.min ?? defaultMin
    const max = this.option.zoom?.max ?? defaultMax

    // deltaY > 0 ならズームアウト（縮小）、< 0 ならズームイン（拡大）
    const factor = e.deltaY > 0 ? 1 / step : step
    const newScale = Math.max(min, Math.min(max, currentScale * factor))

    // 値が変わらなければ何もしない
    if (newScale === currentScale) return

    // ズーム値を先に更新（Litの再レンダリングをトリガー）
    if (isMonthMode) {
      this.zoomPxPerMonth = newScale
    } else {
      this.zoomPxPerDay = newScale
    }

    // 再レンダリング後にスクロール位置を補正
    // マウスカーソル位置の日付が画面上の同じ位置に留まるようにする
    const ratio = newScale / currentScale
    this.updateComplete.then(() => {
      const newMouseContentX = mouseContentX * ratio
      const scrollDelta = newMouseContentX - mouseContentX
      container.scrollLeft += scrollDelta
    })

    // イベント通知
    this.dispatchEvent(
      new CustomEvent<ZoomChangeEventDetail>('zoom-change', {
        detail: {
          pxPerDay: isMonthMode ? this.effectivePxPerDay : newScale,
          pxPerMonth: isMonthMode ? newScale : undefined,
        },
        bubbles: true,
        composed: true,
      }),
    )
  }

  /**
   * 指定した pxPerDay（または pxPerMonth）にズームを設定する。
   * @param value ズーム先の pxPerDay（月単位モード時は pxPerMonth）
   */
  public zoomTo(value: number): void {
    const isMonthMode = this.effectivePxPerMonth !== undefined
    const defaultMin = isMonthMode ? 20 : 2
    const defaultMax = isMonthMode ? 600 : 200
    const min = this.option.zoom?.min ?? defaultMin
    const max = this.option.zoom?.max ?? defaultMax
    const clamped = Math.max(min, Math.min(max, value))

    if (isMonthMode) {
      this.zoomPxPerMonth = clamped
    } else {
      this.zoomPxPerDay = clamped
    }

    this.dispatchEvent(
      new CustomEvent<ZoomChangeEventDetail>('zoom-change', {
        detail: {
          pxPerDay: isMonthMode ? this.effectivePxPerDay : clamped,
          pxPerMonth: isMonthMode ? clamped : undefined,
        },
        bubbles: true,
        composed: true,
      }),
    )
  }

  /**
   * 全タスクが表示領域に収まるようにズームレベルを自動調整する。
   */
  public zoomToFit(): void {
    const container = this.shadowRoot?.querySelector('.scroll-container') as HTMLElement
    if (!container) return

    // 全タスクの最小開始日・最大終了日を取得
    let minStart: Date | null = null
    let maxEnd: Date | null = null
    for (const row of this.displayRows) {
      for (const task of row.tasks) {
        if (!minStart || task.start < minStart) minStart = task.start
        if (!maxEnd || task.end > maxEnd) maxEnd = task.end
      }
    }

    if (!minStart || !maxEnd) return

    const labelWidth = this.currentRowHeaderWidth
    const availableWidth = container.clientWidth - labelWidth
    if (availableWidth <= 0) return

    const isMonthMode = this.effectivePxPerMonth !== undefined

    if (isMonthMode) {
      // 月数を計算
      const monthDiff =
        (maxEnd.getFullYear() - minStart.getFullYear()) * 12 + (maxEnd.getMonth() - minStart.getMonth())
      const totalMonths = Math.max(1, monthDiff)
      const targetPxPerMonth = availableWidth / totalMonths
      this.zoomTo(targetPxPerMonth)
    } else {
      // 日数を計算
      const diffMs = maxEnd.getTime() - minStart.getTime()
      const totalDays = Math.max(1, diffMs / (1000 * 60 * 60 * 24))
      const targetPxPerDay = availableWidth / totalDays
      this.zoomTo(targetPxPerDay)
    }

    // タスク開始位置にスクロール
    requestAnimationFrame(() => {
      const startX = this.getDateX(minStart!) + labelWidth
      container.scrollLeft = Math.max(0, startX - 10)
    })
  }

  /**
   * ズームをリセットし、option で設定された元のスケールに戻す。
   */
  public resetZoom(): void {
    const wasZoomed = this.zoomPxPerDay !== null || this.zoomPxPerMonth !== null
    this.zoomPxPerDay = null
    this.zoomPxPerMonth = null

    if (wasZoomed) {
      const isMonthMode = this.option.calendar.pxPerMonth !== undefined
      this.dispatchEvent(
        new CustomEvent<ZoomChangeEventDetail>('zoom-change', {
          detail: {
            pxPerDay: this.option.calendar.pxPerDay ?? 50,
            pxPerMonth: isMonthMode ? this.option.calendar.pxPerMonth : undefined,
          },
          bubbles: true,
          composed: true,
        }),
      )
    }
  }

  private clearSelection() {
    if (this.selectedRows.size === 0 && this.selectedTasks.size === 0) return

    if (this.selectedRows.size > 0) {
      this.selectedRows = new Set()
      this.dispatchEvent(
        new CustomEvent<RowSelectionChangeEventDetail>('row-selection-change', {
          detail: {
            selectedIds: [],
          },
          bubbles: true,
          composed: true,
        }),
      )
    }

    if (this.selectedTasks.size > 0) {
      this.selectedTasks = new Set()
      this.dispatchEvent(
        new CustomEvent<BarSelectionChangeEventDetail>('bar-selection-change', {
          detail: {
            selectedIds: [],
          },
          bubbles: true,
          composed: true,
        }),
      )
    }
  }

  // --- キーボード操作 ---

  private handleKeyDown = (e: KeyboardEvent) => {
    // キーボード操作が無効化されている場合はスキップ
    if (this.option.keyboard?.enabled === false) return

    // 入力要素にフォーカスがある場合はスキップ
    const composedPath = e.composedPath()
    const target = composedPath[0] as HTMLElement
    if (target !== this && target?.tagName && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return

    switch (e.key) {
      case 'ArrowRight':
        if (e.shiftKey && !this.option.readOnly) {
          this.moveSelectedTasksByKeyboard(1)
        } else {
          this.moveFocusHorizontal(1)
        }
        e.preventDefault()
        break

      case 'ArrowLeft':
        if (e.shiftKey && !this.option.readOnly) {
          this.moveSelectedTasksByKeyboard(-1)
        } else {
          this.moveFocusHorizontal(-1)
        }
        e.preventDefault()
        break

      case 'ArrowDown':
        this.moveFocusVertical(1)
        e.preventDefault()
        break

      case 'ArrowUp':
        this.moveFocusVertical(-1)
        e.preventDefault()
        break

      case 'Enter':
      case ' ':
        if (this.focusedTaskId) {
          if (e.ctrlKey || e.metaKey) {
            this.toggleTaskSelection(this.focusedTaskId)
          } else {
            this.selectSingleTask(this.focusedTaskId)
          }
        }
        e.preventDefault()
        break

      case 'Escape':
        this.clearSelection()
        this.focusedTaskId = null
        this.focusedRowId = null
        break

      case 'Delete':
      case 'Backspace':
        if (!this.option.readOnly && this.selectedTasks.size > 0) {
          this.dispatchEvent(
            new CustomEvent<TaskDeleteEventDetail>('task-delete', {
              detail: {
                taskIds: [...this.selectedTasks],
                event: e,
              },
              bubbles: true,
              composed: true,
            }),
          )
        }
        e.preventDefault()
        break

      case 'Home':
        this.focusFirstOrLastTaskInRow('first')
        e.preventDefault()
        break

      case 'End':
        this.focusFirstOrLastTaskInRow('last')
        e.preventDefault()
        break
    }
  }

  /**
   * 水平方向にフォーカスを移動する（同一行内のタスク間、または次/前行へ）
   */
  private moveFocusHorizontal(direction: 1 | -1) {
    const rows = this.displayRows
    if (rows.length === 0) return

    // フォーカスがない場合は最初のタスクにフォーカス
    if (!this.focusedTaskId || !this.focusedRowId) {
      this.focusFirstAvailableTask()
      return
    }

    const rowIndex = rows.findIndex((r) => r.id === this.focusedRowId)
    if (rowIndex === -1) {
      this.focusFirstAvailableTask()
      return
    }

    const row = rows[rowIndex]
    const sortedTasks = [...row.tasks].sort((a, b) => a.start.getTime() - b.start.getTime())
    const taskIndex = sortedTasks.findIndex((t) => t.id === this.focusedTaskId)

    if (taskIndex === -1) {
      // フォーカス中のタスクがこの行にない（データが変わった等）
      if (sortedTasks.length > 0) {
        this.setFocus(sortedTasks[0].id, row.id)
      }
      return
    }

    const nextIndex = taskIndex + direction
    if (nextIndex >= 0 && nextIndex < sortedTasks.length) {
      // 同一行内で移動
      this.setFocus(sortedTasks[nextIndex].id, row.id)
    } else {
      // 次/前の行に移動
      this.moveFocusVertical(direction)
    }
  }

  /**
   * 垂直方向にフォーカスを移動する（行をまたぐ）
   */
  private moveFocusVertical(direction: 1 | -1) {
    const rows = this.displayRows
    if (rows.length === 0) return

    if (!this.focusedTaskId || !this.focusedRowId) {
      this.focusFirstAvailableTask()
      return
    }

    const currentRowIndex = rows.findIndex((r) => r.id === this.focusedRowId)
    if (currentRowIndex === -1) {
      this.focusFirstAvailableTask()
      return
    }

    // タスクがある行を探す
    for (let i = currentRowIndex + direction; i >= 0 && i < rows.length; i += direction) {
      const row = rows[i]
      if (row.tasks.length > 0) {
        const sortedTasks = [...row.tasks].sort((a, b) => a.start.getTime() - b.start.getTime())
        const targetTask = direction > 0 ? sortedTasks[0] : sortedTasks[sortedTasks.length - 1]
        this.setFocus(targetTask.id, row.id)
        return
      }
    }
  }

  /**
   * 最初にタスクを持つ行の最初のタスクにフォーカスする
   */
  private focusFirstAvailableTask() {
    for (const row of this.displayRows) {
      if (row.tasks.length > 0) {
        const sortedTasks = [...row.tasks].sort((a, b) => a.start.getTime() - b.start.getTime())
        this.setFocus(sortedTasks[0].id, row.id)
        return
      }
    }
  }

  /**
   * 現在の行の最初または最後のタスクにフォーカスする
   */
  private focusFirstOrLastTaskInRow(position: 'first' | 'last') {
    if (!this.focusedRowId) {
      this.focusFirstAvailableTask()
      return
    }

    const row = this.displayRows.find((r) => r.id === this.focusedRowId)
    if (!row || row.tasks.length === 0) return

    const sortedTasks = [...row.tasks].sort((a, b) => a.start.getTime() - b.start.getTime())
    const target = position === 'first' ? sortedTasks[0] : sortedTasks[sortedTasks.length - 1]
    this.setFocus(target.id, row.id)
  }

  /**
   * フォーカスを設定し、必要に応じてスクロールする
   */
  private setFocus(taskId: string, rowId: string) {
    this.focusedTaskId = taskId
    this.focusedRowId = rowId
    this.scrollToTask(taskId)
  }

  /**
   * タスクの選択をトグルする（Ctrl/Cmd+Enter）
   */
  private toggleTaskSelection(taskId: string) {
    const newSelectedTasks = new Set(this.selectedTasks)
    if (newSelectedTasks.has(taskId)) {
      newSelectedTasks.delete(taskId)
    } else {
      newSelectedTasks.add(taskId)
    }
    this.selectedTasks = newSelectedTasks
    this.dispatchEvent(
      new CustomEvent<BarSelectionChangeEventDetail>('bar-selection-change', {
        detail: { selectedIds: [...newSelectedTasks] },
        bubbles: true,
        composed: true,
      }),
    )
  }

  /**
   * 単一タスクを選択する（Enter/Space）
   */
  private selectSingleTask(taskId: string) {
    this.selectedTasks = new Set([taskId])
    this.dispatchEvent(
      new CustomEvent<BarSelectionChangeEventDetail>('bar-selection-change', {
        detail: { selectedIds: [taskId] },
        bubbles: true,
        composed: true,
      }),
    )
  }

  /**
   * Shift+矢印キーで選択中タスクを移動する
   */
  private moveSelectedTasksByKeyboard(direction: 1 | -1) {
    if (this.selectedTasks.size === 0) return

    const moveStep = this.option.keyboard?.moveStep ?? this.option.snapDuration ?? 1440
    const moveMs = moveStep * 60 * 1000 * direction

    const newRows = this.rows.map((row) => {
      const hasSelectedTask = row.tasks.some((t) => this.selectedTasks.has(t.id))
      if (!hasSelectedTask) return row

      return {
        ...row,
        tasks: row.tasks.map((t) => {
          if (!this.selectedTasks.has(t.id)) return t
          return {
            ...t,
            start: new Date(t.start.getTime() + moveMs),
            end: new Date(t.end.getTime() + moveMs),
          }
        }),
      }
    })

    // 各選択タスクについて task-update イベントを発火
    for (const row of this.rows) {
      for (const task of row.tasks) {
        if (!this.selectedTasks.has(task.id)) continue
        const newStart = new Date(task.start.getTime() + moveMs)
        const newEnd = new Date(task.end.getTime() + moveMs)
        this.dispatchEvent(
          new CustomEvent('task-update', {
            detail: {
              id: task.id,
              name: task.name,
              start: newStart,
              end: newEnd,
              dx: 0,
              dy: 0,
              isDragging: false,
              mode: 'move' as GanttTaskMoveMode,
              targetRowId: row.id,
            },
            bubbles: true,
            composed: true,
          }),
        )
      }
    }

    this.rows = newRows
    this.dispatchEvent(
      new CustomEvent('rows-change', {
        detail: this.rows,
        bubbles: true,
        composed: true,
      }),
    )
  }

  private handleBarClick(e: CustomEvent<{ task: GanttTask; event: MouseEvent; isMultiSelect: boolean }>) {
    e.stopPropagation()
    const { task, isMultiSelect } = e.detail

    // ドラッグ操作がなかった（クリック扱い）場合でも、ドラッグ関連の状態をクリーンアップ
    this.draggingTask = null
    this.dragTargetRowIndex = null
    if (this.dragOverlayInfo) {
      this.dragOverlayInfo = { ...this.dragOverlayInfo, visible: false }
      this.hideDragOverlay()
    }

    let newSelectedTasks: Set<string>

    if (isMultiSelect) {
      // Ctrl/Cmd+クリック: トグル選択
      newSelectedTasks = new Set(this.selectedTasks)
      if (newSelectedTasks.has(task.id)) {
        newSelectedTasks.delete(task.id)
      } else {
        newSelectedTasks.add(task.id)
      }
    } else {
      // 通常クリック: 単一選択
      newSelectedTasks = new Set([task.id])
    }

    this.selectedTasks = newSelectedTasks

    this.dispatchEvent(
      new CustomEvent<BarSelectionChangeEventDetail>('bar-selection-change', {
        detail: {
          selectedIds: [...newSelectedTasks],
        },
        bubbles: true,
        composed: true,
      }),
    )
  }

  private handleBarContextMenu(e: CustomEvent<{ task: GanttTask; event: MouseEvent }>) {
    const { task } = e.detail

    // 選択済みバーの右クリックは選択を保持
    if (this.selectedTasks.has(task.id)) {
      return
    }

    // 未選択バーの右クリックは単一選択に切り替え
    this.selectedTasks = new Set([task.id])
    this.dispatchEvent(
      new CustomEvent<BarSelectionChangeEventDetail>('bar-selection-change', {
        detail: {
          selectedIds: [task.id],
        },
        bubbles: true,
        composed: true,
      }),
    )
  }

  // --- コネクタードラッグ管理 ---

  private handleConnectorDragStart(e: CustomEvent) {
    const { taskId, endpoint, clientX, clientY } = e.detail
    e.stopPropagation()

    const { taskCoords } = this.calculateLayout()
    const coord = taskCoords.get(taskId)
    if (coord?.isSummary) return

    const labelWidth = this.currentRowHeaderWidth
    let startX = e.detail.startX + labelWidth
    let startY = e.detail.startY

    if (coord) {
      startX = endpoint === 'start' ? coord.x : coord.x + coord.width
      startY = coord.y + coord.height / 2
    }

    this.connectorDrag = {
      sourceTaskId: taskId,
      sourceEndpoint: endpoint,
      startX,
      startY,
      currentClientX: clientX,
      currentClientY: clientY,
      targetTaskId: null,
      targetEndpoint: null,
    }

    // ツールチップを消す
    if (this.tooltip) {
      this.tooltip = null
    }
  }

  private handleConnectorDragMove(e: CustomEvent) {
    if (!this.connectorDrag) return
    e.stopPropagation()

    const { clientX, clientY } = e.detail

    // マウス座標 -> コンテンツ内座標
    const container = this.shadowRoot?.querySelector('.scroll-container') as HTMLElement
    if (!container) return

    const rect = container.getBoundingClientRect()
    const contentX = clientX - rect.left + container.scrollLeft
    const contentY = clientY - rect.top + container.scrollTop - this.calendarHeight

    // ターゲットタスクの検出
    const { taskCoords } = this.calculateLayout()
    let closestTaskId: string | null = null
    let closestEndpoint: DependencyEndpoint | null = null
    let minDist = 30 // スナップ閾値（px）

    for (const [taskId, coord] of taskCoords) {
      if (taskId === this.connectorDrag.sourceTaskId) continue
      if (coord.isSummary) continue

      // バーの左端（start）と右端（end）それぞれの距離を計算
      const centerY = coord.y + coord.height / 2
      const leftX = coord.x
      const rightX = coord.x + coord.width

      const distLeft = Math.sqrt((contentX - leftX) ** 2 + (contentY - centerY) ** 2)
      const distRight = Math.sqrt((contentX - rightX) ** 2 + (contentY - centerY) ** 2)

      if (distLeft < minDist) {
        minDist = distLeft
        closestTaskId = taskId
        closestEndpoint = 'start'
      }
      if (distRight < minDist) {
        minDist = distRight
        closestTaskId = taskId
        closestEndpoint = 'end'
      }
    }

    // gantt-bar 要素の connectorDropTarget 属性を更新
    const prevTargetId = this.connectorDrag.targetTaskId
    if (prevTargetId !== closestTaskId) {
      // 前のターゲットのハイライトを解除
      if (prevTargetId) {
        this._setConnectorDropTarget(prevTargetId, false)
      }
      // 新しいターゲットをハイライト
      if (closestTaskId) {
        this._setConnectorDropTarget(closestTaskId, true)
      }
    }

    this.connectorDrag = {
      ...this.connectorDrag,
      currentClientX: clientX,
      currentClientY: clientY,
      targetTaskId: closestTaskId,
      targetEndpoint: closestEndpoint,
    }
  }

  private handleConnectorDragEnd(e: CustomEvent) {
    if (!this.connectorDrag) return
    e.stopPropagation()

    const { cancelled } = e.detail
    const { sourceTaskId, sourceEndpoint, targetTaskId, targetEndpoint } = this.connectorDrag

    // ターゲットのハイライトを解除
    if (targetTaskId) {
      this._setConnectorDropTarget(targetTaskId, false)
    }

    if (!cancelled && targetTaskId && targetEndpoint) {
      const { taskCoords } = this.calculateLayout()
      const sourceCoord = taskCoords.get(sourceTaskId)
      const targetCoord = taskCoords.get(targetTaskId)
      if (!sourceCoord?.isSummary && !targetCoord?.isSummary) {
        // 依存関係作成イベントを発火
        this.dispatchEvent(
          new CustomEvent<DependencyCreateEventDetail>('dependency-create', {
            detail: {
              sourceTaskId,
              sourceEndpoint,
              targetTaskId,
              targetEndpoint,
            },
            bubbles: true,
            composed: true,
          }),
        )
      }
    }

    this.connectorDrag = null
  }

  /**
   * 指定タスクIDのgantt-bar要素にconnectorDropTarget属性をセットする
   */
  private _setConnectorDropTarget(taskId: string, value: boolean) {
    const rows = this.shadowRoot?.querySelectorAll('gantt-row')
    if (!rows) return
    for (const row of rows) {
      const bars = (row as any).shadowRoot?.querySelectorAll('gantt-bar')
      if (!bars) continue
      for (const bar of bars) {
        if ((bar as any).task?.id === taskId) {
          ; (bar as any).connectorDropTarget = value
          return
        }
      }
    }
  }

  /**
   * 依存関係線がクリックされた時のハンドラ。
   * dependency-removeイベントを発火する。
   * @param targetTaskId 依存を持つタスクのID（矢印の先）
   * @param sourceTaskId 依存元のタスクのID（矢印の根元）
   */
  private handleDependencyLineClick(event: MouseEvent, targetTaskId: string, sourceTaskId: string) {
    this.dispatchEvent(
      new CustomEvent<DependencyClickEventDetail>('dependency-click', {
        detail: {
          event,
          sourceTaskId,
          targetTaskId,
        },
        bubbles: true,
        composed: true,
      }),
    )
  }


  /**
   * 外部からタスクIDを指定してタスクを選択状態にし、
   * 表示範囲外の場合はスクロールして表示する。
   * @param taskId 選択するタスクのID
   * @returns タスクが見つかり選択できた場合はtrue、見つからなかった場合はfalse
   */
  public selectTask(taskId: string): boolean {
    // タスクの存在確認
    let found = false
    for (const row of this.displayRows) {
      if (row.tasks.some((t) => t.id === taskId)) {
        found = true
        break
      }
    }
    if (!found) return false

    // 選択状態の更新
    this.selectedTasks = new Set([taskId])
    this.dispatchEvent(
      new CustomEvent<BarSelectionChangeEventDetail>('bar-selection-change', {
        detail: { selectedIds: [taskId] },
        bubbles: true,
        composed: true,
      }),
    )

    // スクロール位置の調整
    this.scrollToTask(taskId)
    return true
  }

  private handleRowToggleCollapse(e: CustomEvent<RowToggleCollapseEventDetail>) {
    const { rowId, collapsed } = e.detail
    this.toggleRowCollapse(rowId, collapsed)
  }

  /**
   * 指定した行の折りたたみ状態を切り替えます。
   *
   * @param rowId 対象の行ID
   * @param collapsed 設定する折りたたみ状態（省略時は現在の状態を反転）
   * @returns 切り替えに成功した場合はtrue、行が見つからない場合はfalse
   */
  public toggleRowCollapse(rowId: string, collapsed?: boolean): boolean {
    const targetRow = this.rows.find((r) => r.id === rowId)
    if (!targetRow) return false

    const newCollapsed = collapsed !== undefined ? collapsed : !this._collapsedRowIds.has(rowId)

    if (newCollapsed) {
      this._collapsedRowIds.add(rowId)
    } else {
      this._collapsedRowIds.delete(rowId)
    }
    this._prevExternalCollapsed.set(rowId, newCollapsed)

    this.rows = this.rows.map((r) =>
      r.id === rowId ? { ...r, collapsed: newCollapsed } : r,
    )

    this.dispatchEvent(
      new CustomEvent<RowToggleCollapseEventDetail>('row-toggle-collapse', {
        detail: {
          rowId,
          collapsed: newCollapsed,
          row: this.rows.find((r) => r.id === rowId) ?? targetRow,
        },
        bubbles: true,
        composed: true,
      }),
    )

    this.dispatchEvent(
      new CustomEvent<GanttRow[]>('rows-change', {
        detail: this.rows,
        bubbles: true,
        composed: true,
      }),
    )

    this.requestUpdate()
    return true
  }

  /**
   * 子行を持つすべての親行を折りたたみます。
   */
  public collapseAll(): void {
    const rowsWithChildren = new Set<string>()
    for (const r of this.rows) {
      if (r.parentId) rowsWithChildren.add(r.parentId)
    }

    for (const id of rowsWithChildren) {
      this._collapsedRowIds.add(id)
      this._prevExternalCollapsed.set(id, true)
    }

    this.rows = this.rows.map((r) =>
      rowsWithChildren.has(r.id) ? { ...r, collapsed: true } : r,
    )

    this.dispatchEvent(
      new CustomEvent<GanttRow[]>('rows-change', {
        detail: this.rows,
        bubbles: true,
        composed: true,
      }),
    )

    this.requestUpdate()
  }

  /**
   * すべての行を展開（折りたたみ解除）します。
   */
  public expandAll(): void {
    for (const id of this._collapsedRowIds) {
      this._prevExternalCollapsed.set(id, false)
    }
    this._collapsedRowIds.clear()

    this.rows = this.rows.map((r) =>
      r.collapsed ? { ...r, collapsed: false } : r,
    )

    this.dispatchEvent(
      new CustomEvent<GanttRow[]>('rows-change', {
        detail: this.rows,
        bubbles: true,
        composed: true,
      }),
    )

    this.requestUpdate()
  }

  /**
   * スクロール位置を左上（0, 0）にリセットします。
   */
  public resetScroll(): void {
    const container = this._scrollContainer ?? (this.shadowRoot?.querySelector('.scroll-container') as HTMLElement | null)
    if (container) {
      container.scrollLeft = 0
      container.scrollTop = 0
    }
    this.currentScrollLeft = 0
    this.currentScrollTop = 0
    this.virtualScrollTop = 0
    this.requestUpdate()
  }

  /**
   * 指定したスクロール位置に移動します。
   */
  public scrollToPosition(options: { left?: number; top?: number; behavior?: ScrollBehavior }): void {
    const container = this._scrollContainer ?? (this.shadowRoot?.querySelector('.scroll-container') as HTMLElement | null)
    if (container) {
      container.scrollTo({
        left: options.left,
        top: options.top,
        behavior: options.behavior ?? 'auto',
      })
      if (options.left !== undefined) {
        this.currentScrollLeft = options.left
      }
      if (options.top !== undefined) {
        this.currentScrollTop = options.top
        this.virtualScrollTop = options.top
      }
      this.requestUpdate()
    }
  }

  /**
   * 指定タスクが表示範囲外の場合にスクロールして表示する
   */
  private scrollToTask(taskId: string): void {
    const { taskCoords } = this.calculateLayout()
    const coords = taskCoords.get(taskId)
    if (!coords) return

    const container = this.shadowRoot?.querySelector('.scroll-container') as HTMLElement
    if (!container) return

    const labelWidth = this.currentRowHeaderWidth

    // 縦スクロール: カレンダーヘッダー分を考慮
    const taskTopInContent = coords.y + this.calendarHeight
    const taskBottomInContent = taskTopInContent + coords.height
    const visibleTop = container.scrollTop
    const visibleBottom = container.scrollTop + container.clientHeight

    if (taskTopInContent < visibleTop || taskBottomInContent > visibleBottom) {
      const targetScrollTop = taskTopInContent - container.clientHeight / 2 + coords.height / 2
      container.scrollTo({ top: Math.max(0, targetScrollTop), behavior: 'smooth' })
    }

    // 横スクロール: 行ヘッダー幅を考慮
    const taskLeftInContent = coords.x
    const taskRightInContent = coords.x + coords.width
    const visibleLeft = container.scrollLeft + labelWidth
    const visibleRight = container.scrollLeft + container.clientWidth

    if (taskLeftInContent < visibleLeft || taskRightInContent > visibleRight) {
      const targetScrollLeft = taskLeftInContent - labelWidth - 20
      container.scrollTo({ left: Math.max(0, targetScrollLeft), behavior: 'smooth' })
    }
  }

  render() {
    const colors = getThemeColors(this.theme, this.option.customTheme)

    const { layouts: rowLayouts, taskCoords, totalHeight } = this.calculateLayout()
    const labelWidth = this.currentRowHeaderWidth

    // currentOptionはoption参照、labelWidth、またはズーム値が変わった時だけ再生成
    // 毎回新オブジェクトを作ると全gantt-rowが再レンダリングされる
    if (
      this._lastOptionRef !== this.option ||
      this._lastLabelWidth !== labelWidth ||
      this._lastZoomPxPerDay !== this.zoomPxPerDay ||
      this._lastZoomPxPerMonth !== this.zoomPxPerMonth
    ) {
      this._cachedCurrentOption = {
        ...this.option,
        rowHeader: {
          ...this.option.rowHeader,
          width: labelWidth,
        },
        calendar: {
          ...this.option.calendar,
          pxPerDay: this.effectivePxPerDay,
          pxPerMonth: this.effectivePxPerMonth,
        },
      }
      this._lastOptionRef = this.option
      this._lastLabelWidth = labelWidth
      this._lastZoomPxPerDay = this.zoomPxPerDay
      this._lastZoomPxPerMonth = this.zoomPxPerMonth
    }
    const currentOption = this._cachedCurrentOption!

    const buffer = 5
    let startIndex = 0
    let endIndex = this.displayRows.length - 1

    if (!this.isExporting) {
      for (let i = 0; i < rowLayouts.length; i++) {
        if (rowLayouts[i].top + rowLayouts[i].height > this.virtualScrollTop) {
          startIndex = Math.max(0, i - buffer)
          break
        }
      }

      for (let i = startIndex; i < rowLayouts.length; i++) {
        if (rowLayouts[i].top > this.virtualScrollTop + this.viewportHeight) {
          endIndex = Math.min(this.displayRows.length - 1, i + buffer)
          break
        }
      }
    }

    const visibleRows = this.displayRows.slice(startIndex, endIndex + 1)
    const rowLevels = computeRowLevels(this.rows)
    const rowWbsCodes = computeRowWbsCodes(this.rows)
    const rowsWithChildren = new Set<string>()
    for (const r of this.rows) {
      if (r.parentId) rowsWithChildren.add(r.parentId)
    }
    const paddingTop = this.isExporting ? 0 : (rowLayouts[startIndex] ? rowLayouts[startIndex].top : 0)
    const lastVisibleRowLayout = rowLayouts[endIndex]
    const renderedBottom = lastVisibleRowLayout ? lastVisibleRowLayout.top + lastVisibleRowLayout.height : 0
    // Windowsの横スクロールバーの重なりを防ぎつつ、余分な余白を最小限にする（17px）
    const paddingBottom = Math.max(0, totalHeight - renderedBottom)

    // コンテンツの高さがビューポートより大きい場合のみ縦スクロールを有効にする
    // 横スクロールバーが表示される場合はその高さ分(17px)を差し引いて判定
    const needsVerticalScroll = totalHeight > this.viewportHeight

    // タスク間の接続線を描く
    const lines = []
    const isReadOnly = this.option.readOnly === true
    const showArrows = this.option.dependency?.showArrows !== false
    const arrowSize = this.option.dependency?.arrowSize ?? 8
    const lineStyle: DependencyLineStyle = this.option.dependency?.lineStyle ?? 'orthogonal'
    const cornerRadius = this.option.dependency?.cornerRadius ?? 8
    const showCriticalPath = this.option.dependency?.showCriticalPath === true
    const criticalPathTaskIds = showCriticalPath ? computeCriticalPath(this.displayRows) : new Set<string>()
    for (const [taskId, task] of taskCoords) {
      if (task.dependencies) {
        for (const depId of task.dependencies) {
          const depTask = taskCoords.get(depId)
          if (depTask) {
            const startX = depTask.x + depTask.width
            const startY = depTask.y + depTask.height / 2
            const endX = task.x
            const endY = task.y + task.height / 2
            // 前進方向か（ターゲットタスクが開始タスクより右側にあるか）
            const isForward = startX < endX
            // 矢印表示時は線の終端を矢印分だけ手前にする
            const rawAdjustedEndX = showArrows ? endX - arrowSize : endX
            // 前進方向の場合、パスの終端がstartXより左に行かないように制限する
            const adjustedEndX = isForward ? Math.max(startX, rawAdjustedEndX) : rawAdjustedEndX

            let pathD: string
            let hitPathD: string
            let arrowPathD: string

            const barHeight = this.option.bar?.height ?? DEFAULT_BAR_HEIGHT
            const barMargin = this.option.bar?.margin ?? DEFAULT_BAR_MARGIN

            const isSameRow = Math.abs(startY - endY) < 1

            if (isSameRow && isForward) {
              // 同じ行で前進方向（距離が近い場合も含む）、ループさせずに直線を引く
              pathD = adjustedEndX > startX ? `M ${startX} ${startY} L ${adjustedEndX} ${endY}` : ''
              hitPathD = endX > startX ? `M ${startX} ${startY} L ${endX} ${endY}` : ''
            } else if (lineStyle === 'orthogonal') {
              // 直角折れ線（角丸付き）
              const paths = buildOrthogonalPath(startX, startY, endX, endY, adjustedEndX, barHeight, barMargin, cornerRadius)
              pathD = paths.pathD
              hitPathD = paths.hitPathD
            } else {
              // ベジェ曲線
              if (isForward) {
                // 前進方向: シンプルなベジェ曲線
                const midX = (startX + adjustedEndX) / 2
                pathD = `M ${startX} ${startY} C ${midX} ${startY} ${midX} ${endY} ${adjustedEndX} ${endY}`
                hitPathD = `M ${startX} ${startY} C ${(startX + endX) / 2} ${startY} ${(startX + endX) / 2} ${endY} ${endX} ${endY}`
              } else {
                // 後退方向: S字カーブ
                const offset = Math.max(12, (startX - endX) * 0.15)
                const midY = (startY + endY) / 2
                const effectiveMidY = Math.abs(startY - endY) < barHeight
                  ? midY + barHeight + barMargin
                  : midY

                pathD = `M ${startX} ${startY} C ${startX + offset} ${startY}, ${startX + offset} ${effectiveMidY}, ${(startX + adjustedEndX) / 2} ${effectiveMidY} S ${adjustedEndX - offset} ${endY}, ${adjustedEndX} ${endY}`
                hitPathD = `M ${startX} ${startY} C ${startX + offset} ${startY}, ${startX + offset} ${effectiveMidY}, ${(startX + endX) / 2} ${effectiveMidY} S ${endX - offset} ${endY}, ${endX} ${endY}`
              }
            }

            // 矢印用の直線パス（マーカーが正しい方向を向くように）
            arrowPathD = showArrows
              ? `M ${adjustedEndX} ${endY} L ${endX} ${endY}`
              : ''

            lines.push(
              svg`<g class="dependency-group">
                ${!isReadOnly
                  ? svg`<path class="dependency-hit-area" d="${hitPathD}" @click="${(e: MouseEvent) => {
                    e.stopPropagation()
                    this.handleDependencyLineClick(e, taskId, depId)
                  }}" />`
                  : ''}
                <path class="dependency-line ${showCriticalPath && criticalPathTaskIds.has(taskId) && criticalPathTaskIds.has(depId) ? 'critical-path' : ''}" d="${pathD}" />
                ${showArrows
                  ? svg`<path class="dependency-line dependency-arrow-line ${showCriticalPath && criticalPathTaskIds.has(taskId) && criticalPathTaskIds.has(depId) ? 'critical-path' : ''}" d="${arrowPathD}" marker-end="url(#dependency-arrowhead)" />`
                  : ''}
              </g>`,
            )
          }
        }
      }
    }

    // コネクタードラッグ中のプレビュー線
    let connectorPreviewLine = null
    if (this.connectorDrag) {
      const container = this.shadowRoot?.querySelector('.scroll-container') as HTMLElement
      if (container) {
        const rect = container.getBoundingClientRect()
        const srcStartX = this.connectorDrag.startX
        const srcStartY = this.connectorDrag.startY

        let endContentX: number
        let endContentY: number

        if (this.connectorDrag.targetTaskId && this.connectorDrag.targetEndpoint) {
          // ターゲットにスナップ
          const targetCoord = taskCoords.get(this.connectorDrag.targetTaskId)
          if (targetCoord) {
            endContentX = this.connectorDrag.targetEndpoint === 'start'
              ? targetCoord.x
              : targetCoord.x + targetCoord.width
            endContentY = targetCoord.y + targetCoord.height / 2
          } else {
            endContentX = this.connectorDrag.currentClientX - rect.left + container.scrollLeft
            endContentY = this.connectorDrag.currentClientY - rect.top + container.scrollTop - this.calendarHeight
          }
        } else {
          // フリー
          endContentX = this.connectorDrag.currentClientX - rect.left + container.scrollLeft
          endContentY = this.connectorDrag.currentClientY - rect.top + container.scrollTop - this.calendarHeight
        }

        const midPX = (srcStartX + endContentX) / 2
        connectorPreviewLine = svg`<path class="connector-preview-line" d="M ${srcStartX} ${srcStartY} C ${midPX} ${srcStartY} ${midPX} ${endContentY} ${endContentX} ${endContentY}" />`
      }
    }

    return html`
      <style>${buildDynamicStyles(this.theme, this.option.customTheme)}
        :host {
          --critical-path-color: ${colors.criticalPath ?? 'rgba(220, 38, 38, 0.85)'};
          ${this.option?.tree?.summaryColor ? `--moguchart-summary-bar-color: ${this.option.tree.summaryColor};` : ''}
          ${this.option?.fontScale !== undefined ? `--moguchart-font-scale: ${this.option.fontScale};` : ''}
        }
      </style>
      ${this.isExporting ? html`<style>:host { overflow: visible !important; height: ${this.calendarHeight + totalHeight + 2}px !important; width: max-content !important; min-width: auto !important; border-radius: 0 !important; border: none !important; }</style>` : ''}
      <div
        class="scroll-container"
        style="overflow-x: ${this.isExporting ? 'visible' : 'auto'}; overflow-y: ${this.isExporting ? 'visible' : (needsVerticalScroll ? 'auto' : 'hidden')}; height: ${this.isExporting ? 'auto' : '100%'}; width: ${this.isExporting ? 'max-content' : '100%'}; min-width: auto;"
        @scroll="${this.handleScroll}"
        @pointerdown="${this.handleContainerPointerDown}"
        @bar-mouseenter="${this.handleBarMouseEnter}"
        @bar-mouseleave="${this.handleBarMouseLeave}"
        @dragover="${this.handleContainerDragOver}"
        @dragleave="${this.handleContainerDragLeave}"
        @drop="${this.handleContainerDrop}"
        @click="${this.handleContainerClick}"
        @contextmenu="${this.handleContainerContextMenu}"
        @mousemove="${this.handleContainerMouseMove}"
        @mouseleave="${this.handleContainerMouseLeave}"
        @connector-drag-start="${this.handleConnectorDragStart}"
        @connector-drag-move="${this.handleConnectorDragMove}"
        @connector-drag-end="${this.handleConnectorDragEnd}"
      >
        ${this.option.rowHeader?.resizable !== false
        ? html`
              <div
                style="
                  position: sticky;
                  left: ${labelWidth - 2}px;
                  top: 0;
                  width: 0;
                  height: 0;
                  z-index: 510;
                  overflow: visible;
                "
              >
                <div
                  class="header-resizer ${this.isResizingHeader ? 'resizing' : ''}"
                  style="height: ${this.isExporting ? totalHeight : Math.max(totalHeight, this.viewportHeight)}px;"
                  @pointerdown="${this.handleHeaderResizeStart}"
                ></div>
              </div>
            `
        : ''}
        <gantt-calendar
          id="calendar"
          .option="${currentOption}"
          .theme="${this.theme}"
          .currentTime="${this.currentTime}"
          .isExporting="${this.isExporting}"
          .hoveredMilestoneId="${this.hoveredMilestoneId}"
          .cornerContent="${this.option.customRendering?.cornerContent}"
          .calendarMonthContent="${this.option.customRendering?.calendarMonthContent}"
          .calendarDayContent="${this.option.customRendering?.calendarDayContent}"
          .calendarWeekContent="${this.option.customRendering?.calendarWeekContent}"
          .calendarHourContent="${this.option.customRendering?.calendarHourContent}"
          @milestone-hover-change="${(e: CustomEvent) => {
        this.hoveredMilestoneId = e.detail.milestoneId
      }}"
        ></gantt-calendar>

        <svg
          class="dependency-lines"
          style="top: 0;"
          width="${this.getDateX(this.option.calendar.end) + labelWidth}"
          height="${totalHeight + this.calendarHeight}"
        >
          ${showArrows
        ? svg`<defs>
                <marker
                  id="dependency-arrowhead"
                  markerWidth="${arrowSize}"
                  markerHeight="${arrowSize}"
                  refX="${arrowSize}"
                  refY="${arrowSize / 2}"
                  orient="auto"
                  markerUnits="userSpaceOnUse"
                >
                  <polygon
                    points="0 0, ${arrowSize} ${arrowSize / 2}, 0 ${arrowSize}"
                    fill="${colors.dependencyLine}"
                    class="dependency-arrowhead-fill"
                  />
                </marker>
              </defs>`
        : ''}
          <g transform="translate(0, ${this.calendarHeight})">
            ${lines}
            ${connectorPreviewLine}
          </g>
        </svg>

        ${!this.isExporting &&
        this.option.calendar.showCurrentTime &&
        this.currentTime >= this.option.calendar.start &&
        this.currentTime <= this.option.calendar.end
        ? html`
              <div
                class="current-time-line"
                style="
                  top: ${this.calendarHeight}px;
                  left: ${this.getDateX(this.currentTime) + labelWidth}px;
                  height: ${totalHeight}px;
                  background-color: ${colors.currentTimeLine};
                "
              ></div>
              <div
                class="current-time-dot"
                style="
                  top: ${this.calendarHeight + 3}px;
                  left: ${this.getDateX(this.currentTime) + labelWidth + 1}px;
                  background-color: ${colors.currentTimeLine};
                "
              ></div>
            `
        : ''}
        ${(this.option.calendar.milestones ?? []).map(
          (ms) => html`
            <div
              class="milestone-line ${this.hoveredMilestoneId === ms.id ? 'milestone-hovered' : ''}"
              style="
                top: ${this.calendarHeight}px;
                left: ${this.getDateX(ms.start) + labelWidth}px;
                height: ${totalHeight}px;
                width: ${ms.width ?? 2}px;
                background-color: ${ms.color};
                opacity: ${this.hoveredMilestoneId === ms.id ? 1 : 0.5};
                ${ms.style ?? ''}
              "
              @mouseenter="${() => {
              this.hoveredMilestoneId = ms.id
            }}"
              @mouseleave="${() => {
              this.hoveredMilestoneId = null
            }}"
            ></div>
          `,
        )}
        ${this.option.calendar.showCursorLine && this.cursorLineX !== null
        ? html`
              <div
                class="cursor-line"
                style="
                  left: ${this.cursorLineX}px;
                  height: ${this.calendarHeight + (this.isExporting ? totalHeight : (totalHeight || this.viewportHeight))}px;
                  background-color: ${this.option.calendar.cursorLineColor ?? colors.currentTimeLine};
                "
              ></div>
            `
        : ''}

        <div style="height: ${paddingTop}px; width: 1px;"></div>

        ${repeat(
          visibleRows,
          (row) => row.id,
          (row, index) => {
            const originalIndex = startIndex + index
            return html`
              <gantt-row
                .row="${row}"
                .option="${currentOption}"
                .level="${rowLevels.get(row.id) ?? 0}"
                .hasChildren="${rowsWithChildren.has(row.id)}"
                .wbsCode="${rowWbsCodes.get(row.id) ?? ''}"
                .isSelected="${this.selectedRows.has(row.id)}"
                .isDragTarget="${this.dragTargetRowIndex === originalIndex ||
              (this.dragOverRowId === row.id && this.dragOverPosition === null)}"
                .draggingTask="${this.draggingTask}"
                .draggingTaskIds="${this.draggingTaskIds}"
                .multiDragDx="${this.multiDragDx}"
                .multiDragDy="${this.multiDragDy}"
                .multiDragSameRow="${this.multiDragSameRow}"
                .theme="${this.theme}"
                .dropPosition="${this.dragOverRowId === row.id ? this.dragOverPosition : null}"
                .externalDragTask="${this.dragPreview?.rowId === row.id ? this.dragPreview : null}"
                .selectedTaskIds="${this._cachedSelectedTaskIds}"
                .focusedTaskId="${this.focusedTaskId}"
                .isExporting="${this.isExporting}"
                .criticalPathTaskIds="${showCriticalPath ? [...criticalPathTaskIds] : []}"
                @task-update="${this.handleTaskUpdate}"
                @row-clicked="${this.handleRowClicked}"
                @row-header-contextmenu="${this.handleRowContextMenu}"
                @row-toggle-collapse="${this.handleRowToggleCollapse}"
                @row-dragstart="${this.handleRowDragStart}"
                @row-dragend="${this.handleRowDragEnd}"
                @bar-click="${this.handleBarClick}"
                @task-contextmenu="${this.handleBarContextMenu}"
              />
            `
          },
        )}

        <div style="height: ${paddingBottom}px; width: 1px;"></div>

        ${this.marqueeSelection && this.marqueeSelection.active
          ? html`
              <div
                class="marquee-selection-box"
                style="
                  left: ${Math.min(this.marqueeSelection.startX, this.marqueeSelection.currentX)}px;
                  top: ${this.calendarHeight + Math.min(this.marqueeSelection.startY, this.marqueeSelection.currentY)}px;
                  width: ${Math.abs(this.marqueeSelection.currentX - this.marqueeSelection.startX)}px;
                  height: ${Math.abs(this.marqueeSelection.currentY - this.marqueeSelection.startY)}px;
                  ${this.option?.selection?.borderColor ? `border-color: ${this.option.selection.borderColor};` : ''}
                  ${this.option?.selection?.backgroundColor ? `background-color: ${this.option.selection.backgroundColor};` : ''}
                "
              ></div>
            `
          : ''}
      </div>

      ${this.option.showDragInfoOverlay !== false ? html` <div class="drag-info-overlay"></div> ` : ''}
      ${this.tooltip
        ? html`
            <div
              class="tooltip ${this.tooltip.visible ? 'visible' : ''} ${this.tooltip.below ? 'below' : ''}"
              style="top: ${this.tooltip.below ? this.tooltip.barBottom : this.tooltip.y}px; left: ${this.tooltip.x}px;"
            />
          `
        : ''}
      ${!this.isExporting && this.option.minimap?.enabled === true
        ? html`
            <gantt-minimap
              .rows="${this.displayRows}"
              .option="${currentOption}"
              .theme="${this.theme}"
              .scrollLeft="${this.currentScrollLeft}"
              .scrollTop="${this.currentScrollTop}"
              .viewportWidth="${Math.max(0, this.viewportWidth - labelWidth)}"
              .viewportHeight="${this.viewportHeight}"
              .contentWidth="${this.getDateX(this.option.calendar.end)}"
              .contentHeight="${totalHeight + this.calendarHeight}"
              .calendarHeight="${this.calendarHeight}"
              .rowHeaderWidth="${0}"
              .currentTime="${this.currentTime}"
              @minimap-scroll="${this.handleMinimapScroll}"
            ></gantt-minimap>
          `
        : ''}
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gantt-chart': GanttChartElement
  }
}

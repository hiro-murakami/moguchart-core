import {
  DEFAULT_BAR_MARGIN,
  DEFAULT_ROW_HEADER_WIDTH,
} from '../core/constants'
import type {
  BarHoverEventDetail,
  BarSelectionChangeEventDetail,
  GanttChartOption,
  GanttChartOptionZoom,
  GanttRow,
  GanttTask,
  GanttTaskMoveMode,
  RowSelectionChangeEventDetail,
  RowToggleCollapseEventDetail,
  TaskUpdateEventDetail,
  TaskProgressChangeEventDetail,
  TaskDeadlineChangeEventDetail,
  CommandEventDetail,
  HistoryChangeEventDetail,
  GanttColumn,
  ColumnResizeEventDetail,
  ColumnReorderEventDetail,
  ColumnSortEventDetail,
  GridSortDirection,
  GridSortState,
  GridCellRange,
  CalendarRangeChangeEventDetail,
  GanttOverlayRenderContext,
  GanttViewportState,
  GanttDependency,
  GridCellNavigationDirection,
  DependencyType,
  DependencyUpdateInput,
} from '../core/types'
import { jaLocale } from '../core/i18n'
import type { GanttFilterConfig, GanttFilterResult } from '../core/filter'
import { HistoryManager, type GanttCommand, type GanttCommandType } from '../core/history'
import {
  calculateGridFooterSummary,
  getGridFooterCellValue,
  formatGridFooterCellValue,
  isGridColumnPinned,
  partitionGridColumns,
  resolveGridCellRange,
} from '../core/grid'
import {
  calculateTaskLanes,
  getThemeColors,
  dateToX,
  xToDate,
  sanitizeCssValue,
  sanitizeInlineStyle,
  throttle,
} from '../core/utils'
import { computeCriticalPath } from '../core/critical-path'
import { propagateAutoSchedule, type AutoScheduleOptions } from '../core/auto-schedule'
import { LitElement, html, type PropertyValues } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { repeat } from 'lit/directives/repeat.js'

import './gantt-calendar'
import './gantt-row'
import './gantt-minimap'
import type { MinimapScrollEventDetail } from './gantt-minimap'
import { ganttChartStyles, buildDynamicStyles } from './gantt-chart-styles'
import { PluginManager, type GanttPlugin } from '../core/plugin'
import {
  ZoomController,
  TouchController,
  MarqueeController,
  TooltipController,
  type TooltipState,
  KeyboardController,
  DependencyController,
  type ConnectorDragState,
  DragDropController,
  TaskDragController,
  RowReorderController,
  TreeController,
  GridController,
  type DraggingTaskState,
  type DragOverlayInfo,
  type DragPreviewState,
} from './controllers'
import { renderDependencySvg } from './gantt-chart-dependency-svg'
import type { ExportImageOptions } from '../core/types'
import {
  computeRowLevels,
  computeRowWbsCodes,
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
  public get selectedDependency(): { sourceTaskId: string; targetTaskId: string } | null {
    return this._dependencyController?.selectedDependency ?? null
  }
  public set selectedDependency(val: { sourceTaskId: string; targetTaskId: string } | null) {
    if (this._dependencyController) {
      this._dependencyController.selectedDependency = val
      this.requestUpdate()
    }
  }
  @property({ attribute: false })
  externalDraggingTask: GanttTask | null = null

  private static readonly EMPTY_STRING_ARRAY: string[] = []
  private static readonly VIRTUAL_X_CHUNK_PX = 250

  @state() public selectedRows = new Set<string>()
  @state() public selectedTasks = new Set<string>()
  @state() private lastClickedRowId: string | null = null
  @state() public virtualScrollTop = 0
  @state() private virtualRangeStartX = 0
  @state() private virtualRangeEndX = 2000
  public currentScrollLeft = 0
  public currentScrollTop = 0
  @state() public viewportWidth = 800
  @state() public viewportHeight = 400
  @state() public calendarHeight = 0
  public get tooltip(): TooltipState | null {
    return this._tooltipController?.tooltip ?? null
  }
  public set tooltip(val: TooltipState | null) {
    if (this._tooltipController) {
      this._tooltipController.tooltip = val
    }
  }
  @state() private currentTime = new Date()
  @state() public currentRowHeaderWidth = DEFAULT_ROW_HEADER_WIDTH
  public get isResizingHeader(): boolean {
    return this._gridController?.isResizingHeader ?? false
  }
  public set isResizingHeader(val: boolean) {
    if (this._gridController) {
      this._gridController.isResizingHeader = val
      this.requestUpdate()
    }
  }
  @state() private hoveredMilestoneId: string | null = null
  @state() private cursorLineX: number | null = null
  public get connectorDrag(): ConnectorDragState | null {
    return this._dependencyController?.connectorDrag ?? null
  }
  public set connectorDrag(val: ConnectorDragState | null) {
    if (this._dependencyController) {
      this._dependencyController.connectorDrag = val
    }
  }

  // --- Drag & Drop Controller Delegation Properties ---
  public get draggingTask(): DraggingTaskState | null {
    return this._taskDragController?.draggingTask ?? null
  }
  public set draggingTask(val: DraggingTaskState | null) {
    if (this._taskDragController) {
      this._taskDragController.draggingTask = val
    }
  }

  public get draggingTaskIds(): string[] {
    return this._taskDragController?.draggingTaskIds ?? []
  }
  public set draggingTaskIds(val: string[]) {
    if (this._taskDragController) {
      this._taskDragController.draggingTaskIds = val
    }
  }

  public get multiDragDx(): number {
    return this._taskDragController?.multiDragDx ?? 0
  }
  public set multiDragDx(val: number) {
    if (this._taskDragController) {
      this._taskDragController.multiDragDx = val
    }
  }

  public get multiDragDy(): number {
    return this._taskDragController?.multiDragDy ?? 0
  }
  public set multiDragDy(val: number) {
    if (this._taskDragController) {
      this._taskDragController.multiDragDy = val
    }
  }

  public get multiDragSameRow(): boolean {
    return this._taskDragController?.multiDragSameRow ?? false
  }
  public set multiDragSameRow(val: boolean) {
    if (this._taskDragController) {
      this._taskDragController.multiDragSameRow = val
    }
  }

  public get dragTargetRowIndex(): number | null {
    return this._taskDragController?.dragTargetRowIndex ?? null
  }
  public set dragTargetRowIndex(val: number | null) {
    if (this._taskDragController) {
      this._taskDragController.dragTargetRowIndex = val
    }
  }

  public get dragOverlayInfo(): DragOverlayInfo | null {
    return this._taskDragController?.dragOverlayInfo ?? null
  }
  public set dragOverlayInfo(val: DragOverlayInfo | null) {
    if (this._taskDragController) {
      this._taskDragController.dragOverlayInfo = val
    }
  }

  public get dragOverRowId(): string | null {
    return this._rowReorderController?.dragOverRowId ?? null
  }
  public set dragOverRowId(val: string | null) {
    if (this._rowReorderController) {
      this._rowReorderController.dragOverRowId = val
    }
  }

  public get dragOverPosition(): 'top' | 'bottom' | null {
    return this._rowReorderController?.dragOverPosition ?? null
  }
  public set dragOverPosition(val: 'top' | 'bottom' | null) {
    if (this._rowReorderController) {
      this._rowReorderController.dragOverPosition = val
    }
  }

  public get dragPreview(): DragPreviewState | null {
    return this._taskDragController?.dragPreview ?? null
  }
  public set dragPreview(val: DragPreviewState | null) {
    if (this._taskDragController) {
      this._taskDragController.dragPreview = val
    }
  }

  public get _draggingRowId(): string | null {
    return this._rowReorderController?._draggingRowId ?? null
  }
  public set _draggingRowId(val: string | null) {
    if (this._rowReorderController) {
      this._rowReorderController._draggingRowId = val
    }
  }

  // --- Keyboard Controller Delegation Properties ---
  public get focusedTaskId(): string | null {
    return this._keyboardController?.focusedTaskId ?? null
  }
  public set focusedTaskId(val: string | null) {
    if (this._keyboardController) {
      this._keyboardController.focusedTaskId = val
    }
  }

  public get focusedRowId(): string | null {
    return this._keyboardController?.focusedRowId ?? null
  }
  public set focusedRowId(val: string | null) {
    if (this._keyboardController) {
      this._keyboardController.focusedRowId = val
    }
  }

  // --- Zoom Controller Delegation Properties ---
  public get zoomPercent(): number {
    return this._zoomController?.zoomPercent ?? 100
  }
  public set zoomPercent(val: number) {
    if (this._zoomController) {
      this._zoomController.zoomPercent = val
    }
  }

  @state() public baseRowHeaderWidth: number = DEFAULT_ROW_HEADER_WIDTH

  public get zoomPxPerDay(): number | null {
    return this._zoomController?.zoomPxPerDay ?? null
  }
  public set zoomPxPerDay(val: number | null) {
    if (this._zoomController) {
      this._zoomController.zoomPxPerDay = val
    }
  }

  public get zoomPxPerMonth(): number | null {
    return this._zoomController?.zoomPxPerMonth ?? null
  }
  public set zoomPxPerMonth(val: number | null) {
    if (this._zoomController) {
      this._zoomController.zoomPxPerMonth = val
    }
  }

  // --- Marquee Controller Delegation Properties ---
  public get marqueeSelection() {
    return this._marqueeController?.marqueeSelection ?? null
  }
  public set marqueeSelection(val: any) {
    if (this._marqueeController) {
      this._marqueeController.marqueeSelection = val
    }
  }

  private _systemThemeMediaQuery: MediaQueryList | null = null
  private _pluginManager = new PluginManager(this)
  private _zoomController = new ZoomController(this)
  private _touchController = new TouchController(this, this._zoomController)
  private _marqueeController = new MarqueeController(this)
  private _tooltipController = new TooltipController(this)
  private _keyboardController = new KeyboardController(this)
  private _dependencyController = new DependencyController(this)
  private _taskDragController = new TaskDragController(this)
  private _rowReorderController = new RowReorderController(this)
  private _treeController = new TreeController(this)
  private _gridController = new GridController(this)
  private _dragDropControllerInstance: DragDropController | null = null
  public get _dragDropController(): DragDropController {
    if (!this._dragDropControllerInstance) {
      this._dragDropControllerInstance = new DragDropController(
        this,
        this._taskDragController,
        this._rowReorderController,
      )
    }
    return this._dragDropControllerInstance
  }
  private _historyManager = new HistoryManager({
    onChange: (state) => {
      this.dispatchEvent(
        new CustomEvent<HistoryChangeEventDetail>('history-change', {
          detail: state,
          bubbles: true,
          composed: true,
        }),
      )
    },
  })
  @state() private isExporting = false

  // --- GridController Delegation Properties ---
  public get currentGridColumns(): GanttColumn[] | null {
    return this._gridController?.currentGridColumns ?? null
  }
  public set currentGridColumns(val: GanttColumn[] | null) {
    if (this._gridController) {
      this._gridController.currentGridColumns = val
      this.requestUpdate()
    }
  }

  public get currentGridScrollLeft(): number {
    return this._gridController?.currentGridScrollLeft ?? 0
  }
  public set currentGridScrollLeft(val: number) {
    if (this._gridController) {
      this._gridController.currentGridScrollLeft = val
      this.requestUpdate()
    }
  }

  public get columnDropTarget(): { columnId: string; position: 'left' | 'right' } | null {
    return this._gridController?.columnDropTarget ?? null
  }
  public set columnDropTarget(val: { columnId: string; position: 'left' | 'right' } | null) {
    if (this._gridController) {
      this._gridController.columnDropTarget = val
      this.requestUpdate()
    }
  }

  public get currentSortState(): GridSortState | null {
    return this._gridController?.currentSortState ?? null
  }
  public set currentSortState(val: GridSortState | null) {
    if (this._gridController) {
      this._gridController.currentSortState = val
      this._layoutCache = null
      this.requestUpdate()
    }
  }

  public get selectedCellRange(): GridCellRange | null {
    return this._gridController?.selectedCellRange ?? null
  }
  public set selectedCellRange(val: GridCellRange | null) {
    if (this._gridController) {
      this._gridController.selectedCellRange = val
      this.requestUpdate()
    }
  }

  public get _userResizedHeaderWidth(): number | null {
    return this._gridController?._userResizedHeaderWidth ?? null
  }
  public set _userResizedHeaderWidth(val: number | null) {
    if (this._gridController) {
      this._gridController._userResizedHeaderWidth = val
    }
  }

  public get _userColumnWidths(): Map<string, number> {
    return this._gridController._userColumnWidths
  }

  public get _userColumnOrder(): string[] | null {
    return this._gridController?._userColumnOrder ?? null
  }
  public set _userColumnOrder(val: string[] | null) {
    if (this._gridController) {
      this._gridController._userColumnOrder = val
    }
  }

  public get effectiveGridColumns(): GanttColumn[] | undefined {
    return this._gridController.effectiveGridColumns
  }

  public getEffectiveSortState(): GridSortState | null {
    return this._gridController.currentSortState
  }

  public getGridColumnById(columnId: string): GanttColumn | undefined {
    return this._gridController.getGridColumnById(columnId)
  }

  public getScrollContainer(): HTMLElement | null {
    return this._scrollContainer
  }

  public getAutoScheduleOptions(): AutoScheduleOptions {
    return {
      mode: this.option?.dependency?.scheduleMode,
      respectMovable: this.option?.dependency?.respectMovable,
      calendarMode: this.option?.calendar?.calendarMode,
      isHoliday: this.option?.calendar?.isHoliday,
      nonWorkingDays: this.option?.calendar?.nonWorkingDays,
    }
  }

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
  private _lastZoomPercent: number | null = null
  private _lastZoomPxPerDay: number | null = null
  private _lastZoomPxPerMonth: number | null = null
  private _lastAutoExtendTime = 0
  private _cachedCriticalPathArray: string[] = GanttChartElement.EMPTY_STRING_ARRAY
  private _scrollContainer: HTMLElement | null = null
  public get _collapsedRowIds(): Set<string> {
    return this._treeController.collapsedRowIds
  }
  public set _collapsedRowIds(val: Set<string>) {
    this._treeController.collapsedRowIds = val
  }

  public invalidateLayoutCache(): void {
    this._layoutCache = null
  }

  public clearTooltip(): void {
    this._tooltipController.clearTooltip()
  }

  public get displayRows(): GanttRow[] {
    return this._treeController.getDisplayRows()
  }

  /**
   * ズームオプションのヘルパー
   */
  public get zoomOption(): GanttChartOptionZoom | undefined {
    return this._zoomController.zoomOption
  }

  public get effectiveZoomScale(): number {
    return this._zoomController.effectiveZoomScale
  }

  public get isScaleCalendarEnabled(): boolean {
    return this._zoomController.isScaleCalendarEnabled
  }

  public get isScaleRowHeaderEnabled(): boolean {
    return this._zoomController.isScaleRowHeaderEnabled
  }

  public get isScaleBarHeightEnabled(): boolean {
    return this._zoomController.isScaleBarHeightEnabled
  }

  public get isScaleFontEnabled(): boolean {
    return this._zoomController.isScaleFontEnabled
  }

  public get effectivePxPerDay(): number {
    return this._zoomController.effectivePxPerDay
  }

  public get effectivePxPerMonth(): number | undefined {
    return this._zoomController.effectivePxPerMonth
  }

  public get effectiveRowHeaderWidth(): number {
    return this._zoomController.effectiveRowHeaderWidth
  }

  public get effectiveBarHeight(): number {
    return this._zoomController.effectiveBarHeight
  }

  public get effectiveFontScale(): number {
    return this._zoomController.effectiveFontScale
  }

  static styles = ganttChartStyles

  protected firstUpdated() {
    this.setupCurrentTimeTimer()

    const calendar = this.shadowRoot?.getElementById('calendar')
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.target === this) {
            if (entry.contentRect.height > 0) this.viewportHeight = entry.contentRect.height
            if (entry.contentRect.width > 0) {
              this.viewportWidth = entry.contentRect.width
              this.syncHorizontalVirtualRange(this.currentScrollLeft)
            }
          } else if (entry.target === calendar) {
            this.calendarHeight = (entry.target as HTMLElement).offsetHeight
          }
        }
      })
      this.resizeObserver.observe(this)
      if (calendar) {
        this.resizeObserver.observe(calendar)
      }
    }

    // wheel イベントは scroll-container に直接登録する
    // ホスト要素に登録するとブラウザのネイティブスクロールが先に処理されてしまう
    this._scrollContainer = this.shadowRoot?.querySelector('.scroll-container') as HTMLElement | null
    if (this._scrollContainer) {
      this.currentScrollLeft = this._scrollContainer.scrollLeft
      this.currentScrollTop = this._scrollContainer.scrollTop
      this.syncHorizontalVirtualRange(this.currentScrollLeft)
    }
    this._scrollContainer?.addEventListener('wheel', this.handleWheel, { passive: false })
    this._touchController.attach(this._scrollContainer)
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
    this.addEventListener('copy', this.handleClipboardCopy as EventListener)
    this.addEventListener('paste', this.handleClipboardPaste as EventListener)
    this.addEventListener('pointerdown', this._handlePointerDownFocus, true)
    this.addEventListener('task-progress-change', this.handleTaskProgressChange as EventListener)
    this.addEventListener('task-deadline-change', this.handleTaskDeadlineChange as EventListener)
    this.addEventListener('zoom-change', this.handleInternalZoomChange as EventListener)
    this.addEventListener('wheel', this.handleWheel, { passive: false })
    // 初期テーマ設定
    if (this.option?.theme === 'system' || (this.option?.theme !== 'light' && this.option?.theme !== 'dark')) {
      this.theme = this._systemThemeMediaQuery?.matches ? 'dark' : 'light'
    } else {
      this.theme = this.option.theme
    }
    window.addEventListener('dragend', this._handleGlobalDragEnd)
    // オプションに定義されたプラグインの自動登録
    if (this.option?.plugins) {
      for (const plugin of this.option.plugins) {
        this.use(plugin)
      }
    }
    // オプションに定義された履歴設定の反映
    if (this.option?.history) {
      this._historyManager.updateOptions({
        enabled: this.option.history.enabled,
        maxDepth: this.option.history.maxDepth,
        onUndo: this.option.history.onUndo,
        onRedo: this.option.history.onRedo,
      })
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.updateScrollTop.cancel()
    this._pluginManager.destroy()
    this._touchController.detach()
    window.removeEventListener('dragend', this._handleGlobalDragEnd)
    this.resizeObserver?.disconnect()
    this.stopCurrentTimeTimer()
    this._systemThemeMediaQuery?.removeEventListener('change', this.handleSystemThemeChange)
    this.removeEventListener('keydown', this.handleKeyDown)
    this.removeEventListener('copy', this.handleClipboardCopy as EventListener)
    this.removeEventListener('paste', this.handleClipboardPaste as EventListener)
    this.removeEventListener('pointerdown', this._handlePointerDownFocus, true)
    this.removeEventListener('task-progress-change', this.handleTaskProgressChange as EventListener)
    this.removeEventListener('task-deadline-change', this.handleTaskDeadlineChange as EventListener)
    this.removeEventListener('zoom-change', this.handleInternalZoomChange as EventListener)
    this.removeEventListener('wheel', this.handleWheel)
    this._scrollContainer?.removeEventListener('wheel', this.handleWheel)
    this._scrollContainer = null
  }

  private _handlePointerDownFocus = (e: PointerEvent) => {
    const path = e.composedPath()
    const target = path[0] as HTMLElement
    if (target?.tagName && ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName)) return
    if (path.some((el) => (el as HTMLElement)?.classList?.contains?.('dependency-edit-popover'))) return
    if (document.activeElement !== this) {
      this.focus()
    }
  }

  private _handleGlobalDragEnd = () => {
    this._rowReorderController.handleRowDragEnd()
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
      const hadPreviousOption = Boolean(changedProperties.get('option'))
      this.setupCurrentTimeTimer()
      this._gridController.syncWithOption(hadPreviousOption)
      this._treeController.syncFilterWithOption(hadPreviousOption)
      this._zoomController.syncWithOption()
      if (this.option?.history) {
        this._historyManager.updateOptions({
          enabled: this.option.history.enabled,
          maxDepth: this.option.history.maxDepth,
          onUndo: this.option.history.onUndo,
          onRedo: this.option.history.onRedo,
        })
      }
    }
    if (
      changedProperties.has('rows') ||
      changedProperties.has('option') ||
      changedProperties.has('currentRowHeaderWidth') ||
      changedProperties.has('zoomPercent') ||
      changedProperties.has('zoomPxPerDay') ||
      changedProperties.has('zoomPxPerMonth')
    ) {
      this._layoutCache = null
    }

    if (changedProperties.has('rows')) {
      const { rows: updatedRows, hasChanges } = this._treeController.syncCollapsedWithRows(this.rows)
      if (hasChanges) {
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

    if (
      changedProperties.has('rows') ||
      changedProperties.has('option')
    ) {
      if (this.option?.dependency?.showCriticalPath === true) {
        this._cachedCriticalPathArray = [...computeCriticalPath(this.displayRows)]
      } else {
        this._cachedCriticalPathArray = GanttChartElement.EMPTY_STRING_ARRAY
      }
    }
    this.syncHorizontalVirtualRange(this.currentScrollLeft)
  }

  protected updated(changedProperties: PropertyValues): void {
    super.updated(changedProperties)

    if (changedProperties.has('option') && this.option?.plugins) {
      for (const plugin of this.option.plugins) {
        this.use(plugin)
      }
    }

    this._tooltipController.updateTooltipDOM()
    this._taskDragController.syncConstraintGuideDOM()
    this._pluginManager.executeAfterRender()
  }

  public updateDragOverlay(): void {
    this._taskDragController.updateDragOverlay()
  }

  public hideDragOverlay(): void {
    this._taskDragController.hideDragOverlay()
  }

  private currentTimeTimer: number | undefined

  private setupCurrentTimeTimer() {
    this.stopCurrentTimeTimer()
    const interval = this.option?.calendar?.currentTimeUpdateInterval
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

  private handleHeaderResizeStart = (e: PointerEvent): void => {
    this._gridController.handleHeaderResizeStart(e)
  }

  private handleColumnResize = (e: CustomEvent<ColumnResizeEventDetail>): void => {
    this._gridController.handleColumnResize(e)
  }

  private handleColumnDragOver = (
    e: CustomEvent<{ columnId: string | null; position: 'left' | 'right' | null }>,
  ): void => {
    this._gridController.handleColumnDragOver(e)
  }

  private handleColumnReorder = (e: CustomEvent<ColumnReorderEventDetail>): void => {
    this._gridController.handleColumnReorder(e)
  }

  private handleColumnSort = (e: CustomEvent<ColumnSortEventDetail>): void => {
    this._gridController.handleColumnSort(e)
  }

  /**
   * プログラムから特定カラムのソート状態を設定・解除する
   */
  public sortByColumn(columnId: string | null, direction?: GridSortDirection | null): void {
    this._gridController.sortByColumn(columnId, direction)
  }

  /**
   * 現在のグリッドソート状態を取得する
   */
  public getSortState(): GridSortState | null {
    return this._gridController.getSortState()
  }

  public handleGridWheel = (e: WheelEvent): boolean => {
    return this._gridController.handleGridWheel(e)
  }

  public syncHorizontalVirtualRange(scrollLeft: number): void {
    const timelineViewportW = Math.max(300, this.viewportWidth - this.currentRowHeaderWidth)
    const overscanPx = Math.max(Math.round(timelineViewportW * 0.75), 600)
    const chunkPx = GanttChartElement.VIRTUAL_X_CHUNK_PX
    const nextStartX = Math.max(0, Math.floor((scrollLeft - overscanPx) / chunkPx) * chunkPx)
    const nextEndX = Math.ceil((scrollLeft + timelineViewportW + overscanPx) / chunkPx) * chunkPx
    if (this.virtualRangeStartX !== nextStartX) {
      this.virtualRangeStartX = nextStartX
    }
    if (this.virtualRangeEndX !== nextEndX) {
      this.virtualRangeEndX = nextEndX
    }
  }

  private computeVisibleRowIndices(rowLayouts: Array<{ top: number; height: number }>, scrollTop: number): {
    startIndex: number
    endIndex: number
  } {
    const rowCount = this.displayRows.length
    if (rowCount === 0) return { startIndex: 0, endIndex: -1 }
    if (this.isExporting) return { startIndex: 0, endIndex: rowCount - 1 }

    const buffer = 5
    let startIndex = 0
    let endIndex = rowCount - 1
    for (let i = 0; i < rowLayouts.length; i++) {
      if (rowLayouts[i].top + rowLayouts[i].height > scrollTop) {
        startIndex = Math.max(0, i - buffer)
        break
      }
    }
    for (let i = startIndex; i < rowLayouts.length; i++) {
      if (rowLayouts[i].top > scrollTop + this.viewportHeight) {
        endIndex = Math.min(rowCount - 1, i + buffer)
        break
      }
    }
    return { startIndex, endIndex }
  }

  private emitViewportChange(): void {
    const { layouts } = this.calculateLayout()
    const { startIndex, endIndex } = this.computeVisibleRowIndices(layouts, this.currentScrollTop)
    const timelineViewportW = Math.max(0, this.viewportWidth - this.currentRowHeaderWidth)
    const viewportState: GanttViewportState = {
      scrollLeft: this.currentScrollLeft,
      scrollTop: this.currentScrollTop,
      viewportWidth: this.viewportWidth,
      viewportHeight: this.viewportHeight,
      rowHeaderWidth: this.currentRowHeaderWidth,
      calendarHeight: this.calendarHeight,
      visibleStartX: Math.max(0, this.currentScrollLeft),
      visibleEndX: Math.max(0, this.currentScrollLeft + timelineViewportW),
      visibleRowStartIndex: startIndex,
      visibleRowEndIndex: Math.max(0, endIndex),
      pxPerDay: this.effectivePxPerDay,
      pxPerMonth: this.effectivePxPerMonth,
      zoomPercent: this.getZoomPercent(),
      zoomScale: this.getZoomScale(),
    }
    this._pluginManager.executeViewportChange(viewportState)
  }

  private handleInternalZoomChange = (): void => {
    if (this._scrollContainer) {
      this.currentScrollLeft = this._scrollContainer.scrollLeft
      this.currentScrollTop = this._scrollContainer.scrollTop
    }
    this.syncHorizontalVirtualRange(this.currentScrollLeft)
    this._taskDragController.syncConstraintGuideDOM()
    this.emitViewportChange()
  }

  /**
   * タスクドラッグ・ドロップ時にカレンダー端へ到達した場合、表示期間を自動的に拡張する
   */
  public maybeAutoExtendCalendar(minDate: Date, maxDate: Date, isDragging: boolean): void {
    const autoExtendOpt = this.option?.calendar?.autoExtend
    if (!autoExtendOpt) return
    if (typeof autoExtendOpt === 'object' && autoExtendOpt.enabled === false) return

    if (isDragging) {
      const now = Date.now()
      if (now - this._lastAutoExtendTime < 120) return
    }

    const extendDays = Math.max(1, typeof autoExtendOpt === 'object' ? (autoExtendOpt.extendDays ?? 7) : 7)
    const extendMonths = Math.max(1, typeof autoExtendOpt === 'object' ? (autoExtendOpt.extendMonths ?? 1) : 1)
    const edgeThresholdPx = Math.max(0, typeof autoExtendOpt === 'object' ? (autoExtendOpt.edgeThresholdPx ?? 40) : 40)

    const prevStart = new Date(this.option.calendar.start)
    const prevEnd = new Date(this.option.calendar.end)
    let nextStart = new Date(prevStart)
    let nextEnd = new Date(prevEnd)
    const isMonthMode = this.effectivePxPerMonth !== undefined || this.option.calendar.pxPerMonth !== undefined

    // 未来方向（右端）の拡張判定
    const maxDateX = this.getDateX(maxDate)
    const endX = this.getDateX(prevEnd)
    if (maxDate.getTime() > prevEnd.getTime() || maxDateX >= endX - edgeThresholdPx) {
      const baseEnd = new Date(Math.max(prevEnd.getTime(), maxDate.getTime()))
      if (isMonthMode) {
        const d = new Date(baseEnd)
        d.setMonth(d.getMonth() + extendMonths)
        nextEnd = d
      } else {
        nextEnd = new Date(baseEnd.getTime() + extendDays * 24 * 60 * 60 * 1000)
      }
    }

    // 過去方向（左端）の拡張判定（ドラッグ中の座標原点ズレを防ぐためドロップ確定時に実行）
    if (!isDragging) {
      const minDateX = this.getDateX(minDate)
      if (minDate.getTime() < prevStart.getTime() || minDateX <= edgeThresholdPx) {
        const baseStart = new Date(Math.min(prevStart.getTime(), minDate.getTime()))
        if (isMonthMode) {
          const d = new Date(baseStart)
          d.setMonth(d.getMonth() - extendMonths)
          d.setDate(1)
          d.setHours(0, 0, 0, 0)
          nextStart = d
        } else {
          const d = new Date(baseStart.getTime() - extendDays * 24 * 60 * 60 * 1000)
          d.setHours(0, 0, 0, 0)
          nextStart = d
        }
      }
    }

    const startChanged = nextStart.getTime() !== prevStart.getTime()
    const endChanged = nextEnd.getTime() !== prevEnd.getTime()
    if (!startChanged && !endChanged) return

    if (isDragging) {
      this._lastAutoExtendTime = Date.now()
    }

    const addedLeftPx = startChanged
      ? dateToX(prevStart, nextStart, this.effectivePxPerDay, this.effectivePxPerMonth)
      : 0

    this.option = {
      ...this.option,
      calendar: {
        ...this.option.calendar,
        start: nextStart,
        end: nextEnd,
      },
    }
    this._layoutCache = null

    if (addedLeftPx > 0) {
      const container =
        this._scrollContainer ?? (this.shadowRoot?.querySelector('.scroll-container') as HTMLElement | null)
      if (container) {
        const compensatedLeft = container.scrollLeft + addedLeftPx
        container.scrollLeft = compensatedLeft
        this.currentScrollLeft = compensatedLeft
      }
    }

    this.syncHorizontalVirtualRange(this.currentScrollLeft)

    const direction: CalendarRangeChangeEventDetail['direction'] =
      startChanged && endChanged ? 'both' : startChanged ? 'start' : 'end'

    this.dispatchEvent(
      new CustomEvent<CalendarRangeChangeEventDetail>('calendar-range-change', {
        detail: {
          start: nextStart,
          end: nextEnd,
          previousStart: prevStart,
          previousEnd: prevEnd,
          direction,
        },
        bubbles: true,
        composed: true,
      }),
    )
  }

  private handleScroll = (e: Event) => {
    const target = e.target as HTMLElement
    this.currentScrollLeft = target.scrollLeft
    this.currentScrollTop = target.scrollTop
    this.syncHorizontalVirtualRange(target.scrollLeft)
    this.updateScrollTop(target.scrollTop)
    this._tooltipController.hideTooltip()
    this._taskDragController.syncConstraintGuideDOM()
    if (this.option?.minimap?.enabled === true || this._pluginManager.hasOverlayRenderers()) {
      this.requestUpdate()
    }
    this.emitViewportChange()
  }

  private handleMinimapScroll = (e: CustomEvent<MinimapScrollEventDetail>) => {
    const container = this.shadowRoot?.querySelector('.scroll-container') as HTMLElement | null
    if (container) {
      container.scrollLeft = e.detail.scrollLeft
      container.scrollTop = e.detail.scrollTop
      this.currentScrollLeft = e.detail.scrollLeft
      this.currentScrollTop = e.detail.scrollTop
      this.virtualScrollTop = e.detail.scrollTop
      this.syncHorizontalVirtualRange(e.detail.scrollLeft)
      this._taskDragController.syncConstraintGuideDOM()
      if (this.option?.minimap?.enabled === true || this._pluginManager.hasOverlayRenderers()) {
        this.requestUpdate()
      }
      this.emitViewportChange()
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

  public getDateX(date: Date): number {
    return dateToX(
      date,
      this.option.calendar.start,
      this.effectivePxPerDay,
      this.effectivePxPerMonth,
    )
  }

  public calculateLayout() {
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
        dependencies?: GanttDependency[]
        isSummary?: boolean
        isMilestone?: boolean
      }
    >()

    const layouts = this.displayRows.map((row) => {
      const { tasksWithLanes, laneCount } = calculateTaskLanes(row.tasks)
      const barHeight = this.effectiveBarHeight
      const barMargin = this.option.bar?.margin ?? DEFAULT_BAR_MARGIN

      tasksWithLanes.forEach((task: any) => {
        const isMilestone = task.type === 'milestone'
        const rawX = this.getDateX(task.start) + labelWidth
        const endX = this.getDateX(task.end) + labelWidth
        const diamondSize = Math.max(12, Math.round(barHeight * 0.72))
        const x = isMilestone ? rawX - diamondSize / 2 : rawX
        const width = isMilestone ? diamondSize : endX - rawX
        const y = top + task.lane * (barHeight + barMargin) + barMargin
        taskCoords.set(task.id, {
          x,
          y,
          width,
          height: barHeight,
          dependencies: task.dependencies,
          isSummary: task.type === 'summary',
          isMilestone,
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
  public isMultiDrag(taskId: string): boolean {
    return this._taskDragController.isMultiDrag(taskId)
  }

  public isMultiDragSameRow(): boolean {
    return this._taskDragController.isMultiDragSameRow()
  }

  public handleTaskUpdate = (e: CustomEvent<TaskUpdateEventDetail & { mode?: GanttTaskMoveMode }>): void => {
    this._taskDragController.handleTaskUpdate(e)
  }

  private handleTaskProgressChange = (e: CustomEvent<TaskProgressChangeEventDetail>) => {
    if (e.detail.cancelled) return
    const { task, progress, originalProgress } = e.detail
    if (this.option.readOnly && !task.progressResizable) return
    if (task.progressResizable === false) return

    const origProgress = originalProgress ?? 0
    if (origProgress === progress) return

    let taskFound = false
    const previousRows = this.rows
    const newRows = this.rows.map((row) => {
      const taskIndex = row.tasks.findIndex((t) => t.id === task.id)
      if (taskIndex === -1) return row
      taskFound = true
      const updatedTasks = [...row.tasks]
      updatedTasks[taskIndex] = { ...updatedTasks[taskIndex], progress }
      return { ...row, tasks: updatedTasks }
    })

    if (!taskFound) return

    this.applyRowsChangeWithCommand(previousRows, newRows, {
      type: 'task-progress',
      description: `進捗率の変更 (${progress}%)`,
    })
  }

  private handleTaskDeadlineChange = (e: CustomEvent<TaskDeadlineChangeEventDetail>) => {
    if (e.detail.cancelled) return
    const { task, deadline, originalDeadline } = e.detail
    if (this.option.readOnly || this.option.deadline?.editable === false) return
    if (task.movable === 'none' || task.type === 'summary') return
    if (!deadline || Number.isNaN(new Date(deadline).getTime())) return

    const nextDeadline = new Date(deadline)
    if (originalDeadline && new Date(originalDeadline).getTime() === nextDeadline.getTime()) {
      return
    }

    let taskFound = false
    const previousRows = this.rows
    const newRows = this.rows.map((row) => {
      const taskIndex = row.tasks.findIndex((t) => t.id === task.id)
      if (taskIndex === -1) return row
      taskFound = true
      const updatedTasks = [...row.tasks]
      updatedTasks[taskIndex] = { ...updatedTasks[taskIndex], deadline: nextDeadline }
      return { ...row, tasks: updatedTasks }
    })

    if (!taskFound) return

    this.applyRowsChangeWithCommand(previousRows, newRows, {
      type: 'task-deadline',
      description: '期限の変更',
    })
  }

  private handleBarMouseEnter(e: CustomEvent<BarHoverEventDetail>) {
    this._tooltipController.handleBarMouseEnter(e.detail)
  }

  private handleBarMouseLeave() {
    this._tooltipController.handleBarMouseLeave()
  }


  public async reorderRows(sourceIds: string | string[], targetId: string, position: 'top' | 'bottom'): Promise<void> {
    return this._rowReorderController.reorderRows(sourceIds, targetId, position)
  }

  public handleContainerDragOver = (e: DragEvent): void => {
    this._rowReorderController.handleContainerDragOver(e)
  }

  private handleRowDragStart = (e: CustomEvent<{ rowId: string }>): void => {
    this._rowReorderController.handleRowDragStart(e)
  }

  private handleRowDragEnd = (): void => {
    this._rowReorderController.handleRowDragEnd()
  }

  public handleContainerDragLeave = (e: DragEvent): void => {
    this._rowReorderController.handleContainerDragLeave(e)
  }

  public handleContainerDrop = (e: DragEvent): void => {
    this._rowReorderController.handleContainerDrop(e)
  }

  public handleExternalTaskDrop(e: DragEvent, taskJson: string): void {
    this._taskDragController.handleExternalTaskDrop(e, taskJson)
  }

  private handleRowClicked(e: CustomEvent<{ rowId: string; event: MouseEvent }>) {
    const { rowId, event } = e.detail
    const { shiftKey, ctrlKey, metaKey } = event

    if (this.selectedDependency) {
      this.clearDependencySelection()
    }

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

  private handleContainerPointerDown = (e: PointerEvent): void => {
    this._marqueeController.handlePointerDown(e)
  }

  public stopMarqueeAutoScroll(): void {
    this._marqueeController.stopMarqueeAutoScroll()
  }

  private handleContainerClick(e: MouseEvent) {
    if (this._marqueeController.justFinishedMarquee) {
      this._marqueeController.justFinishedMarquee = false
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
   * プラグインを登録してインストールする。
   * @param plugin 登録するプラグイン
   * @param config プラグインの設定オプション（任意）
   */
  public use<TConfig = any>(plugin: GanttPlugin<TConfig>, config?: TConfig): this {
    this._pluginManager.use(plugin, config)
    return this
  }

  /**
   * 履歴マネージャーのインスタンスを取得する
   */
  public get historyManager(): HistoryManager {
    return this._historyManager
  }

  /**
   * Undo可能かどうか
   */
  public get canUndo(): boolean {
    return this._historyManager.canUndo
  }

  /**
   * Redo可能かどうか
   */
  public get canRedo(): boolean {
    return this._historyManager.canRedo
  }

  /**
   * 直前の操作を元に戻す (Undo)
   */
  public async undo(): Promise<boolean> {
    return this._historyManager.undo()
  }

  /**
   * 直前にUndoした操作をやり直す (Redo)
   */
  public async redo(): Promise<boolean> {
    return this._historyManager.redo()
  }

  /**
   * 操作履歴をすべてクリアする
   */
  public clearHistory(): void {
    this._historyManager.clear()
  }

  /**
   * 外部または内部からコマンドを履歴に登録して command イベントを発行する
   */
  public recordCommand(command: GanttCommand): void {
    if (this.option?.history?.enabled === false) return
    this._historyManager.execute(command)
    this.dispatchEvent(
      new CustomEvent<CommandEventDetail>('command', {
        detail: { command },
        bubbles: true,
        composed: true,
      }),
    )
  }

  /**
   * rowsの更新と同時にUndo/Redoコマンドを生成・登録する内部共通ヘルパー
   */
  public applyRowsChangeWithCommand(
    previousRows: GanttRow[],
    nextRows: GanttRow[],
    commandInfo: {
      type: GanttCommandType
      description: string
    },
  ): void {
    if (document.activeElement !== this) {
      this.focus()
    }
    this.rows = nextRows
    this.dispatchEvent(
      new CustomEvent('rows-change', {
        detail: this.rows,
        bubbles: true,
        composed: true,
      }),
    )

    const command: GanttCommand = {
      id: `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: commandInfo.type,
      description: commandInfo.description,
      timestamp: Date.now(),
      before: previousRows,
      after: nextRows,
      undo: () => {
        this.clearDependencySelection()
        this.rows = previousRows
        this.dispatchEvent(
          new CustomEvent('rows-change', {
            detail: this.rows,
            bubbles: true,
            composed: true,
          }),
        )
      },
      redo: () => {
        this.clearDependencySelection()
        this.rows = nextRows
        this.dispatchEvent(
          new CustomEvent('rows-change', {
            detail: this.rows,
            bubbles: true,
            composed: true,
          }),
        )
      },
    }
    this.recordCommand(command)
  }

  /**
   * 内部のプラグインマネージャーを取得する。
   */
  public get pluginManager(): PluginManager {
    return this._pluginManager
  }

  /**
   * ガントチャートを画像またはPDFとしてエクスポートする。
   * ※ エクスポート機能を使用するには、`@mogura/moguchart-plugin-export` プラグインの登録が必要です。
   * 例:
   *   import { exportPlugin } from '@mogura/moguchart-plugin-export'
   *   chart.use(exportPlugin())
   *
   * @param format 'png' または 'pdf'
   * @param options エクスポートオプション
   */
  public async exportImage(
    _format: 'png' | 'pdf' = 'png',
    _options: ExportImageOptions = {}
  ): Promise<string | Blob> {
    throw new Error(
      '[Moguchart] chart.exportImage() requires "@mogura/moguchart-plugin-export". ' +
        'Please install "@mogura/moguchart-plugin-export" and register it: chart.use(exportPlugin())',
    )
  }

  // --- ズーム操作（ZoomControllerへの委譲） ---

  public handleWheel = (e: WheelEvent): void => {
    if (this.handleGridWheel(e)) {
      return
    }
    this._zoomController.handleWheel(e, this._scrollContainer)
  }

  public zoomToPercent(percent: number): void {
    this._zoomController.zoomToPercent(percent)
  }

  public zoomToPercentAtPoint(percent: number, clientX: number, anchorUnits?: number): boolean {
    return this._zoomController.zoomToPercentAtPoint(
      percent,
      clientX,
      this._scrollContainer,
      anchorUnits,
    )
  }

  public zoomToScale(scale: number): void {
    this._zoomController.zoomToScale(scale)
  }

  public zoomIn(step?: number): void {
    this._zoomController.zoomIn(step)
  }

  public zoomOut(step?: number): void {
    this._zoomController.zoomOut(step)
  }

  public getZoomPercent(): number {
    return this._zoomController.getZoomPercent()
  }

  public getZoomScale(): number {
    return this._zoomController.getZoomScale()
  }

  public zoomTo(value: number): void {
    this._zoomController.zoomTo(value)
  }

  public zoomToFit(): void {
    this._zoomController.zoomToFit()
  }

  public resetZoom(): void {
    this._zoomController.resetZoom()
  }

  public clearDependencySelection(): void {
    this._dependencyController.clearDependencySelection()
  }

  public selectDependency(sourceTaskId: string, targetTaskId: string): void {
    this._dependencyController.selectDependency(sourceTaskId, targetTaskId)
  }

  public triggerDependencyDelete(sourceTaskId: string, targetTaskId: string, originalEvent?: Event): void {
    this._dependencyController.triggerDependencyDelete(sourceTaskId, targetTaskId, originalEvent)
  }

  public clearSelection() {
    if (
      this.selectedRows.size === 0 &&
      this.selectedTasks.size === 0 &&
      !this.selectedDependency &&
      !this.selectedCellRange
    ) {
      return
    }

    if (this.selectedCellRange) {
      this.selectGridCells(null)
    }

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

    if (this.selectedDependency) {
      this.clearDependencySelection()
    }
  }

  // --- グリッドセル範囲選択 ＆ TSV コピー＆ペースト（GridControllerへの委譲） ---

  public selectGridCells(range: GridCellRange | null): void {
    this._gridController.selectGridCells(range)
  }

  public getSelectedGridCells(): GridCellRange | null {
    return this._gridController.getSelectedGridCells()
  }

  public moveGridCellSelection(
    dRow: number,
    dCol: number,
    extendRange: boolean,
    wrapRow = false,
  ): boolean {
    return this._gridController.moveGridCellSelection(dRow, dCol, extendRange, wrapRow)
  }

  private handleRowCellPointerDown = (
    e: CustomEvent<{
      rowId: string
      columnId: string
      isNameOrTreeCell: boolean
      event: PointerEvent
    }>,
  ): void => {
    this._gridController.handleRowCellPointerDown(e)
  }

  private handleRowCellPointerEnter = (
    e: CustomEvent<{
      rowId: string
      columnId: string
      event: PointerEvent
    }>,
  ): void => {
    this._gridController.handleRowCellPointerEnter(e)
  }

  public copySelectedCellsToTsv(): string {
    return this._gridController.copySelectedCellsToTsv()
  }

  public pasteTsvToCells(
    tsv: string,
    targetRowId?: string,
    targetColumnId?: string,
  ): number {
    return this._gridController.pasteTsvToCells(tsv, targetRowId, targetColumnId)
  }

  private handleClipboardCopy = (e: ClipboardEvent): void => {
    this._gridController.handleClipboardCopy(e)
  }

  private handleClipboardPaste = (e: ClipboardEvent): void => {
    this._gridController.handleClipboardPaste(e)
  }


  public handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this._dependencyController.editingPopover) {
      e.preventDefault()
      e.stopPropagation()
      this._dependencyController.closeEditPopover()
      return
    }
    this._keyboardController.handleKeyDown(e)
  }

  private handleBarClick(e: CustomEvent<{ task: GanttTask; event: MouseEvent; isMultiSelect: boolean }>) {
    e.stopPropagation()
    const { task, isMultiSelect } = e.detail

    // ドラッグ操作がなかった（クリック扱い）場合でも、ドラッグ関連の状態をクリーンアップ
    this._taskDragController.cleanupDragState()

    if (this.selectedDependency) {
      this.clearDependencySelection()
    }
    if (this.selectedCellRange) {
      this.selectGridCells(null)
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

  // --- コネクタードラッグ管理（DependencyControllerへの委譲） ---

  public handleConnectorDragStart = (e: CustomEvent): void => {
    this._dependencyController.handleConnectorDragStart(e)
  }

  public handleConnectorDragMove = (e: CustomEvent): void => {
    this._dependencyController.handleConnectorDragMove(e)
  }

  public handleConnectorDragEnd = (e: CustomEvent): void => {
    this._dependencyController.handleConnectorDragEnd(e)
  }

  public handleDependencyLineClick = (event: MouseEvent, targetTaskId: string, sourceTaskId: string): void => {
    this._dependencyController.handleDependencyLineClick(event, targetTaskId, sourceTaskId)
  }

  /**
   * プログラムから依存関係の種別（FS/SS/FF/SF）またはラグ期間を更新します。
   */
  public updateDependency(
    sourceTaskId: string,
    targetTaskId: string,
    updates: DependencyUpdateInput,
  ): boolean {
    return this._dependencyController.updateDependency(sourceTaskId, targetTaskId, updates)
  }

  /**
   * 指定した依存関係リンクの組み込み編集ポップオーバーを開きます。
   */
  public openDependencyEditPopover(sourceTaskId: string, targetTaskId: string): boolean {
    return this._dependencyController.openEditPopover(sourceTaskId, targetTaskId)
  }

  /**
   * 現在開いている依存関係編集ポップオーバーを閉じます。
   */
  public closeDependencyEditPopover(): void {
    this._dependencyController.closeEditPopover()
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
    this._treeController.handleRowToggleCollapse(e)
  }

  public toggleRowCollapse(rowId: string, collapsed?: boolean): boolean {
    return this._treeController.toggleRowCollapse(rowId, collapsed)
  }

  public collapseAll(): void {
    this._treeController.collapseAll()
  }

  public expandAll(): void {
    this._treeController.expandAll()
  }

  /**
   * WBS階層維持フィルタリング・検索条件を設定し、再描画および `filter-change` イベントを発火します。
   */
  public setFilter(filter: GanttFilterConfig | null): GanttFilterResult {
    return this._treeController.setFilter(filter)
  }

  /**
   * 現在適用されているフィルタリング条件を解除します。
   */
  public clearFilter(): GanttFilterResult {
    return this._treeController.clearFilter()
  }

  /**
   * 現在適用されているフィルタ設定を取得します。
   */
  public getFilter(): GanttFilterConfig | null {
    return this._treeController.getFilter()
  }

  /**
   * 現在のフィルタ評価結果（一致行数・可視行数・一致IDセット等）を取得します。
   */
  public getFilterResult(): GanttFilterResult {
    return this._treeController.getFilterResult()
  }

  private handleRowCellEdit = (
    e: CustomEvent<{
      rowId: string
      columnId: string
      rawValue: any
      navigationDirection?: GridCellNavigationDirection
    }>,
  ): void => {
    this._gridController.handleRowCellEdit(e)
  }

  /**
   * 依存関係に基づいて後続タスクの日程を自動的に再計算・カスケード更新する
   * @param changedTaskIds 変更の起点となるタスクID配列（省略時は依存関係を持つ全タスクを対象に再計算）
   * @param options 自動スケジューリング設定
   * @returns 日時が更新されたタスクIDの配列
   */
  public autoSchedule(changedTaskIds?: string[], options?: AutoScheduleOptions): string[] {
    const previousRows = this.rows
    const scheduleResult = propagateAutoSchedule(this.rows, changedTaskIds, {
      mode: options?.mode ?? this.option?.dependency?.scheduleMode,
      respectMovable: options?.respectMovable ?? this.option?.dependency?.respectMovable,
      calendarMode: options?.calendarMode ?? this.option?.calendar?.calendarMode,
      isHoliday: options?.isHoliday ?? this.option?.calendar?.isHoliday,
      nonWorkingDays: options?.nonWorkingDays ?? this.option?.calendar?.nonWorkingDays,
    })
    if (!scheduleResult.hasChanges) {
      return []
    }
    this.applyRowsChangeWithCommand(previousRows, scheduleResult.rows, {
      type: 'custom',
      description: '自動スケジューリング',
    })
    return scheduleResult.updatedTaskIds
  }

  /**
   * 指定された行とカラムのインライン編集を開始する
   */
  public startCellEdit(rowId: string, columnId: string): boolean {
    return this._gridController.startCellEdit(rowId, columnId)
  }

  /**
   * 指定したセルから隣接する編集可能なセルへ移動してインライン編集を開始する
   */
  public navigateCellEdit(
    fromRowId: string,
    fromColumnId: string,
    direction: GridCellNavigationDirection,
  ): boolean {
    return this._gridController.navigateCellEdit(fromRowId, fromColumnId, direction)
  }

  /**
   * 現在編集中のセルがあれば編集を確定する
   */
  public commitCellEdit(
    overrideValue?: any,
    navigationDirection?: GridCellNavigationDirection,
  ): boolean {
    return this._gridController.commitCellEdit(overrideValue, navigationDirection)
  }

  /**
   * 現在編集中のセルがあれば編集をキャンセルする
   */
  public cancelCellEdit(): void {
    this._gridController.cancelCellEdit()
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
    this.syncHorizontalVirtualRange(0)
    this.requestUpdate()
    this.emitViewportChange()
  }

  /**
   * 指定したスクロール位置に移動します。
   */
  public scrollToPosition(options: { left?: number; top?: number; behavior?: ScrollBehavior }): void {
    const container = this._scrollContainer ?? (this.shadowRoot?.querySelector('.scroll-container') as HTMLElement | null)
    if (container) {
      if (typeof container.scrollTo === 'function') {
        container.scrollTo({
          left: options.left,
          top: options.top,
          behavior: options.behavior ?? 'auto',
        })
      } else {
        if (options.left !== undefined) container.scrollLeft = options.left
        if (options.top !== undefined) container.scrollTop = options.top
      }
      if (options.left !== undefined) {
        this.currentScrollLeft = options.left
        this.syncHorizontalVirtualRange(options.left)
      }
      if (options.top !== undefined) {
        this.currentScrollTop = options.top
        this.virtualScrollTop = options.top
      }
      this.requestUpdate()
      this.emitViewportChange()
    }
  }

  /**
   * 指定タスクが表示範囲外の場合にスクロールして表示する
   */
  public scrollToTask(taskId: string): void {
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

    let targetTop: number | undefined
    let targetLeft: number | undefined

    if (taskTopInContent < visibleTop || taskBottomInContent > visibleBottom) {
      targetTop = Math.max(0, taskTopInContent - container.clientHeight / 2 + coords.height / 2)
    }

    // 横スクロール: 行ヘッダー幅を考慮
    const taskLeftInContent = coords.x
    const taskRightInContent = coords.x + coords.width
    const visibleLeft = container.scrollLeft + labelWidth
    const visibleRight = container.scrollLeft + container.clientWidth

    if (taskLeftInContent < visibleLeft || taskRightInContent > visibleRight) {
      targetLeft = Math.max(0, taskLeftInContent - labelWidth - 40)
    }

    if (targetTop !== undefined || targetLeft !== undefined) {
      const nextTop = targetTop !== undefined ? targetTop : container.scrollTop
      const nextLeft = targetLeft !== undefined ? targetLeft : container.scrollLeft
      if (typeof container.scrollTo === 'function') {
        container.scrollTo({
          top: nextTop,
          left: nextLeft,
          behavior: 'smooth',
        })
      } else {
        container.scrollTop = nextTop
        container.scrollLeft = nextLeft
      }
    }
  }

  /**
   * 固定フッター集計行（最小開始日・最大終了日・合計期間・加重平均進捗率）を描画する
   */
  private renderGridFooterRow(
    visibleColumns: GanttColumn[],
    labelWidth: number,
    colors: ReturnType<typeof getThemeColors>,
    footerHeight: number,
  ) {
    const isMonthMode = this.option.calendar.pxPerMonth !== undefined
    const isTimeMode = !!this.option.calendar.showTime
    const { pinnedColumns, scrollableColumns, scrollableWidth } = partitionGridColumns(visibleColumns)
    const totalGridWidth = visibleColumns.reduce((sum, c) => sum + (c.width ?? 100), 0)
    const footerSummary = calculateGridFooterSummary(this.rows, this.getAutoScheduleOptions())
    const cellPadding = this.option.grid?.cellPadding ?? 6
    const showBorder = this.option.grid?.showBorders !== false
    const timelineWidth = (() => {
      if (this.option.calendar.pxPerMonth !== undefined) {
        const e = this.option.calendar.end
        return this.getDateX(new Date(e.getFullYear(), e.getMonth() + 1, 1))
      }
      return this.getDateX(this.option.calendar.end)
    })()

    const summaryBarStartX = footerSummary.start ? this.getDateX(footerSummary.start) : null
    const summaryBarEndX = footerSummary.end ? this.getDateX(footerSummary.end) : null
    const hasSummaryBar =
      summaryBarStartX !== null &&
      summaryBarEndX !== null &&
      summaryBarEndX >= summaryBarStartX
    const barLeft = hasSummaryBar ? summaryBarStartX! : 0
    const barWidth = hasSummaryBar ? Math.max(4, summaryBarEndX! - summaryBarStartX!) : 0
    const barColor =
      this.option?.tree?.summaryColor ??
      (this.theme === 'dark' ? '#475569' : '#64748b')
    const progressColor =
      this.option?.progress?.summaryColor ??
      (this.theme === 'dark' ? '#38bdf8' : '#2563eb')

    const renderFooterCell = (col: GanttColumn) => {
      const isPinned = isGridColumnPinned(col)
      const rawVal = getGridFooterCellValue(
        col,
        this.rows,
        footerSummary,
        this.option.grid?.footerLabel,
        this.option.locale,
      )
      const formatted = formatGridFooterCellValue(
        col,
        rawVal,
        this.rows,
        footerSummary,
        this.option.locale,
        isMonthMode,
        isTimeMode,
      )
      const customContent = col.renderFooterCell
        ? col.renderFooterCell(rawVal, this.rows, col, this.option.locale)
        : null
      return html`
        <div
          class="grid-footer-cell grid-footer-cell-${col.id} ${isPinned ? 'is-pinned-left' : ''}"
          data-column-id="${col.id}"
          data-pinned="${isPinned ? 'left' : ''}"
          style="
            width: ${col.width}px;
            min-width: ${col.minWidth ?? 40}px;
            max-width: ${col.maxWidth ? `${col.maxWidth}px` : 'none'};
            justify-content: ${
              col.align === 'center'
                ? 'center'
                : col.align === 'right'
                  ? 'flex-end'
                  : 'flex-start'
            };
            padding: 0 ${cellPadding}px;
            ${showBorder ? `border-right: 1px solid ${colors.border};` : ''}
          "
        >
          <div
            class="grid-footer-cell-content"
            style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
          >
            ${customContent !== null ? customContent : formatted}
          </div>
        </div>
      `
    }

    return html`
      <div
        class="grid-footer-row"
        style="
          height: ${footerHeight}px;
          background: ${colors.calendarBg};
          border-top: 2px solid ${colors.border};
          color: ${colors.text};
        "
      >
        <div
          class="grid-footer-header"
          style="
            width: ${labelWidth}px;
            height: 100%;
            background: ${colors.calendarBg};
            border-right: 1px solid ${colors.border};
          "
        >
          ${pinnedColumns.length > 0 && !this.isExporting
            ? html`
                <div
                  class="grid-footer-cells-container has-pinned-columns"
                  style="width: 100%; overflow: hidden;"
                >
                  <div
                    class="grid-pinned-left ${this.currentGridScrollLeft > 0 ? 'has-scroll-shadow' : ''}"
                    style="display: flex; height: 100%; flex-shrink: 0; background: ${colors.calendarBg};"
                  >
                    ${pinnedColumns.map(renderFooterCell)}
                  </div>
                  <div
                    class="grid-scrollable-viewport"
                    style="flex: 1; min-width: 0; height: 100%; overflow: hidden;"
                  >
                    <div
                      class="grid-scrollable-track"
                      style="
                        display: flex;
                        height: 100%;
                        width: ${scrollableWidth}px;
                        min-width: 100%;
                        transform: translateX(-${this.currentGridScrollLeft}px);
                        box-sizing: border-box;
                      "
                    >
                      ${scrollableColumns.map(renderFooterCell)}
                    </div>
                  </div>
                </div>
              `
            : html`
                <div
                  class="grid-footer-cells-container"
                  style="
                    width: ${totalGridWidth}px;
                    min-width: 100%;
                    transform: translateX(-${this.currentGridScrollLeft}px);
                  "
                >
                  ${visibleColumns.map(renderFooterCell)}
                </div>
              `}
        </div>
        <div
          class="grid-footer-timeline"
          style="
            width: ${timelineWidth}px;
            height: 100%;
            background: ${colors.calendarBg};
          "
        >
          ${hasSummaryBar
            ? html`
                <div
                  class="grid-footer-summary-bar"
                  style="
                    left: ${barLeft}px;
                    width: ${barWidth}px;
                    background-color: ${barColor};
                  "
                >
                  <div
                    class="grid-footer-summary-bar-progress"
                    style="
                      width: ${Math.max(0, Math.min(100, footerSummary.progress))}%;
                      background-color: ${progressColor};
                    "
                  ></div>
                </div>
              `
            : ''}
        </div>
      </div>
    `
  }

  private renderDependencyEditPopover() {
    const pop = this._dependencyController.editingPopover
    if (!pop) return ''

    const loc = this.option.locale?.dependencyPopover ?? jaLocale.dependencyPopover!
    const unitLabel = loc.units[pop.unitKey]
    const canDelete = !this.option.readOnly && this.option.dependency?.deletable !== false
    const depTypes: DependencyType[] = ['FS', 'SS', 'FF', 'SF']

    let rawX = pop.anchorClientX
    let rawY = pop.anchorClientY
    const container =
      this._scrollContainer ?? (this.shadowRoot?.querySelector('.scroll-container') as HTMLElement | null)
    if (container) {
      const rect = container.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        rawX = rect.left + (pop.anchorContentX - this.currentScrollLeft)
        rawY = rect.top + this.calendarHeight + (pop.anchorContentY - this.currentScrollTop)
      }
    }
    const winW = typeof window !== 'undefined' && window.innerWidth > 0 ? window.innerWidth : 1200
    const x = Math.max(160, Math.min(winW - 160, rawX ?? 240))
    const baseY = rawY ?? 200
    const placeBelow = baseY < 190
    const y = placeBelow ? baseY + 14 : baseY - 14

    return html`
      <div
        class="dependency-edit-popover"
        role="dialog"
        aria-label="${loc.title}"
        style="
          left: ${x}px;
          top: ${y}px;
          transform: translate(-50%, ${placeBelow ? '0%' : '-100%'});
        "
        @pointerdown="${(e: Event) => e.stopPropagation()}"
        @click="${(e: Event) => e.stopPropagation()}"
        @keydown="${(e: KeyboardEvent) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            e.stopPropagation()
            this._dependencyController.closeEditPopover()
          } else if (e.key === 'Enter') {
            const target = e.target as HTMLElement | null
            if (target?.tagName !== 'BUTTON') {
              e.preventDefault()
              e.stopPropagation()
              this._dependencyController.commitEditPopover()
            }
          }
        }}"
      >
        <div class="dependency-popover-header">
          <div class="dependency-popover-title-wrap">
            <div class="dependency-popover-title">${loc.title}</div>
            <div class="dependency-popover-route" title="${pop.sourceTaskName} → ${pop.targetTaskName}">
              ${pop.sourceTaskName} → ${pop.targetTaskName}
            </div>
          </div>
          <button
            type="button"
            class="dependency-popover-close"
            title="${loc.cancel}"
            aria-label="${loc.cancel}"
            @click="${() => this._dependencyController.closeEditPopover()}"
          >
            ✕
          </button>
        </div>

        <div class="dependency-popover-row">
          <span class="dependency-popover-label">${loc.typeLabel}</span>
          <div class="dependency-type-segment">
            ${depTypes.map(
              (dt) => html`
                <button
                  type="button"
                  class="dependency-type-btn ${pop.draftType === dt ? 'active' : ''}"
                  data-dep-type="${dt}"
                  title="${loc.types[dt]}"
                  @click="${() => this._dependencyController.setDraftType(dt)}"
                >
                  ${dt}
                </button>
              `,
            )}
          </div>
        </div>

        <div class="dependency-popover-row">
          <span class="dependency-popover-label">${loc.lagLabel(unitLabel)}</span>
          <div class="dependency-lag-controls">
            <button
              type="button"
              class="dependency-lag-step-btn dependency-lag-dec-btn"
              @click="${() => this._dependencyController.stepDraftLag(-1)}"
            >
              -${pop.stepInUnit}
            </button>
            <input
              type="number"
              class="dependency-lag-input"
              step="${pop.stepInUnit}"
              .value="${String(pop.draftLagInUnit)}"
              @input="${(e: Event) => {
                const raw = (e.target as HTMLInputElement).value
                if (raw === '' || raw === '-') return
                const parsed = Number(raw)
                if (!Number.isNaN(parsed)) {
                  this._dependencyController.setDraftLagInUnit(parsed)
                }
              }}"
              @change="${(e: Event) => {
                const parsed = Number((e.target as HTMLInputElement).value)
                if (!Number.isNaN(parsed)) {
                  this._dependencyController.setDraftLagInUnit(parsed)
                }
              }}"
            />
            <button
              type="button"
              class="dependency-lag-step-btn dependency-lag-inc-btn"
              @click="${() => this._dependencyController.stepDraftLag(1)}"
            >
              +${pop.stepInUnit}
            </button>
          </div>
        </div>

        <div class="dependency-popover-actions">
          ${canDelete
            ? html`
                <button
                  type="button"
                  class="dependency-popover-btn dependency-popover-btn-delete"
                  @click="${(e: MouseEvent) => {
                    this.triggerDependencyDelete(pop.sourceTaskId, pop.targetTaskId, e)
                  }}"
                >
                  ${loc.delete}
                </button>
              `
            : ''}
          <div class="dependency-popover-actions-right">
            <button
              type="button"
              class="dependency-popover-btn dependency-popover-btn-cancel"
              @click="${() => this._dependencyController.closeEditPopover()}"
            >
              ${loc.cancel}
            </button>
            <button
              type="button"
              class="dependency-popover-btn dependency-popover-btn-save"
              @click="${() => this._dependencyController.commitEditPopover()}"
            >
              ${loc.save}
            </button>
          </div>
        </div>
      </div>
    `
  }

  render() {
    if (!this.option) {
      return html``
    }
    const colors = getThemeColors(this.theme, this.option.customTheme)

    const { layouts: rowLayouts, taskCoords, totalHeight } = this.calculateLayout()
    const labelWidth = this.currentRowHeaderWidth
    const effectiveCols = this.effectiveGridColumns
    const visibleGridCols = effectiveCols ? effectiveCols.filter((c) => c.visible !== false) : []
    const resolvedCellRange = resolveGridCellRange(
      this.displayRows,
      visibleGridCols,
      this.selectedCellRange,
    )
    const showGridFooter = Boolean(
      effectiveCols && visibleGridCols.length > 0 && this.option.grid?.showFooter === true,
    )
    const footerHeight = showGridFooter
      ? Math.max(28, Math.round((this.effectiveBarHeight ?? 20) + 12))
      : 0

    // currentOptionはoption参照、labelWidth、またはズーム値が変わった時だけ再生成
    // 毎回新オブジェクトを作ると全gantt-rowが再レンダリングされる
    if (
      this._lastOptionRef !== this.option ||
      this._lastLabelWidth !== labelWidth ||
      this._lastZoomPercent !== this.zoomPercent ||
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
        bar: {
          ...this.option.bar,
          height: this.effectiveBarHeight,
        },
      }
      this._lastOptionRef = this.option
      this._lastLabelWidth = labelWidth
      this._lastZoomPercent = this.zoomPercent
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
    const needsVerticalScroll = totalHeight + footerHeight > this.viewportHeight

    const isVirtualX = !this.isExporting && this.option.calendar.virtualScrollX !== false
    const effectiveVisibleStartX = isVirtualX ? this.virtualRangeStartX : 0
    const effectiveVisibleEndX = isVirtualX ? this.virtualRangeEndX : Number.POSITIVE_INFINITY
    const contentWidth = Math.max(0, this.getDateX(this.option.calendar.end))

    const visibleMilestones = (this.option.calendar.milestones ?? []).filter((ms) => {
      if (!isVirtualX) return true
      const msX = this.getDateX(ms.start)
      return msX >= effectiveVisibleStartX - 20 && msX <= effectiveVisibleEndX + 20
    })

    const hasPluginOverlays = this._pluginManager.hasOverlayRenderers()
    const overlayRenderContext: GanttOverlayRenderContext<GanttChartElement> | null = hasPluginOverlays
      ? {
          chart: this,
          rows: this.rows,
          displayRows: this.displayRows,
          option: currentOption,
          theme: this.theme,
          calendarHeight: this.calendarHeight,
          rowHeaderWidth: labelWidth,
          contentWidth,
          totalHeight,
          scrollLeft: this.currentScrollLeft,
          scrollTop: this.currentScrollTop,
          viewportWidth: this.viewportWidth,
          viewportHeight: this.viewportHeight,
          visibleStartX: effectiveVisibleStartX,
          visibleEndX: effectiveVisibleEndX,
          isExporting: this.isExporting,
          getDateX: (d: Date) => this.getDateX(d),
          xToDate: (x: number) =>
            xToDate(
              x,
              this.option.calendar.start,
              this.effectivePxPerDay,
              this.effectivePxPerMonth,
            ),
          taskCoords,
          rowLayouts,
        }
      : null

    const safeSummaryBarColor = sanitizeCssValue(this.option?.tree?.summaryColor, '')
    const safeSummaryProgressColor = sanitizeCssValue(this.option?.progress?.summaryColor, '')

    return html`
      <style>${buildDynamicStyles(this.theme, this.option.customTheme)}
        :host {
          --critical-path-color: ${colors.criticalPath ?? 'rgba(220, 38, 38, 0.85)'};
          ${safeSummaryBarColor ? `--moguchart-summary-bar-color: ${safeSummaryBarColor};` : ''}
          ${safeSummaryProgressColor ? `--moguchart-summary-progress-color: ${safeSummaryProgressColor};` : ''}
          ${this.effectiveFontScale !== undefined ? `--moguchart-font-scale: ${this.effectiveFontScale};` : ''}
        }
      </style>
      ${this.isExporting ? html`<style>:host { overflow: visible !important; height: ${this.calendarHeight + totalHeight + footerHeight + 2}px !important; width: max-content !important; min-width: auto !important; border-radius: 0 !important; border: none !important; } * { box-shadow: none !important; }</style>` : ''}
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
                  style="height: ${this.isExporting ? totalHeight + footerHeight : Math.max(totalHeight + footerHeight, this.viewportHeight)}px;"
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
          .visibleStartX="${effectiveVisibleStartX}"
          .visibleEndX="${effectiveVisibleEndX}"
          .hoveredMilestoneId="${this.hoveredMilestoneId}"
          .cornerContent="${this.option.customRendering?.cornerContent}"
          .calendarQuarterContent="${this.option.customRendering?.calendarQuarterContent}"
          .calendarMonthContent="${this.option.customRendering?.calendarMonthContent}"
          .calendarDayContent="${this.option.customRendering?.calendarDayContent}"
          .calendarWeekContent="${this.option.customRendering?.calendarWeekContent}"
          .calendarHourContent="${this.option.customRendering?.calendarHourContent}"
          .gridScrollLeft="${this.currentGridScrollLeft}"
          .gridColumns="${this.effectiveGridColumns}"
          .sortState="${this.currentSortState}"
          @column-resize="${this.handleColumnResize}"
          @column-drag-over="${this.handleColumnDragOver}"
          @column-reorder="${this.handleColumnReorder}"
          @column-sort="${this.handleColumnSort}"
          @milestone-hover-change="${(e: CustomEvent) => {
        this.hoveredMilestoneId = e.detail.milestoneId
      }}"
        ></gantt-calendar>

        ${renderDependencySvg({
          taskCoords,
          displayRows: this.displayRows,
          option: this.option,
          effectiveBarHeight: this.effectiveBarHeight,
          selectedDependency: this.selectedDependency,
          connectorDrag: this.connectorDrag,
          scrollContainer: this._scrollContainer,
          calendarHeight: this.calendarHeight,
          totalHeight,
          labelWidth,
          colors,
          getDateX: (d) => this.getDateX(d),
          onDependencyLineClick: (e, tId, sId) => this.handleDependencyLineClick(e, tId, sId),
          onDependencyDelete: (sId, tId, e) => this.triggerDependencyDelete(sId, tId, e),
          onDependencyEdit: (sId, tId, anchor, e) =>
            this._dependencyController.handleDependencyEdit(sId, tId, anchor, e),
        })}

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
        ${visibleMilestones.map((ms) => {
          const safeMsColor = sanitizeCssValue(ms.color, '#8b5cf6')
          const safeMsStyle = sanitizeInlineStyle(ms.style)
          return html`
            <div
              class="milestone-line ${this.hoveredMilestoneId === ms.id ? 'milestone-hovered' : ''}"
              style="
                top: ${this.calendarHeight}px;
                left: ${this.getDateX(ms.start) + labelWidth}px;
                height: ${totalHeight}px;
                width: ${ms.width ?? 2}px;
                background-color: ${safeMsColor};
                opacity: ${this.hoveredMilestoneId === ms.id ? 1 : 0.5};
                ${safeMsStyle ? `${safeMsStyle};` : ''}
              "
              @mouseenter="${() => {
              this.hoveredMilestoneId = ms.id
            }}"
              @mouseleave="${() => {
              this.hoveredMilestoneId = null
            }}"
            ></div>
          `
        })}
        ${!this.isExporting &&
        this.option.constraint?.enabled !== false &&
        this.option.constraint?.showDragGuide !== false
          ? html`
              <div
                class="constraint-drag-guide-layer"
                style="
                  top: ${this.calendarHeight}px;
                  left: ${labelWidth}px;
                  width: ${contentWidth}px;
                  height: ${totalHeight}px;
                "
              ></div>
            `
          : ''}
        ${overlayRenderContext
          ? html`
              <div
                class="plugin-overlay-layer"
                style="
                  top: ${this.calendarHeight}px;
                  left: ${labelWidth}px;
                  width: ${contentWidth}px;
                  height: ${totalHeight}px;
                "
              >
                ${this._pluginManager.renderOverlays(overlayRenderContext)}
              </div>
            `
          : ''}
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
                .multiDragSameRow="${this.multiDragSameRow || (this.selectedTasks.size >= 2 && this.isMultiDragSameRow())}"
                .theme="${this.theme}"
                .dropPosition="${this.dragOverRowId === row.id ? this.dragOverPosition : null}"
                .externalDragTask="${this.dragPreview?.rowId === row.id ? this.dragPreview : null}"
                .selectedTaskIds="${this._cachedSelectedTaskIds}"
                .focusedTaskId="${this.focusedTaskId}"
                .isExporting="${this.isExporting}"
                .visibleStartX="${effectiveVisibleStartX}"
                .visibleEndX="${effectiveVisibleEndX}"
                .criticalPathTaskIds="${this._cachedCriticalPathArray}"
                .gridScrollLeft="${this.currentGridScrollLeft}"
                .gridColumns="${this.effectiveGridColumns}"
                .columnDropTarget="${this.columnDropTarget}"
                .resolvedCellRange="${resolvedCellRange}"
                @task-update="${this.handleTaskUpdate}"
                @row-clicked="${this.handleRowClicked}"
                @row-header-contextmenu="${this.handleRowContextMenu}"
                @row-toggle-collapse="${this.handleRowToggleCollapse}"
                @row-dragstart="${this.handleRowDragStart}"
                @row-dragend="${this.handleRowDragEnd}"
                @row-cell-edit="${this.handleRowCellEdit}"
                @row-cell-pointerdown="${this.handleRowCellPointerDown}"
                @row-cell-pointerenter="${this.handleRowCellPointerEnter}"
                @bar-click="${this.handleBarClick}"
                @task-contextmenu="${this.handleBarContextMenu}"
              />
            `
          },
        )}

        <div style="height: ${paddingBottom}px; width: 1px;"></div>

        ${showGridFooter ? this.renderGridFooterRow(visibleGridCols, labelWidth, colors, footerHeight) : ''}

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
      ${!this.isExporting ? this.renderDependencyEditPopover() : ''}
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

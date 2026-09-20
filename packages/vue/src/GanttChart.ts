import {
  defineComponent,
  ref,
  watch,
  onMounted,
  onBeforeUnmount,
  h,
  type PropType,
} from 'vue'
import {
  GanttChartElement,
  type GanttRow,
  type GanttChartOption,
  type GanttTask,
  type ChartContextMenuEventDetail,
  type MinimapMoveEventDetail,
  type MinimapResizeEventDetail,
  type MinimapCollapseEventDetail,
  type TaskUpdateEventDetail,
  type BarHoverEventDetail,
  type TaskClickEventDetail,
  type TaskContextMenuEventDetail,
  type TaskDropEventDetail,
  type RowReorderEventDetail,
  type RowHeaderResizeEventDetail,
  type RowSelectionChangeEventDetail,
  type BarSelectionChangeEventDetail,
  type RowHeaderClickEventDetail,
  type RowHeaderDblClickEventDetail,
  type RowHeaderContextMenuEventDetail,
  type RowToggleCollapseEventDetail,
  type DependencyCreateEventDetail,
  type DependencyClickEventDetail,
  type DependencyDeleteEventDetail,
  type DependencySelectEventDetail,
  type MarkerDblClickEventDetail,
  type MarkerContextMenuEventDetail,
  type TaskDeleteEventDetail,
  type ZoomChangeEventDetail,
  type TaskProgressChangeEventDetail,
} from '@mogura/moguchart-core'

export const ganttChartProps = {
  /** ガントチャートに表示する行データ配列 */
  rows: {
    type: Array as PropType<GanttRow[]>,
    default: () => [],
  },
  /** ガントチャートの設定オプション（カレンダー期間やプラグインなど） */
  option: {
    type: Object as PropType<GanttChartOption>,
    required: true as const,
  },
  /** 表示テーマ ('light' | 'dark') */
  theme: {
    type: String as PropType<'light' | 'dark'>,
    default: 'light',
  },
  /** 選択状態の行ID配列 */
  selectedRowIds: {
    type: Array as PropType<string[]>,
    default: () => [],
  },
  /** 選択状態のタスクID配列 */
  selectedTaskIds: {
    type: Array as PropType<string[]>,
    default: () => [],
  },
  /** 選択状態の依存関係 */
  selectedDependency: {
    type: Object as PropType<{ sourceTaskId: string; targetTaskId: string } | null>,
    default: null,
  },
  /** 外部からドラッグ中のタスク */
  externalDraggingTask: {
    type: Object as PropType<GanttTask | null>,
    default: null,
  },
}

export const ganttChartEmits = {
  'chart-contextmenu': (_detail: ChartContextMenuEventDetail, _e: CustomEvent<ChartContextMenuEventDetail>) => true,
  'minimap-move': (_detail: MinimapMoveEventDetail, _e: CustomEvent<MinimapMoveEventDetail>) => true,
  'minimap-resize': (_detail: MinimapResizeEventDetail, _e: CustomEvent<MinimapResizeEventDetail>) => true,
  'minimap-collapse': (_detail: MinimapCollapseEventDetail, _e: CustomEvent<MinimapCollapseEventDetail>) => true,
  'task-update': (_detail: TaskUpdateEventDetail, _e: CustomEvent<TaskUpdateEventDetail>) => true,
  'bar-hover': (_detail: BarHoverEventDetail, _e: CustomEvent<BarHoverEventDetail>) => true,
  'task-click': (_detail: TaskClickEventDetail, _e: CustomEvent<TaskClickEventDetail>) => true,
  'task-dblclick': (_detail: TaskClickEventDetail, _e: CustomEvent<TaskClickEventDetail>) => true,
  'task-contextmenu': (_detail: TaskContextMenuEventDetail, _e: CustomEvent<TaskContextMenuEventDetail>) => true,
  'task-drop': (_detail: TaskDropEventDetail, _e: CustomEvent<TaskDropEventDetail>) => true,
  'row-reordered': (_detail: RowReorderEventDetail, _e: CustomEvent<RowReorderEventDetail>) => true,
  'row-header-resize': (_detail: RowHeaderResizeEventDetail, _e: CustomEvent<RowHeaderResizeEventDetail>) => true,
  'row-selection-change': (_detail: RowSelectionChangeEventDetail, _e: CustomEvent<RowSelectionChangeEventDetail>) => true,
  'bar-selection-change': (_detail: BarSelectionChangeEventDetail, _e: CustomEvent<BarSelectionChangeEventDetail>) => true,
  'row-header-click': (_detail: RowHeaderClickEventDetail, _e: CustomEvent<RowHeaderClickEventDetail>) => true,
  'row-header-dblclick': (_detail: RowHeaderDblClickEventDetail, _e: CustomEvent<RowHeaderDblClickEventDetail>) => true,
  'row-header-contextmenu': (_detail: RowHeaderContextMenuEventDetail, _e: CustomEvent<RowHeaderContextMenuEventDetail>) => true,
  'row-toggle-collapse': (_detail: RowToggleCollapseEventDetail, _e: CustomEvent<RowToggleCollapseEventDetail>) => true,
  'dependency-create': (_detail: DependencyCreateEventDetail, _e: CustomEvent<DependencyCreateEventDetail>) => true,
  'dependency-click': (_detail: DependencyClickEventDetail, _e: CustomEvent<DependencyClickEventDetail>) => true,
  'dependency-delete': (_detail: DependencyDeleteEventDetail, _e: CustomEvent<DependencyDeleteEventDetail>) => true,
  'dependency-select': (_detail: DependencySelectEventDetail, _e: CustomEvent<DependencySelectEventDetail>) => true,
  'marker-dblclick': (_detail: MarkerDblClickEventDetail, _e: CustomEvent<MarkerDblClickEventDetail>) => true,
  'marker-contextmenu': (_detail: MarkerContextMenuEventDetail, _e: CustomEvent<MarkerContextMenuEventDetail>) => true,
  'task-delete': (_detail: TaskDeleteEventDetail, _e: CustomEvent<TaskDeleteEventDetail>) => true,
  'zoom-change': (_detail: ZoomChangeEventDetail, _e: CustomEvent<ZoomChangeEventDetail>) => true,
  'task-progress-change': (_detail: TaskProgressChangeEventDetail, _e: CustomEvent<TaskProgressChangeEventDetail>) => true,
}

/**
 * @mogura/moguchart-core の GanttChartElement をラップした公式 Vue 3 コンポーネント。
 */
export const GanttChart = defineComponent({
  name: 'GanttChart',
  props: ganttChartProps,
  emits: ganttChartEmits,
  setup(props, { emit, expose }) {
    const elRef = ref<GanttChartElement | null>(null)
    const eventHandlers = new Map<string, (e: Event) => void>()

    onMounted(() => {
      const el = elRef.value
      if (!el) return

      // 初期プロパティ反映
      el.rows = props.rows
      el.option = props.option
      el.theme = props.theme
      el.selectedRowIds = props.selectedRowIds
      el.selectedTaskIds = props.selectedTaskIds
      el.selectedDependency = props.selectedDependency
      if (props.externalDraggingTask !== undefined) {
        el.externalDraggingTask = props.externalDraggingTask
      }

      // イベントリスナーの動的登録
      const eventNames = Object.keys(ganttChartEmits)
      for (const eventName of eventNames) {
        const handler = (e: Event) => {
          const ce = e as CustomEvent
          emit(eventName as any, ce.detail, ce)
        }
        eventHandlers.set(eventName, handler)
        el.addEventListener(eventName, handler)
      }
    })

    onBeforeUnmount(() => {
      const el = elRef.value
      if (!el) return
      for (const [eventName, handler] of eventHandlers) {
        el.removeEventListener(eventName, handler)
      }
      eventHandlers.clear()
    })

    // リアクティブプロパティ監視
    watch(
      () => props.rows,
      (newRows) => {
        if (elRef.value && newRows) {
          elRef.value.rows = newRows
        }
      },
      { deep: false }
    )

    watch(
      () => props.option,
      (newOption) => {
        if (elRef.value && newOption) {
          elRef.value.option = newOption
        }
      },
      { deep: false }
    )

    watch(
      () => props.theme,
      (newTheme) => {
        if (elRef.value && newTheme) {
          elRef.value.theme = newTheme
        }
      }
    )

    watch(
      () => props.selectedRowIds,
      (newIds) => {
        if (elRef.value && newIds) {
          elRef.value.selectedRowIds = newIds
        }
      },
      { deep: false }
    )

    watch(
      () => props.selectedTaskIds,
      (newIds) => {
        if (elRef.value && newIds) {
          elRef.value.selectedTaskIds = newIds
        }
      },
      { deep: false }
    )

    watch(
      () => props.selectedDependency,
      (newDep) => {
        if (elRef.value) {
          elRef.value.selectedDependency = newDep ?? null
        }
      }
    )

    watch(
      () => props.externalDraggingTask,
      (newTask) => {
        if (elRef.value) {
          elRef.value.externalDraggingTask = newTask ?? null
        }
      }
    )

    // 公開メソッド（Template Ref 経由でアクセス可能）
    const publicMethods = {
      get element(): GanttChartElement | null {
        return elRef.value
      },
      get updateComplete(): Promise<boolean> | undefined {
        return elRef.value?.updateComplete
      },
      get shadowRoot(): ShadowRoot | null | undefined {
        return elRef.value?.shadowRoot
      },
      get externalDraggingTask(): GanttTask | null {
        return elRef.value?.externalDraggingTask ?? null
      },
      set externalDraggingTask(val: GanttTask | null) {
        if (elRef.value) {
          elRef.value.externalDraggingTask = val
        }
      },
      use: (...args: Parameters<GanttChartElement['use']>) => elRef.value?.use(...args),
      exportImage: (...args: Parameters<GanttChartElement['exportImage']>) => elRef.value?.exportImage(...args),
      zoomTo: (...args: Parameters<GanttChartElement['zoomTo']>) => elRef.value?.zoomTo(...args),
      zoomToFit: (...args: Parameters<GanttChartElement['zoomToFit']>) => elRef.value?.zoomToFit(...args),
      resetZoom: (...args: Parameters<GanttChartElement['resetZoom']>) => elRef.value?.resetZoom(...args),
      resetScroll: (...args: Parameters<GanttChartElement['resetScroll']>) => elRef.value?.resetScroll(...args),
      scrollToPosition: (...args: Parameters<GanttChartElement['scrollToPosition']>) => elRef.value?.scrollToPosition(...args),
      selectTask: (...args: Parameters<GanttChartElement['selectTask']>) => elRef.value?.selectTask(...args),
      toggleRowCollapse: (...args: Parameters<GanttChartElement['toggleRowCollapse']>) => elRef.value?.toggleRowCollapse(...args),
      collapseAll: (...args: Parameters<GanttChartElement['collapseAll']>) => elRef.value?.collapseAll(...args),
      expandAll: (...args: Parameters<GanttChartElement['expandAll']>) => elRef.value?.expandAll(...args),
      hitTest: (...args: Parameters<GanttChartElement['hitTest']>) => elRef.value?.hitTest(...args),
      getRowPositions: (...args: Parameters<GanttChartElement['getRowPositions']>) => elRef.value?.getRowPositions(...args),
    }

    expose(publicMethods)

    return () => h('gantt-chart', { ref: elRef })
  },
})

export type GanttChartComponent = typeof GanttChart

export interface GanttChartPublicApi {
  /** 基底の Web Component (GanttChartElement) への参照 */
  readonly element: GanttChartElement | null
  /** Lit コンポーネントのレンダリング完了 Promise */
  readonly updateComplete: Promise<boolean> | undefined
  /** Shadow DOM ルートへの参照 */
  readonly shadowRoot: ShadowRoot | null | undefined
  /** 外部ドラッグ中のタスク */
  externalDraggingTask: GanttTask | null
  use: GanttChartElement['use']
  exportImage: GanttChartElement['exportImage']
  zoomTo: GanttChartElement['zoomTo']
  zoomToFit: GanttChartElement['zoomToFit']
  resetZoom: GanttChartElement['resetZoom']
  resetScroll: GanttChartElement['resetScroll']
  scrollToPosition: GanttChartElement['scrollToPosition']
  selectTask: GanttChartElement['selectTask']
  toggleRowCollapse: GanttChartElement['toggleRowCollapse']
  collapseAll: GanttChartElement['collapseAll']
  expandAll: GanttChartElement['expandAll']
  hitTest: GanttChartElement['hitTest']
  getRowPositions: GanttChartElement['getRowPositions']
  /** コンポーネントのルートDOM要素 */
  $el?: HTMLElement
}

export type GanttChartInstance = GanttChartPublicApi


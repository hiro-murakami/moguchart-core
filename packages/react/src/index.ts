import React from 'react'
import { createComponent, type EventName } from '@lit/react'
import {
  GanttChartElement,
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

/**
 * @mogura/moguchart-core の GanttChartElement をラップした React コンポーネント。
 * Web Components のライフサイクルと完全同期し、React のプロパティやイベントハンドラー、ref をサポートします。
 */
export const GanttChart = createComponent({
  tagName: 'gantt-chart',
  elementClass: GanttChartElement,
  react: React,
  events: {
    onChartContextMenu: 'chart-contextmenu' as EventName<CustomEvent<ChartContextMenuEventDetail>>,
    onMinimapMove: 'minimap-move' as EventName<CustomEvent<MinimapMoveEventDetail>>,
    onMinimapResize: 'minimap-resize' as EventName<CustomEvent<MinimapResizeEventDetail>>,
    onMinimapCollapse: 'minimap-collapse' as EventName<CustomEvent<MinimapCollapseEventDetail>>,
    onTaskUpdate: 'task-update' as EventName<CustomEvent<TaskUpdateEventDetail>>,
    onBarHover: 'bar-hover' as EventName<CustomEvent<BarHoverEventDetail>>,
    onTaskClick: 'task-click' as EventName<CustomEvent<TaskClickEventDetail>>,
    onTaskDblClick: 'task-dblclick' as EventName<CustomEvent<TaskClickEventDetail>>,
    onTaskContextMenu: 'task-contextmenu' as EventName<CustomEvent<TaskContextMenuEventDetail>>,
    onTaskDrop: 'task-drop' as EventName<CustomEvent<TaskDropEventDetail>>,
    onRowReordered: 'row-reordered' as EventName<CustomEvent<RowReorderEventDetail>>,
    onRowHeaderResize: 'row-header-resize' as EventName<CustomEvent<RowHeaderResizeEventDetail>>,
    onRowSelectionChange: 'row-selection-change' as EventName<CustomEvent<RowSelectionChangeEventDetail>>,
    onBarSelectionChange: 'bar-selection-change' as EventName<CustomEvent<BarSelectionChangeEventDetail>>,
    onRowHeaderClick: 'row-header-click' as EventName<CustomEvent<RowHeaderClickEventDetail>>,
    onRowHeaderDblClick: 'row-header-dblclick' as EventName<CustomEvent<RowHeaderDblClickEventDetail>>,
    onRowHeaderContextMenu: 'row-header-contextmenu' as EventName<CustomEvent<RowHeaderContextMenuEventDetail>>,
    onRowToggleCollapse: 'row-toggle-collapse' as EventName<CustomEvent<RowToggleCollapseEventDetail>>,
    onDependencyCreate: 'dependency-create' as EventName<CustomEvent<DependencyCreateEventDetail>>,
    onDependencyClick: 'dependency-click' as EventName<CustomEvent<DependencyClickEventDetail>>,
    onDependencyDelete: 'dependency-delete' as EventName<CustomEvent<DependencyDeleteEventDetail>>,
    onDependencySelect: 'dependency-select' as EventName<CustomEvent<DependencySelectEventDetail>>,
    onMarkerDblClick: 'marker-dblclick' as EventName<CustomEvent<MarkerDblClickEventDetail>>,
    onMarkerContextMenu: 'marker-contextmenu' as EventName<CustomEvent<MarkerContextMenuEventDetail>>,
    onTaskDelete: 'task-delete' as EventName<CustomEvent<TaskDeleteEventDetail>>,
    onZoomChange: 'zoom-change' as EventName<CustomEvent<ZoomChangeEventDetail>>,
    onTaskProgressChange: 'task-progress-change' as EventName<CustomEvent<TaskProgressChangeEventDetail>>,
  },
})

/** GanttChart コンポーネントの Props 型定義 */
export type GanttChartProps = React.ComponentProps<typeof GanttChart>

// コアパッケージの型・定数・関数をそのまま再エクスポート
export * from '@mogura/moguchart-core'

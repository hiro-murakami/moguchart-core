export interface GanttTask {
  id: string
  name?: string
  start: Date
  end: Date
  style?: string
  dependencies?: string[]
}

export interface GanttRow {
  id: string
  label: string
  tasks: GanttTask[]
}

export interface TaskWithLane extends GanttTask {
  lane: number
}

export interface GanttChartOptionBar {
  height?: number
  margin?: number
  cornerRadius?: number
}

export interface GanttChartOptionRowHeader {
  width?: number
  backgroundColor?: string
}

export interface GanttChartOptionColor {
  sunday?: string
  saturday?: string
  holiday?: string
}

export interface GanttChartOptionCalendar {
  start: Date
  color?: GanttChartOptionColor
  pxPerDay: number
  monthFormat?: string
  showRowBackground?: boolean
}

export interface GanttChartOption {
  bar?: GanttChartOptionBar
  rowHeader?: GanttChartOptionRowHeader
  calendar: GanttChartOptionCalendar
  readOnly?: boolean
  tooltipDelay?: number
  showTooltip?: boolean
  showDragInfoOverlay?: boolean
}

export interface TaskUpdateEventDetail extends GanttTask {
  dx?: number
  dy: number
  isDragging: boolean
  targetRowId?: string
}

export interface RenderBarContentEventDetail {
  container: HTMLElement
  task: GanttTask
}

export interface RenderRowHeaderEventDetail {
  container: HTMLElement
  row: GanttRow
}

export interface BarHoverEventDetail {
  task: GanttTask
  x: number
  y: number
}

export interface RenderTooltipEventDetail {
  container: HTMLElement
  task: GanttTask
  x: number
  y: number
}

export interface TaskClickEventDetail {
  task: GanttTask
  event: MouseEvent
}

export interface TaskContextMenuEventDetail {
  task: GanttTask
  event: MouseEvent
}

export interface RenderDragInfoEventDetail {
  container: HTMLElement
  task: GanttTask
  newStart: Date
  newEnd: Date
  targetRow?: GanttRow
}

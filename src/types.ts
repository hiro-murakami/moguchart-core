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

export interface GanttChartOptionCalendar {
  start: Date
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
  theme?: 'light' | 'dark'
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

export interface ThemeColorPalette {
  bg: string
  text: string
  border: string
  gridLine: string
  dragTarget: string
  tooltipBg: string
  tooltipText: string
  dragOverlayBg: string
  dragOverlayText: string
  dragOverlaySubText: string
  dragOverlayDivider: string
  dependencyLine: string
  calendarBg: string
  saturday: string
  sunday: string
  holiday: string
  rowHeaderBg: string
}

export interface ThemeColors {
  light: ThemeColorPalette
  dark: ThemeColorPalette
}

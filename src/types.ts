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

export interface GanttChartOptionLabel {
  width?: number
  backgroundColor?: string
}

export interface GanttChartOptionColor {
  sunday?: string
  saturday?: string
  holiday?: string
}

export interface GanttChartOption {
  bar?: GanttChartOptionBar
  label?: GanttChartOptionLabel
  calendar: {
    start: Date
    color?: GanttChartOptionColor
    pxPerDay: number
    monthFormat?: string
    showRowBackground?: boolean
  }
  readOnly?: boolean
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

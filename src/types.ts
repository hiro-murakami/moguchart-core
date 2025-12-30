export interface GanttTask {
  id: string
  name?: string
  start: Date
  end: Date
  color?: string
}

export interface GanttRow {
  id: string
  label: string
  tasks: GanttTask[]
}

export interface TaskWithLane extends GanttTask {
  lane: number
}

export interface GanttChartOption {
  chartStart: Date
  pxPerDay: number
  barHeight: number
  barMargin: number
  barCornerRadius: number
  labelWidth?: number
}

export interface TaskUpdateEventDetail extends GanttTask {
  dy: number
  isDragging: boolean
}

export interface RenderBarContentEventDetail {
  container: HTMLElement
  task: GanttTask
}

import { html, render } from 'lit'
import '@/components/gantt-chart'
import type {
  GanttChartOption,
  GanttRow,
  RenderBarContentEventDetail,
  TaskUpdateEventDetail,
} from '@/types'
import { testRows } from './test-data'

let rows: GanttRow[] = testRows

const chartStart = new Date()
const pxPerDay = 30 // 共通のスケール
const totalDays = 200 // 表示する日数
const barHeight = 28
const barMargin = 4
const barCornerRadius = 4
const labelWidth = 150
let isReadOnly = false

const renderApp = () => {
  const option: GanttChartOption = {
    bar: {
      height: barHeight,
      margin: barMargin,
      cornerRadius: barCornerRadius,
    },
    label: {
      width: labelWidth,
    },
    calendar: {
      start: chartStart,
      pxPerDay,
    },
    readOnly: isReadOnly,
  }

  const template = html`
    <div style="padding: 50px; font-family: sans-serif; color: #333;">
      <h2>Moguchart 2</h2>

      <div style="margin-bottom: 16px;">
        <label>
          <input
            type="checkbox"
            .checked="${isReadOnly}"
            @change="${(e: Event) => {
              isReadOnly = (e.target as HTMLInputElement).checked
              renderApp()
            }}"
          />
          表示専用モード
        </label>
      </div>

      <gantt-chart
        style="height: 50vh;"
        .rows="${rows}"
        .option="${option}"
        .totalDays="${totalDays}"
        @rows-change="${(e: CustomEvent) => {
          rows = e.detail
        }}"
        @task-update="${handleTaskUpdate}"
        @render-bar-content="${handleRenderBarContent}"
      />
    </div>
  `
  render(template, document.getElementById('app')!)
}

const handleTaskUpdate = (e: CustomEvent<TaskUpdateEventDetail>) => {
  if (e.detail.isDragging) {
    return
  }
  console.log('Task Update:', e.detail)
}

const handleRenderBarContent = (
  e: CustomEvent<RenderBarContentEventDetail>,
) => {
  const { container, task } = e.detail
  console.log('RenderBarContent', container, task)
}

renderApp()

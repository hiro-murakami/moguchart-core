import { html, render } from 'lit'
import '@/components/gantt-chart'
import type {
  GanttChartOption,
  GanttRow,
  RenderBarContentEventDetail,
  RenderRowHeaderEventDetail,
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
const labelWidth = 250
let isReadOnly = false

const renderApp = () => {
  const option: GanttChartOption = {
    bar: {
      height: barHeight,
      margin: barMargin,
      cornerRadius: barCornerRadius,
    },
    rowHeader: {
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
        @render-row-header="${handleRenderRowHeader}"
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

  // サンプル: バーの中に進捗状況を表示する（ダミーデータ）
  // IDから適当な進捗率を生成
  const progressPercent = (task.id.charCodeAt(task.id.length - 1) * 13) % 100

  // 進捗バーの背景
  const progressBar = document.createElement('div')
  progressBar.style.width = `${progressPercent}%`
  progressBar.style.height = '100%'
  progressBar.style.backgroundColor = 'rgba(255, 255, 255, 0.3)'
  progressBar.style.position = 'absolute'
  progressBar.style.top = '0'
  progressBar.style.left = '0'

  // 進捗率のテキスト
  const progressText = document.createElement('span')
  progressText.textContent = `${progressPercent}%`
  progressText.style.position = 'absolute'
  progressText.style.right = '4px'
  progressText.style.top = '50%'
  progressText.style.transform = 'translateY(-50%)'
  progressText.style.fontSize = '10px'
  progressText.style.color = 'rgba(255, 255, 255, 0.9)'
  progressText.style.fontWeight = 'bold'

  // コンテナに追加
  container.style.overflow = 'hidden'
  container.appendChild(progressBar)
  container.appendChild(progressText)
}

const handleRenderRowHeader = (e: CustomEvent<RenderRowHeaderEventDetail>) => {
  const { container, row } = e.detail
  // サンプル: ラベルを太字にして、IDを小さく表示する
  container.innerHTML = `
    <div style="display: flex; flex-direction: column;">
      <div style="font-weight: bold;">${row.label}</div>
      <div style="font-size: 10px; color: #666;">${row.id}</div>
    </div>`
}

renderApp()

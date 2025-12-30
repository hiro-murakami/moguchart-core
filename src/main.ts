import { html, render } from 'lit'
import '@/components/gantt-chart'
import type { GanttRow, RenderBarContentEventDetail } from '@/types'

let rows: GanttRow[] = Array.from({ length: 50 }, (_, i) => {
  const rowId = String(i + 1)
  const offset = i * 7
  return {
    id: rowId,
    label: `プロジェクト ${rowId}`,
    tasks: [
      {
        id: `${rowId}-1`,
        name: `要件定義 ${rowId}`,
        start: new Date(2025, 11, 16 + offset),
        end: new Date(2025, 11, 21 + offset),
        color: '#3b82f6',
      },
      {
        id: `${rowId}-2`,
        name: `開発 ${rowId}`,
        start: new Date(2025, 11, 23 + offset),
        end: new Date(2026, 0, 20 + offset),
        color: '#10b981',
      },
      {
        id: `${rowId}-3`,
        name: `テスト ${rowId}`,
        start: new Date(2026, 0, 25 + offset),
        end: new Date(2026, 1, 10 + offset),
        color: '#f59e0b',
      },
    ],
  }
})

const chartStart = new Date('2025-12-15')
const pxPerDay = 28 // 共通のスケール
const totalDays = 800 // 表示する日数
const barHeight = 28
const barMargin = 4
const barCornerRadius = 4
const labelWidth = 150
let isReadOnly = false

const renderApp = () => {
  const option = {
    chartStart,
    barHeight,
    barMargin,
    barCornerRadius,
    labelWidth,
    calendar: {
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
        @render-bar-content="${handleRenderBarContent}"
      ></gantt-chart>
    </div>
  `
  render(template, document.getElementById('app')!)
}

function handleRenderBarContent(e: CustomEvent<RenderBarContentEventDetail>) {
  const { container, task } = e.detail

  // サンプル: タスクIDに基づいて擬似的な進捗率を表示
  // 実際には task.progress などのプロパティを使用してください
  const progress = (parseInt(task.id, 10) * 33) % 100

  const progressEl = document.createElement('div')
  progressEl.style.width = `${progress}%`
  progressEl.style.height = '100%'
  progressEl.style.backgroundColor = 'rgba(255, 255, 255, 0.4)'
  progressEl.style.borderRadius = 'inherit'
  container.appendChild(progressEl)

  const textEl = document.createElement('div')
  textEl.textContent = `${progress}%`
  textEl.style.position = 'absolute'
  textEl.style.right = '4px'
  textEl.style.top = '50%'
  textEl.style.transform = 'translateY(-50%)'
  textEl.style.fontSize = '10px'
  textEl.style.color = 'white'
  container.appendChild(textEl)
}

renderApp()

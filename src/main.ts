import { html, render } from 'lit'
import '@/components/gantt-chart'
import type {
  GanttChartOption,
  GanttRow,
  RenderBarContentEventDetail,
  RenderRowHeaderEventDetail,
  RenderTooltipEventDetail,
  TaskUpdateEventDetail,
} from '@/types'
import { testRows } from './test-data'

let rows: GanttRow[] = testRows

const chartStart = new Date()
let pxPerDay = 24
const totalDays = 200 // 表示する日数
let barHeight = 28
const barMargin = 4
const barCornerRadius = 4
let rowHeaderWidth = 200
let isReadOnly = false
let tooltipDelay = 500

const renderApp = () => {
  const option: GanttChartOption = {
    bar: {
      height: barHeight,
      margin: barMargin,
      cornerRadius: barCornerRadius,
    },
    rowHeader: {
      width: rowHeaderWidth,
    },
    calendar: {
      start: chartStart,
      pxPerDay,
    },
    readOnly: isReadOnly,
    tooltipDelay,
  }

  const template = html`
    <div style="padding: 50px; font-family: sans-serif; color: #333;">
      <h2>MoguChart 2</h2>

      <div
        style="margin-bottom: 16px; display: flex; gap: 24px; align-items: center;"
      >
        <label style="display: flex; align-items: center; cursor: pointer;">
          <input
            type="checkbox"
            .checked="${isReadOnly}"
            @change="${(e: Event) => {
              isReadOnly = (e.target as HTMLInputElement).checked
              renderApp()
            }}"
            style="margin-right: 6px;"
          />
          表示専用モード
        </label>

        <label style="display: flex; align-items: center; cursor: pointer;">
          バーの高さ:
          <select
            style="font-size: 16px; padding: 4px; margin-left: 6px;"
            @change="${(e: Event) => {
              barHeight = Number((e.target as HTMLSelectElement).value)
              renderApp()
            }}"
          >
            ${[20, 28, 40, 50, 60].map(
              (h) => html`
                <option value="${h}" ?selected="${barHeight === h}">
                  ${h}px
                </option>
              `,
            )}
          </select>
        </label>

        <label style="display: flex; align-items: center; cursor: pointer;">
          1日の幅:
          <select
            style="font-size: 16px; padding: 4px; margin-left: 6px;"
            @change="${(e: Event) => {
              pxPerDay = Number((e.target as HTMLSelectElement).value)
              renderApp()
            }}"
          >
            ${[12, 24, 32, 48, 64].map(
              (w) => html`
                <option value="${w}" ?selected="${pxPerDay === w}">
                  ${w}px
                </option>
              `,
            )}
          </select>
        </label>

        <label style="display: flex; align-items: center; cursor: pointer;">
          行ヘッダーの幅:
          <select
            style="font-size: 16px; padding: 4px; margin-left: 6px;"
            @change="${(e: Event) => {
              rowHeaderWidth = Number((e.target as HTMLSelectElement).value)
              renderApp()
            }}"
          >
            ${[150, 200, 250, 300, 350].map(
              (w) => html`
                <option value="${w}" ?selected="${rowHeaderWidth === w}">
                  ${w}px
                </option>
              `,
            )}
          </select>
        </label>

        <label style="display: flex; align-items: center; cursor: pointer;">
          ツールチップ遅延:
          <select
            style="font-size: 16px; padding: 4px; margin-left: 6px;"
            @change="${(e: Event) => {
              tooltipDelay = Number((e.target as HTMLSelectElement).value)
              renderApp()
            }}"
          >
            ${[0, 500, 1000].map(
              (d) => html`
                <option value="${d}" ?selected="${tooltipDelay === d}">
                  ${d}ms
                </option>
              `,
            )}
          </select>
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
        @render-tooltip="${handleRenderTooltip}"
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

const handleRenderTooltip = (e: CustomEvent<RenderTooltipEventDetail>) => {
  const { container, task } = e.detail
  // サンプル: ツールチップの内容をカスタマイズ
  container.innerHTML = `
    <div style="font-size: 12px; font-weight: bold; margin-bottom: 4px;">${task.name}</div>
    <div style="font-size: 10px;">${task.start.toLocaleDateString()} - ${task.end.toLocaleDateString()}</div>
    <div style="font-size: 10px; margin-top: 4px; border-top: 1px solid rgba(255,255,255,0.3); padding-top: 2px;">ID: ${task.id}</div>
  `
}

renderApp()

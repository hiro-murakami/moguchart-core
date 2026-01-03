import { html, render } from 'lit'
import '@/components/gantt-chart'
import * as holiday_jp from '@holiday-jp/holiday_jp'
import type {
  GanttChartOption,
  GanttRow,
  RenderBarContentEventDetail,
  RenderRowHeaderEventDetail,
  RenderDragInfoEventDetail,
  RenderTooltipEventDetail,
  TaskClickEventDetail,
  TaskContextMenuEventDetail,
  TaskUpdateEventDetail,
} from '@/types'
import type { ThemeColorPalette } from '@/types'
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
let showDragInfoOverlay = true
let theme: 'light' | 'dark' = 'dark'
let highlightWednesday = false
let enableRowReordering = true

const renderApp = () => {
  const customTheme: Partial<ThemeColorPalette> = {}
  if (highlightWednesday) {
    customTheme.wednesday =
      theme === 'dark' ? 'rgba(253, 224, 71, 0.15)' : '#fef08a'
  }

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
      totalDays,
      isHoliday: holiday_jp.isHoliday,
    },
    readOnly: isReadOnly,
    tooltipDelay,
    showDragInfoOverlay,
    theme,
    customTheme,
    enableRowReordering,
  }

  const appStyles =
    theme === 'dark'
      ? 'background-color: #0f172a; color: #f8fafc;'
      : 'background-color: #ffffff; color: #333;'

  const template = html`
    <div
      style="padding: 50px; font-family: sans-serif; min-height: 100vh; box-sizing: border-box; ${appStyles}"
    >
      <h2>MoguChart 2</h2>

      <div
        style="margin-bottom: 16px; display: flex; gap: 24px; align-items: center; flex-wrap: wrap;"
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
          <input
            type="checkbox"
            .checked="${showDragInfoOverlay}"
            @change="${(e: Event) => {
              showDragInfoOverlay = (e.target as HTMLInputElement).checked
              renderApp()
            }}"
            style="margin-right: 6px;"
          />
          ドラッグ情報を表示
        </label>

        <label style="display: flex; align-items: center; cursor: pointer;">
          <input
            type="checkbox"
            .checked="${highlightWednesday}"
            @change="${(e: Event) => {
              highlightWednesday = (e.target as HTMLInputElement).checked
              renderApp()
            }}"
            style="margin-right: 6px;"
          />
          水曜日を強調
        </label>

        <label style="display: flex; align-items: center; cursor: pointer;">
          <input
            type="checkbox"
            .checked="${enableRowReordering}"
            @change="${(e: Event) => {
              enableRowReordering = (e.target as HTMLInputElement).checked
              renderApp()
            }}"
            style="margin-right: 6px;"
          />
          行の並び替えを有効化
        </label>

        <div style="display: flex; align-items: center;">
          <span style="margin-right: 8px;">テーマ:</span>
          <label
            style="display: flex; align-items: center; cursor: pointer; margin-right: 12px;"
          >
            <input
              type="radio"
              name="theme"
              value="light"
              .checked="${theme === 'light'}"
              @change="${() => {
                theme = 'light'
                renderApp()
              }}"
              style="margin-right: 4px;"
            />
            Light
          </label>
          <label style="display: flex; align-items: center; cursor: pointer;">
            <input
              type="radio"
              name="theme"
              value="dark"
              .checked="${theme === 'dark'}"
              @change="${() => {
                theme = 'dark'
                renderApp()
              }}"
              style="margin-right: 4px;"
            />
            Dark
          </label>
        </div>

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
        theme="${theme}"
        @rows-change="${(e: CustomEvent) => {
          rows = e.detail
        }}"
        @task-update="${handleTaskUpdate}"
        @render-bar-content="${handleRenderBarContent}"
        @render-row-header="${handleRenderRowHeader}"
        @render-tooltip="${handleRenderTooltip}"
        @task-dblclick="${handleTaskDblClick}"
        @task-contextmenu="${handleTaskContextMenu}"
        @render-drag-info="${handleRenderDragInfo}"
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

const handleTaskDblClick = (e: CustomEvent<TaskClickEventDetail>) => {
  const { task } = e.detail
  alert(`詳細編集: ${task.name} (ID: ${task.id})`)
}

const handleTaskContextMenu = (e: CustomEvent<TaskContextMenuEventDetail>) => {
  const { task, event } = e.detail

  // 既存のメニューを削除
  const oldMenu = document.getElementById('custom-context-menu')
  if (oldMenu) {
    oldMenu.remove()
  }

  const menu = document.createElement('div')
  menu.id = 'custom-context-menu'
  menu.style.cssText = `
    position: fixed;
    top: ${event.clientY}px;
    left: ${event.clientX}px;
    background: white;
    border: 1px solid #ccc;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    z-index: 9999;
    border-radius: 4px;
    padding: 4px 0;
    min-width: 150px;
  `

  const items = [
    { label: '編集', action: () => alert(`編集: ${task.name}`) },
    { label: '複製', action: () => alert(`複製: ${task.name}`) },
    { label: '削除', action: () => alert(`削除: ${task.name}`), color: 'red' },
  ]

  items.forEach((item) => {
    const el = document.createElement('div')
    el.textContent = item.label
    el.style.cssText = `
      padding: 8px 12px;
      cursor: pointer;
      font-size: 13px;
      color: ${item.color || '#333'};
    `
    el.onmouseenter = () => (el.style.background = '#f5f5f5')
    el.onmouseleave = () => (el.style.background = 'transparent')
    el.onclick = () => {
      item.action()
      menu.remove()
    }
    menu.appendChild(el)
  })

  document.body.appendChild(menu)

  const closeMenu = () => {
    menu.remove()
    document.removeEventListener('click', closeMenu)
  }

  // 少し遅延させてクリックイベントを登録しないと、即座に閉じてしまう可能性がある
  requestAnimationFrame(() => {
    document.addEventListener('click', closeMenu)
  })
}

const handleRenderDragInfo = (e: CustomEvent<RenderDragInfoEventDetail>) => {
  const { container, task, newStart, newEnd, targetRow } = e.detail
  // サンプル: ドラッグ情報のカスタマイズ
  container.innerHTML = `
    <div style="font-weight: bold; color: #fbbf24; margin-bottom: 4px;">${task.name}</div>
    <div style="font-size: 12px;">${newStart.toLocaleDateString()} - ${newEnd.toLocaleDateString()}</div>
    ${targetRow ? `<div style="font-size: 12px; margin-top: 4px; border-top: 1px solid rgba(255,255,255,0.3); padding-top: 2px;">移動先: ${targetRow.label}</div>` : ''}
  `
}

renderApp()

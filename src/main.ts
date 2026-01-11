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
import dayjs from 'dayjs'

const chartStart = new Date()
chartStart.setHours(0, 0, 0, 0)

const generateDayModeData = (): GanttRow[] => {
  const start = new Date(chartStart)
  const rows: GanttRow[] = []
  for (let i = 1; i <= 50; i++) {
    const offset = (i - 1) % 10
    rows.push({
      id: `row${i}`,
      label: `プロジェクト ${i}`,
      tasks: [
        {
          id: `t${i}-1`,
          name: '要件定義',
          start: new Date(
            start.getFullYear(),
            start.getMonth(),
            start.getDate() + offset,
          ),
          end: new Date(
            start.getFullYear(),
            start.getMonth(),
            start.getDate() + offset + 5,
          ),
          pattern:
            i % 3 === 0
              ? { type: 'diagonal-stripe', color: '#3b82f6' }
              : undefined,
        },
        {
          id: `t${i}-2`,
          name: '設計',
          start: new Date(
            start.getFullYear(),
            start.getMonth(),
            start.getDate() + offset + 6,
          ),
          end: new Date(
            start.getFullYear(),
            start.getMonth(),
            start.getDate() + offset + 15,
          ),
          dependencies: [`t${i}-1`],
        },
      ],
    })
  }
  return rows
}

const generateHourModeData = (): GanttRow[] => {
  const start = new Date(chartStart)
  const setTime = (d: Date, h: number, m: number) => {
    const newDate = new Date(d)
    newDate.setHours(h, m, 0, 0)
    return newDate
  }

  const rows: GanttRow[] = []
  for (let i = 1; i <= 30; i++) {
    const shift = (i - 1) % 3
    rows.push({
      id: `user${i}`,
      label: `担当者 ${i}`,
      tasks: [
        {
          id: `h${i}-1`,
          name: '朝会',
          start: setTime(start, 9, 0),
          end: setTime(start, 10, 0),
          movable: 'none',
          style: 'background-color: #ef4444;',
        },
        {
          id: `h${i}-2`,
          name: 'タスクA',
          start: setTime(start, 10 + shift, 0),
          end: setTime(start, 12 + shift, 0),
        },
        {
          id: `h${i}-3`,
          name: '休憩',
          start: setTime(start, 12, 0),
          end: setTime(start, 13, 0),
          pattern: { type: 'dots', color: '#aaa' },
        },
        {
          id: `h${i}-4`,
          name: 'タスクB',
          start: setTime(start, 13, 0),
          end: setTime(start, 16 + shift, 30),
        },
      ],
    })
  }
  return rows
}

let rows: GanttRow[] = []
let viewMode: 'day' | 'hour' = 'day'

let pxPerDay = 48
let totalDays = 60 // 表示する日数
let barHeight = 28
const barMargin = 4
const barCornerRadius = 4
let rowHeaderWidth = 200
let isReadOnly = false
let tooltipDelay = 500
let showDragInfoOverlay = true
let theme: 'light' | 'dark' = 'dark'
let enableRowReordering = true
let snapDuration = 1440
let showTime = false
let showMonths = true
let showDays = true
let showCurrentTime = true
let showCurrentTimeBadge = false
let currentTimeUpdateInterval = 1000
let enableCustomRendering = true

const setViewMode = (mode: 'day' | 'hour') => {
  viewMode = mode
  if (mode === 'day') {
    pxPerDay = 48
    snapDuration = 1440
    showTime = false
    showMonths = true
    showDays = true
    showCurrentTime = true
    showCurrentTimeBadge = false
    currentTimeUpdateInterval = 1000
    totalDays = 60
    rows = generateDayModeData()
  } else {
    // 時間単位モード: 1時間あたり40px (960px/日)
    pxPerDay = 960
    snapDuration = 15
    showTime = true
    showMonths = false
    showDays = true
    showCurrentTime = true
    showCurrentTimeBadge = true
    currentTimeUpdateInterval = 1000
    totalDays = 1.5
    rows = generateHourModeData()
  }
  renderApp()
}

const renderApp = () => {
  const customTheme: Partial<ThemeColorPalette> = {}

  // 時間単位モードのときは土日・祝日のハイライトを無効化（透明にする）
  if (viewMode === 'hour') {
    customTheme.saturday = 'transparent'
    customTheme.sunday = 'transparent'
    customTheme.holiday = 'transparent'
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
      showTime,
      showMonths,
      showDays,
      showCurrentTime,
      showCurrentTimeBadge,
      currentTimeUpdateInterval,
    },
    readOnly: isReadOnly,
    tooltipDelay,
    showDragInfoOverlay,
    theme,
    customTheme,
    enableRowReordering,
    snapDuration,
  }

  const appStyles =
    theme === 'dark'
      ? 'background-color: #0f172a; color: #f8fafc;'
      : 'background-color: #ffffff; color: #333;'

  const template = html`
    <div
      style="padding: 50px; font-family: sans-serif; min-height: 100vh; box-sizing: border-box; ${appStyles}"
    >
      <h2>MoguChart</h2>

      <div
        style="margin-bottom: 16px; display: flex; gap: 24px; align-items: center; flex-wrap: wrap;"
      >
        <div
          style="display: flex; align-items: center; border-right: 1px solid #ccc; padding-right: 24px;"
        >
          <span style="margin-right: 8px; font-weight: bold;">表示モード:</span>
          <label
            style="display: flex; align-items: center; cursor: pointer; margin-right: 12px;"
          >
            <input
              type="radio"
              name="viewMode"
              value="day"
              .checked="${viewMode === 'day'}"
              @change="${() => setViewMode('day')}"
              style="margin-right: 4px;"
            />
            日単位
          </label>
          <label style="display: flex; align-items: center; cursor: pointer;">
            <input
              type="radio"
              name="viewMode"
              value="hour"
              .checked="${viewMode === 'hour'}"
              @change="${() => setViewMode('hour')}"
              style="margin-right: 4px;"
            />
            時間単位
          </label>
        </div>

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
      </div>

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
            .checked="${enableRowReordering}"
            @change="${(e: Event) => {
              enableRowReordering = (e.target as HTMLInputElement).checked
              renderApp()
            }}"
            style="margin-right: 6px;"
          />
          行の並び替えを有効化
        </label>

        <label style="display: flex; align-items: center; cursor: pointer;">
          <input
            type="checkbox"
            .checked="${currentTimeUpdateInterval > 0}"
            @change="${(e: Event) => {
              currentTimeUpdateInterval = (e.target as HTMLInputElement).checked
                ? 1000
                : 0
              renderApp()
            }}"
            style="margin-right: 6px;"
          />
          現在時刻を自動更新
        </label>

        <label style="display: flex; align-items: center; cursor: pointer;">
          ${viewMode === 'day' ? '表示日数:' : '表示時間:'}
          <input
            type="number"
            min="1"
            style="font-size: 16px; padding: 4px; margin-left: 6px; width: 60px;"
            .value="${viewMode === 'day' ? totalDays : totalDays * 24}"
            @change="${(e: Event) => {
              const val = Number((e.target as HTMLInputElement).value)
              if (viewMode === 'day') {
                totalDays = val
              } else {
                totalDays = val / 24
              }
              renderApp()
            }}"
          />
          ${viewMode === 'day' ? '日' : '時間'}
        </label>

        <label style="display: flex; align-items: center; cursor: pointer;">
          <input
            type="checkbox"
            .checked="${enableCustomRendering}"
            @change="${(e: Event) => {
              enableCustomRendering = (e.target as HTMLInputElement).checked
              renderApp()
            }}"
            style="margin-right: 6px;"
          />
          カスタムレンダリング有効
        </label>
      </div>

      <div
        style="margin-bottom: 16px; display: flex; gap: 24px; align-items: center; flex-wrap: wrap;"
      >
        <label style="display: flex; align-items: center; cursor: pointer;">
          <input
            type="checkbox"
            .checked="${showTime}"
            @change="${(e: Event) => {
              showTime = (e.target as HTMLInputElement).checked
              renderApp()
            }}"
            style="margin-right: 6px;"
          />
          時間を表示
        </label>

        <label style="display: flex; align-items: center; cursor: pointer;">
          <input
            type="checkbox"
            .checked="${showMonths}"
            @change="${(e: Event) => {
              showMonths = (e.target as HTMLInputElement).checked
              renderApp()
            }}"
            style="margin-right: 6px;"
          />
          年月を表示
        </label>

        <label style="display: flex; align-items: center; cursor: pointer;">
          <input
            type="checkbox"
            .checked="${showDays}"
            @change="${(e: Event) => {
              showDays = (e.target as HTMLInputElement).checked
              renderApp()
            }}"
            style="margin-right: 6px;"
          />
          日付を表示
        </label>

        <label style="display: flex; align-items: center; cursor: pointer;">
          <input
            type="checkbox"
            .checked="${showCurrentTime}"
            @change="${(e: Event) => {
              showCurrentTime = (e.target as HTMLInputElement).checked
              renderApp()
            }}"
            style="margin-right: 6px;"
          />
          現在時刻線を表示
        </label>

        <label style="display: flex; align-items: center; cursor: pointer;">
          <input
            type="checkbox"
            .checked="${showCurrentTimeBadge}"
            @change="${(e: Event) => {
              showCurrentTimeBadge = (e.target as HTMLInputElement).checked
              renderApp()
            }}"
            style="margin-right: 6px;"
          />
          現在時刻バッジを表示
        </label>
      </div>

      <div
        style="margin-bottom: 16px; display: flex; gap: 24px; align-items: center; flex-wrap: wrap;"
      >
        <label style="display: flex; align-items: center; cursor: pointer;">
          スナップ単位:
          <select
            style="font-size: 16px; padding: 4px; margin-left: 6px;"
            @change="${(e: Event) => {
              snapDuration = Number((e.target as HTMLSelectElement).value)
              renderApp()
            }}"
          >
            ${[6, 15, 30, 60, 180, 720, 1440].map(
              (d) => html`
                <option value="${d}" ?selected="${snapDuration === d}">
                  ${d === 1440 ? '1日' : `${d}分`}
                </option>
              `,
            )}
          </select>
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
            ${[24, 48, 96, 144, 240, 480, 720, 960, 1440, 2880].map(
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
        @render-bar-content="${enableCustomRendering
          ? handleRenderBarContent
          : undefined}"
        @render-row-header="${enableCustomRendering
          ? handleRenderRowHeader
          : undefined}"
        @render-tooltip="${enableCustomRendering
          ? handleRenderTooltip
          : undefined}"
        @task-dblclick="${handleTaskDblClick}"
        @task-contextmenu="${handleTaskContextMenu}"
        @render-drag-info="${enableCustomRendering
          ? handleRenderDragInfo
          : undefined}"
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
  const formatDateTime = (d: Date) => {
    const h = d.getHours()
    const m = d.getMinutes()
    if (h === 0 && m === 0) {
      return d.toLocaleDateString()
    }
    return `${d.toLocaleDateString()} ${h.toString().padStart(2, '0')}:${m
      .toString()
      .padStart(2, '0')}`
  }
  const period = dayjs(newEnd).diff(dayjs(newStart), 'day')

  // サンプル: ドラッグ情報のカスタマイズ
  container.innerHTML = `
    <div style="font-weight: bold; color: #fbbf24; margin-bottom: 4px;">${task.name}</div>
    <div style="font-size: 12px;">${formatDateTime(newStart)} - ${formatDateTime(newEnd)} (${period})</div>
    ${targetRow ? `<div style="font-size: 12px; margin-top: 4px; border-top: 1px solid rgba(255,255,255,0.3); padding-top: 2px;">移動先: ${targetRow.label}</div>` : ''}
  `
}

setViewMode('day')

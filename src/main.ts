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
  GanttTask,
  TaskDropEventDetail,
  RowHeaderResizeEventDetail,
  RowSelectionChangeEventDetail,
  RowHeaderClickEventDetail,
  RowHeaderContextMenuEventDetail,
} from '@/types'
import type { ThemeColorPalette } from '@/types'
import dayjs from 'dayjs'
import { getPatternStyle } from '@/pattern-utils'

const chartStart = new Date()
chartStart.setHours(0, 0, 0, 0)

const generateDayModeData = (): GanttRow[] => {
  const start = new Date(chartStart)
  const rows: GanttRow[] = []
  for (let i = 1; i <= 50; i++) {
    const offset = (i - 1) % 10
    rows.push({
      id: `row${i}`,
      name: `プロジェクト ${i}`,
      tasks: [
        {
          id: `t${i}-1`,
          name: '要件定義',
          start: new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset),
          end: new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset + 5),
          pattern: i % 3 === 0 ? { type: 'diagonal-stripe', color: '#3b82f6' } : undefined,
          labelStyle: i === 1 ? 'font-weight: bold; color: red;' : undefined,
        },
        {
          id: `t${i}-2`,
          name: '設計',
          start: new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset + 6),
          end: new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset + 15),
          dependencies: [`t${i}-1`],
        },
      ],
      visible: i % 5 !== 0,
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
      name: `担当者 ${i}`,
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
const chartEnd = new Date(chartStart)
chartEnd.setDate(chartStart.getDate() + 60)
let barHeight = 28
const barMargin = 4
const barCornerRadius = 4
let rowHeaderWidth = 200
let rowHeaderResizable = true
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
let enableCustomRendering = false
let showUnassignedTasks = true
let isUnassignedTasksOpen = false
let selectedIds: string[] = []
let showHiddenRows = false

// 追加候補のタスク一覧
let unassignedTasks: GanttTask[] = [
  {
    id: 'new-1',
    name: '新規タスクA',
    start: new Date(), // 期間計算用のダミー
    end: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2日間
    style: 'background-color: #8b5cf6;',
  },
  {
    id: 'new-2',
    name: '新規タスクB',
    start: new Date(),
    end: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5日間
    style: 'background-color: #ec4899;',
  },
  {
    id: 'new-3',
    name: '会議設定',
    start: new Date(),
    end: new Date(Date.now() + 1 * 60 * 60 * 1000), // 1時間
    style: 'background-color: #10b981;',
  },
  {
    id: 'new-4',
    name: 'パターン付きタスク',
    start: new Date(),
    end: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3日間
    style: 'background-color: #f59e0b;',
    pattern: { type: 'diagonal-stripe', color: 'rgba(255, 255, 255, 0.5)' },
  },
  {
    id: 'new-5',
    name: 'ラベルスタイル付き',
    start: new Date(),
    end: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000), // 4日間
    style: 'background-color: #3b82f6;',
    labelStyle: 'font-weight: bold; font-size: 14px; color: yellow;',
  },
]

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
    chartEnd.setDate(chartStart.getDate() + 50)
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
    chartEnd.setTime(chartStart.getTime() + 1.5 * 24 * 60 * 60 * 1000)
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
      resizable: rowHeaderResizable,
      maxWidth: 400,
      minWidth: 100,
    },
    calendar: {
      start: chartStart,
      end: chartEnd,
      pxPerDay,
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
    showHiddenRows,
  }

  const appStyles =
    theme === 'dark' ? 'background-color: #0f172a; color: #f8fafc;' : 'background-color: #ffffff; color: #333;'

  const template = html`
    <style>
      @keyframes pop-in {
        0% {
          opacity: 0;
          transform: scale(0.5);
        }
        100% {
          opacity: 1;
          transform: scale(1);
        }
      }
      @keyframes fade-out {
        to {
          opacity: 0;
          transform: scale(0.9);
        }
      }
      button {
        background-color: #3b82f6;
        color: white;
        border: none;
        padding: 8px 12px;
        border-radius: 4px;
        cursor: pointer;
      }
      button:hover {
        background-color: #2563eb;
      }
    </style>
    <div style="padding: 50px; font-family: sans-serif; min-height: 100vh; box-sizing: border-box; ${appStyles}">
      <h2>MoguChart</h2>

      <div style="margin-bottom: 16px; display: flex; gap: 24px; align-items: center; flex-wrap: wrap;">
        <div style="display: flex; align-items: center; border-right: 1px solid #ccc; padding-right: 24px;">
          <span style="margin-right: 8px; font-weight: bold;">表示モード:</span>
          <label style="display: flex; align-items: center; cursor: pointer; margin-right: 12px;">
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
          <label style="display: flex; align-items: center; cursor: pointer; margin-right: 12px;">
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

      <div style="margin-bottom: 16px; display: flex; gap: 24px; align-items: center; flex-wrap: wrap;">
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
              currentTimeUpdateInterval = (e.target as HTMLInputElement).checked ? 1000 : 0
              renderApp()
            }}"
            style="margin-right: 6px;"
          />
          現在時刻を自動更新
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

        <label style="display: flex; align-items: center; cursor: pointer;">
          <input
            type="checkbox"
            .checked="${rowHeaderResizable}"
            @change="${(e: Event) => {
              rowHeaderResizable = (e.target as HTMLInputElement).checked
              renderApp()
            }}"
            style="margin-right: 6px;"
          />
          行ヘッダーのリサイズ許可
        </label>

        <label style="display: flex; align-items: center; cursor: pointer;">
          <input
            type="checkbox"
            .checked="${showHiddenRows}"
            @change="${(e: Event) => {
              showHiddenRows = (e.target as HTMLInputElement).checked
              renderApp()
            }}"
            style="margin-right: 6px;"
          />
          非表示行を表示 (5行おき)
        </label>
      </div>

      <div style="margin-bottom: 16px; display: flex; gap: 24px; align-items: center; flex-wrap: wrap;">
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

      <div style="margin-bottom: 16px; display: flex; gap: 24px; align-items: center; flex-wrap: wrap;">
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
                <option value="${d}" ?selected="${snapDuration === d}">${d === 1440 ? '1日' : `${d}分`}</option>
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
              (h) => html` <option value="${h}" ?selected="${barHeight === h}">${h}px</option> `,
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
              (w) => html` <option value="${w}" ?selected="${pxPerDay === w}">${w}px</option> `,
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
              (w) => html` <option value="${w}" ?selected="${rowHeaderWidth === w}">${w}px</option> `,
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
            ${[0, 500, 1000].map((d) => html` <option value="${d}" ?selected="${tooltipDelay === d}">${d}ms</option> `)}
          </select>
        </label>
      </div>

      <div style="display: flex; gap: 16px; align-items: flex-start;">
        <div style="flex-grow: 1; min-width: 0;">
          <gantt-chart
            style="height: 50vh;"
            .rows="${rows}"
            .option="${option}"
            .selectedRowIds="${selectedIds}"
            theme="${theme}"
            @rows-change="${(e: CustomEvent) => {
              rows = e.detail
            }}"
            @task-update="${handleTaskUpdate}"
            @render-bar-content="${enableCustomRendering ? handleRenderBarContent : undefined}"
            @render-row-header="${enableCustomRendering ? handleRenderRowHeader : undefined}"
            @render-tooltip="${enableCustomRendering ? handleRenderTooltip : undefined}"
            @task-dblclick="${handleTaskDblClick}"
            @task-contextmenu="${handleTaskContextMenu}"
            @render-drag-info="${enableCustomRendering ? handleRenderDragInfo : undefined}"
            @row-header-resize="${handleRowHeaderResize}"
            @row-selection-change="${(e: CustomEvent<RowSelectionChangeEventDetail>) => {
              selectedIds = e.detail.selectedIds
              renderApp()
            }}"
            id="gantt-chart-instance"
            @task-drop="${handleTaskDrop}"
            @row-header-click="${(e: CustomEvent<RowHeaderClickEventDetail>) => {
              console.log('Row header clicked:', e.detail)
            }}"
            @row-header-contextmenu="${(e: CustomEvent<RowHeaderContextMenuEventDetail>) => {
              console.log('Row header context menu:', e.detail)
            }}"
          />
        </div>

        ${showUnassignedTasks
          ? html`
              <div
                style="
                  width: ${isUnassignedTasksOpen ? '240px' : '50px'};
                  padding: ${isUnassignedTasksOpen ? '16px' : '0'};
                  flex-shrink: 0;
                  background: ${theme === 'dark' ? '#1e293b' : '#f8fafc'};
                  border: 1px solid ${theme === 'dark' ? '#334155' : '#e2e8f0'};
                  border-radius: 8px;
                  height: 50vh;
                  transition: width 0.3s ease, padding 0.3s ease;
                  overflow: hidden;
                  display: flex;
                  flex-direction: column;
                "
              >
                <h3
                  style="
                    margin: 0;
                    padding: ${isUnassignedTasksOpen ? '0' : '10px'};
                    width: 100%;
                    height: ${isUnassignedTasksOpen ? 'auto' : '100%'};
                    box-sizing: border-box;
                    font-size: 16px;
                    cursor: pointer;
                    user-select: none;
                    writing-mode: ${isUnassignedTasksOpen ? 'horizontal-tb' : 'vertical-rl'};
                    transform: none;
                    display: flex;
                    align-items: center;
                    justify-content: 'flex-start';
                    gap: ${isUnassignedTasksOpen ? '4px' : '8px'};
                  "
                  @click="${() => {
                    isUnassignedTasksOpen = !isUnassignedTasksOpen
                    renderApp()
                  }}"
                >
                  <span>◯ 追加候補タスク</span>
                </h3>
                ${isUnassignedTasksOpen
                  ? html` <div
                      style="display: flex; flex-direction: column; gap: 8px; overflow-y: auto; flex-grow: 1; margin-top: 12px;"
                    >
                      ${unassignedTasks.map(
                        (task) => html`
                          <div
                            draggable="true"
                            @dragstart="${(e: DragEvent) => handleTaskDragStart(e, task)}"
                            @dragend="${handleTaskDragEnd}"
                            style="
                              padding: 12px;
                              background: ${theme === 'dark' ? '#334155' : 'white'};
                              border: 1px solid ${theme === 'dark' ? '#475569' : '#cbd5e1'};
                              border-radius: 4px;
                              cursor: grab;
                              user-select: none;
                              box-shadow: 0 1px 2px rgba(0,0,0,0.1);
                            "
                          >
                            <div
                              style="
                                height: 16px;
                                width: 100%;
                                border-radius: 2px;
                                margin-bottom: 8px;
                                ${task.style || ''};
                                ${getPatternStyle(task.pattern)};
                              "
                            ></div>
                            <div style="font-weight: bold; font-size: 14px; margin-bottom: 4px;">${task.name}</div>
                            <div style="font-size: 12px; opacity: 0.7;">
                              期間: ${dayjs(task.end).diff(dayjs(task.start), viewMode === 'day' ? 'day' : 'hour')}
                              ${viewMode === 'day' ? '日' : '時間'}
                            </div>
                          </div>
                        `,
                      )}
                      ${unassignedTasks.length === 0
                        ? html`<div style="opacity: 0.5; font-size: 14px; text-align: center; padding: 20px;">
                            タスクはありません
                          </div>`
                        : ''}
                    </div>`
                  : ''}
              </div>
            `
          : ''}
      </div>
    </div>
  `
  render(template, document.getElementById('app')!)
}

const handleTaskDragStart = (e: DragEvent, task: GanttTask) => {
  if (e.dataTransfer) {
    e.dataTransfer.setData('application/json', JSON.stringify(task))
    e.dataTransfer.effectAllowed = 'copy'

    // ドラッグイメージをカスタマイズ
    const dragImage = document.createElement('div')
    dragImage.id = 'custom-drag-image'
    dragImage.style.cssText = `
      position: absolute;
      top: -9999px;
      left: -9999px;
      width: 180px;
      height: ${barHeight}px;
      border-radius: 4px;
      padding: 0 8px;
      display: flex;
      align-items: center;
      font-size: 12px;
      color: white;
      font-weight: bold;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      background-color: #3b82f6;
      ${task.style || ''};
      ${getPatternStyle(task.pattern)};
    `
    dragImage.textContent = task.name || ''
    document.body.appendChild(dragImage)

    e.dataTransfer.setDragImage(dragImage, 0, 0)
  }
  // チャートコンポーネントにドラッグ中のタスク情報を渡す
  const chart = document.getElementById('gantt-chart-instance') as any
  if (chart) {
    chart.externalDraggingTask = task
  }
}

const handleTaskDragEnd = () => {
  const chart = document.getElementById('gantt-chart-instance') as any
  if (chart) {
    chart.externalDraggingTask = null
  }
  const dragImage = document.getElementById('custom-drag-image')
  if (dragImage) {
    dragImage.remove()
  }
}

const handleTaskDrop = (e: CustomEvent<TaskDropEventDetail>) => {
  const { task, dropDate, targetRowId } = e.detail
  try {
    // コンポーネントから受け取った日時を使用
    const newStart = new Date(dropDate)

    // 過去の日付にならないように調整（必要であれば）
    // if (newStart < chartStart) return

    // タスクの日時を更新
    const duration = new Date(task.end).getTime() - new Date(task.start).getTime()

    // スナップ処理（簡易）
    if (viewMode === 'day') {
      newStart.setHours(0, 0, 0, 0)
    } else {
      // 時間モードなら分をスナップ単位に合わせるなどの処理が可能
      const minutes = newStart.getMinutes()
      const snappedMinutes = Math.round(minutes / snapDuration) * snapDuration
      newStart.setMinutes(snappedMinutes, 0, 0)
    }

    const newEnd = new Date(newStart.getTime() + duration)

    // 新しいタスクオブジェクトを作成
    const newTask: GanttTask = {
      ...task,
      id: `${task.id}-${Date.now()}`, // IDを一意にする
      start: newStart,
      end: newEnd,
      style: `${task.style || ''}; transform-origin: center; animation: pop-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;`,
    }

    // 行データを更新
    rows = rows.map((row) => {
      if (row.id === targetRowId) {
        return {
          ...row,
          tasks: [...row.tasks, newTask],
        }
      }
      return row
    })

    // 候補リストから削除しないように変更
    // unassignedTasks = unassignedTasks.filter((t) => t.id !== task.id)
    renderApp()

    // アニメーション終了後にスタイルをクリーンアップ
    // (仮想スクロールなどで再描画された際に再度アニメーションしないようにするため)
    setTimeout(() => {
      rows = rows.map((row) => {
        if (row.id === targetRowId) {
          return {
            ...row,
            tasks: row.tasks.map((t) => {
              if (t.id === newTask.id) {
                // animationプロパティを除去
                const newStyle = t.style?.replace(/animation:[^;]+;?/g, '') || ''
                return { ...t, style: newStyle }
              }
              return t
            }),
          }
        }
        return row
      })
      renderApp()
    }, 500)
  } catch (err) {
    console.error('Failed to drop task:', err)
  }
}

const handleTaskUpdate = (e: CustomEvent<TaskUpdateEventDetail>) => {
  if (e.detail.isDragging) {
    return
  }
  console.log('Task Update:', e.detail)
}

const handleRowHeaderResize = (e: CustomEvent<RowHeaderResizeEventDetail>) => {
  console.log('Row Header Resized:', e.detail)
}

const handleRenderBarContent = (e: CustomEvent<RenderBarContentEventDetail>) => {
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
      <div style="font-weight: bold;">${row.name}</div>
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
    {
      label: '削除',
      action: () => {
        // 1. 削除アニメーションを適用
        rows = rows.map((row) => ({
          ...row,
          tasks: row.tasks.map((t) => {
            if (t.id === task.id) {
              return {
                ...t,
                style: `${t.style || ''}; animation: fade-out 0.3s ease-out forwards; pointer-events: none;`,
              }
            }
            return t
          }),
        }))
        renderApp()

        // 2. アニメーション終了後にデータを削除
        setTimeout(() => {
          rows = rows.map((row) => ({
            ...row,
            tasks: row.tasks.filter((t) => t.id !== task.id),
          }))
          renderApp()
        }, 300)
      },
      color: 'red',
    },
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
    return `${d.toLocaleDateString()} ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
  }
  const period = dayjs(newEnd).diff(dayjs(newStart), 'day')

  // サンプル: ドラッグ情報のカスタマイズ
  container.innerHTML = `
    <div style="font-weight: bold; color: #fbbf24; margin-bottom: 4px;">${task.name}</div>
    <div style="font-size: 12px;">${formatDateTime(newStart)} - ${formatDateTime(newEnd)} (${period})</div>
    ${targetRow ? `<div style="font-size: 12px; margin-top: 4px; border-top: 1px solid rgba(255,255,255,0.3); padding-top: 2px;">移動先: ${targetRow.name}</div>` : ''}
  `
}

setViewMode('day')

import { html, render } from 'lit'
import { GanttChartElement } from '@/components/gantt-chart'
import * as holiday_jp from '@holiday-jp/holiday_jp'
import type {
  GanttChartOption,
  GanttRow,
  TaskClickEventDetail,
  TaskContextMenuEventDetail,
  TaskUpdateEventDetail,
  GanttTask,
  TaskDropEventDetail,
  RowHeaderResizeEventDetail,
  RowSelectionChangeEventDetail,
  RowHeaderClickEventDetail,
  RowHeaderContextMenuEventDetail,
  BarSelectionChangeEventDetail,
} from '@/core/types'
import type { ThemeColorPalette } from '@/core/types'
import type { MoguchartLocale } from '@/core/i18n'
import { jaLocale, enLocale } from '@/core/i18n'
import dayjs from 'dayjs'
import { getPatternStyle } from '@/core/patterns'
import { jaTexts, enTexts } from './i18n'
import type { DemoTexts } from './i18n'
import {
  generateDayModeData,
  generateWeekModeData,
  generateHourModeData,
  generateUnassignedTasks,
  chartStart,
} from './data'

// windowオブジェクトの型拡張
declare global {
  interface Window {
    _systemThemeListenerAdded: boolean
  }
}

let currentLang: 'ja' | 'en' = 'ja'
let currentLocale: MoguchartLocale = jaLocale
let t: DemoTexts = jaTexts

const setLang = (lang: 'ja' | 'en') => {
  currentLang = lang
  currentLocale = lang === 'ja' ? jaLocale : enLocale
  t = lang === 'ja' ? jaTexts : enTexts
  // データを言語変更時に再生成
  if (viewMode === 'day') {
    rows = generateDayModeData(t)
  } else if (viewMode === 'week') {
    rows = generateWeekModeData(t)
  } else {
    rows = generateHourModeData(t)
  }
  unassignedTasks = generateUnassignedTasks(t)
  renderApp()
}

let rows: GanttRow[] = []
let viewMode: 'day' | 'week' | 'hour' = 'day'

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
let theme: 'light' | 'dark' | undefined = undefined // Default to Auto (System)
let enableRowReordering = true
let snapDuration = 1440
let showTime = false
let showMonths = true
let showDays = true
let showWeeks = false
let showCurrentTime = true
let showCurrentTimeBadge = false
let currentTimeUpdateInterval = 1000
let enableCustomRendering = false
let showUnassignedTasks = true
let isUnassignedTasksOpen = false
let selectedIds: string[] = []
let selectedTaskIds: string[] = []
let showHiddenRows = false
let weekStartDay: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 1

let unassignedTasks: GanttTask[] = generateUnassignedTasks(t)

const setViewMode = (mode: 'day' | 'week' | 'hour') => {
  viewMode = mode
  if (mode === 'day') {
    pxPerDay = 48
    snapDuration = 1440
    showTime = false
    showMonths = true
    showDays = true
    showWeeks = false
    showCurrentTime = true
    showCurrentTimeBadge = false
    currentTimeUpdateInterval = 1000
    chartEnd.setDate(chartStart.getDate() + 50)
    rows = generateDayModeData(t)
  } else if (mode === 'week') {
    // 週単位モード: 1日あたり12px (1週間 ≈ 84px)
    pxPerDay = 12
    snapDuration = 1440
    showTime = false
    showMonths = true
    showDays = false
    showWeeks = true
    showCurrentTime = true
    showCurrentTimeBadge = false
    currentTimeUpdateInterval = 1000
    chartEnd.setDate(chartStart.getDate() + 120)
    rows = generateWeekModeData(t)
  } else {
    // 時間単位モード: 1時間あたり40px (960px/日)
    pxPerDay = 960
    snapDuration = 15
    showTime = true
    showMonths = false
    showDays = true
    showWeeks = false
    showCurrentTime = true
    showCurrentTimeBadge = true
    currentTimeUpdateInterval = 1000
    chartEnd.setTime(chartStart.getTime() + 1.5 * 24 * 60 * 60 * 1000)
    rows = generateHourModeData(t)
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
      showWeeks,
      weekStartDay,
      showCurrentTime,
      showCurrentTimeBadge,
      currentTimeUpdateInterval,
      milestones: [
        {
          id: 'ms-1',
          name: t.alphaRelease,
          start: new Date(chartStart.getFullYear(), chartStart.getMonth(), chartStart.getDate() + 7),
          color: '#8b5cf6',
        },
        {
          id: 'ms-2',
          name: t.betaRelease,
          start: new Date(chartStart.getFullYear(), chartStart.getMonth(), chartStart.getDate() + 14),
          color: '#f59e0b',
        },
        {
          id: 'ms-3',
          name: t.officialRelease,
          start: new Date(chartStart.getFullYear(), chartStart.getMonth(), chartStart.getDate() + 30),
          color: '#10b981',
        },
      ],
    },
    readOnly: isReadOnly,
    tooltipDelay,
    showDragInfoOverlay,
    theme,
    customTheme,
    enableRowReordering,
    snapDuration,
    showHiddenRows,
    customRendering: enableCustomRendering
      ? {
          barContent: (task) => {
            const progressPercent = (task.id.charCodeAt(task.id.length - 1) * 13) % 100
            return html`
              <div
                style="position: relative; height: 100%; display: flex; align-items: center; justify-content: center; overflow: hidden; padding: 0 4px;"
                title="${task.name}"
              >
                <div
                  style="width: ${progressPercent}%; height: 100%; background-color: rgba(255, 255, 255, 0.3); position: absolute; top: 0; left: 0;"
                ></div>
                <span
                  style="font-weight: bold; font-size: 14px; text-shadow: 1px 1px 2px rgba(0,0,0,0.5); position: relative; z-index: 1;"
                >
                  ${task.name}
                </span>
                <span
                  style="position: absolute; right: 4px; top: 50%; transform: translateY(-50%); font-size: 10px; color: rgba(255, 255, 255, 0.9); font-weight: bold; z-index: 2;"
                >
                  ${progressPercent}%
                </span>
              </div>
            `
          },
          rowHeaderContent: (row) => html`
            <div style="display: flex; flex-direction: column; padding: 8px;">
              <div style="font-weight: bold;">${row.name}</div>
              <div style="font-size: 10px; color: #666;">${row.id}</div>
            </div>
          `,
          tooltip: (task) => html`
            <div style="font-size: 12px; font-weight: bold; margin-bottom: 4px;">${task.name}</div>
            <div style="font-size: 10px;">${task.start.toLocaleDateString()} - ${task.end.toLocaleDateString()}</div>
            <div
              style="font-size: 10px; margin-top: 4px; border-top: 1px solid rgba(255,255,255,0.3); padding-top: 2px;"
            >
              ID: ${task.id}
            </div>
          `,
          dragInfo: (task, newStart, newEnd, targetRow) => {
            const formatDateTime = (d: Date) => {
              const h = d.getHours()
              const m = d.getMinutes()
              if (h === 0 && m === 0) {
                return d.toLocaleDateString()
              }
              return `${d.toLocaleDateString()} ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
            }
            const period = dayjs(newEnd).diff(dayjs(newStart), 'day')
            return html`
              <div style="font-weight: bold; color: #fbbf24; margin-bottom: 4px;">${task.name}</div>
              <div style="font-size: 12px;">${formatDateTime(newStart)} - ${formatDateTime(newEnd)} (${period})</div>
              ${targetRow
                ? html`<div
                    style="font-size: 12px; margin-top: 4px; border-top: 1px solid rgba(255,255,255,0.3); padding-top: 2px;"
                  >
                    ${t.moveTo(targetRow.name)}
                  </div>`
                : ''}
            `
          },
        }
      : undefined,
    locale: currentLocale,
  }

  const systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)')
  const effectiveTheme = theme || (systemThemeQuery.matches ? 'dark' : 'light')

  // システムテーマ変更時に再レンダリングするリスナーを設定（一度だけ）
  if (!window._systemThemeListenerAdded) {
    systemThemeQuery.addEventListener('change', () => {
      // Auto設定の場合のみ再レンダリング
      if (theme === undefined) {
        renderApp()
      }
    })
    window._systemThemeListenerAdded = true
  }

  const appStyles =
    effectiveTheme === 'dark' ? 'background-color: #0f172a; color: #f8fafc;' : 'background-color: #ffffff; color: #333;'

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
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
        <h2 style="margin: 0;">MoguChart</h2>
        <div style="display: flex; gap: 4px;">
          <button
            style="padding: 6px 14px; font-size: 13px; border-radius: 4px; border: 1px solid #ccc; cursor: pointer; ${currentLang ===
            'ja'
              ? 'background-color: #3b82f6; color: white; border-color: #3b82f6;'
              : `background-color: ${effectiveTheme === 'dark' ? '#1e293b' : '#f8fafc'}; color: ${effectiveTheme === 'dark' ? '#f8fafc' : '#333'};`}"
            @click="${() => setLang('ja')}"
          >
            日本語
          </button>
          <button
            style="padding: 6px 14px; font-size: 13px; border-radius: 4px; border: 1px solid #ccc; cursor: pointer; ${currentLang ===
            'en'
              ? 'background-color: #3b82f6; color: white; border-color: #3b82f6;'
              : `background-color: ${effectiveTheme === 'dark' ? '#1e293b' : '#f8fafc'}; color: ${effectiveTheme === 'dark' ? '#f8fafc' : '#333'};`}"
            @click="${() => setLang('en')}"
          >
            English
          </button>
        </div>
      </div>

      <div style="margin-bottom: 16px; display: flex; gap: 24px; align-items: center; flex-wrap: wrap;">
        <div style="display: flex; align-items: center; border-right: 1px solid #ccc; padding-right: 24px;">
          <span style="margin-right: 8px; font-weight: bold;">${t.viewMode}</span>
          <label style="display: flex; align-items: center; cursor: pointer; margin-right: 12px;">
            <input
              type="radio"
              name="viewMode"
              value="day"
              .checked="${viewMode === 'day'}"
              @change="${() => setViewMode('day')}"
              style="margin-right: 4px;"
            />
            ${t.dayUnit}
          </label>
          <label style="display: flex; align-items: center; cursor: pointer; margin-right: 12px;">
            <input
              type="radio"
              name="viewMode"
              value="week"
              .checked="${viewMode === 'week'}"
              @change="${() => setViewMode('week')}"
              style="margin-right: 4px;"
            />
            ${t.weekUnit}
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
            ${t.hourUnit}
          </label>
        </div>

        <div style="display: flex; align-items: center;">
          <span style="margin-right: 8px;">${t.theme}</span>
          <label style="display: flex; align-items: center; cursor: pointer; margin-right: 12px;">
            <input
              type="radio"
              name="theme"
              value="auto"
              .checked="${theme === undefined}"
              @change="${() => {
                theme = undefined
                renderApp()
              }}"
              style="margin-right: 4px;"
            />
            Auto
          </label>
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
          ${t.readOnlyMode}
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
          ${t.showDragInfo}
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
          ${t.enableRowReorder}
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
          ${t.autoUpdateTime}
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
          ${t.customRendering}
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
          ${t.rowHeaderResize}
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
          ${t.showHiddenRows}
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
          ${t.showTime}
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
          ${t.showYearMonth}
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
          ${t.showDates}
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
          ${t.showCurrentTimeLine}
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
          ${t.showCurrentTimeBadge}
        </label>

        ${viewMode === 'week'
          ? html`
              <label style="display: flex; align-items: center; cursor: pointer;">
                ${t.weekStartDay}
                <select
                  style="font-size: 16px; padding: 4px; margin-left: 6px;"
                  @change="${(e: Event) => {
                    weekStartDay = Number((e.target as HTMLSelectElement).value) as 0 | 1 | 2 | 3 | 4 | 5 | 6
                    renderApp()
                  }}"
                >
                  ${t.dayNames.map(
                    (name: string, i: number) => html`
                      <option value="${i}" ?selected="${weekStartDay === i}">${name}</option>
                    `,
                  )}
                </select>
              </label>
            `
          : ''}
      </div>

      <div style="margin-bottom: 16px; display: flex; gap: 24px; align-items: center; flex-wrap: wrap;">
        <label style="display: flex; align-items: center; cursor: pointer;">
          ${t.snapUnit}
          <select
            style="font-size: 16px; padding: 4px; margin-left: 6px;"
            @change="${(e: Event) => {
              snapDuration = Number((e.target as HTMLSelectElement).value)
              renderApp()
            }}"
          >
            ${[6, 15, 30, 60, 180, 720, 1440].map(
              (d) => html`
                <option value="${d}" ?selected="${snapDuration === d}">${d === 1440 ? t.oneDay : t.minutes(d)}</option>
              `,
            )}
          </select>
        </label>

        <label style="display: flex; align-items: center; cursor: pointer;">
          ${t.barHeight}
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
          ${t.dayWidth}
          <select
            style="font-size: 16px; padding: 4px; margin-left: 6px;"
            @change="${(e: Event) => {
              pxPerDay = Number((e.target as HTMLSelectElement).value)
              renderApp()
            }}"
          >
            ${[12, 24, 48, 96, 144, 240, 480, 720, 960, 1440, 2880].map(
              (w) => html` <option value="${w}" ?selected="${pxPerDay === w}">${w}px</option> `,
            )}
          </select>
        </label>

        <label style="display: flex; align-items: center; cursor: pointer;">
          ${t.rowHeaderWidth}
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
          ${t.tooltipDelay}
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
            @task-dblclick="${handleTaskDblClick}"
            @task-contextmenu="${handleTaskContextMenu}"
            @row-header-resize="${handleRowHeaderResize}"
            @row-selection-change="${(e: CustomEvent<RowSelectionChangeEventDetail>) => {
              selectedIds = e.detail.selectedIds
              renderApp()
            }}"
            .selectedTaskIds="${selectedTaskIds}"
            @bar-selection-change="${(e: CustomEvent<BarSelectionChangeEventDetail>) => {
              selectedTaskIds = e.detail.selectedIds
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
                  background: ${effectiveTheme === 'dark' ? '#1e293b' : '#f8fafc'};
                  border: 1px solid ${effectiveTheme === 'dark' ? '#334155' : '#e2e8f0'};
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
                  <span>${t.candidateTasks}</span>
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
                              background: ${effectiveTheme === 'dark' ? '#334155' : 'white'};
                              border: 1px solid ${effectiveTheme === 'dark' ? '#475569' : '#cbd5e1'};
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
                              ${t.duration}
                              ${dayjs(task.end).diff(dayjs(task.start), viewMode === 'day' ? 'day' : 'hour')}
                              ${viewMode === 'day' ? t.daysUnit : t.hoursUnit}
                            </div>
                          </div>
                        `,
                      )}
                      ${unassignedTasks.length === 0
                        ? html`<div style="opacity: 0.5; font-size: 14px; text-align: center; padding: 20px;">
                            ${t.noTasks}
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
  const chart = document.getElementById('gantt-chart-instance') as GanttChartElement
  if (chart) {
    chart.externalDraggingTask = task
  }
}

const handleTaskDragEnd = () => {
  const chart = document.getElementById('gantt-chart-instance') as GanttChartElement
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
    const newStart = new Date(dropDate)
    const duration = new Date(task.end).getTime() - new Date(task.start).getTime()

    // スナップ処理（簡易）
    if (viewMode === 'day' || viewMode === 'week') {
      newStart.setHours(0, 0, 0, 0)
    } else {
      const minutes = newStart.getMinutes()
      const snappedMinutes = Math.round(minutes / snapDuration) * snapDuration
      newStart.setMinutes(snappedMinutes, 0, 0)
    }

    const newEnd = new Date(newStart.getTime() + duration)

    const newTask: GanttTask = {
      ...task,
      id: `${task.id}-${Date.now()}`,
      start: newStart,
      end: newEnd,
      style: `${task.style || ''}; transform-origin: center; animation: pop-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;`,
    }

    rows = rows.map((row) => {
      if (row.id === targetRowId) {
        return { ...row, tasks: [...row.tasks, newTask] }
      }
      return row
    })
    renderApp()

    // アニメーション終了後にスタイルをクリーンアップ
    setTimeout(() => {
      rows = rows.map((row) => {
        if (row.id === targetRowId) {
          return {
            ...row,
            tasks: row.tasks.map((t) => {
              if (t.id === newTask.id) {
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

const handleTaskDblClick = (e: CustomEvent<TaskClickEventDetail>) => {
  const { task } = e.detail
  alert(t.editDetail(task.name || '', task.id))
}

const handleTaskContextMenu = (e: CustomEvent<TaskContextMenuEventDetail>) => {
  const { task, event } = e.detail

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
    { label: t.edit, action: () => alert(t.editAction(task.name || '')) },
    { label: t.duplicate, action: () => alert(t.duplicateAction(task.name || '')) },
    {
      label: t.delete_,
      action: () => {
        const currentSelectedIds = selectedTaskIds
        const isMultiDelete = currentSelectedIds.includes(task.id)
        const targetIds = isMultiDelete ? currentSelectedIds : [task.id]

        rows = rows.map((row) => ({
          ...row,
          tasks: row.tasks.map((taskItem) => {
            if (targetIds.includes(taskItem.id)) {
              return {
                ...taskItem,
                style: `${taskItem.style || ''}; animation: fade-out 0.3s ease-out forwards; pointer-events: none;`,
              }
            }
            return taskItem
          }),
        }))
        renderApp()

        setTimeout(() => {
          rows = rows.map((row) => ({
            ...row,
            tasks: row.tasks.filter((taskItem) => !targetIds.includes(taskItem.id)),
          }))
          if (isMultiDelete) {
            selectedTaskIds = []
          }
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

  requestAnimationFrame(() => {
    document.addEventListener('click', closeMenu)
  })
}

setViewMode('day')

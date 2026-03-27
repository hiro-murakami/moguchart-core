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
  GanttMarker,
} from '@/types'
import type { ThemeColorPalette } from '@/types'
import type { MoguchartLocale } from './i18n'
import { jaLocale, enLocale } from './i18n'
import dayjs from 'dayjs'
import { getPatternStyle } from '@/pattern-utils'

// デモページ用UIテキスト定義
interface DemoTexts {
  viewMode: string
  dayUnit: string
  hourUnit: string
  theme: string
  readOnlyMode: string
  showDragInfo: string
  enableRowReorder: string
  autoUpdateTime: string
  customRendering: string
  rowHeaderResize: string
  showHiddenRows: string
  showTime: string
  showYearMonth: string
  showDates: string
  showCurrentTimeLine: string
  showCurrentTimeBadge: string
  snapUnit: string
  barHeight: string
  dayWidth: string
  rowHeaderWidth: string
  tooltipDelay: string
  oneDay: string
  minutes: (n: number) => string
  candidateTasks: string
  duration: string
  daysUnit: string
  hoursUnit: string
  noTasks: string
  // データ用テキスト
  project: (n: number) => string
  requirementsDefinition: string
  design: string
  assignee: (n: number) => string
  morningMeeting: string
  taskA: string
  break_: string
  taskB: string
  reviewDeadline: string
  releaseScheduled: string
  alphaRelease: string
  betaRelease: string
  officialRelease: string
  newTaskA: string
  newTaskB: string
  meetingSetup: string
  patternTask: string
  labelStyleTask: string
  // コンテキストメニュー
  edit: string
  duplicate: string
  delete_: string
  editDetail: (name: string, id: string) => string
  editAction: (name: string) => string
  duplicateAction: (name: string) => string
  moveTo: (name: string) => string
}

const jaTexts: DemoTexts = {
  viewMode: '表示モード:',
  dayUnit: '日単位',
  hourUnit: '時間単位',
  theme: 'テーマ:',
  readOnlyMode: '表示専用モード',
  showDragInfo: 'ドラッグ情報を表示',
  enableRowReorder: '行の並び替えを有効化',
  autoUpdateTime: '現在時刻を自動更新',
  customRendering: 'カスタムレンダリング有効',
  rowHeaderResize: '行ヘッダーのリサイズ許可',
  showHiddenRows: '非表示行を表示 (5行おき)',
  showTime: '時間を表示',
  showYearMonth: '年月を表示',
  showDates: '日付を表示',
  showCurrentTimeLine: '現在時刻線を表示',
  showCurrentTimeBadge: '現在時刻バッジを表示',
  snapUnit: 'スナップ単位:',
  barHeight: 'バーの高さ:',
  dayWidth: '1日の幅:',
  rowHeaderWidth: '行ヘッダーの幅:',
  tooltipDelay: 'ツールチップ遅延:',
  oneDay: '1日',
  minutes: (n) => `${n}分`,
  candidateTasks: '◯ 追加候補タスク',
  duration: '期間:',
  daysUnit: '日',
  hoursUnit: '時間',
  noTasks: 'タスクはありません',
  project: (n) => `プロジェクト ${n}`,
  requirementsDefinition: '要件定義',
  design: '設計',
  assignee: (n) => `担当者 ${n}`,
  morningMeeting: '朝会',
  taskA: 'タスクA',
  break_: '休憩',
  taskB: 'タスクB',
  reviewDeadline: 'レビュー期限',
  releaseScheduled: 'リリース予定',
  alphaRelease: 'α版リリース',
  betaRelease: 'β版リリース',
  officialRelease: '正式リリース',
  newTaskA: '新規タスクA',
  newTaskB: '新規タスクB',
  meetingSetup: '会議設定',
  patternTask: 'パターン付きタスク',
  labelStyleTask: 'ラベルスタイル付き',
  edit: '編集',
  duplicate: '複製',
  delete_: '削除',
  editDetail: (name, id) => `詳細編集: ${name} (ID: ${id})`,
  editAction: (name) => `編集: ${name}`,
  duplicateAction: (name) => `複製: ${name}`,
  moveTo: (name) => `移動先: ${name}`,
}

const enTexts: DemoTexts = {
  viewMode: 'View Mode:',
  dayUnit: 'Day',
  hourUnit: 'Hour',
  theme: 'Theme:',
  readOnlyMode: 'Read Only',
  showDragInfo: 'Show Drag Info',
  enableRowReorder: 'Enable Row Reorder',
  autoUpdateTime: 'Auto Update Time',
  customRendering: 'Custom Rendering',
  rowHeaderResize: 'Resizable Row Header',
  showHiddenRows: 'Show Hidden Rows (every 5)',
  showTime: 'Show Time',
  showYearMonth: 'Show Year/Month',
  showDates: 'Show Dates',
  showCurrentTimeLine: 'Show Current Time Line',
  showCurrentTimeBadge: 'Show Current Time Badge',
  snapUnit: 'Snap Unit:',
  barHeight: 'Bar Height:',
  dayWidth: 'Day Width:',
  rowHeaderWidth: 'Row Header Width:',
  tooltipDelay: 'Tooltip Delay:',
  oneDay: '1 day',
  minutes: (n) => `${n} min`,
  candidateTasks: '◯ Unassigned Tasks',
  duration: 'Duration:',
  daysUnit: 'days',
  hoursUnit: 'hours',
  noTasks: 'No tasks',
  project: (n) => `Project ${n}`,
  requirementsDefinition: 'Requirements',
  design: 'Design',
  assignee: (n) => `Assignee ${n}`,
  morningMeeting: 'Morning Meeting',
  taskA: 'Task A',
  break_: 'Break',
  taskB: 'Task B',
  reviewDeadline: 'Review Deadline',
  releaseScheduled: 'Release Planned',
  alphaRelease: 'Alpha Release',
  betaRelease: 'Beta Release',
  officialRelease: 'Official Release',
  newTaskA: 'New Task A',
  newTaskB: 'New Task B',
  meetingSetup: 'Meeting Setup',
  patternTask: 'Patterned Task',
  labelStyleTask: 'Styled Label',
  edit: 'Edit',
  duplicate: 'Duplicate',
  delete_: 'Delete',
  editDetail: (name, id) => `Edit: ${name} (ID: ${id})`,
  editAction: (name) => `Edit: ${name}`,
  duplicateAction: (name) => `Duplicate: ${name}`,
  moveTo: (name) => `Move to: ${name}`,
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
    rows = generateDayModeData()
  } else {
    rows = generateHourModeData()
  }
  regenerateUnassignedTasks()
  renderApp()
}

const chartStart = new Date()
chartStart.setHours(0, 0, 0, 0)

// windowオブジェクトの型拡張
declare global {
  interface Window {
    _systemThemeListenerAdded: boolean
  }
}

const generateDayModeData = (): GanttRow[] => {
  const start = new Date(chartStart)
  const rows: GanttRow[] = []
  for (let i = 1; i <= 50; i++) {
    const offset = (i - 1) % 10
    const markers: GanttMarker[] | undefined =
      i <= 3
        ? [
            {
              id: `marker-${i}-1`,
              date: new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset + 3),
              anchor: 'end',
              type: 'triangle-right',
              color: '#ef4444',
              name: t.reviewDeadline,
            },
            {
              id: `marker-${i}-2`,
              date: new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset + 20),
              anchor: 'start',
              type: 'triangle-left',
              color: '#ef4444',
              name: t.releaseScheduled,
            },
          ]
        : undefined
    rows.push({
      id: `row${i}`,
      name: t.project(i),
      tasks: [
        {
          id: `t${i}-1`,
          name: t.requirementsDefinition,
          start: new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset),
          end: new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset + 5),
          pattern: i % 3 === 0 ? { type: 'diagonal-stripe', color: '#3b82f6' } : undefined,
          labelStyle: i === 1 ? 'font-weight: bold; color: red;' : undefined,
        },
        {
          id: `t${i}-2`,
          name: t.design,
          start: new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset + 6),
          end: new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset + 15),
          dependencies: [`t${i}-1`],
        },
      ],
      markers,
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
      name: t.assignee(i),
      tasks: [
        {
          id: `h${i}-1`,
          name: t.morningMeeting,
          start: setTime(start, 9, 0),
          end: setTime(start, 10, 0),
          movable: 'none',
          style: 'background-color: #ef4444;',
        },
        {
          id: `h${i}-2`,
          name: t.taskA,
          start: setTime(start, 10 + shift, 0),
          end: setTime(start, 12 + shift, 0),
        },
        {
          id: `h${i}-3`,
          name: t.break_,
          start: setTime(start, 12, 0),
          end: setTime(start, 13, 0),
          pattern: { type: 'dots', color: '#aaa' },
        },
        {
          id: `h${i}-4`,
          name: t.taskB,
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
let theme: 'light' | 'dark' | undefined = undefined // Default to Auto (System)
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
let selectedTaskIds: string[] = []
let showHiddenRows = false

// 追加候補のタスク一覧
const regenerateUnassignedTasks = () => {
  unassignedTasks = [
    {
      id: 'new-1',
      name: t.newTaskA,
      start: new Date(),
      end: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      style: 'background-color: #8b5cf6;',
    },
    {
      id: 'new-2',
      name: t.newTaskB,
      start: new Date(),
      end: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      style: 'background-color: #ec4899;',
    },
    {
      id: 'new-3',
      name: t.meetingSetup,
      start: new Date(),
      end: new Date(Date.now() + 1 * 60 * 60 * 1000),
      style: 'background-color: #10b981;',
    },
    {
      id: 'new-4',
      name: t.patternTask,
      start: new Date(),
      end: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      style: 'background-color: #f59e0b;',
      pattern: { type: 'diagonal-stripe', color: 'rgba(255, 255, 255, 0.5)' },
    },
    {
      id: 'new-5',
      name: t.labelStyleTask,
      start: new Date(),
      end: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
      style: 'background-color: #3b82f6;',
      labelStyle: 'font-weight: bold; font-size: 14px; color: yellow;',
    },
  ]
}
let unassignedTasks: GanttTask[] = []
regenerateUnassignedTasks()

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
            style="padding: 6px 14px; font-size: 13px; border-radius: 4px; border: 1px solid #ccc; cursor: pointer; ${currentLang === 'ja' ? 'background-color: #3b82f6; color: white; border-color: #3b82f6;' : `background-color: ${effectiveTheme === 'dark' ? '#1e293b' : '#f8fafc'}; color: ${effectiveTheme === 'dark' ? '#f8fafc' : '#333'};`}"
            @click="${() => setLang('ja')}"
          >日本語</button>
          <button
            style="padding: 6px 14px; font-size: 13px; border-radius: 4px; border: 1px solid #ccc; cursor: pointer; ${currentLang === 'en' ? 'background-color: #3b82f6; color: white; border-color: #3b82f6;' : `background-color: ${effectiveTheme === 'dark' ? '#1e293b' : '#f8fafc'}; color: ${effectiveTheme === 'dark' ? '#f8fafc' : '#333'};`}"
            @click="${() => setLang('en')}"
          >English</button>
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
            ${[24, 48, 96, 144, 240, 480, 720, 960, 1440, 2880].map(
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
                              ${t.duration} ${dayjs(task.end).diff(dayjs(task.start), viewMode === 'day' ? 'day' : 'hour')}
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

const handleTaskDblClick = (e: CustomEvent<TaskClickEventDetail>) => {
  const { task } = e.detail
  alert(t.editDetail(task.name || '', task.id))
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
    { label: t.edit, action: () => alert(t.editAction(task.name || '')) },
    { label: t.duplicate, action: () => alert(t.duplicateAction(task.name || '')) },
    {
      label: t.delete_,
      action: () => {
        const selectedIds = selectedTaskIds
        const isMultiDelete = selectedIds.includes(task.id)
        const targetIds = isMultiDelete ? selectedIds : [task.id]

        // 1. 削除アニメーションを適用
        rows = rows.map((row) => ({
          ...row,
          tasks: row.tasks.map((t) => {
            if (targetIds.includes(t.id)) {
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
            tasks: row.tasks.filter((t) => !targetIds.includes(t.id)),
          }))
          // 削除後に選択状態をクリア（必要に応じて）
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

  // 少し遅延させてクリックイベントを登録しないと、即座に閉じてしまう可能性がある
  requestAnimationFrame(() => {
    document.addEventListener('click', closeMenu)
  })
}

setViewMode('day')

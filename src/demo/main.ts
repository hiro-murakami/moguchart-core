import { html, render } from 'lit'
import { GanttChartElement } from '../components/gantt-chart'
import { isHoliday } from './holidays'
import type {
  GanttChartOption,
  GanttRow,
  TaskClickEventDetail,
  TaskContextMenuEventDetail,
  TaskUpdateEventDetail,
  TaskDeleteEventDetail,
  GanttTask,
  TaskDropEventDetail,
  RowHeaderResizeEventDetail,
  RowSelectionChangeEventDetail,
  RowHeaderClickEventDetail,
  RowHeaderContextMenuEventDetail,
  RowToggleCollapseEventDetail,
  BarSelectionChangeEventDetail,
  DependencyLineStyle,
  TaskProgressChangeEventDetail,
} from '../core/types'
import type { ThemeColorPalette } from '../core/types'
import type { MoguchartLocale } from '../core/i18n'
import { jaLocale, enLocale } from '../core/i18n'
import dayjs from 'dayjs'
import { getPatternStyle } from '../core/patterns'
import { jaTexts, enTexts } from './i18n'
import type { DemoTexts } from './i18n'
import {
  generateDayModeData,
  generateWeekModeData,
  generateHourModeData,
  generateMonthModeData,
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
  } else if (viewMode === 'month') {
    rows = generateMonthModeData(t)
  } else {
    rows = generateHourModeData(t)
  }
  unassignedTasks = generateUnassignedTasks(t)
  renderApp()
}

let rows: GanttRow[] = []
let viewMode: 'day' | 'week' | 'month' | 'hour' = 'day'

let pxPerDay = 48
let pxPerMonth: number | undefined = undefined
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
let enableCrossRowMove = true
let showMinimap = true
let snapDuration = 1440
let showTime = false
let showMonths = true
let showDays = true
let showWeeks = false
let showMonthsRow = false
let showCurrentTime = true
let showCurrentTimeBadge = false
let currentTimeUpdateInterval = 1000
let enableCustomRendering = false
let showUnassignedTasks = true
let isUnassignedTasksOpen = false
let selectedIds: string[] = []
let selectedTaskIds: string[] = []
let showHiddenRows = false
let showCursorLine = false
let weekStartDay: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 1
let weekTextAlign: 'left' | 'center' | 'right' = 'left'
let weekFormat: (weekNumber: number, startDate: Date) => string = (_, startDate) => startDate.getDate().toString()
let dependencyLineStyle: DependencyLineStyle = 'orthogonal'
let showConnectors = true
let enableProgress = true
let editableProgress = true
let showProgressLabel = true
let enableMarquee = true

let unassignedTasks: GanttTask[] = generateUnassignedTasks(t)

const setViewMode = (mode: 'day' | 'week' | 'month' | 'hour') => {
  viewMode = mode
  if (mode === 'day') {
    pxPerDay = 48
    pxPerMonth = undefined
    snapDuration = 1440
    showTime = false
    showMonths = true
    showDays = true
    showWeeks = false
    showMonthsRow = false
    showCurrentTime = true
    showCurrentTimeBadge = false
    currentTimeUpdateInterval = 1000
    chartEnd.setTime(chartStart.getTime() + 50 * 24 * 60 * 60 * 1000)
    rows = generateDayModeData(t)
  } else if (mode === 'week') {
    // 週単位モード: 1日あたり12px (1週間 ≈ 84px)
    pxPerDay = 12
    pxPerMonth = undefined
    snapDuration = 1440
    showTime = false
    showMonths = true
    showDays = false
    showWeeks = true
    showMonthsRow = false
    showCurrentTime = true
    showCurrentTimeBadge = false
    currentTimeUpdateInterval = 1000
    chartEnd.setTime(chartStart.getTime() + 120 * 24 * 60 * 60 * 1000)
    rows = generateWeekModeData(t)
  } else if (mode === 'month') {
    // 月単位モード: 日単位の設定を無視してpxPerMonthを使用
    // pxPerDay = 2 // unused when pxPerMonth is set
    pxPerMonth = 48
    // snapDuration = 43200 // 30日 = 43200分
    showTime = false
    showMonths = false
    showDays = false
    showWeeks = false
    showMonthsRow = true
    showCurrentTime = true
    showCurrentTimeBadge = false
    currentTimeUpdateInterval = 1000
    chartEnd.setTime(chartStart.getTime() + 365 * 6 * 24 * 60 * 60 * 1000) // カレンダーの期間を5年以上確保
    rows = generateMonthModeData(t)
  } else {
    // 時間単位モード: 1時間あたり40px (960px/日)
    pxPerDay = 960
    pxPerMonth = undefined
    snapDuration = 15
    showTime = true
    showMonths = false
    showDays = true
    showWeeks = false
    showMonthsRow = false
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

  // 時間単位・月単位モードのときは土日・祝日のハイライトを無効化（透明にする）
  if (viewMode === 'hour' || viewMode === 'month') {
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
      pxPerMonth,
      isHoliday,
      showTime,
      showMonths,
      showDays,
      showWeeks,
      showMonthsRow,
      weekStartDay,
      weekTextAlign,
      weekFormat,
      showCurrentTime,
      showCurrentTimeBadge,
      currentTimeUpdateInterval,
      showCursorLine,
      milestones:
        viewMode == 'day'
          ? [
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
            ]
          : [],
    },
    readOnly: isReadOnly,
    tooltipDelay,
    showDragInfoOverlay,
    theme,
    customTheme,
    enableRowReordering,
    enableCrossRowMove,
    minimap: {
      enabled: showMinimap,
    },
    progress: {
      enabled: enableProgress,
      editable: editableProgress,
      showLabel: showProgressLabel,
      snapStep: 5,
    },
    selection: {
      marquee: enableMarquee,
    },
    tree: {
      enabled: true,
      indentWidth: 16,
      showToggleIcon: true,
      showWbsCode: true,
      autoSummary: true,
    },
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
          chartBackground: (ctx) => {
            // 偶数日にストライプパターン、週末にアイコン付き背景を表示するデモ
            const day = ctx.date.getDate()
            const isEvenDay = day % 2 === 0
            const stripeStyle = isEvenDay
              ? 'background: repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(128,128,128,0.08) 3px, rgba(128,128,128,0.08) 6px);'
              : ''
            const weekendOrHoliday = ctx.isSunday || ctx.isSaturday || ctx.isHoliday
            const icon = ctx.isSunday || ctx.isHoliday ? '🔴' : ctx.isSaturday ? '🔵' : ''
            return html`
              <div
                style="width: 100%; height: 100%; ${stripeStyle} display: flex; align-items: flex-end; justify-content: center; padding-bottom: 2px; box-sizing: border-box;"
              >
                ${weekendOrHoliday && ctx.width >= 20
                  ? html`<span style="font-size: 8px; opacity: 0.6; line-height: 1;">${icon}</span>`
                  : ''}
              </div>
            `
          },
        }
      : undefined,
    locale: currentLocale,
    dependency: {
      lineStyle: dependencyLineStyle,
      showConnectors,
    },
    zoom: {
      enabled: true,
    },
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

  // テーマに応じた色定義
  const isDark = effectiveTheme === 'dark'
  const c = {
    bg: isDark ? '#0f172a' : '#ffffff',
    text: isDark ? '#e2e8f0' : '#1e293b',
    textMuted: isDark ? '#94a3b8' : '#64748b',
    cardBg: isDark ? '#1e293b' : '#f8fafc',
    cardBorder: isDark ? '#334155' : '#e2e8f0',
    cardHover: isDark ? '#273548' : '#f1f5f9',
    accent: '#3b82f6',
    accentHover: '#2563eb',
    segBg: isDark ? '#0f172a' : '#e2e8f0',
    segActive: '#3b82f6',
    segText: isDark ? '#94a3b8' : '#64748b',
    segActiveText: '#ffffff',
    toggleBg: isDark ? '#475569' : '#cbd5e1',
    toggleActive: '#3b82f6',
    selectBg: isDark ? '#0f172a' : '#ffffff',
    selectBorder: isDark ? '#475569' : '#d1d5db',
    headerBorder: isDark ? '#334155' : '#e2e8f0',
    exportAmber: '#f59e0b',
    exportRed: '#ef4444',
  }

  const appStyles = `background-color: ${c.bg}; color: ${c.text};`

  const template = html`
    <style>
      @keyframes pop-in {
        0% { opacity: 0; transform: scale(0.5); }
        100% { opacity: 1; transform: scale(1); }
      }
      @keyframes fade-out {
        to { opacity: 0; transform: scale(0.9); }
      }
      * { box-sizing: border-box; }

      /* ── ベースボタン ── */
      .demo-btn {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 7px 14px; font-size: 13px; font-weight: 500;
        border-radius: 6px; border: none; cursor: pointer;
        background: ${c.accent}; color: #fff;
        transition: background 0.15s, box-shadow 0.15s;
      }
      .demo-btn:hover { background: ${c.accentHover}; box-shadow: 0 2px 8px rgba(59,130,246,0.25); }

      /* ── セグメントコントロール ── */
      .seg-group {
        display: inline-flex; background: ${c.segBg}; border-radius: 8px; padding: 3px; gap: 2px;
      }
      .seg-group label {
        padding: 5px 12px; border-radius: 6px; font-size: 13px; font-weight: 500;
        cursor: pointer; user-select: none; transition: all 0.15s;
        color: ${c.segText}; white-space: nowrap;
      }
      .seg-group label:hover { background: ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}; }
      .seg-group label.active {
        background: ${c.segActive}; color: ${c.segActiveText};
        box-shadow: 0 1px 3px rgba(59,130,246,0.3);
      }
      .seg-group input[type="radio"] { display: none; }

      /* ── トグルスイッチ ── */
      .toggle-label {
        display: inline-flex; align-items: center; gap: 8px;
        cursor: pointer; font-size: 13px; color: ${c.text};
        user-select: none; white-space: nowrap;
      }
      .toggle-label input { display: none; }
      .toggle-track {
        position: relative; width: 36px; height: 20px; border-radius: 10px;
        background: ${c.toggleBg}; transition: background 0.2s; flex-shrink: 0;
      }
      .toggle-track::after {
        content: ''; position: absolute; top: 2px; left: 2px;
        width: 16px; height: 16px; border-radius: 50%;
        background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.15);
        transition: transform 0.2s;
      }
      .toggle-label input:checked + .toggle-track {
        background: ${c.toggleActive};
      }
      .toggle-label input:checked + .toggle-track::after {
        transform: translateX(16px);
      }

      /* ── コントロールパネル ── */
      .ctrl-panel {
        display: flex; flex-direction: column; gap: 8px;
        margin-bottom: 14px;
      }
      .ctrl-row {
        display: flex; gap: 8px; flex-wrap: wrap;
      }
      .ctrl-card {
        background: ${c.cardBg}; border: 1px solid ${c.cardBorder};
        border-radius: 10px; padding: 0; overflow: hidden;
        transition: box-shadow 0.2s;
        flex: 1; min-width: 240px;
      }
      .ctrl-card:hover { box-shadow: 0 2px 12px ${isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.06)'}; }
      .ctrl-card-header {
        display: flex; align-items: center; gap: 8px;
        padding: 10px 14px; cursor: pointer; user-select: none;
        font-size: 13px; font-weight: 600; color: ${c.text};
        border-bottom: 1px solid ${c.cardBorder};
        background: ${isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)'};
      }
      .ctrl-card-header .icon { font-size: 15px; }
      .ctrl-card-header .chevron {
        margin-left: auto; font-size: 12px; color: ${c.textMuted};
        transition: transform 0.2s;
      }
      .ctrl-card-header .chevron.open { transform: rotate(180deg); }
      .ctrl-card-body {
        padding: 12px 14px;
        display: flex; flex-wrap: wrap; gap: 10px 16px;
        align-items: center;
      }

      /* ── ミニセレクト ── */
      .mini-select {
        font-size: 13px; padding: 4px 8px; border-radius: 6px;
        border: 1px solid ${c.selectBorder}; background: ${c.selectBg};
        color: ${c.text}; cursor: pointer; outline: none;
        transition: border-color 0.15s;
      }
      .mini-select:focus { border-color: ${c.accent}; }
      .select-group {
        display: inline-flex; align-items: center; gap: 6px;
        font-size: 13px; color: ${c.text}; white-space: nowrap;
      }

      /* ── ヘッダー ── */
      .demo-header {
        display: flex; align-items: center; justify-content: space-between;
        margin-bottom: 14px; padding-bottom: 12px;
        border-bottom: 1px solid ${c.headerBorder};
      }
      .demo-header h2 {
        margin: 0; font-size: 22px; font-weight: 700;
        background: linear-gradient(135deg, ${c.accent}, #8b5cf6);
        -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        background-clip: text;
      }
      .header-links {
        display: inline-flex; align-items: center; gap: 8px;
      }
      .header-link {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 5px 10px; font-size: 13px; font-weight: 500;
        text-decoration: none; border-radius: 6px;
        border: 1px solid ${c.cardBorder};
        background: ${c.cardBg};
        color: ${c.text};
        transition: all 0.15s;
      }
      .header-link:hover {
        background: ${c.cardHover};
        border-color: ${c.accent};
        color: ${c.accent};
      }
      .header-link.npm-link:hover {
        border-color: #cb3837;
        color: #cb3837;
      }
      .header-link svg {
        flex-shrink: 0;
      }
      .lang-group {
        display: inline-flex; background: ${c.segBg}; border-radius: 8px; padding: 3px; gap: 2px;
      }
      .lang-group button {
        padding: 5px 14px; border-radius: 6px; font-size: 13px; font-weight: 500;
        border: none; cursor: pointer; transition: all 0.15s;
        background: transparent; color: ${c.segText};
      }
      .lang-group button.active {
        background: ${c.accent}; color: #fff;
        box-shadow: 0 1px 3px rgba(59,130,246,0.3);
      }
      .lang-group button:not(.active):hover {
        background: ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'};
      }
      .export-group {
        display: flex; gap: 6px; align-items: center;
      }
      .export-btn {
        display: inline-flex; align-items: center; gap: 5px;
        padding: 6px 12px; font-size: 12px; font-weight: 500;
        border-radius: 6px; border: none; cursor: pointer; color: #fff;
        transition: opacity 0.15s, box-shadow 0.15s;
      }
      .export-btn:hover { opacity: 0.9; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
    </style>
    <div style="padding: 24px 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; min-height: 100vh; ${appStyles}">
      <!-- ヘッダー -->
      <div class="demo-header">
        <div style="display: flex; align-items: center; gap: 16px;">
          <h2>moguchart-core</h2>
          <div class="export-group">
            <button
              class="export-btn"
              style="background: ${c.exportAmber};"
              @click="${async () => {
                const chart = document.getElementById('gantt-chart-instance') as GanttChartElement
                if (chart) {
                  await chart.exportImage('png', { download: true, filename: 'gantt-html2canvas', splitHeight: 1000 })
                }
              }}"
            >
              📸 PNG
            </button>
            <button
              class="export-btn"
              style="background: ${c.exportRed};"
              @click="${async () => {
                const chart = document.getElementById('gantt-chart-instance') as GanttChartElement
                if (chart) {
                  await chart.exportImage('pdf', { download: true, filename: 'gantt-html2canvas', splitHeight: 1000 })
                }
              }}"
            >
              📄 PDF
            </button>
            <button
              class="export-btn"
              style="background: #6366f1;"
              title="親行を一括折りたたみ"
              @click="${() => {
                const chart = document.getElementById('gantt-chart-instance') as GanttChartElement
                if (chart) {
                  chart.collapseAll()
                }
              }}"
            >
              📁 折りたたみ
            </button>
            <button
              class="export-btn"
              style="background: #2563eb;"
              title="すべての行を展開"
              @click="${() => {
                const chart = document.getElementById('gantt-chart-instance') as GanttChartElement
                if (chart) {
                  chart.expandAll()
                }
              }}"
            >
              📂 展開
            </button>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <div class="header-links">
            <a
              href="https://www.npmjs.com/package/@mogura/moguchart-core"
              target="_blank"
              rel="noopener noreferrer"
              class="header-link npm-link"
              title="npm: @mogura/moguchart-core"
            >
              <svg viewBox="0 0 780 250" style="width: 28px; height: 12px; fill: #cb3837;"><path d="M240,250h100v-110h110v110h500v-250h-710z M340,140v-60h60v60z M450,140v-60h60v60z M560,140v-60h60v60z"></path></svg>
              <span>npm</span>
            </a>
            <a
              href="https://github.com/hiro-murakami/moguchart-core"
              target="_blank"
              rel="noopener noreferrer"
              class="header-link"
              title="GitHub: moguchart-core"
            >
              <svg viewBox="0 0 16 16" style="width: 14px; height: 14px; fill: currentColor;"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path></svg>
              <span>GitHub</span>
            </a>
          </div>
          <div class="lang-group">
            <button class="${currentLang === 'ja' ? 'active' : ''}" @click="${() => setLang('ja')}">日本語</button>
            <button class="${currentLang === 'en' ? 'active' : ''}" @click="${() => setLang('en')}">English</button>
          </div>
        </div>
      </div>

      <!-- コントロールパネル -->
      <div class="ctrl-panel">
        <!-- 1行目: 表示モード + テーマ -->
        <div class="ctrl-row">
          <!-- 表示モード -->
          <div class="ctrl-card" style="flex: 2;">
            <div class="ctrl-card-body" style="border-bottom: none;">
              <span style="font-weight: 600; font-size: 13px; color: ${c.textMuted};">📊 ${t.viewMode}</span>
              <div class="seg-group">
                <label class="${viewMode === 'day' ? 'active' : ''}">
                  <input type="radio" name="viewMode" value="day" .checked="${viewMode === 'day'}" @change="${() => setViewMode('day')}" />
                  ${t.dayUnit}
                </label>
                <label class="${viewMode === 'week' ? 'active' : ''}">
                  <input type="radio" name="viewMode" value="week" .checked="${viewMode === 'week'}" @change="${() => setViewMode('week')}" />
                  ${t.weekUnit}
                </label>
                <label class="${viewMode === 'month' ? 'active' : ''}">
                  <input type="radio" name="viewMode" value="month" .checked="${viewMode === 'month'}" @change="${() => setViewMode('month')}" />
                  ${t.monthUnit}
                </label>
                <label class="${viewMode === 'hour' ? 'active' : ''}">
                  <input type="radio" name="viewMode" value="hour" .checked="${viewMode === 'hour'}" @change="${() => setViewMode('hour')}" />
                  ${t.hourUnit}
                </label>
              </div>

              <span style="width: 1px; height: 20px; background: ${c.cardBorder}; margin: 0 4px;"></span>

              <span style="font-weight: 600; font-size: 13px; color: ${c.textMuted};">🎨 ${t.theme}</span>
              <div class="seg-group">
                <label class="${theme === undefined ? 'active' : ''}">
                  <input type="radio" name="theme" value="auto" .checked="${theme === undefined}" @change="${() => { theme = undefined; renderApp() }}" />
                  Auto
                </label>
                <label class="${theme === 'light' ? 'active' : ''}">
                  <input type="radio" name="theme" value="light" .checked="${theme === 'light'}" @change="${() => { theme = 'light'; renderApp() }}" />
                  Light
                </label>
                <label class="${theme === 'dark' ? 'active' : ''}">
                  <input type="radio" name="theme" value="dark" .checked="${theme === 'dark'}" @change="${() => { theme = 'dark'; renderApp() }}" />
                  Dark
                </label>
              </div>

              <span style="width: 1px; height: 20px; background: ${c.cardBorder}; margin: 0 4px;"></span>

              <span style="font-weight: 600; font-size: 13px; color: ${c.textMuted};">🔗 ${currentLang === 'ja' ? '接続線' : 'Line Style'}</span>
              <div class="seg-group">
                <label class="${dependencyLineStyle === 'curve' ? 'active' : ''}">
                  <input type="radio" name="depLineStyle" value="curve" .checked="${dependencyLineStyle === 'curve'}" @change="${() => { dependencyLineStyle = 'curve'; renderApp() }}" />
                  ${currentLang === 'ja' ? '曲線' : 'Curve'}
                </label>
                <label class="${dependencyLineStyle === 'orthogonal' ? 'active' : ''}">
                  <input type="radio" name="depLineStyle" value="orthogonal" .checked="${dependencyLineStyle === 'orthogonal'}" @change="${() => { dependencyLineStyle = 'orthogonal'; renderApp() }}" />
                  ${currentLang === 'ja' ? '直線' : 'Orthogonal'}
                </label>
              </div>
            </div>
          </div>
        </div>

        <!-- 2行目: カレンダー表示 + 動作設定 + サイズ設定 -->
        <div class="ctrl-row">
          <!-- カレンダー表示 -->
          <div class="ctrl-card">
            <div class="ctrl-card-header">
              <span class="icon">📅</span>
              ${t.sectionCalendar}
            </div>
            <div class="ctrl-card-body">
              <label class="toggle-label">
                <input type="checkbox" .checked="${showTime}" @change="${(e: Event) => { showTime = (e.target as HTMLInputElement).checked; renderApp() }}" />
                <span class="toggle-track"></span>
                ${t.showTime}
              </label>
              <label class="toggle-label">
                <input type="checkbox" .checked="${showMonths}" @change="${(e: Event) => { showMonths = (e.target as HTMLInputElement).checked; renderApp() }}" />
                <span class="toggle-track"></span>
                ${t.showYearMonth}
              </label>
              <label class="toggle-label">
                <input type="checkbox" .checked="${showDays}" @change="${(e: Event) => { showDays = (e.target as HTMLInputElement).checked; renderApp() }}" />
                <span class="toggle-track"></span>
                ${t.showDates}
              </label>
              <label class="toggle-label">
                <input type="checkbox" .checked="${showCurrentTime}" @change="${(e: Event) => { showCurrentTime = (e.target as HTMLInputElement).checked; renderApp() }}" />
                <span class="toggle-track"></span>
                ${t.showCurrentTimeLine}
              </label>
              <label class="toggle-label">
                <input type="checkbox" .checked="${showCurrentTimeBadge}" @change="${(e: Event) => { showCurrentTimeBadge = (e.target as HTMLInputElement).checked; renderApp() }}" />
                <span class="toggle-track"></span>
                ${t.showCurrentTimeBadge}
              </label>
              <label class="toggle-label">
                <input type="checkbox" .checked="${showCursorLine}" @change="${(e: Event) => { showCursorLine = (e.target as HTMLInputElement).checked; renderApp() }}" />
                <span class="toggle-track"></span>
                ${currentLang === 'ja' ? 'カーソル線' : 'Cursor Line'}
              </label>
              ${viewMode === 'week'
                ? html`
                    <span class="select-group">
                      ${t.weekStartDay}
                      <select
                        class="mini-select"
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
                    </span>
                  `
                : ''}
            </div>
          </div>

          <!-- 動作設定 -->
          <div class="ctrl-card">
            <div class="ctrl-card-header">
              <span class="icon">⚙️</span>
              ${t.sectionBehavior}
            </div>
            <div class="ctrl-card-body">
              <label class="toggle-label">
                <input type="checkbox" .checked="${isReadOnly}" @change="${(e: Event) => { isReadOnly = (e.target as HTMLInputElement).checked; renderApp() }}" />
                <span class="toggle-track"></span>
                ${t.readOnlyMode}
              </label>
              <label class="toggle-label">
                <input type="checkbox" .checked="${showDragInfoOverlay}" @change="${(e: Event) => { showDragInfoOverlay = (e.target as HTMLInputElement).checked; renderApp() }}" />
                <span class="toggle-track"></span>
                ${t.showDragInfo}
              </label>
              <label class="toggle-label">
                <input type="checkbox" .checked="${enableRowReordering}" @change="${(e: Event) => { enableRowReordering = (e.target as HTMLInputElement).checked; renderApp() }}" />
                <span class="toggle-track"></span>
                ${t.enableRowReorder}
              </label>
              <label class="toggle-label">
                <input type="checkbox" .checked="${enableCrossRowMove}" @change="${(e: Event) => { enableCrossRowMove = (e.target as HTMLInputElement).checked; renderApp() }}" />
                <span class="toggle-track"></span>
                ${t.enableCrossRowMove}
              </label>
              <label class="toggle-label">
                <input type="checkbox" .checked="${showMinimap}" @change="${(e: Event) => { showMinimap = (e.target as HTMLInputElement).checked; renderApp() }}" />
                <span class="toggle-track"></span>
                ${t.showMinimap}
              </label>
              <label class="toggle-label">
                <input type="checkbox" .checked="${currentTimeUpdateInterval > 0}" @change="${(e: Event) => { currentTimeUpdateInterval = (e.target as HTMLInputElement).checked ? 1000 : 0; renderApp() }}" />
                <span class="toggle-track"></span>
                ${t.autoUpdateTime}
              </label>
              <label class="toggle-label">
                <input type="checkbox" .checked="${enableCustomRendering}" @change="${(e: Event) => { enableCustomRendering = (e.target as HTMLInputElement).checked; renderApp() }}" />
                <span class="toggle-track"></span>
                ${t.customRendering}
              </label>
              <label class="toggle-label">
                <input type="checkbox" .checked="${rowHeaderResizable}" @change="${(e: Event) => { rowHeaderResizable = (e.target as HTMLInputElement).checked; renderApp() }}" />
                <span class="toggle-track"></span>
                ${t.rowHeaderResize}
              </label>
              <label class="toggle-label">
                <input type="checkbox" .checked="${showHiddenRows}" @change="${(e: Event) => { showHiddenRows = (e.target as HTMLInputElement).checked; renderApp() }}" />
                <span class="toggle-track"></span>
                ${t.showHiddenRows}
              </label>
              <label class="toggle-label">
                <input type="checkbox" .checked="${showConnectors}" @change="${(e: Event) => { showConnectors = (e.target as HTMLInputElement).checked; renderApp() }}" />
                <span class="toggle-track"></span>
                ${t.showConnectors}
              </label>
              <label class="toggle-label">
                <input type="checkbox" .checked="${enableProgress}" @change="${(e: Event) => { enableProgress = (e.target as HTMLInputElement).checked; renderApp() }}" />
                <span class="toggle-track"></span>
                ${t.enableProgress}
              </label>
              <label class="toggle-label">
                <input type="checkbox" .checked="${editableProgress}" @change="${(e: Event) => { editableProgress = (e.target as HTMLInputElement).checked; renderApp() }}" />
                <span class="toggle-track"></span>
                ${t.editableProgress}
              </label>
              <label class="toggle-label">
                <input type="checkbox" .checked="${showProgressLabel}" @change="${(e: Event) => { showProgressLabel = (e.target as HTMLInputElement).checked; renderApp() }}" />
                <span class="toggle-track"></span>
                ${t.showProgressLabel}
              </label>
              <label class="toggle-label">
                <input type="checkbox" .checked="${enableMarquee}" @change="${(e: Event) => { enableMarquee = (e.target as HTMLInputElement).checked; renderApp() }}" />
                <span class="toggle-track"></span>
                ${t.enableMarqueeSelection}
              </label>
            </div>
          </div>

          <!-- サイズ設定 -->
          <div class="ctrl-card">
            <div class="ctrl-card-header">
              <span class="icon">📐</span>
              ${t.sectionSize}
            </div>
            <div class="ctrl-card-body">
              <span class="select-group" style="${viewMode === 'month' ? 'opacity: 0.5;' : ''}">
                ${t.snapUnit}
                <select
                  class="mini-select"
                  .disabled="${viewMode === 'month'}"
                  @change="${(e: Event) => { snapDuration = Number((e.target as HTMLSelectElement).value); renderApp() }}"
                >
                  ${[6, 15, 30, 60, 180, 720, 1440].map(
                    (d) => html`
                      <option value="${d}" ?selected="${snapDuration === d}">
                        ${d === 1440 ? t.oneDay : d === 43200 ? t.oneMonth : t.minutes(d)}
                      </option>
                    `,
                  )}
                </select>
              </span>
              <span class="select-group">
                ${t.barHeight}
                <select
                  class="mini-select"
                  @change="${(e: Event) => { barHeight = Number((e.target as HTMLSelectElement).value); renderApp() }}"
                >
                  ${[20, 28, 40, 50, 60].map(
                    (h) => html` <option value="${h}" ?selected="${barHeight === h}">${h}px</option> `,
                  )}
                </select>
              </span>
              <span class="select-group">
                ${viewMode === 'month' ? (currentLang === 'ja' ? '月幅' : 'Month Width') : t.dayWidth}
                <select
                  class="mini-select"
                  @change="${(e: Event) => {
                    const val = Number((e.target as HTMLSelectElement).value)
                    if (viewMode === 'month') { pxPerMonth = val } else { pxPerDay = val }
                    renderApp()
                  }}"
                >
                  ${viewMode === 'month'
                    ? [24, 48, 64, 128, 256].map(
                        (w) => html` <option value="${w}" ?selected="${pxPerMonth === w}">${w}px</option> `,
                      )
                    : [12, 24, 48, 96, 144, 240, 480, 720, 960, 1440, 2880].map(
                        (w) => html` <option value="${w}" ?selected="${pxPerDay === w}">${w}px</option> `,
                      )}
                </select>
              </span>
              <span class="select-group">
                ${t.rowHeaderWidth}
                <select
                  class="mini-select"
                  @change="${(e: Event) => { rowHeaderWidth = Number((e.target as HTMLSelectElement).value); renderApp() }}"
                >
                  ${[150, 200, 250, 300, 350].map(
                    (w) => html` <option value="${w}" ?selected="${rowHeaderWidth === w}">${w}px</option> `,
                  )}
                </select>
              </span>
              <span class="select-group">
                ${t.tooltipDelay}
                <select
                  class="mini-select"
                  @change="${(e: Event) => { tooltipDelay = Number((e.target as HTMLSelectElement).value); renderApp() }}"
                >
                  ${[0, 500, 1000].map((d) => html` <option value="${d}" ?selected="${tooltipDelay === d}">${d}ms</option> `)}
                </select>
              </span>
            </div>
          </div>
        </div>
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
            @task-delete="${handleTaskDelete}"
            @row-header-resize="${handleRowHeaderResize}"
            @row-toggle-collapse="${(e: CustomEvent<RowToggleCollapseEventDetail>) => {
              const { rowId, collapsed } = e.detail
              rows = rows.map((r) => (r.id === rowId ? { ...r, collapsed } : r))
            }}"
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
            @dependency-create="${(e: CustomEvent) => {
              const { sourceTaskId, targetTaskId } = e.detail
              console.log('Dependency created:', e.detail)
              // dependencies配列にsourceTaskIdを追加（既存と重複しない場合のみ）
              rows = rows.map((row) => ({
                ...row,
                tasks: row.tasks.map((task) => {
                  if (task.id === targetTaskId) {
                    const deps = task.dependencies ?? []
                    if (!deps.includes(sourceTaskId)) {
                      return { ...task, dependencies: [...deps, sourceTaskId] }
                    }
                  }
                  return task
                }),
              }))
              renderApp()
            }}"
            @dependency-click="${(e: CustomEvent) => {
              console.log('Dependency clicked:', e.detail)
            }}"
            @task-progress-change="${(e: CustomEvent<TaskProgressChangeEventDetail>) => {
              const { task, progress } = e.detail
              console.log('Task progress changed:', e.detail)
              rows = rows.map((row) => ({
                ...row,
                tasks: row.tasks.map((t) => (t.id === task.id ? { ...t, progress } : t)),
              }))
              renderApp()
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
                  background: ${c.cardBg};
                  border: 1px solid ${c.cardBorder};
                  border-radius: 10px;
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
                              background: ${isDark ? '#334155' : 'white'};
                              border: 1px solid ${c.selectBorder};
                              border-radius: 6px;
                              cursor: grab;
                              user-select: none;
                              box-shadow: 0 1px 2px rgba(0,0,0,0.1);
                              transition: box-shadow 0.15s;
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
    if (viewMode === 'day' || viewMode === 'week' || viewMode === 'month') {
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

const handleTaskDelete = (e: CustomEvent<TaskDeleteEventDetail>) => {
  const { taskIds } = e.detail
  if (taskIds.length === 0) return

  // フェードアウトアニメーション付き削除（コンテキストメニューの削除と同じロジック）
  rows = rows.map((row) => ({
    ...row,
    tasks: row.tasks.map((taskItem) => {
      if (taskIds.includes(taskItem.id)) {
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
      tasks: row.tasks.filter((taskItem) => !taskIds.includes(taskItem.id)),
    }))
    selectedTaskIds = selectedTaskIds.filter((id) => !taskIds.includes(id))
    renderApp()
  }, 300)
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

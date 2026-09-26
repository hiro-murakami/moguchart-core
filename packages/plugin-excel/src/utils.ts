import type { GanttChartElement, GanttRow } from '@mogura/moguchart-core'
import type { ExcelLocale, ExcelTimelineScale, ExportExcelOptions } from './types'
import { resolveExcelLocale, jaLocale, enLocale } from './i18n'

export const EN_MONTH_NAMES = enLocale.timeline?.monthNames || [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

/**
 * ガントチャートまたはオプションから言語・ロケールを判定する
 */
export function detectLocale(
  chart?: GanttChartElement,
  explicitLocale?: ExcelLocale
): ExcelLocale {
  const def = resolveExcelLocale(explicitLocale, chart)
  return def.name || 'ja'
}


/**
 * タイムライン用の単一列情報（日、月、週、時間など全スケール共通）
 */
export interface TimelineItem {
  key: string
  startDate: Date
  endDate: Date
  groupLabel: string // ヘッダー行1 (年月、年、日など)
  subLabel: string // ヘッダー行2 (日/曜日、月名、週名、時刻など)
  scale?: ExcelTimelineScale
  isWeekend?: boolean
  isHoliday?: boolean
  isToday?: boolean
  width?: number
}

/**
 * WBS階層情報が付加された行・タスク情報
 */
export interface FlatRowItem {
  row: GanttRow
  wbsNumber: string
  depth: number
  isParent: boolean
}

/**
 * Excelのワークシート名として安全な名前にサニタイズする
 * - 使用禁止文字: * ? : \ / [ ]
 * - 最大長: 31文字
 */
export function sanitizeSheetName(name?: string, fallback = '工程表', maxLen = 31): string {
  if (!name || typeof name !== 'string') return fallback

  // Excelシート名で禁止されている文字 (* ? : \ / [ ]) を除去
  let sanitized = name.replace(/[*?:\\/\[\]]/g, '').trim()

  if (!sanitized) {
    sanitized = fallback
  }

  // 31文字制限（指定された最大文字数）に切り詰め
  return sanitized.substring(0, maxLen)
}

const NAMED_COLORS: Record<string, string> = {
  black: 'FF000000',
  white: 'FFFFFFFF',
  red: 'FFFF0000',
  green: 'FF008000',
  blue: 'FF0000FF',
  yellow: 'FFFFFF00',
  orange: 'FFFFA500',
  purple: 'FF800080',
  teal: 'FF008080',
  cyan: 'FF00FFFF',
  navy: 'FF000080',
  gray: 'FF808080',
  grey: 'FF808080',
  lightgray: 'FFD3D3D3',
  lightgrey: 'FFD3D3D3',
  darkgray: 'FFA9A9A9',
  darkgrey: 'FFA9A9A9',
  transparent: '00FFFFFF',
}

/**
 * CSSカラー文字列（HEX, rgb, rgba, 主要カラー名）をExcelJS用のARGB形式に変換する
 * 例: '#3B82F6' -> 'FF3B82F6', 'rgb(59, 130, 246)' -> 'FF3B82F6'
 */
export function hexToArgb(color?: string, defaultArgb = 'FF3B82F6'): string {
  if (!color || typeof color !== 'string') return defaultArgb

  const trimmed = color.trim()
  const lower = trimmed.toLowerCase()

  // 1. カラー名
  if (NAMED_COLORS[lower]) {
    return NAMED_COLORS[lower]
  }

  // 2. rgb(r, g, b) または rgba(r, g, b, a)
  const rgbMatch = lower.match(/^rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/)
  if (rgbMatch) {
    const r = Math.min(255, Math.max(0, parseInt(rgbMatch[1], 10)))
    const g = Math.min(255, Math.max(0, parseInt(rgbMatch[2], 10)))
    const b = Math.min(255, Math.max(0, parseInt(rgbMatch[3], 10)))
    let a = 255
    if (rgbMatch[4] !== undefined) {
      const alphaVal = parseFloat(rgbMatch[4])
      if (!isNaN(alphaVal)) {
        a = Math.min(255, Math.max(0, Math.round(alphaVal * 255)))
      }
    }
    const toHex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase()
    return `${toHex(a)}${toHex(r)}${toHex(g)}${toHex(b)}`
  }

  // 3. HEXカラー
  const clean = trimmed.replace(/^#/, '')

  // 3桁 HEX (例: 'FFF' -> 'FFFFFF')
  if (clean.length === 3 && /^[0-9a-fA-F]{3}$/.test(clean)) {
    return (
      'FF' +
      clean
        .split('')
        .map((c) => c + c)
        .join('')
        .toUpperCase()
    )
  }

  // 4桁 HEX with alpha (例: 'FFF8' -> 'FFFFFF88')
  if (clean.length === 4 && /^[0-9a-fA-F]{4}$/.test(clean)) {
    const [r, g, b, a] = clean.split('')
    const hexA = `${a}${a}`.toUpperCase()
    const hexR = `${r}${r}`.toUpperCase()
    const hexG = `${g}${g}`.toUpperCase()
    const hexB = `${b}${b}`.toUpperCase()
    return `${hexA}${hexR}${hexG}${hexB}`
  }

  // 6桁 HEX
  if (clean.length === 6 && /^[0-9a-fA-F]{6}$/.test(clean)) {
    return `FF${clean.toUpperCase()}`
  }

  // 8桁 HEX (RRGGBBAA -> AARRGGBB に変換)
  if (clean.length === 8 && /^[0-9a-fA-F]{8}$/.test(clean)) {
    const rgb = clean.substring(0, 6)
    const alpha = clean.substring(6, 8)
    return `${alpha.toUpperCase()}${rgb.toUpperCase()}`
  }

  return defaultArgb
}

/**
 * ARGB形式の色から輝度（Luminance）を計算し、視認性の高いコントラスト文字色（白または黒）を返す
 */
export function getContrastArgb(argb: string): string {
  if (typeof argb === 'string' && argb.length === 8) {
    const r = parseInt(argb.substring(2, 4), 16)
    const g = parseInt(argb.substring(4, 6), 16)
    const b = parseInt(argb.substring(6, 8), 16)
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b
      return luminance > 165 ? 'FF000000' : 'FFFFFFFF'
    }
  }
  return 'FFFFFFFF'
}

/**
 * タスク情報からガントチャート表示色（ARGB形式）を抽出・決定する
 * 優先順位:
 * 1. task.style の background-color / background
 * 2. task.attribute.colorPalette.backgroundColor または task.colorPalette.backgroundColor
 * 3. task.progressColor
 * 4. task.backgroundColor または task.color
 * 5. サマリータスクの場合は 'FF334155'、通常タスクの場合は themeArgb
 */
export function extractTaskBarColor(
  task: any,
  isParent = false,
  themeArgb = 'FF3B82F6'
): string {
  const isSummary = isParent || task?.type === 'summary'
  const fallbackColor = isSummary ? 'FF334155' : themeArgb

  if (!task) return fallbackColor

  // 1. task.style から background-color を抽出
  if (typeof task.style === 'string' && task.style) {
    const bgMatch = task.style.match(/(?:^|;)\s*background(?:-color)?\s*:\s*([^;!]+)/i)
    if (bgMatch && bgMatch[1]) {
      const colorVal = bgMatch[1].trim()
      if (colorVal && colorVal !== 'inherit' && colorVal !== 'initial' && colorVal !== 'transparent') {
        return hexToArgb(colorVal, fallbackColor)
      }
    }
  }

  // 2. attribute.colorPalette.backgroundColor
  const paletteBg =
    task.attribute?.colorPalette?.backgroundColor ||
    task.colorPalette?.backgroundColor
  if (typeof paletteBg === 'string' && paletteBg.trim()) {
    return hexToArgb(paletteBg.trim(), fallbackColor)
  }

  // 3. task.progressColor
  if (typeof task.progressColor === 'string' && task.progressColor.trim()) {
    return hexToArgb(task.progressColor.trim(), fallbackColor)
  }

  // 4. task.backgroundColor または task.color
  const directColor = task.backgroundColor || task.color
  if (typeof directColor === 'string' && directColor.trim()) {
    return hexToArgb(directColor.trim(), fallbackColor)
  }

  return fallbackColor
}

/**
 * タイムライン列アイテム（祝祭日、土日、平日）に応じた背景色（ARGB）を返す
 * ※ 背景色（土日・祝祭日）の適用は「日単位（scale === 'day'）」のみ行います。
 * - 祝祭日・日曜日: holidayArgb (デフォルト: 'FFFEE2E2', 淡い赤/ピンク)
 * - 土曜日: 'FFEFF6FF' (淡いブルー)
 * - 平日（または日単位以外）: null (背景色なし / 白)
 */
export function getTimelineCellBgColor(
  item: TimelineItem,
  holidayArgb = 'FFFEE2E2',
  scale?: ExcelTimelineScale
): string | null {
  const currentScale = scale ?? item.scale ?? 'day'

  // 日単位（day）以外の場合は背景色を指定しない
  if (currentScale !== 'day') {
    return null
  }

  const dayOfWeek = item.startDate.getDay()

  // 1. 祝祭日または日曜日（dayOfWeek === 0）は同じ赤/ピンク背景
  if (item.isHoliday || dayOfWeek === 0) {
    return holidayArgb
  }

  // 2. 土曜日（dayOfWeek === 6）
  if (dayOfWeek === 6 || item.isWeekend) {
    return 'FFEFF6FF' // 土曜日は淡いブルー
  }

  return null
}

/**
 * チャートの設定やオプションから適切なタイムラインスケールを判定する
 */
export function detectTimelineScale(
  chart?: GanttChartElement,
  explicitScale?: ExcelTimelineScale
): ExcelTimelineScale {
  if (explicitScale) return explicitScale

  const calendar = chart?.option?.calendar
  if (calendar) {
    if (calendar.showTime) {
      return 'hour'
    }
    if (calendar.showMonthsRow || (calendar.pxPerMonth !== undefined && !calendar.showDays)) {
      return 'month'
    }
    if (calendar.showWeeks && !calendar.showDays) {
      return 'week'
    }
  }

  return 'day'
}

/**
 * ExcelJS に渡す Date オブジェクトを、ローカル時刻の見た目通りの日付シリアル値になるよう補正する。
 * ExcelJS は内部で date.getTime() (UTC) を使用してシリアル値を計算するため、
 * JST などの正のタイムゾーン下ではローカル日時 (例: 2025-01-01 00:00:00) が前日 (2024-12-31 15:00:00) のシリアル値として
 * 書き込まれてしまい、Excel 上で 1日 (または月単位で 1ヶ月) 過去にずれて表示される。
 * そのため、getTimezoneOffset() 分を差し引くことで、Excel 上のシリアル値がローカル日時と完全に一致するようにする。
 */
export function toExcelDate(date: Date): Date {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000)
}

/**
 * タイムラインの開始日・終了日を計算し、スケール単位にスナップする
 * 優先順位:
 * 1. options の startDate / endDate
 * 2. calendar (画面上のカレンダー表示設定) の start / end
 * 3. 行・タスク全体の最小開始日 / 最大終了日
 */
export function getTimelineRange(
  rows: GanttRow[],
  options?: Pick<ExportExcelOptions, 'startDate' | 'endDate'>,
  scale: ExcelTimelineScale = 'day',
  calendar?: { start?: Date; end?: Date }
): { startDate: Date; endDate: Date } {
  const explicitStart = options?.startDate || calendar?.start
  const explicitEnd = options?.endDate || calendar?.end

  let minTime = explicitStart ? new Date(explicitStart).getTime() : Infinity
  let maxTime = explicitEnd ? new Date(explicitEnd).getTime() : -Infinity

  if (!explicitStart || !explicitEnd) {
    for (const row of rows) {
      if (!Array.isArray(row.tasks)) continue
      for (const task of row.tasks) {
        if (!explicitStart && task.start) {
          const startTime = new Date(task.start).getTime()
          if (!isNaN(startTime) && startTime < minTime) minTime = startTime
        }
        if (!explicitEnd && task.end) {
          const endTime = new Date(task.end).getTime()
          if (!isNaN(endTime) && endTime > maxTime) maxTime = endTime
        }
      }
    }
  }

  const now = new Date()
  if (minTime === Infinity) {
    // タスクが存在しない場合は当月の初日
    minTime = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  }
  if (maxTime === -Infinity) {
    // タスクが存在しない場合は当月の末日（または開始日の30日後）
    maxTime = new Date(minTime + 30 * 24 * 60 * 60 * 1000).getTime()
  }

  const startDate = new Date(minTime)
  const endDate = new Date(maxTime)

  if (scale === 'month') {
    // 月初・月末にスナップ
    startDate.setDate(1)
    startDate.setHours(0, 0, 0, 0)

    endDate.setMonth(endDate.getMonth() + 1, 0)
    endDate.setHours(23, 59, 59, 999)
  } else if (scale === 'week') {
    // 月曜始まりの週にスナップ
    const startDay = startDate.getDay()
    const daysToMonday = (startDay + 6) % 7
    startDate.setDate(startDate.getDate() - daysToMonday)
    startDate.setHours(0, 0, 0, 0)

    const endDay = endDate.getDay()
    const daysToSunday = (7 - endDay) % 7
    endDate.setDate(endDate.getDate() + daysToSunday)
    endDate.setHours(23, 59, 59, 999)
  } else if (scale === 'hour') {
    // 時間単位にスナップ
    startDate.setMinutes(0, 0, 0)
    endDate.setMinutes(59, 59, 999)
  } else {
    // 日単位（既存動作）
    startDate.setHours(0, 0, 0, 0)
    endDate.setHours(23, 59, 59, 999)
  }

  return { startDate, endDate }
}

/**
 * 画面上のピクセル幅 (px) を Excel の列幅 (文字幅単位) に変換する
 * 一般的な Excel の標準フォント (11pt) では 1文字幅 ≒ 約7.5px
 */
export function pxToExcelColumnWidth(px: number, minWidth = 3): number {
  if (typeof px !== 'number' || isNaN(px) || px <= 0) return minWidth
  const width = Math.round((px / 7.5) * 10) / 10
  return Math.max(minWidth, width)
}

/**
 * オプション、チャート設定、スケールから最適なタイムライン列幅（Excel列幅単位）を判定・算出する
 */
export function detectTimelineColumnWidth(
  chart?: GanttChartElement,
  explicitWidth?: number,
  scale: ExcelTimelineScale = 'day',
  columnsPerUnit = 1
): number {
  // 1. オプションで明示的に指定されている場合は最優先
  if (typeof explicitWidth === 'number' && explicitWidth > 0) {
    return explicitWidth
  }

  // 2. chart.option.calendar から画面のピクセル幅を取得して換算
  const calendar = chart?.option?.calendar
  if (calendar) {
    if (scale === 'month' && typeof calendar.pxPerMonth === 'number' && calendar.pxPerMonth > 0) {
      return pxToExcelColumnWidth(calendar.pxPerMonth, 6)
    }
    if (scale === 'hour') {
      if (typeof calendar.pxPerDay === 'number' && calendar.pxPerDay > 0) {
        const pxPerHour = calendar.pxPerDay / 24 / columnsPerUnit
        const minW = columnsPerUnit > 1 ? 3.5 : 4.5
        return pxToExcelColumnWidth(pxPerHour, minW)
      }
    }
    if (scale === 'week') {
      if (typeof calendar.pxPerDay === 'number' && calendar.pxPerDay > 0) {
        return pxToExcelColumnWidth(calendar.pxPerDay * 7, 6)
      }
    }
    if (scale === 'day' && typeof calendar.pxPerDay === 'number' && calendar.pxPerDay > 0) {
      const pxPerSlot = calendar.pxPerDay / columnsPerUnit
      const minW = columnsPerUnit > 1 ? 3.5 : 3.5
      return pxToExcelColumnWidth(pxPerSlot, minW)
    }
  }

  // 3. デフォルト幅
  switch (scale) {
    case 'month':
      return 8.0
    case 'week':
      return 7.5
    case 'hour':
      return columnsPerUnit > 1 ? 3.8 : 5.0
    case 'day':
    default:
      return columnsPerUnit > 1 ? 3.8 : 4.2
  }
}

/**
 * 1日または1時間あたりの分割列数を判定・算出する
 * 優先順位:
 * 1. options.columnsPerUnit (明示的指定)
 * 2. options.snapDurationMinutes (スナップ分数から計算)
 * 3. chart.option.snapDuration (チャート設定のスナップ分数から計算)
 * 4. デフォルト: 1
 */
export function detectColumnsPerUnit(
  chart?: GanttChartElement,
  options?: Pick<ExportExcelOptions, 'columnsPerUnit' | 'snapDurationMinutes'>,
  scale: ExcelTimelineScale = 'day'
): number {
  if (scale === 'month' || scale === 'week') {
    return 1
  }

  // 1. columnsPerUnit が明示的に指定されている場合
  if (typeof options?.columnsPerUnit === 'number' && options.columnsPerUnit > 0) {
    return Math.max(1, Math.round(options.columnsPerUnit))
  }

  // 2. snapDurationMinutes または chart.option.snapDuration から算出
  const snapMinutes = options?.snapDurationMinutes ?? chart?.option?.snapDuration
  if (typeof snapMinutes === 'number' && snapMinutes > 0) {
    if (scale === 'day') {
      // 1440分（24時間）に対する分割数（1440=1, 720=2, 360=4, 180=8, 60=24 等）
      return Math.max(1, Math.round(1440 / snapMinutes))
    }
    if (scale === 'hour') {
      // 60分に対する分割数（60=1, 30=2, 15=4, 12=5, 6=10, 5=12 等）
      return Math.max(1, Math.round(60 / snapMinutes))
    }
  }

  return 1
}

/**
 * 各スケール（日・週・月・時間）に応じたタイムライン列リストを生成する
 */
export function generateTimelineList(
  startDate: Date,
  endDate: Date,
  scale: ExcelTimelineScale = 'day',
  includeWeekends = true,
  columnWidth?: number,
  columnsPerUnit = 1,
  isHoliday?: (date: Date) => boolean,
  locale: ExcelLocale = 'ja'
): TimelineItem[] {
  const items: TimelineItem[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayTime = today.getTime()

  const localeDef = resolveExcelLocale(locale)
  const monthNames = localeDef.timeline?.monthNames || jaLocale.timeline!.monthNames!
  const dayNames = localeDef.timeline?.dayNames || jaLocale.timeline!.dayNames!
  const yearFormat = localeDef.timeline?.yearFormat || ((y: number) => `${y}年`)
  const yearMonthFormat =
    localeDef.timeline?.yearMonthFormat || ((y: number, m: number) => `${y}年${m}月`)
  const yearMonthDayFormat =
    localeDef.timeline?.yearMonthDayFormat ||
    ((y: number, m: number, d: number, dn: string) => (dn ? `${y}年${m}月${d}日 (${dn})` : `${y}年${m}月${d}日`))
  const weekSubLabel = localeDef.timeline?.weekSubLabel || ((m: number, d: number) => `${m}/${d}〜`)

  const validCols = Math.max(1, Math.round(columnsPerUnit))
  const defaultWidth =
    scale === 'month'
      ? 8.0
      : scale === 'week'
        ? 7.5
        : scale === 'hour'
          ? validCols > 1
            ? 3.8
            : 5.0
          : validCols > 1
            ? 3.8
            : 4.2
  const resolvedWidth = typeof columnWidth === 'number' && columnWidth > 0 ? columnWidth : defaultWidth

  if (scale === 'month') {
    const cur = new Date(startDate.getFullYear(), startDate.getMonth(), 1, 0, 0, 0, 0)
    const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1, 0, 0, 0, 0)

    while (cur.getTime() <= end.getTime()) {
      const year = cur.getFullYear()
      const month = cur.getMonth() + 1
      const mStart = new Date(year, month - 1, 1, 0, 0, 0, 0)
      const mEnd = new Date(year, month, 0, 23, 59, 59, 999)

      const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month

      items.push({
        key: `month-${year}-${month}`,
        startDate: mStart,
        endDate: mEnd,
        groupLabel: yearFormat(year),
        subLabel: monthNames[month - 1] ?? `${month}月`,
        scale: 'month',
        isWeekend: false,
        isToday: isCurrentMonth,
        width: resolvedWidth,
      })

      cur.setMonth(cur.getMonth() + 1)
    }
    return items
  }

  if (scale === 'week') {
    const cur = new Date(startDate)
    cur.setHours(0, 0, 0, 0)
    const endTime = endDate.getTime()

    let weekCounter = 1
    while (cur.getTime() <= endTime) {
      const wStart = new Date(cur)
      const wEnd = new Date(cur.getTime() + 7 * 24 * 60 * 60 * 1000 - 1)

      const isCurrentWeek = todayTime >= wStart.getTime() && todayTime <= wEnd.getTime()
      const year = wStart.getFullYear()
      const month = wStart.getMonth() + 1
      const day = wStart.getDate()
      const monthName = monthNames[month - 1] ?? `${month}月`

      items.push({
        key: `week-${year}-${month}-${day}`,
        startDate: wStart,
        endDate: wEnd,
        groupLabel: yearMonthFormat(year, month, monthName),
        subLabel: weekSubLabel(month, day, weekCounter++, monthName),
        scale: 'week',
        isWeekend: false,
        isToday: isCurrentWeek,
        width: resolvedWidth,
      })

      cur.setDate(cur.getDate() + 7)
    }
    return items
  }

  if (scale === 'hour') {
    const cur = new Date(startDate)
    cur.setMinutes(0, 0, 0)
    const endTime = endDate.getTime()
    const slotMinutes = 60 / validCols

    while (cur.getTime() <= endTime) {
      const hStart = new Date(cur)
      const dayOfWeek = hStart.getDay()
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
      const isHolidayDay = isHoliday ? isHoliday(hStart) : false

      if (includeWeekends || !isWeekend) {
        const year = hStart.getFullYear()
        const month = hStart.getMonth() + 1
        const day = hStart.getDate()
        const hour = hStart.getHours()
        const monthName = monthNames[month - 1] ?? `${month}月`

        const isToday =
          today.getFullYear() === year &&
          today.getMonth() + 1 === month &&
          today.getDate() === day

        const groupLabel = yearMonthDayFormat(year, month, day, '', monthName)

        if (validCols === 1) {
          items.push({
            key: `hour-${year}-${month}-${day}-${hour}`,
            startDate: hStart,
            endDate: new Date(cur.getTime() + 60 * 60 * 1000 - 1),
            groupLabel,
            subLabel: String(hour),
            scale: 'hour',
            isWeekend,
            isHoliday: isHolidayDay,
            isToday,
            width: resolvedWidth,
          })
        } else {
          for (let sIdx = 0; sIdx < validCols; sIdx++) {
            const slotStart = new Date(hStart.getTime() + sIdx * slotMinutes * 60 * 1000)
            const slotEnd = new Date(slotStart.getTime() + slotMinutes * 60 * 1000 - 1)

            items.push({
              key: `hour-${year}-${month}-${day}-${hour}-${sIdx}`,
              startDate: slotStart,
              endDate: slotEnd,
              groupLabel,
              subLabel: sIdx === 0 ? String(hour) : '',
              scale: 'hour',
              isWeekend,
              isHoliday: isHolidayDay,
              isToday,
              width: resolvedWidth,
            })
          }
        }
      }

      cur.setHours(cur.getHours() + 1)
    }
    return items
  }

  // デフォルト: 'day'
  const cur = new Date(startDate)
  cur.setHours(0, 0, 0, 0)
  const endTime = endDate.getTime()
  const slotMinutes = 1440 / validCols

  while (cur.getTime() <= endTime) {
    const dayOfWeek = cur.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    const isHolidayDay = isHoliday ? isHoliday(cur) : false

    if (includeWeekends || !isWeekend) {
      const year = cur.getFullYear()
      const month = cur.getMonth() + 1
      const day = cur.getDate()
      const dayName = dayNames[dayOfWeek] ?? ''
      const monthName = monthNames[month - 1] ?? `${month}月`

      if (validCols === 1) {
        const dStart = new Date(cur)
        const dEnd = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), 23, 59, 59, 999)
        items.push({
          key: `day-${year}-${month}-${day}`,
          startDate: dStart,
          endDate: dEnd,
          groupLabel: yearMonthFormat(year, month, monthName),
          subLabel: `${day}\n${dayName}`,
          scale: 'day',
          isWeekend,
          isHoliday: isHolidayDay,
          isToday: cur.getTime() === todayTime,
          width: resolvedWidth,
        })
      } else {
        for (let sIdx = 0; sIdx < validCols; sIdx++) {
          const slotStart = new Date(cur.getTime() + sIdx * slotMinutes * 60 * 1000)
          const slotEnd = new Date(slotStart.getTime() + slotMinutes * 60 * 1000 - 1)
          const startHour = slotStart.getHours()
          const startMin = slotStart.getMinutes()

          items.push({
            key: `day-${year}-${month}-${day}-${sIdx}`,
            startDate: slotStart,
            endDate: slotEnd,
            groupLabel: yearMonthDayFormat(year, month, day, dayName, monthName),
            subLabel: `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`,
            scale: 'day',
            isWeekend,
            isHoliday: isHolidayDay,
            isToday: cur.getTime() === todayTime,
            width: resolvedWidth,
          })
        }
      }
    }

    cur.setDate(cur.getDate() + 1)
  }

  return items
}


/**
 * 行リストからWBSコード（1, 1.1, 1.2 等）と階層深さを計算してフラット化する
 */
export function calculateWbsHierarchy(rows: GanttRow[]): FlatRowItem[] {
  const rowMap = new Map<string, GanttRow>()
  const childrenMap = new Map<string, GanttRow[]>()
  const rootRows: GanttRow[] = []

  for (const row of rows) {
    rowMap.set(row.id, row)
  }

  for (const row of rows) {
    if (row.parentId && rowMap.has(row.parentId)) {
      if (!childrenMap.has(row.parentId)) {
        childrenMap.set(row.parentId, [])
      }
      childrenMap.get(row.parentId)!.push(row)
    } else {
      rootRows.push(row)
    }
  }

  const result: FlatRowItem[] = []

  function traverse(row: GanttRow, prefix: string, depth: number) {
    const children = childrenMap.get(row.id) || []
    result.push({
      row,
      wbsNumber: prefix,
      depth,
      isParent: children.length > 0,
    })

    children.forEach((child, index) => {
      traverse(child, `${prefix}.${index + 1}`, depth + 1)
    })
  }

  rootRows.forEach((root, index) => {
    traverse(root, `${index + 1}`, 0)
  })

  // 親子関係のない行が万が一残っていた場合のフォールバック
  if (result.length < rows.length) {
    const processedIds = new Set(result.map((r) => r.row.id))
    rows.forEach((row) => {
      if (!processedIds.has(row.id)) {
        result.push({
          row,
          wbsNumber: `${result.length + 1}`,
          depth: 0,
          isParent: (childrenMap.get(row.id) || []).length > 0,
        })
      }
    })
  }

  return result
}

/**
 * 曜日の表記を取得する（登録済みロケールまたはカスタム定義に対応）
 */
export function getDayOfWeekText(dayOfWeek: number, locale: ExcelLocale = 'ja'): string {
  const localeDef = resolveExcelLocale(locale)
  return localeDef.timeline?.dayNames?.[dayOfWeek] ?? ''
}

/**
 * ブラウザ環境でBlobをファイルとしてダウンロードする
 */
export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 1000)
}

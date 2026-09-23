import type { GanttChartElement, GanttRow } from '@mogura/moguchart-core'
import type { ExcelTimelineScale, ExportExcelOptions } from './types'

/**
 * タイムライン用の単一日付情報（互換性維持用）
 */
export interface TimelineDateItem {
  date: Date
  year: number
  month: number
  day: number
  dayOfWeek: number // 0: 日, 1: 月, ..., 6: 土
  isWeekend: boolean
  isToday: boolean
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
  isWeekend?: boolean
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

/**
 * CSSのHEXカラーをExcelJS用のARGB形式に変換する
 * 例: '#3B82F6' -> 'FF3B82F6', '#fff' -> 'FFFFFFFF'
 */
export function hexToArgb(hex?: string, defaultArgb = 'FF3B82F6'): string {
  if (!hex || typeof hex !== 'string') return defaultArgb

  let clean = hex.trim().replace(/^#/, '')

  // 3桁 HEX (例: 'FFF' -> 'FFFFFF')
  if (clean.length === 3) {
    clean = clean
      .split('')
      .map((c) => c + c)
      .join('')
  } else if (clean.length === 4) {
    // 4桁 HEX with alpha (例: 'FFF8' -> 'FFFFFF88')
    const [r, g, b, a] = clean.split('')
    clean = `${a}${a}${r}${r}${g}${g}${b}${b}`
  }

  // 6桁 HEX
  if (clean.length === 6) {
    return `FF${clean.toUpperCase()}`
  }

  // 8桁 HEX (RRGGBBAA -> AARRGGBB に変換)
  if (clean.length === 8) {
    const rgb = clean.substring(0, 6)
    const alpha = clean.substring(6, 8)
    return `${alpha.toUpperCase()}${rgb.toUpperCase()}`
  }

  return defaultArgb
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
  scale: ExcelTimelineScale = 'day'
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
        const pxPerHour = calendar.pxPerDay / 24
        return pxToExcelColumnWidth(pxPerHour, 4.5)
      }
    }
    if (scale === 'week') {
      if (typeof calendar.pxPerDay === 'number' && calendar.pxPerDay > 0) {
        return pxToExcelColumnWidth(calendar.pxPerDay * 7, 6)
      }
    }
    if (scale === 'day' && typeof calendar.pxPerDay === 'number' && calendar.pxPerDay > 0) {
      return pxToExcelColumnWidth(calendar.pxPerDay, 3.5)
    }
  }

  // 3. デフォルト幅
  switch (scale) {
    case 'month':
      return 8.0
    case 'week':
      return 7.5
    case 'hour':
      return 5.0
    case 'day':
    default:
      return 4.2
  }
}

/**
 * 各スケール（日・週・月・時間）に応じたタイムライン列リストを生成する
 */
export function generateTimelineList(
  startDate: Date,
  endDate: Date,
  scale: ExcelTimelineScale = 'day',
  includeWeekends = true,
  columnWidth?: number
): TimelineItem[] {
  const items: TimelineItem[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayTime = today.getTime()

  const defaultWidth = scale === 'month' ? 8.0 : scale === 'week' ? 7.5 : scale === 'hour' ? 5.0 : 4.2
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
        groupLabel: `${year}年`,
        subLabel: `${month}月`,
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

    while (cur.getTime() <= endTime) {
      const wStart = new Date(cur)
      const wEnd = new Date(cur.getTime() + 7 * 24 * 60 * 60 * 1000 - 1)

      const isCurrentWeek = todayTime >= wStart.getTime() && todayTime <= wEnd.getTime()
      const year = wStart.getFullYear()
      const month = wStart.getMonth() + 1
      const day = wStart.getDate()

      items.push({
        key: `week-${year}-${month}-${day}`,
        startDate: wStart,
        endDate: wEnd,
        groupLabel: `${year}年${month}月`,
        subLabel: `${month}/${day}〜`,
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

    while (cur.getTime() <= endTime) {
      const hStart = new Date(cur)
      const hEnd = new Date(cur.getTime() + 60 * 60 * 1000 - 1)
      const dayOfWeek = hStart.getDay()
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

      if (includeWeekends || !isWeekend) {
        const year = hStart.getFullYear()
        const month = hStart.getMonth() + 1
        const day = hStart.getDate()
        const hour = hStart.getHours()

        const isToday =
          today.getFullYear() === year &&
          today.getMonth() + 1 === month &&
          today.getDate() === day

        items.push({
          key: `hour-${year}-${month}-${day}-${hour}`,
          startDate: hStart,
          endDate: hEnd,
          groupLabel: `${year}年${month}月${day}日 (${getDayOfWeekText(dayOfWeek)})`,
          subLabel: `${String(hour).padStart(2, '0')}:00`,
          isWeekend,
          isToday,
          width: resolvedWidth,
        })
      }

      cur.setHours(cur.getHours() + 1)
    }
    return items
  }

  // デフォルト: 'day'
  const cur = new Date(startDate)
  cur.setHours(0, 0, 0, 0)
  const endTime = endDate.getTime()

  while (cur.getTime() <= endTime) {
    const dayOfWeek = cur.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

    if (includeWeekends || !isWeekend) {
      const dStart = new Date(cur)
      const dEnd = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), 23, 59, 59, 999)
      const year = cur.getFullYear()
      const month = cur.getMonth() + 1
      const day = cur.getDate()

      items.push({
        key: `day-${year}-${month}-${day}`,
        startDate: dStart,
        endDate: dEnd,
        groupLabel: `${year}年${month}月`,
        subLabel: `${day}\n${getDayOfWeekText(dayOfWeek)}`,
        isWeekend,
        isToday: cur.getTime() === todayTime,
        width: resolvedWidth,
      })
    }

    cur.setDate(cur.getDate() + 1)
  }

  return items
}

/**
 * 指定期間内の日別リストを生成する（互換性維持用）
 */
export function generateDateList(
  startDate: Date,
  endDate: Date,
  includeWeekends = true
): TimelineDateItem[] {
  const dates: TimelineDateItem[] = []
  const current = new Date(startDate)
  current.setHours(0, 0, 0, 0)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayTime = today.getTime()

  const endTime = endDate.getTime()

  while (current.getTime() <= endTime) {
    const dayOfWeek = current.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

    if (includeWeekends || !isWeekend) {
      dates.push({
        date: new Date(current),
        year: current.getFullYear(),
        month: current.getMonth() + 1,
        day: current.getDate(),
        dayOfWeek,
        isWeekend,
        isToday: current.getTime() === todayTime,
      })
    }

    current.setDate(current.getDate() + 1)
  }

  return dates
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
 * 曜日の日本語表記を取得する
 */
export function getDayOfWeekText(dayOfWeek: number): string {
  const texts = ['日', '月', '火', '水', '木', '金', '土']
  return texts[dayOfWeek] ?? ''
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

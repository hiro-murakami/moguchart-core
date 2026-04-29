/**
 * ガントチャートを SVG または PNG 画像としてエクスポートするユーティリティ。
 *
 * Shadow DOM の cloneNode では内部コンテンツがコピーされないため、
 * rows / option / theme などのデータから SVG を直接描画します。
 */

import type { GanttChartOption, GanttRow, DependencyLineStyle } from '@/core/types'
import {
  calculateTaskLanes,
  dateToX,
  getThemeColors,
  getCalendarColor,
  getTotalDays,
} from '@/core/utils'
import { buildOrthogonalPath } from './gantt-chart-dependency-path'
import { DEFAULT_BAR_COLOR, DEFAULT_BAR_HEIGHT, DEFAULT_BAR_MARGIN, DEFAULT_BAR_CORNER_RADIUS, DEFAULT_ROW_HEADER_WIDTH } from '@/core/constants'
import { jaLocale } from '@/core/i18n'
import dayjs from 'dayjs'

export interface ExportImageOptions {
  /** ダウンロード時のファイル名（拡張子なし）。省略時は 'gantt-chart' */
  filename?: string
  /** true の場合、自動的にファイルダウンロードを開始する。デフォルト: false */
  download?: boolean
  /** PNG 出力時のスケール倍率（高解像度化）。デフォルト: 2 */
  scale?: number
}

export interface ExportGanttOptions extends ExportImageOptions {
  rows: GanttRow[]
  option: GanttChartOption
  theme: 'light' | 'dark'
  /** カレンダー行の高さ（実測値）。省略時は自動推定 */
  calendarHeight?: number
  /** 行ヘッダー幅（現在の実効値）。省略時は option から取得 */
  rowHeaderWidth?: number
}

function px(v: number): string {
  return v.toFixed(2)
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function dateX(date: Date, option: GanttChartOption): number {
  return dateToX(date, option.calendar.start, option.calendar.pxPerDay ?? 50, option.calendar.pxPerMonth)
}

/** カレンダー行を SVG 要素文字列として描画する */
function buildCalendarSvg(option: GanttChartOption, theme: 'light' | 'dark', labelWidth: number): { svg: string; height: number } {
  const colors = getThemeColors(theme, option.customTheme)
  const locale = option.locale ?? jaLocale
  const pxPerDay = option.calendar.pxPerDay ?? 50
  const pxPerMonth = option.calendar.pxPerMonth
  const totalDays = getTotalDays(option.calendar.start, option.calendar.end)

  const days: Date[] = Array.from({ length: Math.ceil(totalDays) }, (_, i) => {
    const d = new Date(option.calendar.start)
    d.setDate(d.getDate() + i)
    return d
  })

  // months
  const months: { year: number; month: number; x: number; width: number }[] = []
  {
    type MonthAcc = { year: number; month: number; startDate: Date; endDate: Date }
    const acc: MonthAcc[] = []
    days.forEach(day => {
      const y = day.getFullYear(), m = day.getMonth()
      const last = acc[acc.length - 1]
      if (last && last.year === y && last.month === m) {
        last.endDate = new Date(day); last.endDate.setDate(last.endDate.getDate() + 1)
      } else {
        const s = new Date(day); s.setHours(0,0,0,0)
        const e = new Date(day); e.setDate(e.getDate() + 1)
        acc.push({ year: y, month: m, startDate: s, endDate: e })
      }
    })
    acc.forEach(m => {
      months.push({ year: m.year, month: m.month, x: dateX(m.startDate, option), width: dateX(m.endDate, option) - dateX(m.startDate, option) })
    })
  }

  const ROW_H = 22
  let parts: string[] = []
  let y = 0
  const totalWidth = dateX(option.calendar.end, option) + labelWidth

  // 背景
  parts.push(`<rect x="0" y="0" width="${px(totalWidth)}" height="999" fill="${esc(colors.calendarBg)}"/>`)

  // ラベルプレースホルダー背景
  const headerBg = option.rowHeader?.backgroundColor ?? colors.rowHeaderBg
  parts.push(`<rect x="0" y="0" width="${px(labelWidth)}" height="999" fill="${esc(headerBg)}"/>`)

  // showMonthsRow: 年行 + 月行
  if (option.calendar.showMonthsRow) {
    // years
    const years: { year: number; x: number; width: number }[] = []
    {
      type YAcc = { year: number; startDate: Date; endDate: Date }
      const acc: YAcc[] = []
      days.forEach(d => {
        const y = d.getFullYear()
        const last = acc[acc.length - 1]
        if (last && last.year === y) { last.endDate = new Date(d); last.endDate.setDate(last.endDate.getDate() + 1) }
        else { const s = new Date(d); s.setHours(0,0,0,0); const e = new Date(d); e.setDate(e.getDate() + 1); acc.push({ year: y, startDate: s, endDate: e }) }
      })
      acc.forEach(a => years.push({ year: a.year, x: dateX(a.startDate, option), width: dateX(a.endDate, option) - dateX(a.startDate, option) }))
    }
    // year row
    parts.push(`<rect x="${px(labelWidth)}" y="${px(y)}" width="${px(totalWidth - labelWidth)}" height="${px(ROW_H)}" fill="${esc(colors.bg)}"/>`)
    years.forEach((yr, i) => {
      const rx = labelWidth + yr.x
      if (i > 0) parts.push(`<line x1="${px(rx)}" y1="${px(y)}" x2="${px(rx)}" y2="${px(y + ROW_H)}" stroke="${esc(colors.border)}" stroke-width="1"/>`)
      parts.push(`<text x="${px(rx + 4)}" y="${px(y + 15)}" font-size="11" font-weight="bold" fill="${esc(colors.text)}" font-family="sans-serif">${esc(String(yr.year))}</text>`)
    })
    parts.push(`<line x1="${px(labelWidth)}" y1="${px(y + ROW_H)}" x2="${px(totalWidth)}" y2="${px(y + ROW_H)}" stroke="${esc(colors.border)}" stroke-width="1"/>`)
    y += ROW_H
    // month row
    const monthTextAlign = option.calendar.monthTextAlign ?? 'center'
    parts.push(`<rect x="${px(labelWidth)}" y="${px(y)}" width="${px(totalWidth - labelWidth)}" height="${px(ROW_H)}" fill="${esc(colors.bg)}"/>`)
    months.forEach((m, i) => {
      const rx = labelWidth + m.x
      if (i > 0) parts.push(`<line x1="${px(rx)}" y1="${px(y)}" x2="${px(rx)}" y2="${px(y + ROW_H)}" stroke="${esc(colors.border)}" stroke-width="1"/>`)
      const monthRowFormat = locale.monthRowFormat
      const label = dayjs(new Date(m.year, m.month)).format(monthRowFormat)
      const tx = monthTextAlign === 'right' ? rx + m.width - 4 : monthTextAlign === 'center' ? rx + m.width / 2 : rx + 4
      const anchor = monthTextAlign === 'right' ? 'end' : monthTextAlign === 'center' ? 'middle' : 'start'
      parts.push(`<text x="${px(tx)}" y="${px(y + 15)}" font-size="10" font-weight="bold" fill="${esc(colors.text)}" text-anchor="${anchor}" font-family="sans-serif">${esc(label)}</text>`)
    })
    parts.push(`<line x1="${px(labelWidth)}" y1="${px(y + ROW_H)}" x2="${px(totalWidth)}" y2="${px(y + ROW_H)}" stroke="${esc(colors.border)}" stroke-width="1"/>`)
    y += ROW_H
  } else if (option.calendar.showMonths !== false) {
    // 月行
    const format = option.calendar.monthFormat || locale.monthFormat
    parts.push(`<rect x="${px(labelWidth)}" y="${px(y)}" width="${px(totalWidth - labelWidth)}" height="${px(ROW_H)}" fill="${esc(colors.bg)}"/>`)
    months.forEach((m, i) => {
      const rx = labelWidth + m.x
      if (i > 0) parts.push(`<line x1="${px(rx)}" y1="${px(y)}" x2="${px(rx)}" y2="${px(y + ROW_H)}" stroke="${esc(colors.border)}" stroke-width="1"/>`)
      const label = dayjs(new Date(m.year, m.month)).format(format)
      parts.push(`<text x="${px(rx + 4)}" y="${px(y + 15)}" font-size="11" font-weight="bold" fill="${esc(colors.text)}" font-family="sans-serif">${esc(label)}</text>`)
    })
    parts.push(`<line x1="${px(labelWidth)}" y1="${px(y + ROW_H)}" x2="${px(totalWidth)}" y2="${px(y + ROW_H)}" stroke="${esc(colors.border)}" stroke-width="1"/>`)
    y += ROW_H
  }

  // 日行
  if (option.calendar.showDays !== false) {
    const DAY_H = ROW_H
    parts.push(`<rect x="${px(labelWidth)}" y="${px(y)}" width="${px(totalWidth - labelWidth)}" height="${px(DAY_H)}" fill="${esc(colors.calendarBg)}"/>`)
    days.forEach((day, index) => {
      let width = pxPerDay
      if (pxPerMonth !== undefined) {
        // monthモードでは各月の幅から計算
        const nextDay = new Date(day); nextDay.setDate(nextDay.getDate() + 1)
        width = dateX(nextDay, option) - dateX(day, option)
      }
      if (index + 1 > totalDays) width = (totalDays - index) * (pxPerDay ?? 50)
      const bgColor = getCalendarColor(day, colors, option.calendar.isHoliday)
      const rx = labelWidth + dateX(day, option)
      if (bgColor) parts.push(`<rect x="${px(rx)}" y="${px(y)}" width="${px(width)}" height="${px(DAY_H)}" fill="${esc(bgColor)}"/>`)
      parts.push(`<line x1="${px(rx + width)}" y1="${px(y)}" x2="${px(rx + width)}" y2="${px(y + DAY_H)}" stroke="${esc(colors.border)}" stroke-width="0.5" opacity="0.5"/>`)
      const label = option.calendar.showTime
        ? `${String(day.getMonth() + 1).padStart(2, '0')}/${String(day.getDate()).padStart(2, '0')}`
        : String(day.getDate())
      parts.push(`<text x="${px(rx + width / 2)}" y="${px(y + 15)}" font-size="10" text-anchor="middle" fill="${esc(colors.text)}" font-family="sans-serif">${esc(label)}</text>`)
    })
    y += DAY_H
  }

  // 下ボーダー
  parts.push(`<line x1="0" y1="${px(y)}" x2="${px(totalWidth)}" y2="${px(y)}" stroke="${esc(colors.border)}" stroke-width="2"/>`)

  // ヘッダー右ボーダー
  parts.push(`<line x1="${px(labelWidth)}" y1="0" x2="${px(labelWidth)}" y2="${px(y)}" stroke="${esc(colors.border)}" stroke-width="1"/>`)

  return { svg: parts.join(''), height: y }
}

/** rows を SVG 要素文字列として描画する */
function buildRowsSvg(
  rows: GanttRow[],
  option: GanttChartOption,
  theme: 'light' | 'dark',
  labelWidth: number,
  offsetY: number,
): { svg: string; totalHeight: number; taskCoords: Map<string, { x: number; y: number; width: number; height: number; dependencies?: string[] }> } {
  const colors = getThemeColors(theme, option.customTheme)
  const barHeight = option.bar?.height ?? DEFAULT_BAR_HEIGHT
  const barMargin = option.bar?.margin ?? DEFAULT_BAR_MARGIN
  const barRadius = option.bar?.cornerRadius ?? DEFAULT_BAR_CORNER_RADIUS
  const pxPerDay = option.calendar.pxPerDay ?? 50
  const headerBg = option.rowHeader?.backgroundColor ?? colors.rowHeaderBg

  const displayRows = option.showHiddenRows ? rows : rows.filter(r => r.visible !== false)
  const parts: string[] = []
  const taskCoords = new Map<string, { x: number; y: number; width: number; height: number; dependencies?: string[] }>()

  let rowTop = 0

  displayRows.forEach(row => {
    const { tasksWithLanes, laneCount } = calculateTaskLanes(row.tasks)
    const rowHeight = laneCount * (barHeight + barMargin) + barMargin
    const isHidden = row.visible === false
    const ry = offsetY + rowTop

    // 行背景
    if (isHidden) {
      parts.push(`<rect x="${px(labelWidth)}" y="${px(ry)}" width="${px(dateX(option.calendar.end, option))}" height="${px(rowHeight)}" fill="${esc(colors.bg)}"/>`)
      // 斜線パターン（簡易）
      parts.push(`<rect x="${px(labelWidth)}" y="${px(ry)}" width="${px(dateX(option.calendar.end, option))}" height="${px(rowHeight)}" fill="url(#hidden-pattern)"/>`)
    } else {
      // グリッド線（日次）
      const totalDays = getTotalDays(option.calendar.start, option.calendar.end)
      for (let i = 0; i <= Math.ceil(totalDays); i++) {
        const gx = labelWidth + i * pxPerDay
        parts.push(`<line x1="${px(gx)}" y1="${px(ry)}" x2="${px(gx)}" y2="${px(ry + rowHeight)}" stroke="${esc(colors.gridLine)}" stroke-width="0.5" opacity="0.6"/>`)
      }
    }

    // 行ヘッダー背景
    parts.push(`<rect x="0" y="${px(ry)}" width="${px(labelWidth)}" height="${px(rowHeight)}" fill="${esc(headerBg)}"/>`)
    // 行ヘッダーテキスト
    parts.push(`<text x="12" y="${px(ry + rowHeight / 2 + 4)}" font-size="12" fill="${esc(colors.text)}" font-family="sans-serif" clip-path="url(#header-clip-${row.id.replace(/[^a-z0-9]/gi, '_')})">${esc(row.name ?? '')}</text>`)

    // バーを描画
    tasksWithLanes.forEach(task => {
      const tx = labelWidth + dateX(task.start, option)
      const tw = Math.max(dateX(task.end, option) - dateX(task.start, option), 1)
      const ty = ry + task.lane * (barHeight + barMargin) + barMargin
      const barColor = (() => {
        const s = task.style ?? ''
        const m = s.match(/background-color\s*:\s*([^;]+)/)
        return m ? m[1].trim() : (DEFAULT_BAR_COLOR)
      })()

      // タスク座標を記録（依存線描画用）
      taskCoords.set(task.id, {
        x: tx,
        y: ty,
        width: tw,
        height: barHeight,
        dependencies: task.dependencies,
      })

      // バー本体
      parts.push(`<rect x="${px(tx)}" y="${px(ty)}" width="${px(tw)}" height="${px(barHeight)}" rx="${barRadius}" ry="${barRadius}" fill="${esc(barColor)}"/>`)
      // ラベル
      if (task.name) {
        parts.push(`<text x="${px(tx + 6)}" y="${px(ty + barHeight / 2 + 4)}" font-size="11" fill="white" font-family="sans-serif" clip-path="url(#bar-clip-${task.id.replace(/[^a-z0-9]/gi, '_')})">${esc(task.name)}</text>`)
        parts.push(`<clipPath id="bar-clip-${task.id.replace(/[^a-z0-9]/gi, '_')}"><rect x="${px(tx)}" y="${px(ty)}" width="${px(tw - 4)}" height="${px(barHeight)}"/></clipPath>`)
      }
    })

    // 行下ボーダー
    parts.push(`<line x1="0" y1="${px(ry + rowHeight)}" x2="${px(labelWidth + dateX(option.calendar.end, option))}" y2="${px(ry + rowHeight)}" stroke="${esc(colors.border)}" stroke-width="0.5"/>`)
    // ヘッダー右ボーダー
    parts.push(`<line x1="${px(labelWidth)}" y1="${px(ry)}" x2="${px(labelWidth)}" y2="${px(ry + rowHeight)}" stroke="${esc(colors.border)}" stroke-width="1"/>`)
    // クリップ（ヘッダーテキスト用）
    const safeId = row.id.replace(/[^a-z0-9]/gi, '_')
    parts.push(`<clipPath id="header-clip-${safeId}"><rect x="0" y="${px(ry)}" width="${px(labelWidth - 4)}" height="${px(rowHeight)}"/></clipPath>`)

    rowTop += rowHeight
  })

  return { svg: parts.join(''), totalHeight: rowTop, taskCoords }
}

/** 依存線を SVG 要素文字列として描画する */
function buildDependenciesSvg(
  taskCoords: Map<string, { x: number; y: number; width: number; height: number; dependencies?: string[] }>,
  option: GanttChartOption,
  theme: 'light' | 'dark',
): string {
  const colors = getThemeColors(theme, option.customTheme)
  const showArrows = option.dependency?.showArrows !== false
  const arrowSize = option.dependency?.arrowSize ?? 8
  const lineStyle: DependencyLineStyle = option.dependency?.lineStyle ?? 'orthogonal'
  const cornerRadius = option.dependency?.cornerRadius ?? 8
  const barHeight = option.bar?.height ?? DEFAULT_BAR_HEIGHT
  const barMargin = option.bar?.margin ?? DEFAULT_BAR_MARGIN
  const lineColor = colors.dependencyLine

  const parts: string[] = []
  const arrowId = 'dep-arrow'

  if (showArrows) {
    parts.push(`<defs><marker id="${arrowId}" markerWidth="${arrowSize}" markerHeight="${arrowSize}" refX="${arrowSize}" refY="${arrowSize / 2}" orient="auto" markerUnits="userSpaceOnUse"><polygon points="0 0, ${arrowSize} ${arrowSize / 2}, 0 ${arrowSize}" fill="${esc(lineColor)}"/></marker></defs>`)
  }

  for (const [, task] of taskCoords) {
    if (!task.dependencies) continue
    for (const depId of task.dependencies) {
      const dep = taskCoords.get(depId)
      if (!dep) continue
      const startX = dep.x + dep.width
      const startY = dep.y + dep.height / 2
      const endX = task.x
      const endY = task.y + task.height / 2
      const adjustedEndX = showArrows ? endX - arrowSize : endX

      let pathD: string
      if (lineStyle === 'orthogonal') {
        const { pathD: d } = buildOrthogonalPath(startX, startY, endX, endY, adjustedEndX, barHeight, barMargin, cornerRadius)
        pathD = d
      } else {
        if (startX < endX - 10) {
          const midX = (startX + adjustedEndX) / 2
          pathD = `M ${startX} ${startY} C ${midX} ${startY} ${midX} ${endY} ${adjustedEndX} ${endY}`
        } else {
          const offset = Math.max(12, (startX - endX) * 0.15)
          const midY = (startY + endY) / 2
          const effectiveMidY = Math.abs(startY - endY) < barHeight ? midY + barHeight + barMargin : midY
          pathD = `M ${startX} ${startY} C ${startX + offset} ${startY}, ${startX + offset} ${effectiveMidY}, ${(startX + adjustedEndX) / 2} ${effectiveMidY} S ${adjustedEndX - offset} ${endY}, ${adjustedEndX} ${endY}`
        }
      }

      parts.push(`<path d="${esc(pathD)}" stroke="${esc(lineColor)}" stroke-width="2" fill="none"/>`)
      if (showArrows) {
        const arrowPath = `M ${adjustedEndX} ${endY} L ${endX} ${endY}`
        parts.push(`<path d="${esc(arrowPath)}" stroke="${esc(lineColor)}" stroke-width="0" fill="none" marker-end="url(#${arrowId})"/>`)
      }
    }
  }

  return parts.join('')
}

/**
 * データから直接 SVG を生成してエクスポートする。
 * Shadow DOM の cloneNode の問題を回避するため、描画ロジックを再実装しています。
 */
export async function exportGanttImage(
  opts: ExportGanttOptions,
  format: 'svg' | 'png',
): Promise<string> {
  const { rows, option, theme, filename = 'gantt-chart', download = false, scale = 2 } = opts
  const labelWidth = opts.rowHeaderWidth ?? (option.rowHeader?.width ?? DEFAULT_ROW_HEADER_WIDTH)
  const colors = getThemeColors(theme, option.customTheme)

  // カレンダー部分の描画
  const { svg: calSvg, height: calH } = buildCalendarSvg(option, theme, labelWidth)

  // 行部分の描画
  const { svg: rowsSvg, totalHeight, taskCoords } = buildRowsSvg(rows, option, theme, labelWidth, calH)

  // 依存線の描画
  const depSvg = buildDependenciesSvg(taskCoords, option, theme)

  const totalWidth = labelWidth + dateX(option.calendar.end, option)
  const totalH = calH + totalHeight

  const svgContent = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${px(totalWidth)}" height="${px(totalH)}" viewBox="0 0 ${px(totalWidth)} ${px(totalH)}">`,
    // 全体背景
    `<rect width="${px(totalWidth)}" height="${px(totalH)}" fill="${esc(colors.bg)}"/>`,
    // 隠し行パターン定義
    `<defs><pattern id="hidden-pattern" patternUnits="userSpaceOnUse" width="20" height="20" patternTransform="rotate(45)">`,
    `<line x1="0" y1="0" x2="0" y2="20" stroke="${esc(colors.border)}" stroke-width="8"/></pattern></defs>`,
    calSvg,
    rowsSvg,
    depSvg,
    `</svg>`,
  ].join('')

  const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`

  if (format === 'svg') {
    if (download) triggerDownload(svgDataUrl, `${filename}.svg`)
    return svgDataUrl
  }

  // PNG: Canvas で SVG を描画してエクスポート
  const pngDataUrl = await svgToPng(svgDataUrl, totalWidth, totalH, scale)
  if (download) triggerDownload(pngDataUrl, `${filename}.png`)
  return pngDataUrl
}

/** SVG データURL を Canvas 経由で PNG データURL に変換する */
function svgToPng(svgDataUrl: string, width: number, height: number, scale: number): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(width * scale)
      canvas.height = Math.round(height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Failed to get canvas 2d context')); return }
      ctx.scale(scale, scale)
      ctx.drawImage(img, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => reject(new Error('Failed to load SVG image'))
    img.src = svgDataUrl
  })
}

/** データURL のファイルダウンロードをトリガーする */
function triggerDownload(dataUrl: string, filename: string): void {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  a.click()
}

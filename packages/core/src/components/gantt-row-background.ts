import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { createCustomHolidayResolver } from '../core/auto-schedule'
import { getCalendarColor, getThemeColors, getTotalDays, dateToX } from '../core/utils'
import type { GanttChartOption, ChartBackgroundCellContext, GanttHolidayChecker } from '../core/types'

interface CachedBgCell {
  left: number
  width: number
  color: string
  date: Date
  index: number
}

function findCellRange(cells: CachedBgCell[], startX: number, endX: number): [number, number] {
  if (cells.length === 0 || endX <= startX) return [0, -1]

  // cell.left + cell.width > startX となる最初のインデックスを二分探索
  let lo = 0
  let hi = cells.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (cells[mid].left + cells[mid].width <= startX) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  const firstIdx = lo
  if (firstIdx >= cells.length || cells[firstIdx].left >= endX) {
    return [0, -1]
  }

  // cell.left < endX となる最後のインデックスを二分探索
  lo = firstIdx
  hi = cells.length - 1
  let lastIdx = firstIdx
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1
    if (cells[mid].left < endX) {
      lastIdx = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }

  return [firstIdx, lastIdx]
}

@customElement('gantt-row-background')
export class GanttRowBackgroundElement extends LitElement {
  @property({ type: Object }) option!: GanttChartOption
  @property({ type: String })
  theme: 'light' | 'dark' = 'light'
  @property({ type: String })
  rowId = ''
  @property({ type: Number })
  visibleStartX = 0
  @property({ type: Number })
  visibleEndX = Number.POSITIVE_INFINITY
  @property({ type: Boolean })
  isExporting = false

  private get totalDays() {
    return getTotalDays(this.option.calendar.start, this.option.calendar.end)
  }

  // dayセルのキャッシュ（start/end/pxPerDay/pxPerMonth/theme/休日設定が変わらない限り再利用）
  private _cachedCells: CachedBgCell[] | null = null
  private _cachedColoredCells: CachedBgCell[] | null = null
  private _cachedCellsStartTime = 0
  private _cachedCellsEndTime = 0
  private _cachedCellsPxPerDay = 0
  private _cachedCellsPxPerMonth: number | undefined = undefined
  private _cachedCellsTheme = ''
  private _cachedCustomThemeRef: unknown = undefined
  private _cachedIsHoliday: GanttHolidayChecker | undefined = undefined
  private _cachedNonWorkingDays: number[] | undefined = undefined

  static styles = css`
    :host {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: block;
      z-index: 0;
      pointer-events: none;
      overflow: hidden;
    }
    .bg-cell {
      position: absolute;
      top: 0;
      bottom: 0;
      overflow: hidden;
    }
  `

  render() {
    const colors = getThemeColors(this.theme, this.option.customTheme)
    const startTime = this.option.calendar.start.getTime()
    const endTime = this.option.calendar.end.getTime()
    const pxPerDay = this.option.calendar.pxPerDay ?? 50
    const pxPerMonth = this.option.calendar.pxPerMonth

    if (
      !this._cachedCells ||
      startTime !== this._cachedCellsStartTime ||
      endTime !== this._cachedCellsEndTime ||
      pxPerDay !== this._cachedCellsPxPerDay ||
      pxPerMonth !== this._cachedCellsPxPerMonth ||
      this.theme !== this._cachedCellsTheme ||
      this.option.customTheme !== this._cachedCustomThemeRef ||
      this.option.calendar.isHoliday !== this._cachedIsHoliday ||
      this.option.calendar.nonWorkingDays !== this._cachedNonWorkingDays
    ) {
      this._cachedCellsStartTime = startTime
      this._cachedCellsEndTime = endTime
      this._cachedCellsPxPerDay = pxPerDay
      this._cachedCellsPxPerMonth = pxPerMonth
      this._cachedCellsTheme = this.theme
      this._cachedCustomThemeRef = this.option.customTheme
      this._cachedIsHoliday = this.option.calendar.isHoliday
      this._cachedNonWorkingDays = this.option.calendar.nonWorkingDays

      const dayCount = Math.max(0, Math.ceil(this.totalDays))
      const allCells: CachedBgCell[] = new Array(dayCount)
      const coloredCells: CachedBgCell[] = []

      for (let i = 0; i < dayCount; i++) {
        const day = new Date(this.option.calendar.start)
        day.setDate(day.getDate() + i)
        const color = getCalendarColor(
          day,
          colors,
          this.option.calendar.isHoliday,
          this.option.calendar,
        )
        const nextDay = new Date(day)
        nextDay.setDate(day.getDate() + 1)
        const d1 = dateToX(day, this.option.calendar.start, pxPerDay, pxPerMonth)
        const d2 = dateToX(nextDay, this.option.calendar.start, pxPerDay, pxPerMonth)
        const cell: CachedBgCell = {
          left: d1,
          width: d2 - d1,
          color,
          date: day,
          index: i,
        }
        allCells[i] = cell
        if (color && color !== 'transparent') {
          coloredCells.push(cell)
        }
      }

      this._cachedCells = allCells
      this._cachedColoredCells = coloredCells
    }

    const useVirtualX =
      !this.isExporting &&
      this.option.calendar.virtualScrollX !== false &&
      Number.isFinite(this.visibleEndX)

    const chartBackgroundRenderer = this.option.customRendering?.chartBackground

    if (chartBackgroundRenderer) {
      const cells = this._cachedCells!
      const [firstIdx, lastIdx] = useVirtualX
        ? findCellRange(cells, this.visibleStartX, this.visibleEndX)
        : [0, cells.length - 1]
      if (lastIdx < firstIdx) return html``

      const visibleSlice = useVirtualX ? cells.slice(firstIdx, lastIdx + 1) : cells
      const holidayResolver = createCustomHolidayResolver({
        isHoliday: this.option.calendar.isHoliday,
        nonWorkingDays: this.option.calendar.nonWorkingDays,
      })

      return html`
        ${visibleSlice.map(({ left, width, color, date, index }) => {
          const dayOfWeek = date.getDay()
          const isHoliday = holidayResolver.isHolidayDate(date)
          const context: ChartBackgroundCellContext = {
            date,
            width,
            height: this.clientHeight || 0,
            rowId: this.rowId,
            isSaturday: dayOfWeek === 6,
            isSunday: dayOfWeek === 0,
            isHoliday,
            defaultColor: color,
            index,
          }
          const content = chartBackgroundRenderer(context)
          return html`<div
            class="bg-cell"
            style="left: ${left}px; width: ${width}px; ${color ? `background-color: ${color};` : ''}"
          ><div style="position: absolute; inset: 0;">${typeof content === 'string' ? html`${content}` : content}</div></div>`
        })}
      `
    }

    // 標準スパース描画モード: 色付きのセル（週末・祝日・カスタム曜日色）のみを可視範囲内で出力
    const coloredCells = this._cachedColoredCells!
    if (coloredCells.length === 0) return html``

    const [firstIdx, lastIdx] = useVirtualX
      ? findCellRange(coloredCells, this.visibleStartX, this.visibleEndX)
      : [0, coloredCells.length - 1]
    if (lastIdx < firstIdx) return html``

    const visibleColored = useVirtualX ? coloredCells.slice(firstIdx, lastIdx + 1) : coloredCells
    return html`
      ${visibleColored.map(
        ({ left, width, color }) =>
          html`<div
            class="bg-cell"
            style="left: ${left}px; width: ${width}px; background-color: ${color};"
          ></div>`,
      )}
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gantt-row-background': GanttRowBackgroundElement
  }
}

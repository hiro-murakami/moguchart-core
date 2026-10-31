import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { createCustomHolidayResolver } from '../core/auto-schedule'
import { getCalendarColor, getThemeColors, getTotalDays, dateToX } from '../core/utils'
import type { GanttChartOption, ChartBackgroundCellContext, GanttHolidayChecker } from '../core/types'

@customElement('gantt-row-background')
export class GanttRowBackgroundElement extends LitElement {
  @property({ type: Object }) option!: GanttChartOption
  @property({ type: String })
  theme: 'light' | 'dark' = 'light'
  @property({ type: String })
  rowId = ''

  private get totalDays() {
    return getTotalDays(this.option.calendar.start, this.option.calendar.end)
  }

  // dayセルのキャッシュ（start/end/pxPerDay/pxPerMonth/theme/休日設定が変わらない限り再利用）
  private _cachedCells: { width: number; color: string; date: Date }[] | null = null
  private _cachedCellsStartTime = 0
  private _cachedCellsEndTime = 0
  private _cachedCellsPxPerDay = 0
  private _cachedCellsPxPerMonth: number | undefined = undefined
  private _cachedCellsTheme = ''
  private _cachedIsHoliday: GanttHolidayChecker | undefined = undefined
  private _cachedNonWorkingDays: number[] | undefined = undefined

  static styles = css`
    :host {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      z-index: 0;
      pointer-events: none;
      overflow: hidden;
    }
    .bg-cell {
      flex-shrink: 0;
      position: relative;
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
      this.option.calendar.isHoliday !== this._cachedIsHoliday ||
      this.option.calendar.nonWorkingDays !== this._cachedNonWorkingDays
    ) {
      this._cachedCellsStartTime = startTime
      this._cachedCellsEndTime = endTime
      this._cachedCellsPxPerDay = pxPerDay
      this._cachedCellsPxPerMonth = pxPerMonth
      this._cachedCellsTheme = this.theme
      this._cachedIsHoliday = this.option.calendar.isHoliday
      this._cachedNonWorkingDays = this.option.calendar.nonWorkingDays

      const days = Array.from(
        { length: Math.ceil(this.totalDays) },
        (_, i) => {
          const d = new Date(this.option.calendar.start)
          d.setDate(d.getDate() + i)
          return d
        },
      )

      this._cachedCells = days.map((day) => {
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
        return { width: d2 - d1, color, date: day }
      })
    }

    const chartBackgroundRenderer = this.option.customRendering?.chartBackground

    if (chartBackgroundRenderer) {
      const holidayResolver = createCustomHolidayResolver({
        isHoliday: this.option.calendar.isHoliday,
        nonWorkingDays: this.option.calendar.nonWorkingDays,
      })
      return html`
        ${this._cachedCells!.map(({ width, color, date }, index) => {
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
          if (typeof content === 'string') {
            return html`<div
              class="bg-cell"
              style="width: ${width}px; background-color: ${color};"
            ><div style="position: absolute; inset: 0;">${html`${content}`}</div></div>`
          }
          return html`<div
            class="bg-cell"
            style="width: ${width}px; background-color: ${color};"
          ><div style="position: absolute; inset: 0;">${content}</div></div>`
        })}
      `
    }

    return html`
      ${this._cachedCells!.map(({ width, color }) => html`<div
        style="width: ${width}px; background-color: ${color}; flex-shrink: 0;"
      ></div>`)}
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gantt-row-background': GanttRowBackgroundElement
  }
}

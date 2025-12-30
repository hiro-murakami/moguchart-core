import { LitElement, html, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import type { GanttChartOption } from '@/types'
import { DEFAULT_LABEL_WIDTH, DEFAULT_COLOR } from '@/constants'
import * as holiday_jp from '@holiday-jp/holiday_jp'

@customElement('gantt-calendar')
export class GanttCalendar extends LitElement {
  @property({ type: Object }) option!: GanttChartOption
  @property({ type: Number }) totalDays = 30

  static styles = css`
    :host {
      display: flex;
      width: fit-content;
      min-width: 100%;
      background: #f8fafc;
      border-bottom: 2px solid ${unsafeCSS(DEFAULT_COLOR.BORDER)};
      box-sizing: border-box;
    }
    .label-placeholder {
      flex-shrink: 0;
      border-right: 1px solid ${unsafeCSS(DEFAULT_COLOR.BORDER)};
      box-sizing: border-box;
      position: sticky;
      left: 0;
      z-index: 30;
      background: inherit;
    }
    .calendar-group {
      display: flex;
      flex-direction: column;
    }
    .months-container {
      display: flex;
      background: #fff;
      border-bottom: 1px solid ${unsafeCSS(DEFAULT_COLOR.BORDER)};
    }
    .month-cell {
      box-sizing: border-box;
      padding: 4px 8px;
      font-size: 12px;
      font-weight: bold;
      border-right: 1px solid ${unsafeCSS(DEFAULT_COLOR.BORDER)};
      white-space: nowrap;
      overflow: hidden;
    }
    .days-container {
      display: flex;
      background-position: -1px 0;
    }
    .day-cell {
      text-align: center;
      font-size: 10px;
      padding: 6px 0;
      flex-shrink: 0;
      box-sizing: border-box;
      word-break: break-all;
      line-height: 1.1;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  `

  render() {
    const days = Array.from({ length: this.totalDays }, (_, i) => {
      const d = new Date(this.option.chartStart)
      d.setDate(d.getDate() + i)
      return d
    })

    const months: { year: number; month: number; count: number }[] = []
    days.forEach((day) => {
      const year = day.getFullYear()
      const month = day.getMonth()
      const last = months[months.length - 1]
      if (last && last.year === year && last.month === month) {
        last.count++
      } else {
        months.push({ year, month, count: 1 })
      }
    })

    const backgroundStyle = `
      background-image: linear-gradient(90deg, transparent ${this.option.calendar.pxPerDay - 1}px, ${DEFAULT_COLOR.BORDER} ${this.option.calendar.pxPerDay - 1}px);
      background-size: ${this.option.calendar.pxPerDay}px 100%;
    `

    return html`
      <div
        class="label-placeholder"
        style="width: ${this.option.label?.width ??
        DEFAULT_LABEL_WIDTH}px; background-color: ${this.option.label
          ?.backgroundColor ?? DEFAULT_COLOR.LABEL_BACKGROUND};"
      ></div>
      <div class="calendar-group">
        <div class="months-container">
          ${months.map(
            (m) => html`
              <div
                class="month-cell"
                style="width: ${m.count * this.option.calendar.pxPerDay}px"
              >
                ${m.year}年${m.month + 1}月
              </div>
            `,
          )}
        </div>
        <div class="days-container" style="${backgroundStyle}">
          ${days.map((day) => {
            const dayOfWeek = day.getDay()
            const isHolidayDay = holiday_jp.isHoliday(day)
            let backgroundColor = ''
            if (isHolidayDay) {
              backgroundColor =
                this.option.calendar.holidayColor ??
                this.option.calendar.sundayColor ??
                DEFAULT_COLOR.HOLIDAY
            } else if (dayOfWeek === 0) {
              backgroundColor =
                this.option.calendar.sundayColor ?? DEFAULT_COLOR.SUNDAY
            } else if (dayOfWeek === 6) {
              backgroundColor =
                this.option.calendar.saturdayColor ?? DEFAULT_COLOR.SATURDAY
            }
            return html`
              <div
                class="day-cell"
                style="width: ${this.option.calendar
                  .pxPerDay}px; ${backgroundColor
                  ? `background-color: ${backgroundColor};`
                  : ''}"
              >
                ${day.getDate()}
              </div>
            `
          })}
        </div>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gantt-calendar': GanttCalendar
  }
}

import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import type { GanttChartOption } from '@/core/types'
import { jaLocale } from '@/core/i18n'
import { DEFAULT_ROW_HEADER_WIDTH } from '@/core/constants'
import { getCalendarColor, getThemeColors, getTotalDays, dateToX } from '@/core/utils'
import dayjs from 'dayjs'

@customElement('gantt-calendar')
export class GanttCalendarElement extends LitElement {
  @property({ type: Object }) option!: GanttChartOption
  @property({ type: String })
  theme: 'light' | 'dark' = 'light'
  @property({ type: Object }) currentTime = new Date()
  @property({ type: String }) hoveredMilestoneId: string | null = null

  // days/months/years/weeks のキャッシュ
  private _cachedDays: Date[] | null = null
  private _cachedMonths: { year: number; month: number; count: number; width?: number; start?: Date; end?: Date }[] | null = null
  private _cachedYears: { year: number; count: number; start?: Date; end?: Date; width?: number }[] | null = null
  private _cachedWeeks: { weekNumber: number; startDate: Date; count: number }[] | null = null
  private _cachedStartTime = 0
  private _cachedEndTime = 0
  private _cachedPxPerDay = 0
  private _cachedPxPerMonth: number | undefined = undefined
  private _cachedWeekStartDay: number = -1

  private get totalDays() {
    return getTotalDays(this.option.calendar.start, this.option.calendar.end)
  }

  static styles = css`
    :host {
      display: flex;
      width: fit-content;
      min-width: 100%;
      box-sizing: border-box;
      position: sticky;
      top: 0;
      z-index: 500;
    }
    .label-placeholder {
      flex-shrink: 0;
      box-sizing: border-box;
      position: sticky;
      left: 0;
      z-index: 100;
      background: inherit;
    }
    .calendar-group {
      display: flex;
      flex-direction: column;
      position: relative;
      z-index: 70;
    }
    .months-container {
      display: flex;
    }
    .month-cell {
      box-sizing: border-box;
      padding: 4px 8px;
      font-size: 12px;
      font-weight: bold;
      white-space: nowrap;
      overflow: hidden;
    }
    .weeks-container {
      display: flex;
    }
    .week-cell {
      box-sizing: border-box;
      padding: 4px 0;
      font-size: 10px;
      font-weight: bold;
      text-align: center;
      flex-shrink: 0;
      white-space: nowrap;
      overflow: hidden;
    }
    .days-container {
      display: flex;
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
    .hours-container {
      display: flex;
    }
    .hour-cell {
      text-align: center;
      font-size: 9px;
      padding: 2px 0;
      flex-shrink: 0;
      box-sizing: border-box;
      overflow: hidden;
    }
    .current-time-badge {
      position: absolute;
      bottom: 0;
      transform: translateX(-50%);
      padding: 2px 4px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: bold;
      white-space: nowrap;
      z-index: 10;
      pointer-events: none;
    }
    .milestone-badge {
      position: absolute;
      top: 0;
      transform: translateX(-50%);
      padding: 2px 4px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: bold;
      white-space: nowrap;
      z-index: 9;
      pointer-events: auto;
      color: #ffffff;
      transition: opacity 0.2s ease;
      cursor: default;
    }
    .milestone-connector {
      position: absolute;
      top: 19px;
      bottom: 0px;
      transform: translateX(-50%);
      z-index: 8;
      pointer-events: auto;
      transition: opacity 0.2s ease;
      cursor: default;
    }
  `

  private getDateX(date: Date) {
    return dateToX(date, this.option.calendar.start, this.option.calendar.pxPerDay, this.option.calendar.pxPerMonth)
  }

  private formatTime(date: Date) {
    const h = date.getHours().toString().padStart(2, '0')
    const m = date.getMinutes().toString().padStart(2, '0')
    return `${h}:${m}`
  }

  private _buildWeeks(days: Date[], weekStartDay: number): { weekNumber: number; startDate: Date; count: number }[] {
    const getWeekNumber = (date: Date): number => {
      const d = new Date(date.getTime())
      d.setHours(0, 0, 0, 0)
      const dayOfWeek = d.getDay()
      const daysSinceWeekStart = (dayOfWeek - weekStartDay + 7) % 7
      const weekStart = new Date(d.getTime())
      weekStart.setDate(weekStart.getDate() - daysSinceWeekStart)
      const yearStart = new Date(weekStart.getFullYear(), 0, 1)
      const dayOfYear = Math.floor((weekStart.getTime() - yearStart.getTime()) / 86400000)
      return Math.floor(dayOfYear / 7) + 1
    }
    const weeks: { weekNumber: number; startDate: Date; count: number }[] = []
    days.forEach((day) => {
      const dayOfWeek = day.getDay()
      const isWeekStart = dayOfWeek === weekStartDay
      const last = weeks[weeks.length - 1]
      if (last && !isWeekStart) {
        last.count++
      } else {
        weeks.push({ weekNumber: getWeekNumber(day), startDate: new Date(day), count: 1 })
      }
    })
    return weeks
  }

  render() {
    const colors = getThemeColors(this.theme, this.option.customTheme)

    // start/end が変わった時だけ days/months/years を再計算する
    const startTime = this.option.calendar.start.getTime()
    const endTime = this.option.calendar.end.getTime()
    const pxPerDay = this.option.calendar.pxPerDay
    const pxPerMonth = this.option.calendar.pxPerMonth
    const weekStartDay = this.option.calendar.weekStartDay ?? 1
    const needsRebuild = !this._cachedDays || startTime !== this._cachedStartTime || endTime !== this._cachedEndTime
    const needsWidthRecalc = pxPerDay !== this._cachedPxPerDay || pxPerMonth !== this._cachedPxPerMonth
    if (needsRebuild) {
      this._cachedStartTime = startTime
      this._cachedEndTime = endTime
      this._cachedPxPerDay = pxPerDay
      this._cachedPxPerMonth = pxPerMonth

      const days = Array.from({ length: Math.ceil(this.totalDays) }, (_, i) => {
        const d = new Date(this.option.calendar.start)
        d.setDate(d.getDate() + i)
        return d
      })
      this._cachedDays = days

      const months: { year: number; month: number; count: number; width?: number; start?: Date; end?: Date }[] = []
      days.forEach((day) => {
        const year = day.getFullYear()
        const month = day.getMonth()
        const last = months[months.length - 1]
        if (last && last.year === year && last.month === month) {
          last.count++
          last.end = new Date(day)
          last.end.setDate(last.end.getDate() + 1)
        } else {
          const start = new Date(day)
          start.setHours(0, 0, 0, 0)
          const end = new Date(day)
          end.setDate(end.getDate() + 1)
          months.push({ year, month, count: 1, start, end })
        }
      })
      months.forEach((m) => {
        if (m.start && m.end) {
          m.width = this.getDateX(m.end) - this.getDateX(m.start)
        }
      })
      this._cachedMonths = months

      // years（showMonthsRow 用）
      const years: { year: number; count: number; start?: Date; end?: Date; width?: number }[] = []
      days.forEach((day) => {
        const year = day.getFullYear()
        const last = years[years.length - 1]
        if (last && last.year === year) {
          last.count++
          last.end = new Date(day)
          last.end.setDate(last.end.getDate() + 1)
        } else {
          const start = new Date(day)
          start.setHours(0, 0, 0, 0)
          const end = new Date(day)
          end.setDate(end.getDate() + 1)
          years.push({ year, count: 1, start, end })
        }
      })
      years.forEach((y) => {
        if (y.start && y.end) {
          y.width = this.getDateX(y.end) - this.getDateX(y.start)
        }
      })
      this._cachedYears = years

      // weeks（showWeeks 用）— weekStartDay もここで計算しキャッシュ
      this._cachedWeekStartDay = weekStartDay
      this._cachedWeeks = this._buildWeeks(days, weekStartDay)
    } else if (needsWidthRecalc) {
      // pxPerDay / pxPerMonth が変わった場合は months/years の width のみ再計算
      this._cachedPxPerDay = pxPerDay
      this._cachedPxPerMonth = pxPerMonth
      this._cachedMonths!.forEach((m) => {
        if (m.start && m.end) {
          m.width = this.getDateX(m.end) - this.getDateX(m.start)
        }
      })
      this._cachedYears!.forEach((y) => {
        if (y.start && y.end) {
          y.width = this.getDateX(y.end) - this.getDateX(y.start)
        }
      })
      if (weekStartDay !== this._cachedWeekStartDay) {
        this._cachedWeekStartDay = weekStartDay
        this._cachedWeeks = this._buildWeeks(this._cachedDays!, weekStartDay)
      }
    } else if (weekStartDay !== this._cachedWeekStartDay) {
      // weekStartDay だけ変わった場合は weeks のみ再計算
      this._cachedWeekStartDay = weekStartDay
      this._cachedWeeks = this._buildWeeks(this._cachedDays!, weekStartDay)
    }

    const days = this._cachedDays!
    const months = this._cachedMonths!
    const years = this._cachedYears!

    const backgroundStyle = `
      background-image: linear-gradient(90deg, transparent ${this.option.calendar.pxPerDay - 1}px, ${colors.border} ${this.option.calendar.pxPerDay - 1}px);
      background-size: ${this.option.calendar.pxPerDay}px 100%;
    `

    const hours = Array.from({ length: 24 }, (_, i) => i)
    const hourWidth = this.option.calendar.pxPerDay / 24
    const hourBackgroundStyle = `
      background-image: linear-gradient(90deg, transparent ${hourWidth - 1}px, ${colors.border} ${hourWidth - 1}px);
      background-size: ${hourWidth}px 100%;
    `

    const totalWidth = this.getDateX(this.option.calendar.end)

    return html`
      <style>
        :host {
          background: ${colors.calendarBg};
          border-bottom: 2px solid ${colors.border};
          color: ${colors.text};
        }
        .label-placeholder {
          border-right: 1px solid ${colors.border};
        }
        .months-container {
          background: ${colors.bg};
          border-bottom: 1px solid ${colors.border};
        }
        .month-cell {
          border-right: 1px solid ${colors.monthGridLine || colors.border};
        }
        .hours-container {
          border-top: 1px solid ${colors.border};
        }
      </style>
      <div
        class="label-placeholder"
        style="width: ${this.option.rowHeader?.width ?? DEFAULT_ROW_HEADER_WIDTH}px; background-color: ${this.option
          .rowHeader?.backgroundColor ?? colors.rowHeaderBg};"
      ></div>
      <div class="calendar-group" style="width: ${totalWidth}px; overflow: hidden;">
        ${this.option.calendar.showMonthsRow
          ? (() => {
              const monthTextAlign = this.option.calendar.monthTextAlign ?? 'center'

              return html`<div class="months-container" style="position: relative; z-index: 2;">
                  ${years.map(
                    (y) => html`<div class="month-cell" style="width: ${y.width ?? (y.count * this.option.calendar.pxPerDay)}px; border-right: 1px solid ${colors.yearGridLine || colors.monthGridLine || colors.border};">
                      ${y.year}
                    </div>`,
                  )}
                </div>
                <div class="weeks-container" style="background: ${colors.bg}; border-bottom: 1px solid ${colors.border}; position: relative; z-index: 2;">
                  ${months.map(
                    (m) => {
                      const monthRowFormat = (this.option.locale ?? jaLocale).monthRowFormat
                      const monthLabel = dayjs(new Date(m.year, m.month)).format(monthRowFormat)
                      const isYearBoundary = m.month === 11
                      const borderColor = isYearBoundary ? (colors.yearGridLine || colors.monthGridLine || colors.border) : (colors.monthGridLine || colors.border)
                      return html`<div
                      class="week-cell"
                      style="width: ${m.width ?? (m.count * this.option.calendar.pxPerDay)}px; border-right: 1px solid ${borderColor}; text-align: ${monthTextAlign}; padding: 0 2px;"
                    >
                      ${monthLabel}
                    </div>`
                    },
                  )}
                </div>`
            })()
          : ''}
        ${this.option.calendar.showMonths !== false && !this.option.calendar.showMonthsRow
          ? html`<div class="months-container" style="position: relative; z-index: 2;">
              ${months.map((m) => {
                const format = this.option.calendar.monthFormat || (this.option.locale ?? jaLocale).monthFormat
                const text = dayjs(new Date(m.year, m.month)).format(format)
                const isYearBoundary = m.month === 11
                const borderColor = isYearBoundary ? (colors.yearGridLine || colors.monthGridLine || colors.border) : (colors.monthGridLine || colors.border)
                return html`<div class="month-cell" style="width: ${m.width ?? (m.count * this.option.calendar.pxPerDay)}px; border-right: 1px solid ${borderColor};">
                  ${text}
                </div>`
              })}
            </div>`
          : ''}
        ${this.option.calendar.showWeeks
          ? (() => {
              const weeks = this._cachedWeeks!

              const weekBackgroundStyle = `
                background: ${colors.bg};
                border-bottom: 1px solid ${colors.border};
              `

              const weekFormat = this.option.calendar.weekFormat
              const weekTextAlign = this.option.calendar.weekTextAlign ?? 'center'
              return html`<div class="weeks-container" style="${weekBackgroundStyle}">
                ${weeks.map((w) => {
                  const label = weekFormat ? weekFormat(w.weekNumber, w.startDate) : `W${w.weekNumber}`
                  return html`<div
                    class="week-cell"
                    style="width: ${w.count *
                    this.option.calendar
                      .pxPerDay}px; border-right: 1px solid ${colors.border}; text-align: ${weekTextAlign}; padding: 0 2px;"
                  >
                    ${label}
                  </div>`
                })}
              </div>`
            })()
          : ''}
        ${this.option.calendar.showDays !== false
          ? html`<div class="days-container" style="${backgroundStyle}">
              ${days.map((day, index) => {
                let width = this.option.calendar.pxPerDay
                if (index + 1 > this.totalDays) {
                  width = (this.totalDays - index) * this.option.calendar.pxPerDay
                }
                const backgroundColor = getCalendarColor(day, colors, this.option.calendar.isHoliday)
                
                return html`
                  <div
                    class="day-cell"
                    style="width: ${width}px; ${backgroundColor ? `background-color: ${backgroundColor};` : ''}"
                  >
                    ${this.option.calendar.showTime
                      ? `${(day.getMonth() + 1).toString().padStart(2, '0')}/${day.getDate().toString().padStart(2, '0')}`
                      : day.getDate()}
                  </div>
                `
              })}
            </div>`
          : ''}
        ${this.option.calendar.showTime
          ? html`
              <div class="hours-container" style="${hourBackgroundStyle}">
                ${days.map(() =>
                  hours.map((h) => {
                    return html` <div class="hour-cell" style="width: ${hourWidth}px;">${h}</div> `
                  }),
                )}
              </div>
            `
          : ''}
        ${(() => {
          const isMonthMode = this.option.calendar.showMonthsRow || (this.option.calendar.showDays === false && !this.option.calendar.showWeeks);
          const startX = this.getDateX(this.option.calendar.start);
          return months.map(m => {
            if (!m.start) return '';
            const x = this.getDateX(m.start);
            if (x <= startX) return ''; // do not draw line at the very left edge
            const isYearBoundary = m.month === 0; // January is the year boundary
            let lineColor;
            if (isYearBoundary) {
              lineColor = colors.yearGridLine || colors.monthGridLine || colors.border;
            } else {
              lineColor = isMonthMode ? colors.border : (colors.monthGridLine || colors.border);
            }
            return html`<div style="position: absolute; top: 0; bottom: 0; left: ${x - 1}px; width: 1px; background-color: ${lineColor}; pointer-events: none; z-index: 1;"></div>`;
          });
        })()}
        ${this.option.calendar.showCurrentTime &&
          this.option.calendar.showCurrentTimeBadge === true &&
          this.currentTime >= this.option.calendar.start &&
          this.currentTime <= this.option.calendar.end
          ? html`
              <div
                class="current-time-badge"
                style="
                  left: ${this.getDateX(this.currentTime)}px;
                  background-color: ${colors.currentTimeLine};
                  color: ${colors.currentTimeLineText};
                "
              >
                ${this.formatTime(this.currentTime)}
              </div>
            `
          : ''}
        ${(this.option.calendar.milestones ?? []).map(
          (ms) => html`
            <div
              class="milestone-connector"
              style="
                left: ${this.getDateX(ms.start) + 1}px;
                width: ${ms.width ?? 2}px;
                background-color: ${ms.color};
                opacity: ${this.hoveredMilestoneId === ms.id ? 1 : 0.5};
              "
              @mouseenter="${() => {
                this.dispatchEvent(
                  new CustomEvent('milestone-hover-change', {
                    detail: { milestoneId: ms.id },
                    bubbles: true,
                    composed: true,
                  }),
                )
              }}"
              @mouseleave="${() => {
                this.dispatchEvent(
                  new CustomEvent('milestone-hover-change', {
                    detail: { milestoneId: null },
                    bubbles: true,
                    composed: true,
                  }),
                )
              }}"
            ></div>
            <div
              class="milestone-badge"
              style="
                left: ${this.getDateX(ms.start)}px;
                background-color: ${ms.color};
                opacity: ${this.hoveredMilestoneId === ms.id ? 1 : 0.5};
              "
              @mouseenter="${() => {
                this.dispatchEvent(
                  new CustomEvent('milestone-hover-change', {
                    detail: { milestoneId: ms.id },
                    bubbles: true,
                    composed: true,
                  }),
                )
              }}"
              @mouseleave="${() => {
                this.dispatchEvent(
                  new CustomEvent('milestone-hover-change', {
                    detail: { milestoneId: null },
                    bubbles: true,
                    composed: true,
                  }),
                )
              }}"
            >
              ${ms.name}
            </div>
          `,
        )}
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gantt-calendar': GanttCalendarElement
  }
}

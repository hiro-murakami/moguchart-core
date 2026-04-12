import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import type { GanttChartOption } from '@/core/types'
import { jaLocale } from '@/core/i18n'
import { DEFAULT_ROW_HEADER_WIDTH } from '@/core/constants'
import { getCalendarColor, getThemeColors, getTotalDays } from '@/core/utils'
import dayjs from 'dayjs'

@customElement('gantt-calendar')
export class GanttCalendarElement extends LitElement {
  @property({ type: Object }) option!: GanttChartOption
  @property({ type: String })
  theme: 'light' | 'dark' = 'light'
  @property({ type: Object }) currentTime = new Date()
  @property({ type: String }) hoveredMilestoneId: string | null = null

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
    const d = new Date(date)
    const start = new Date(this.option.calendar.start)
    start.setHours(0, 0, 0, 0)
    const diff = d.getTime() - start.getTime()
    return (diff / (1000 * 60 * 60 * 24)) * this.option.calendar.pxPerDay
  }

  private formatTime(date: Date) {
    const h = date.getHours().toString().padStart(2, '0')
    const m = date.getMinutes().toString().padStart(2, '0')
    return `${h}:${m}`
  }

  render() {
    const colors = getThemeColors(this.theme, this.option.customTheme)

    const days = Array.from({ length: Math.ceil(this.totalDays) }, (_, i) => {
      const d = new Date(this.option.calendar.start)
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
      background-image: linear-gradient(90deg, transparent ${this.option.calendar.pxPerDay - 1}px, ${colors.border} ${this.option.calendar.pxPerDay - 1}px);
      background-size: ${this.option.calendar.pxPerDay}px 100%;
    `

    const hours = Array.from({ length: 24 }, (_, i) => i)
    const hourWidth = this.option.calendar.pxPerDay / 24
    const hourBackgroundStyle = `
      background-image: linear-gradient(90deg, transparent ${hourWidth - 1}px, ${colors.border} ${hourWidth - 1}px);
      background-size: ${hourWidth}px 100%;
    `

    const totalWidth = this.totalDays * this.option.calendar.pxPerDay

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
          border-right: 1px solid ${colors.border};
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
              // 年のグループを生成
              const years: { year: number; count: number }[] = []
              days.forEach((day) => {
                const year = day.getFullYear()
                const last = years[years.length - 1]
                if (last && last.year === year) {
                  last.count++
                } else {
                  years.push({ year, count: 1 })
                }
              })

              const monthTextAlign = this.option.calendar.monthTextAlign ?? 'center'

              return html`<div class="months-container">
                  ${years.map(
                    (y) => html`<div class="month-cell" style="width: ${y.count * this.option.calendar.pxPerDay}px">
                      ${y.year}
                    </div>`,
                  )}
                </div>
                <div class="weeks-container" style="background: ${colors.bg}; border-bottom: 1px solid ${colors.border};">
                  ${months.map(
                    (m) => {
                      const monthRowFormat = (this.option.locale ?? jaLocale).monthRowFormat
                      const monthLabel = dayjs(new Date(m.year, m.month)).format(monthRowFormat)
                      return html`<div
                      class="week-cell"
                      style="width: ${m.count *
                      this.option.calendar
                        .pxPerDay}px; border-right: 1px solid ${colors.border}; text-align: ${monthTextAlign}; padding: 0 2px;"
                    >
                      ${monthLabel}
                    </div>`
                    },
                  )}
                </div>`
            })()
          : ''}
        ${this.option.calendar.showMonths !== false && !this.option.calendar.showMonthsRow
          ? html`<div class="months-container">
              ${months.map((m) => {
                const format = this.option.calendar.monthFormat || (this.option.locale ?? jaLocale).monthFormat
                const text = dayjs(new Date(m.year, m.month)).format(format)
                return html`<div class="month-cell" style="width: ${m.count * this.option.calendar.pxPerDay}px">
                  ${text}
                </div>`
              })}
            </div>`
          : ''}
        ${this.option.calendar.showWeeks
          ? (() => {
              const weekStartDay = this.option.calendar.weekStartDay ?? 1 // デフォルト: 月曜

              // weekStartDay に基づく週番号を計算する関数
              const getWeekNumber = (date: Date): number => {
                const d = new Date(date.getTime())
                d.setHours(0, 0, 0, 0)
                // weekStartDay を基準にした曜日オフセットを計算
                const dayOfWeek = d.getDay()
                const daysSinceWeekStart = (dayOfWeek - weekStartDay + 7) % 7
                // 週の始まりに調整
                const weekStart = new Date(d.getTime())
                weekStart.setDate(weekStart.getDate() - daysSinceWeekStart)
                // 年初からの週番号を計算
                const yearStart = new Date(weekStart.getFullYear(), 0, 1)
                const dayOfYear = Math.floor((weekStart.getTime() - yearStart.getTime()) / 86400000)
                return Math.floor(dayOfYear / 7) + 1
              }

              // 日付配列から週のグループを作成（weekStartDay を基準にグループ化）
              const weeks: { weekNumber: number; startDate: Date; count: number }[] = []
              days.forEach((day) => {
                const dayOfWeek = day.getDay()
                const isWeekStart = dayOfWeek === weekStartDay
                const last = weeks[weeks.length - 1]
                if (last && !isWeekStart) {
                  last.count++
                } else {
                  const weekNumber = getWeekNumber(day)
                  weeks.push({ weekNumber, startDate: new Date(day), count: 1 })
                }
              })

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
                  hours.map((h) => html` <div class="hour-cell" style="width: ${hourWidth}px;">${h}</div> `),
                )}
              </div>
            `
          : ''}
        ${this.option.calendar.showCurrentTime && this.option.calendar.showCurrentTimeBadge === true
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

import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import type { GanttChartOption } from '@/types'
import { DEFAULT_ROW_HEADER_WIDTH, DEFAULT_MONTH_FORMAT } from '@/constants'
import { getCalendarColor, getThemeColors, getTotalDays } from '@/utils'
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
        ${this.option.calendar.showMonths !== false
          ? html`<div class="months-container">
              ${months.map((m) => {
                const format = this.option.calendar.monthFormat || DEFAULT_MONTH_FORMAT
                const text = dayjs(new Date(m.year, m.month)).format(format)
                return html`<div class="month-cell" style="width: ${m.count * this.option.calendar.pxPerDay}px">
                  ${text}
                </div>`
              })}
            </div>`
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
                    ${day.getDate()}
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

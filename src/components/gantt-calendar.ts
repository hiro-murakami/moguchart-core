import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import type {
  GanttChartOption,
  CalendarMonthCellContext,
  CalendarDayCellContext,
  CalendarWeekCellContext,
  CalendarHourCellContext,
} from '../core/types'
import { jaLocale } from '../core/i18n'
import { DEFAULT_ROW_HEADER_WIDTH } from '../core/constants'
import { getCalendarColor, getThemeColors, getTotalDays, dateToX } from '../core/utils'
import dayjs from 'dayjs'

@customElement('gantt-calendar')
export class GanttCalendarElement extends LitElement {
  @property({ type: Object }) option!: GanttChartOption
  @property({ type: String })
  theme: 'light' | 'dark' = 'light'
  @property({ type: Object }) currentTime = new Date()
  @property({ type: Boolean }) isExporting = false
  @property({ type: String }) hoveredMilestoneId: string | null = null
  @property({ attribute: false }) cornerContent?: () => string | unknown
  @property({ attribute: false }) calendarMonthContent?: (context: CalendarMonthCellContext) => string | unknown
  @property({ attribute: false }) calendarDayContent?: (context: CalendarDayCellContext) => string | unknown
  @property({ attribute: false }) calendarWeekContent?: (context: CalendarWeekCellContext) => string | unknown
  @property({ attribute: false }) calendarHourContent?: (context: CalendarHourCellContext) => string | unknown

  /**
   * カスタムレンダリング関数の返却値をターゲット要素に注入するヘルパー
   * HTMLElement の場合は appendChild、文字列の場合は innerHTML に設定する
   */
  private injectCustomContent(target: HTMLElement, content: unknown, className: string) {
    // 既存のカスタムコンテンツを削除（再レンダリング時の重複防止）
    const existing = target.querySelector(`.${className}`)
    if (existing) existing.remove()
    if (content instanceof HTMLElement) {
      content.classList.add(className)
      target.appendChild(content)
    } else if (typeof content === 'string') {
      const wrapper = document.createElement('span')
      wrapper.classList.add(className)
      // textContent で安全に挿入（innerHTML による XSS を防止）
      wrapper.textContent = content
      target.appendChild(wrapper)
    }
  }

  protected updated() {
    // cornerContent が指定されている場合、label-placeholder に DOM 要素を注入する
    const placeholder = this.shadowRoot?.querySelector('.label-placeholder') as HTMLElement | null
    if (!placeholder) return
    // 既存の cornerContent 要素を削除（再レンダリング時の重複防止）
    const existing = placeholder.querySelector('.corner-content-root')
    if (existing) existing.remove()
    if (this.cornerContent) {
      const content = this.cornerContent()
      if (content instanceof HTMLElement) {
        content.classList.add('corner-content-root')
        placeholder.appendChild(content)
      }
    }

    // カレンダーセルのカスタムレンダリング注入
    this.injectCalendarCustomContent()
  }

  /**
   * カレンダーセルのカスタムレンダリングコンテンツを注入する
   */
  private injectCalendarCustomContent() {
    if (this.calendarMonthContent) {
      const cells = this.shadowRoot?.querySelectorAll('[data-calendar-month]')
      cells?.forEach((cell) => {
        const el = cell as HTMLElement
        const year = parseInt(el.dataset.calendarMonthYear ?? '0', 10)
        const month = parseInt(el.dataset.calendarMonth ?? '0', 10)
        const width = parseFloat(el.dataset.calendarMonthWidth ?? '0')
        const defaultLabel = el.dataset.calendarMonthLabel ?? ''
        const context: CalendarMonthCellContext = { year, month, width, defaultLabel }
        const content = this.calendarMonthContent!(context)
        this.injectCustomContent(el, content, 'custom-month-content')
      })
    }

    if (this.calendarDayContent) {
      const cells = this.shadowRoot?.querySelectorAll('[data-calendar-day]')
      cells?.forEach((cell) => {
        const el = cell as HTMLElement
        const dateStr = el.dataset.calendarDay ?? ''
        const date = new Date(dateStr)
        const width = parseFloat(el.dataset.calendarDayWidth ?? '0')
        const isSaturday = el.dataset.calendarDaySaturday === 'true'
        const isSunday = el.dataset.calendarDaySunday === 'true'
        const isHoliday = el.dataset.calendarDayHoliday === 'true'
        const defaultLabel = el.dataset.calendarDayLabel ?? ''
        const context: CalendarDayCellContext = { date, width, isSaturday, isSunday, isHoliday, defaultLabel }
        const content = this.calendarDayContent!(context)
        this.injectCustomContent(el, content, 'custom-day-content')
      })
    }

    if (this.calendarWeekContent) {
      const cells = this.shadowRoot?.querySelectorAll('[data-calendar-week]')
      cells?.forEach((cell) => {
        const el = cell as HTMLElement
        const weekNumber = parseInt(el.dataset.calendarWeek ?? '0', 10)
        const startDateStr = el.dataset.calendarWeekStart ?? ''
        const startDate = new Date(startDateStr)
        const width = parseFloat(el.dataset.calendarWeekWidth ?? '0')
        const defaultLabel = el.dataset.calendarWeekLabel ?? ''
        const context: CalendarWeekCellContext = { weekNumber, startDate, width, defaultLabel }
        const content = this.calendarWeekContent!(context)
        this.injectCustomContent(el, content, 'custom-week-content')
      })
    }

    if (this.calendarHourContent) {
      const cells = this.shadowRoot?.querySelectorAll('[data-calendar-hour]')
      cells?.forEach((cell) => {
        const el = cell as HTMLElement
        const hour = parseInt(el.dataset.calendarHour ?? '0', 10)
        const width = parseFloat(el.dataset.calendarHourWidth ?? '0')
        const dateStr = el.dataset.calendarHourDate ?? ''
        const date = new Date(dateStr)
        const context: CalendarHourCellContext = { hour, width, date }
        const content = this.calendarHourContent!(context)
        this.injectCustomContent(el, content, 'custom-hour-content')
      })
    }
  }

  // days/months/years/weeks のキャッシュ
  private _cachedDays: Date[] | null = null
  private _cachedMonths:
    | { year: number; month: number; count: number; width?: number; start?: Date; end?: Date }[]
    | null = null
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
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding-right: 4px;
      overflow: hidden;
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
      font-size: calc(12px * var(--moguchart-font-scale, 1));
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
      font-size: calc(10px * var(--moguchart-font-scale, 1));
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
      font-size: calc(10px * var(--moguchart-font-scale, 1));
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
      font-size: calc(10px * var(--moguchart-font-scale, 1));
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
      font-size: calc(10px * var(--moguchart-font-scale, 1));
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
      font-size: calc(10px * var(--moguchart-font-scale, 1));
      font-weight: bold;
      white-space: nowrap;
      z-index: 9;
      pointer-events: auto;
      color: #ffffff;
      transition: opacity 0.2s ease;
      cursor: default;
    }
    .milestone-badge.milestone-hovered {
      z-index: 200;
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
    .milestone-connector.milestone-hovered {
      z-index: 199;
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

    const hourWidth = this.option.calendar.pxPerDay / 24
    const dayWidth = this.option.calendar.pxPerDay
    const dayLineColor = this.option.customTheme?.showTimeDateLine ?? colors.monthGridLine ?? colors.border
    // 開始時刻が0時でない場合、背景グリッドをオフセットする
    // 例: 開始が09:00なら、最初の日区切り線は 15時間後 = (24-9)*hourWidth の位置に来るべき
    const startDate = this.option.calendar.start
    const startOffsetMs =
      startDate.getHours() * 60 * 60 * 1000 + startDate.getMinutes() * 60 * 1000 + startDate.getSeconds() * 1000
    const startOffsetPx = (startOffsetMs / (24 * 60 * 60 * 1000)) * dayWidth
    // CSS background-position は正方向にずらすため、負のオフセット（つまり右にずらす）
    // 日区切り: 最初の0時までの距離 = dayWidth - startOffsetPx
    // 時間グリッド: hourWidth 単位で同様にオフセット
    const hourOffsetPx = startOffsetPx % hourWidth
    const dayBgPos = startOffsetPx === 0 ? '0px 0' : `${-startOffsetPx}px 0`
    const hourBgPos = hourOffsetPx === 0 ? '0px 0' : `${-hourOffsetPx}px 0`
    const hourBackgroundStyle = `
      background-image: linear-gradient(90deg, transparent ${dayWidth - 1}px, ${dayLineColor} ${dayWidth - 1}px), linear-gradient(90deg, transparent ${hourWidth - 1}px, ${colors.border} ${hourWidth - 1}px);
      background-size: ${dayWidth}px 100%, ${hourWidth}px 100%;
      background-position: ${dayBgPos}, ${hourBgPos};
    `
    // showTime モード: 深夜0時を日付境界とする日ごとのセグメントを生成
    type ShowTimeSeg = { date: Date; hStart: number; hEnd: number; widthPx: number }
    const showTimeDays: ShowTimeSeg[] = []
    if (this.option.calendar.showTime) {
      const calStart = this.option.calendar.start
      const calEnd = this.option.calendar.end
      let cur = new Date(calStart)
      cur.setHours(0, 0, 0, 0)
      while (cur.getTime() < calEnd.getTime()) {
        const segStart = cur.getTime() < calStart.getTime() ? calStart : cur
        const nextDay = new Date(cur)
        nextDay.setDate(nextDay.getDate() + 1)
        const segEnd = nextDay.getTime() > calEnd.getTime() ? calEnd : nextDay
        const hStart = segStart.getHours()
        const hEndRaw = segEnd.getHours()
        const hasFraction = segEnd.getMinutes() > 0 || segEnd.getSeconds() > 0 || segEnd.getMilliseconds() > 0
        const hEnd = hEndRaw === 0 && !hasFraction ? 24 : hasFraction ? hEndRaw + 1 : hEndRaw
        const durationHours = (segEnd.getTime() - segStart.getTime()) / (1000 * 60 * 60)
        showTimeDays.push({ date: new Date(cur), hStart, hEnd, widthPx: durationHours * hourWidth })
        cur = new Date(nextDay)
      }
    }

    // 月単位モード（pxPerMonth 設定時）では、最後の月セルの終端（翌月1日の位置）を
    // totalWidth とする。calendar.end が月の途中の日付だと getDateX(end) が月境界より
    // 手前の値になり、overflow: hidden で最後の月の border-right が切り取られてしまうため。
    const lastMonth = months[months.length - 1]
    const totalWidth =
      this.option.calendar.pxPerMonth !== undefined && lastMonth?.end
        ? this.getDateX(lastMonth.end)
        : this.getDateX(this.option.calendar.end)

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
                    (y) =>
                      html`<div
                        class="month-cell"
                        style="width: ${y.width ?? y.count * this.option.calendar.pxPerDay}px;"
                      >
                        ${y.year}
                      </div>`,
                  )}
                </div>
                <div
                  class="weeks-container"
                  style="background: ${colors.bg}; border-bottom: 1px solid ${colors.border}; position: relative;"
                >
                  ${months.map((m) => {
                    const monthRowFormat = (this.option.locale ?? jaLocale).monthRowFormat
                    const monthLabel = dayjs(new Date(m.year, m.month)).format(monthRowFormat)
                    const cellWidth = m.width ?? m.count * this.option.calendar.pxPerDay
                    return html`<div
                      class="week-cell"
                      style="width: ${cellWidth}px; text-align: ${monthTextAlign}; padding: 0 2px;"
                      data-calendar-month="${m.month}"
                      data-calendar-month-year="${m.year}"
                      data-calendar-month-width="${cellWidth}"
                      data-calendar-month-label="${monthLabel}"
                    >
                      ${this.calendarMonthContent ? '' : monthLabel}
                    </div>`
                  })}
                </div>`
            })()
          : ''}
        ${this.option.calendar.showMonths !== false && !this.option.calendar.showMonthsRow
          ? html`<div class="months-container" style="position: relative;">
              ${months.map((m) => {
                const format = this.option.calendar.monthFormat || (this.option.locale ?? jaLocale).monthFormat
                const text = dayjs(new Date(m.year, m.month)).format(format)
                const cellWidth = m.width ?? m.count * this.option.calendar.pxPerDay
                return html`<div
                  class="month-cell"
                  style="width: ${cellWidth}px;"
                  data-calendar-month="${m.month}"
                  data-calendar-month-year="${m.year}"
                  data-calendar-month-width="${cellWidth}"
                  data-calendar-month-label="${text}"
                >
                  ${this.calendarMonthContent ? '' : text}
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
                  const cellWidth = w.count * this.option.calendar.pxPerDay
                  return html`<div
                    class="week-cell"
                    style="width: ${cellWidth}px; border-right: 1px solid ${colors.border}; text-align: ${weekTextAlign}; padding: 0 2px;"
                    data-calendar-week="${w.weekNumber}"
                    data-calendar-week-start="${w.startDate.toISOString()}"
                    data-calendar-week-width="${cellWidth}"
                    data-calendar-week-label="${label}"
                  >
                    ${this.calendarWeekContent ? '' : label}
                  </div>`
                })}
              </div>`
            })()
          : ''}
        ${this.option.calendar.showDays !== false
          ? html`<div class="days-container" style="${this.option.calendar.showTime ? '' : backgroundStyle}">
              ${this.option.calendar.showTime
                ? showTimeDays.map((seg, segIndex) => {
                    const backgroundColor = getCalendarColor(seg.date, colors, this.option.calendar.isHoliday)
                    const isLastSeg = segIndex === showTimeDays.length - 1
                    const dateBorderColor = colors.showTimeDateLine ?? colors.monthGridLine ?? colors.border
                    const defaultLabel = (this.option.locale ?? jaLocale).timeUnitDateFormat(seg.date)
                    const isHolidayDay = this.option.calendar.isHoliday ? this.option.calendar.isHoliday(seg.date) : false
                    return html`
                      <div
                        class="day-cell"
                        style="width: ${seg.widthPx}px; border-right: ${isLastSeg
                          ? 'none'
                          : `1px solid ${dateBorderColor}`}; ${backgroundColor
                          ? `background-color: ${backgroundColor};`
                          : ''} font-size: calc(12px * var(--moguchart-font-scale, 1)); font-weight: 700; justify-content: flex-start; padding-left: 4px;"
                        data-calendar-day="${seg.date.toISOString()}"
                        data-calendar-day-width="${seg.widthPx}"
                        data-calendar-day-saturday="${seg.date.getDay() === 6}"
                        data-calendar-day-sunday="${seg.date.getDay() === 0}"
                        data-calendar-day-holiday="${isHolidayDay}"
                        data-calendar-day-label="${defaultLabel}"
                      >
                        ${this.calendarDayContent ? '' : defaultLabel}
                      </div>
                    `
                  })
                : days.map((day, index) => {
                    let width = this.option.calendar.pxPerDay
                    if (index + 1 > this.totalDays) {
                      width = (this.totalDays - index) * this.option.calendar.pxPerDay
                    }
                    const backgroundColor = getCalendarColor(day, colors, this.option.calendar.isHoliday)
                    const defaultLabel = String(day.getDate())
                    const isHolidayDay = this.option.calendar.isHoliday ? this.option.calendar.isHoliday(day) : false
                    return html`
                      <div
                        class="day-cell"
                        style="width: ${width}px; ${backgroundColor ? `background-color: ${backgroundColor};` : ''}"
                        data-calendar-day="${day.toISOString()}"
                        data-calendar-day-width="${width}"
                        data-calendar-day-saturday="${day.getDay() === 6}"
                        data-calendar-day-sunday="${day.getDay() === 0}"
                        data-calendar-day-holiday="${isHolidayDay}"
                        data-calendar-day-label="${defaultLabel}"
                      >
                        ${this.calendarDayContent ? '' : defaultLabel}
                      </div>
                    `
                  })}
            </div>`
          : ''}
        ${this.option.calendar.showTime
          ? html`
              <div class="hours-container" style="${hourBackgroundStyle}">
                ${showTimeDays.map((seg) => {
                  return Array.from({ length: seg.hEnd - seg.hStart }, (_, i) => seg.hStart + i).map((h) => {
                    return html` <div
                      class="hour-cell"
                      style="width: ${hourWidth}px;"
                      data-calendar-hour="${h}"
                      data-calendar-hour-width="${hourWidth}"
                      data-calendar-hour-date="${seg.date.toISOString()}"
                    >${this.calendarHourContent ? '' : h}</div> `
                  })
                })}
              </div>
            `
          : ''}
        ${(() => {
          const isMonthMode =
            this.option.calendar.showMonthsRow ||
            (this.option.calendar.showDays === false && !this.option.calendar.showWeeks)
          const startX = this.getDateX(this.option.calendar.start)
          const endX = this.getDateX(this.option.calendar.end)
          const lines = months.map((m) => {
            if (!m.start) return ''
            const x = this.getDateX(m.start)
            if (x <= startX) return '' // do not draw line at the very left edge
            const isYearBoundary = m.month === 0 // January is the year boundary
            let lineColor
            let lineZIndex = 1
            if (isYearBoundary) {
              lineColor = colors.yearGridLine || colors.monthGridLine || colors.border
              lineZIndex = 3
            } else {
              lineColor = isMonthMode ? colors.border : colors.monthGridLine || colors.border
              lineZIndex = 1
            }
            return html`<div
              style="position: absolute; top: 0; bottom: 0; left: ${x -
              1}px; width: 1px; background-color: ${lineColor}; pointer-events: none; z-index: ${lineZIndex};"
            ></div>`
          })
          // 最後の月の右端（calendar.end の位置）にも縦線を描画する
          // end が月の初日でない場合、months の start 位置ループでは右端の線が生成されないため
          const lastMonth = months[months.length - 1]
          if (lastMonth && endX > startX) {
            const lastIsYearBoundary = lastMonth.month === 11 // December boundary
            const endLineColor = lastIsYearBoundary
              ? colors.yearGridLine || colors.monthGridLine || colors.border
              : isMonthMode
                ? colors.border
                : colors.monthGridLine || colors.border
            const endLineZIndex = lastIsYearBoundary ? 3 : 1
            lines.push(
              html`<div
                style="position: absolute; top: 0; bottom: 0; left: ${endX -
                1}px; width: 1px; background-color: ${endLineColor}; pointer-events: none; z-index: ${endLineZIndex};"
              ></div>`,
            )
          }
          return lines
        })()}
        ${!this.isExporting &&
        this.option.calendar.showCurrentTime &&
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
              class="milestone-connector ${this.hoveredMilestoneId === ms.id ? 'milestone-hovered' : ''}"
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
              class="milestone-badge ${this.hoveredMilestoneId === ms.id ? 'milestone-hovered' : ''}"
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

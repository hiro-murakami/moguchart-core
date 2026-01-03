import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { getCalendarColor, getThemeColors } from '@/utils'
import type { GanttChartOption } from '@/types'

@customElement('gantt-row-background')
export class GanttRowBackgroundElement extends LitElement {
  @property({ type: Object }) option!: GanttChartOption
  @property({ type: String })
  theme: 'light' | 'dark' = 'light'

  static styles = css`
    :host {
      position: absolute;
      top: 0;
      left: 0;
      height: 100%;
      display: flex;
      z-index: 0;
      pointer-events: none;
    }
  `

  render() {
    const colors = getThemeColors(this.theme, this.option.customTheme)
    const days = Array.from(
      { length: this.option.calendar.totalDays },
      (_, i) => {
        const d = new Date(this.option.calendar.start)
        d.setDate(d.getDate() + i)
        return d
      },
    )

    return html`
      ${days.map((day) => {
        const color = getCalendarColor(
          day,
          colors,
          this.option.calendar.isHoliday,
        )
        return html`<div
          style="width: ${this.option.calendar
            .pxPerDay}px; background-color: ${color}; flex-shrink: 0;"
        ></div>`
      })}
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gantt-row-background': GanttRowBackgroundElement
  }
}

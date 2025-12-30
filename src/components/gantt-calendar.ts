import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import type { GanttChartOption } from '@/types'
import { DEFAULT_LABEL_WIDTH } from '@/constants'

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
      border-bottom: 2px solid #e2e8f0;
      box-sizing: border-box;
    }
    .label-placeholder {
      flex-shrink: 0;
      border-right: 1px solid #e2e8f0;
      box-sizing: border-box;
      position: sticky;
      left: 0;
      z-index: 30;
      background: inherit;
    }
    .calendar-container {
      display: flex;
      background-position: -1px 0;
    }
    .day-cell {
      text-align: center;
      font-size: 10px;
      padding: 8px 0;
      flex-shrink: 0;
      box-sizing: border-box;
    }
  `

  render() {
    const days = Array.from({ length: this.totalDays }, (_, i) => {
      const d = new Date(this.option.chartStart)
      d.setDate(d.getDate() + i)
      return d
    })

    const backgroundStyle = `
      background-image: linear-gradient(90deg, transparent ${this.option.pxPerDay - 1}px, #e2e8f0 ${this.option.pxPerDay - 1}px);
      background-size: ${this.option.pxPerDay}px 100%;
    `

    return html`
      <div
        class="label-placeholder"
        style="width: ${this.option.labelWidth ?? DEFAULT_LABEL_WIDTH}px"
      ></div>
      <div class="calendar-container" style="${backgroundStyle}">
        ${days.map(
          (day) => html`
            <div class="day-cell" style="width: ${this.option.pxPerDay}px;">
              ${day.getDate() === 1
                ? html`<b>${day.getMonth() + 1}/</b>`
                : ''}${day.getDate()}
            </div>
          `,
        )}
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gantt-calendar': GanttCalendar
  }
}

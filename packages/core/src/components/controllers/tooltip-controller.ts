import type { ReactiveController, ReactiveControllerHost } from 'lit'
import { html, render } from 'lit'
import { jaLocale } from '../../core/i18n'
import type { BarHoverEventDetail, GanttChartOption } from '../../core/types'

export type TooltipState = BarHoverEventDetail & {
  visible: boolean
  below?: boolean
}

export interface TooltipControllerHost extends ReactiveControllerHost, HTMLElement {
  option: GanttChartOption
  draggingTask: any
}

export class TooltipController implements ReactiveController {
  private host: TooltipControllerHost

  public tooltip: TooltipState | null = null
  private hoverTimer: number | undefined

  constructor(host: TooltipControllerHost) {
    this.host = host
    host.addController(this)
  }

  hostConnected(): void {}

  hostDisconnected(): void {
    this.cleanup()
  }

  public cleanup(): void {
    if (this.hoverTimer !== undefined) {
      window.clearTimeout(this.hoverTimer)
      this.hoverTimer = undefined
    }
  }

  public handleBarMouseEnter(detail: BarHoverEventDetail): void {
    // ドラッグ中、またはshowTooltipがfalseの場合はツールチップを表示しない
    if (this.host.draggingTask || this.host.option.showTooltip === false) {
      return
    }
    if (this.hoverTimer !== undefined) {
      window.clearTimeout(this.hoverTimer)
    }
    const delay = this.host.option.tooltipDelay ?? 500
    if (delay > 0) {
      this.hoverTimer = window.setTimeout(() => {
        this.tooltip = { ...detail, visible: true, below: false }
        this.host.requestUpdate()
      }, delay)
    } else {
      this.tooltip = { ...detail, visible: true, below: false }
      this.host.requestUpdate()
    }
  }

  public handleBarMouseLeave(): void {
    if (this.hoverTimer !== undefined) {
      window.clearTimeout(this.hoverTimer)
      this.hoverTimer = undefined
    }
    if (this.tooltip?.visible) {
      this.tooltip = { ...this.tooltip, visible: false }
      this.host.requestUpdate()
    }
  }

  public hideTooltip(): void {
    if (this.hoverTimer !== undefined) {
      window.clearTimeout(this.hoverTimer)
      this.hoverTimer = undefined
    }
    if (this.tooltip?.visible) {
      this.tooltip = { ...this.tooltip, visible: false }
      this.host.requestUpdate()
    }
  }

  public clearTooltip(): void {
    if (this.hoverTimer !== undefined) {
      window.clearTimeout(this.hoverTimer)
      this.hoverTimer = undefined
    }
    if (this.tooltip) {
      this.tooltip = null
      this.host.requestUpdate()
    }
  }

  /**
   * updated() ライフサイクルで呼び出されるツールチップDOM描画と位置調整
   */
  public updateTooltipDOM(): void {
    if (!this.tooltip) return

    const tooltipEl = this.host.shadowRoot?.querySelector('.tooltip') as HTMLElement | null
    if (!tooltipEl) return

    const content = this.host.option.customRendering?.tooltip
      ? this.host.option.customRendering.tooltip(this.tooltip.task)
      : undefined

    if (content) {
      if (typeof content === 'string') {
        tooltipEl.textContent = content
      } else {
        render(content, tooltipEl)
      }
    } else {
      const locale = this.host.option.locale ?? jaLocale
      const isMonthlyMode = !!this.host.option.calendar.pxPerMonth
      const duration = Math.round(
        (this.tooltip.task.end.getTime() - this.tooltip.task.start.getTime()) / (1000 * 60 * 60 * 24),
      )
      const hasProgress = typeof this.tooltip.task.progress === 'number' && !Number.isNaN(this.tooltip.task.progress)
      const progressRow = hasProgress
        ? html`<div class="tooltip-row">
            ${locale.tooltip.progress
              ? locale.tooltip.progress(Math.round(this.tooltip.task.progress!))
              : `進捗: ${Math.round(this.tooltip.task.progress!)}%`}
          </div>`
        : ''

      if (isMonthlyMode) {
        const endForDisplay = new Date(this.tooltip.task.end)
        endForDisplay.setMonth(endForDisplay.getMonth() - 1)
        render(
          html`
            <div style="font-weight: bold;">${this.tooltip.task.name}</div>
            <div class="tooltip-row">
              ${locale.yearMonthFormat(this.tooltip.task.start)} - ${locale.yearMonthFormat(endForDisplay)}
            </div>
            <div class="tooltip-row">${locale.tooltip.duration(duration)}</div>
            ${progressRow}
          `,
          tooltipEl,
        )
      } else {
        const isHourlyMode = !!this.host.option.calendar.showTime
        const endForDisplay = new Date(this.tooltip.task.end)
        if (
          !isHourlyMode &&
          this.tooltip.task.start.getTime() < this.tooltip.task.end.getTime() &&
          endForDisplay.getHours() === 0 &&
          endForDisplay.getMinutes() === 0
        ) {
          endForDisplay.setDate(endForDisplay.getDate() - 1)
        }
        render(
          html`
            <div style="font-weight: bold;">${this.tooltip.task.name}</div>
            <div class="tooltip-row">
              ${locale.dateFormat(this.tooltip.task.start)} - ${locale.dateFormat(endForDisplay)}
            </div>
            <div class="tooltip-row">${locale.tooltip.duration(duration)}</div>
            ${progressRow}
          `,
          tooltipEl,
        )
      }
    }

    // 画面端はみ出し調整
    const margin = 6
    const elRect = tooltipEl.getBoundingClientRect()

    if (!this.tooltip.below && elRect.top < margin) {
      this.tooltip = { ...this.tooltip, below: true }
      this.host.requestUpdate()
      return
    }

    let adjustedLeft = this.tooltip.x

    if (elRect.right > window.innerWidth - margin) {
      adjustedLeft = window.innerWidth - margin - elRect.width / 2
    }
    if (elRect.left < margin) {
      adjustedLeft = margin + elRect.width / 2
    }

    if (adjustedLeft !== this.tooltip.x) {
      tooltipEl.style.left = `${adjustedLeft}px`
    }
  }
}

import type { ReactiveController, ReactiveControllerHost } from 'lit'
import { html, render } from 'lit'
import { jaLocale } from '../../core/i18n'
import type { BarHoverEventDetail, GanttChartOption } from '../../core/types'
import { calculateTaskDelay } from '../../core/utils'

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

      const baseline = this.tooltip.task.baseline
      const hasBaseline = !!baseline && !!baseline.start && !!baseline.end && this.host.option.baseline?.showTooltip !== false
      let baselineRow: any = ''

      if (hasBaseline) {
        const { isDelayed, delayDays, isAhead, aheadDays } = calculateTaskDelay(this.tooltip.task)
        const bDuration = Math.round((baseline!.end.getTime() - baseline!.start.getTime()) / (1000 * 60 * 60 * 24))

        let bStartStr = ''
        let bEndStr = ''
        if (isMonthlyMode) {
          const bEndForDisplay = new Date(baseline!.end)
          bEndForDisplay.setMonth(bEndForDisplay.getMonth() - 1)
          bStartStr = locale.yearMonthFormat(baseline!.start)
          bEndStr = locale.yearMonthFormat(bEndForDisplay)
        } else {
          const bEndForDisplay = new Date(baseline!.end)
          const isHourlyMode = !!this.host.option.calendar.showTime
          if (
            !isHourlyMode &&
            baseline!.start.getTime() < baseline!.end.getTime() &&
            bEndForDisplay.getHours() === 0 &&
            bEndForDisplay.getMinutes() === 0
          ) {
            bEndForDisplay.setDate(bEndForDisplay.getDate() - 1)
          }
          bStartStr = locale.dateFormat(baseline!.start)
          bEndStr = locale.dateFormat(bEndForDisplay)
        }

        const baselineText = locale.tooltip.baseline
          ? locale.tooltip.baseline(bStartStr, bEndStr, bDuration)
          : `計画: ${bStartStr} - ${bEndStr} (${bDuration}日)`

        let statusText = ''
        let statusColor = '#94a3b8'
        if (isDelayed) {
          statusText = locale.tooltip.delay ? locale.tooltip.delay(delayDays) : `+${delayDays}日遅れ`
          statusColor = this.host.option.baseline?.delayColor ?? '#ef4444'
        } else if (isAhead) {
          statusText = locale.tooltip.ahead ? locale.tooltip.ahead(aheadDays) : `-${aheadDays}日前倒し`
          statusColor = '#10b981'
        } else {
          statusText = locale.tooltip.onSchedule ?? '計画通り'
          statusColor = '#94a3b8'
        }

        baselineRow = html`
          <div class="tooltip-row" style="color: #94a3b8; font-size: 11px; margin-top: 3px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 3px;">
            ${baselineText}
            <span style="color: ${statusColor}; font-weight: 600; margin-left: 4px;">(${statusText})</span>
          </div>
        `
      }

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
            ${baselineRow}
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
            ${baselineRow}
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

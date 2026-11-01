import type { ReactiveController, ReactiveControllerHost } from 'lit'
import type { GanttChartOption } from '../../core/types'
import type { ZoomController } from './zoom-controller'

export interface TouchControllerHost extends ReactiveControllerHost, HTMLElement {
  option: GanttChartOption
  currentRowHeaderWidth: number
  clearTooltip(): void
}

interface PinchSession {
  startDistance: number
  startZoomPercent: number
  anchorUnits: number
  startMidY: number
  startScrollTop: number
}

/**
 * タッチデバイス向けの2本指ピンチイン・ピンチアウトによるスムーズズームと
 * タッチジェスチャー競合制御を管理するコントローラー
 */
export class TouchController implements ReactiveController {
  private host: TouchControllerHost
  private zoomController: ZoomController
  private scrollContainer: HTMLElement | null = null
  private pinchSession: PinchSession | null = null
  public isPinching = false

  constructor(host: TouchControllerHost, zoomController: ZoomController) {
    this.host = host
    this.zoomController = zoomController
    host.addController(this)
  }

  hostConnected(): void {}

  hostDisconnected(): void {
    this.detach()
  }

  public attach(container: HTMLElement | null): void {
    if (this.scrollContainer === container) return
    this.detach()
    this.scrollContainer = container
    if (!container) return

    container.addEventListener('touchstart', this.handleTouchStart, { passive: false })
    container.addEventListener('touchmove', this.handleTouchMove, { passive: false })
    container.addEventListener('touchend', this.handleTouchEnd)
    container.addEventListener('touchcancel', this.handleTouchEnd)
  }

  public detach(): void {
    if (this.scrollContainer) {
      this.scrollContainer.removeEventListener('touchstart', this.handleTouchStart)
      this.scrollContainer.removeEventListener('touchmove', this.handleTouchMove)
      this.scrollContainer.removeEventListener('touchend', this.handleTouchEnd)
      this.scrollContainer.removeEventListener('touchcancel', this.handleTouchEnd)
      this.scrollContainer = null
    }
    this.pinchSession = null
    this.isPinching = false
  }

  private get isPinchZoomEnabled(): boolean {
    if (this.host.option?.touch?.enabled === false) return false
    if (this.host.option?.touch?.pinchZoom !== undefined) {
      return this.host.option.touch.pinchZoom
    }
    return this.host.option?.zoom?.enabled === true
  }

  private handleTouchStart = (e: TouchEvent): void => {
    if (e.touches.length < 2) return
    if (!this.isPinchZoomEnabled || !this.scrollContainer) return

    const t0 = e.touches[0]
    const t1 = e.touches[1]
    const distance = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY)
    if (distance < 8) return

    e.preventDefault()
    this.host.clearTooltip()

    // 進行中のタスク長押し待機等があればキャンセル通知を送る
    window.dispatchEvent(new CustomEvent('moguchart-pinch-start'))

    const midX = (t0.clientX + t1.clientX) / 2
    const midY = (t0.clientY + t1.clientY) / 2
    const rect = this.scrollContainer.getBoundingClientRect()
    const isMonthMode = this.zoomController.effectivePxPerMonth !== undefined
    const effectivePx = isMonthMode
      ? this.zoomController.effectivePxPerMonth!
      : this.zoomController.effectivePxPerDay
    const contentX = midX - rect.left + this.scrollContainer.scrollLeft - this.host.currentRowHeaderWidth
    const anchorUnits = Math.max(0, contentX) / Math.max(1, effectivePx)

    this.pinchSession = {
      startDistance: distance,
      startZoomPercent: this.zoomController.zoomPercent,
      anchorUnits,
      startMidY: midY,
      startScrollTop: this.scrollContainer.scrollTop,
    }
    this.isPinching = true
  }

  private handleTouchMove = (e: TouchEvent): void => {
    if (!this.pinchSession || !this.scrollContainer || e.touches.length < 2) return

    const t0 = e.touches[0]
    const t1 = e.touches[1]
    const currentDistance = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY)
    if (currentDistance < 8) return

    e.preventDefault()

    const midX = (t0.clientX + t1.clientX) / 2
    const midY = (t0.clientY + t1.clientY) / 2
    const scaleFactor = currentDistance / this.pinchSession.startDistance
    const targetPercent = this.pinchSession.startZoomPercent * scaleFactor

    this.zoomController.zoomToPercentAtPoint(
      targetPercent,
      midX,
      this.scrollContainer,
      this.pinchSession.anchorUnits,
    )

    // 2本指の上下移動に合わせた縦スクロール追従
    const dy = midY - this.pinchSession.startMidY
    this.scrollContainer.scrollTop = Math.max(0, this.pinchSession.startScrollTop - dy)
  }

  private handleTouchEnd = (e: TouchEvent): void => {
    if (e.touches.length < 2) {
      this.pinchSession = null
      this.isPinching = false
    }
  }
}


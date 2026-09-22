import type { ReactiveController, ReactiveControllerHost } from 'lit'
import {
  DEFAULT_BAR_HEIGHT,
  DEFAULT_ROW_HEADER_WIDTH,
  DEFAULT_ZOOM_CONFIG,
  CHROME_ZOOM_LEVELS,
} from '../../core/constants'
import type {
  GanttChartOption,
  GanttChartOptionZoom,
  GanttRow,
  ZoomChangeEventDetail,
} from '../../core/types'

export interface ZoomControllerHost extends ReactiveControllerHost, HTMLElement {
  option: GanttChartOption
  baseRowHeaderWidth: number
  currentRowHeaderWidth: number
  displayRows: GanttRow[]
  calendarHeight: number
  getDateX(date: Date): number
  invalidateLayoutCache(): void
}

export class ZoomController implements ReactiveController {
  private host: ZoomControllerHost

  public zoomPercent: number = DEFAULT_ZOOM_CONFIG.DEFAULT_PERCENT
  public zoomPxPerDay: number | null = null
  public zoomPxPerMonth: number | null = null

  private isZoomInitialized = false
  private prevInitialPercent: number | undefined = undefined

  constructor(host: ZoomControllerHost) {
    this.host = host
    host.addController(this)
  }

  hostConnected(): void {
    // ホスト接続時の処理
  }

  hostDisconnected(): void {
    // ホスト切断時のクリーンアップ
  }

  public get zoomOption(): GanttChartOptionZoom | undefined {
    return this.host.option?.zoom
  }

  /**
   * 現在の実効ズーム倍率 (1.0 = 100%)
   */
  public get effectiveZoomScale(): number {
    return this.zoomPercent / 100
  }

  public get isScaleCalendarEnabled(): boolean {
    return this.zoomOption?.scaleElements?.calendar !== false
  }

  public get isScaleRowHeaderEnabled(): boolean {
    return this.zoomOption?.scaleElements?.rowHeader !== false
  }

  public get isScaleBarHeightEnabled(): boolean {
    return this.zoomOption?.scaleElements?.barHeight !== false
  }

  public get isScaleFontEnabled(): boolean {
    return this.zoomOption?.scaleElements?.fontScale !== false
  }

  /**
   * 現在有効な pxPerDay（ズームオーバーライドがあればそちらを優先）
   */
  public get effectivePxPerDay(): number {
    if (this.zoomPxPerDay !== null) return this.zoomPxPerDay
    const base = this.host.option?.calendar?.pxPerDay ?? 50
    if (this.zoomOption?.enabled && this.isScaleCalendarEnabled) {
      return Math.max(8, Math.round(base * this.effectiveZoomScale))
    }
    return base
  }

  /**
   * 現在有効な pxPerMonth（ズームオーバーライドがあればそちらを優先）
   */
  public get effectivePxPerMonth(): number | undefined {
    if (this.zoomPxPerMonth !== null) return this.zoomPxPerMonth
    if (this.host.option?.calendar?.pxPerMonth === undefined) return undefined
    const base = this.host.option.calendar.pxPerMonth
    if (this.zoomOption?.enabled && this.isScaleCalendarEnabled) {
      return Math.max(10, Math.round(base * this.effectiveZoomScale))
    }
    return base
  }

  /**
   * 現在有効な行ヘッダー幅（ズーム連動）
   */
  public get effectiveRowHeaderWidth(): number {
    const baseWidth = this.host.baseRowHeaderWidth || (this.host.option?.rowHeader?.width ?? DEFAULT_ROW_HEADER_WIDTH)
    if (this.zoomOption?.enabled && this.isScaleRowHeaderEnabled) {
      return Math.max(60, Math.min(600, Math.round(baseWidth * this.effectiveZoomScale)))
    }
    return baseWidth
  }

  /**
   * 現在有効なバー高さ（ズーム連動）
   */
  public get effectiveBarHeight(): number {
    const base = this.host.option?.bar?.height ?? DEFAULT_BAR_HEIGHT
    if (this.zoomOption?.enabled && this.isScaleBarHeightEnabled) {
      const scale = this.effectiveZoomScale
      const dampScale = Math.max(0.7, Math.min(1.5, 1 + (scale - 1) * 0.7))
      return Math.max(16, Math.round(base * dampScale))
    }
    return base
  }

  /**
   * 現在有効なフォントスケール（ズーム連動）
   */
  public get effectiveFontScale(): number {
    const base = this.host.option?.fontScale ?? 1
    if (this.zoomOption?.enabled && this.isScaleFontEnabled) {
      return base * this.effectiveZoomScale
    }
    return base
  }

  /**
   * オプション変更時のズーム初期化・再同期処理
   */
  public syncWithOption(): void {
    const currentInitial = this.zoomOption?.initialPercent
    if (!this.isZoomInitialized) {
      this.isZoomInitialized = true
      this.prevInitialPercent = currentInitial
      this.zoomPercent = currentInitial ?? DEFAULT_ZOOM_CONFIG.DEFAULT_PERCENT
    } else if (currentInitial !== undefined && currentInitial !== this.prevInitialPercent) {
      this.prevInitialPercent = currentInitial
      this.zoomPercent = currentInitial
    }

    // 利用側が option を直接変更した場合、ズームオーバーライドをリセット
    if (this.zoomPxPerDay !== null || this.zoomPxPerMonth !== null) {
      this.zoomPxPerDay = null
      this.zoomPxPerMonth = null
      this.zoomPercent = this.zoomOption?.initialPercent ?? DEFAULT_ZOOM_CONFIG.DEFAULT_PERCENT
    }

    if (this.effectiveFontScale !== undefined) {
      this.host.style.setProperty('--moguchart-font-scale', String(this.effectiveFontScale))
    } else {
      this.host.style.removeProperty('--moguchart-font-scale')
    }
  }

  public dispatchZoomChange(): void {
    const isMonthMode = this.effectivePxPerMonth !== undefined
    this.host.dispatchEvent(
      new CustomEvent<ZoomChangeEventDetail>('zoom-change', {
        detail: {
          pxPerDay: this.effectivePxPerDay,
          pxPerMonth: isMonthMode ? this.effectivePxPerMonth : undefined,
          zoomScale: this.effectiveZoomScale,
          zoomPercent: this.zoomPercent,
        },
        bubbles: true,
        composed: true,
      }),
    )
  }

  /**
   * Ctrl/Cmd + マウスホイールによるズーム処理
   */
  public handleWheel = (e: WheelEvent, scrollContainer: HTMLElement | null): void => {
    // Ctrl/Meta キーが押されていない場合は通常スクロール
    if (!e.ctrlKey && !e.metaKey) return
    // ズームが無効の場合は無視
    if (this.host.option?.zoom?.enabled !== true) return
    if (e.defaultPrevented) return

    e.preventDefault()

    const container = scrollContainer
    const labelWidth = this.host.currentRowHeaderWidth

    // マウス位置のコンテンツ内X座標（行ヘッダーを除く）
    let mouseContentX = 0
    if (container) {
      const rect = container.getBoundingClientRect()
      mouseContentX = e.clientX - rect.left + container.scrollLeft - labelWidth
    }

    // 現在のズーム値
    const isMonthMode = this.effectivePxPerMonth !== undefined

    // ズーム倍率計算
    const minPercent = this.host.option?.zoom?.minPercent ?? DEFAULT_ZOOM_CONFIG.MIN_PERCENT
    const maxPercent = this.host.option?.zoom?.maxPercent ?? DEFAULT_ZOOM_CONFIG.MAX_PERCENT

    let newPercent: number
    const levels = this.host.option?.zoom?.levels
    if (levels && levels.length > 0) {
      if (e.deltaY < 0) {
        // ズームイン: 次に大きいレベルへ
        newPercent = levels.find((v) => v > this.zoomPercent) ?? maxPercent
      } else {
        // ズームアウト: 次に小さいレベルへ
        newPercent = [...levels].reverse().find((v) => v < this.zoomPercent) ?? minPercent
      }
    } else {
      const step = this.host.option?.zoom?.step ?? DEFAULT_ZOOM_CONFIG.STEP
      const factor = e.deltaY > 0 ? 1 / step : step
      newPercent = Math.round(this.zoomPercent * factor)
    }
    newPercent = Math.max(minPercent, Math.min(maxPercent, newPercent))

    // 値が変わらなければ何もしない
    if (newPercent === this.zoomPercent && this.zoomPxPerDay === null && this.zoomPxPerMonth === null) return

    const oldEffectivePx = isMonthMode ? this.effectivePxPerMonth! : this.effectivePxPerDay

    // ズーム値を先に更新
    this.zoomPercent = newPercent
    this.zoomPxPerDay = null
    this.zoomPxPerMonth = null

    if (this.isScaleRowHeaderEnabled) {
      this.host.currentRowHeaderWidth = this.effectiveRowHeaderWidth
    }
    if (this.isScaleFontEnabled) {
      this.host.style.setProperty('--moguchart-font-scale', String(this.effectiveFontScale))
    }

    const newEffectivePx = isMonthMode ? this.effectivePxPerMonth! : this.effectivePxPerDay
    const ratio = newEffectivePx / oldEffectivePx

    // 再レンダリング後にスクロール位置を補正（コンテナが存在する場合のみ）
    if (container) {
      this.host.updateComplete.then(() => {
        const newMouseContentX = mouseContentX * ratio
        const scrollDelta = newMouseContentX - mouseContentX
        container.scrollLeft += scrollDelta
      })
    }

    this.host.invalidateLayoutCache()
    this.host.requestUpdate()

    // イベント通知
    this.dispatchZoomChange()
  }

  /**
   * 指定したパーセンテージにズームを設定する。
   */
  public zoomToPercent(percent: number): void {
    const minPercent = this.host.option?.zoom?.minPercent ?? DEFAULT_ZOOM_CONFIG.MIN_PERCENT
    const maxPercent = this.host.option?.zoom?.maxPercent ?? DEFAULT_ZOOM_CONFIG.MAX_PERCENT
    const clamped = Math.max(minPercent, Math.min(maxPercent, Math.round(percent)))

    if (this.zoomPercent === clamped && this.zoomPxPerDay === null && this.zoomPxPerMonth === null) {
      return
    }

    this.zoomPercent = clamped
    this.zoomPxPerDay = null
    this.zoomPxPerMonth = null

    if (this.isScaleRowHeaderEnabled) {
      this.host.currentRowHeaderWidth = this.effectiveRowHeaderWidth
    }
    if (this.isScaleFontEnabled) {
      this.host.style.setProperty('--moguchart-font-scale', String(this.effectiveFontScale))
    }

    this.host.invalidateLayoutCache()
    this.host.requestUpdate()
    this.dispatchZoomChange()
  }

  /**
   * 指定した倍率にズームを設定する。
   */
  public zoomToScale(scale: number): void {
    this.zoomToPercent(Math.round(scale * 100))
  }

  /**
   * 1段階ズームインする。
   */
  public zoomIn(step?: number): void {
    if (step !== undefined) {
      this.zoomToPercent(this.zoomPercent + step)
      return
    }
    const maxPercent = this.host.option?.zoom?.maxPercent ?? DEFAULT_ZOOM_CONFIG.MAX_PERCENT
    const levels = this.host.option?.zoom?.levels ?? CHROME_ZOOM_LEVELS
    const current = this.zoomPercent
    const next = levels.find((v) => v > current) ?? maxPercent
    this.zoomToPercent(Math.min(maxPercent, next))
  }

  /**
   * 1段階ズームアウトする。
   */
  public zoomOut(step?: number): void {
    if (step !== undefined) {
      this.zoomToPercent(this.zoomPercent - step)
      return
    }
    const minPercent = this.host.option?.zoom?.minPercent ?? DEFAULT_ZOOM_CONFIG.MIN_PERCENT
    const levels = this.host.option?.zoom?.levels ?? CHROME_ZOOM_LEVELS
    const current = this.zoomPercent
    const prev = [...levels].reverse().find((v) => v < current) ?? minPercent
    this.zoomToPercent(Math.max(minPercent, prev))
  }

  /**
   * 現在のズームパーセンテージを取得する。
   */
  public getZoomPercent(): number {
    return this.zoomPercent
  }

  /**
   * 現在のズーム倍率を取得する (1.0 = 100%)。
   */
  public getZoomScale(): number {
    return this.effectiveZoomScale
  }

  /**
   * 指定した pxPerDay（または pxPerMonth）にズームを設定する (後方互換)。
   */
  public zoomTo(value: number): void {
    const isMonthMode = this.effectivePxPerMonth !== undefined
    const defaultMin = isMonthMode ? 20 : 2
    const defaultMax = isMonthMode ? 600 : 200
    const min = this.host.option?.zoom?.min ?? defaultMin
    const max = this.host.option?.zoom?.max ?? defaultMax
    const clamped = Math.max(min, Math.min(max, value))

    const basePx = isMonthMode
      ? (this.host.option?.calendar?.pxPerMonth ?? 50)
      : (this.host.option?.calendar?.pxPerDay ?? 50)
    const minPercent = this.host.option?.zoom?.minPercent ?? DEFAULT_ZOOM_CONFIG.MIN_PERCENT
    const maxPercent = this.host.option?.zoom?.maxPercent ?? DEFAULT_ZOOM_CONFIG.MAX_PERCENT
    const calculatedPercent = Math.round((clamped / basePx) * 100)
    this.zoomPercent = Math.max(minPercent, Math.min(maxPercent, calculatedPercent))

    if (isMonthMode) {
      this.zoomPxPerMonth = clamped
    } else {
      this.zoomPxPerDay = clamped
    }

    if (this.isScaleRowHeaderEnabled) {
      this.host.currentRowHeaderWidth = this.effectiveRowHeaderWidth
    }
    if (this.isScaleFontEnabled) {
      this.host.style.setProperty('--moguchart-font-scale', String(this.effectiveFontScale))
    }

    this.host.invalidateLayoutCache()
    this.host.requestUpdate()
    this.dispatchZoomChange()
  }

  /**
   * 全タスクが表示領域に収まるようにズームレベルを自動調整する。
   */
  public zoomToFit(): void {
    const container = this.host.shadowRoot?.querySelector('.scroll-container') as HTMLElement | null
    if (!container) return

    // 全タスクの最小開始日・最大終了日を取得
    let minStart: Date | null = null
    let maxEnd: Date | null = null
    for (const row of this.host.displayRows) {
      for (const task of row.tasks) {
        if (!minStart || task.start < minStart) minStart = task.start
        if (!maxEnd || task.end > maxEnd) maxEnd = task.end
      }
    }

    if (!minStart || !maxEnd) return

    const labelWidth = this.host.currentRowHeaderWidth
    const availableWidth = container.clientWidth - labelWidth
    if (availableWidth <= 0) return

    const isMonthMode = this.effectivePxPerMonth !== undefined

    if (isMonthMode) {
      // 月数を計算
      const monthDiff =
        (maxEnd.getFullYear() - minStart.getFullYear()) * 12 + (maxEnd.getMonth() - minStart.getMonth())
      const totalMonths = Math.max(1, monthDiff)
      const targetPxPerMonth = availableWidth / totalMonths
      this.zoomTo(targetPxPerMonth)
    } else {
      // 日数を計算
      const diffMs = maxEnd.getTime() - minStart.getTime()
      const totalDays = Math.max(1, diffMs / (1000 * 60 * 60 * 24))
      const targetPxPerDay = availableWidth / totalDays
      this.zoomTo(targetPxPerDay)
    }

    // タスク開始位置にスクロール
    requestAnimationFrame(() => {
      const startX = this.host.getDateX(minStart!) + labelWidth
      container.scrollLeft = Math.max(0, startX - 10)
    })
  }

  /**
   * ズームを100%（標準倍率）に戻す。
   */
  public resetZoom(): void {
    if (
      this.zoomPercent === DEFAULT_ZOOM_CONFIG.DEFAULT_PERCENT &&
      this.zoomPxPerDay === null &&
      this.zoomPxPerMonth === null
    ) {
      return
    }
    this.zoomPxPerDay = null
    this.zoomPxPerMonth = null
    this.zoomToPercent(DEFAULT_ZOOM_CONFIG.DEFAULT_PERCENT)
  }
}

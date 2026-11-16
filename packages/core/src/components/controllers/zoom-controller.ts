import type { ReactiveController, ReactiveControllerHost } from 'lit'
import {
  DEFAULT_BAR_HEIGHT,
  DEFAULT_ROW_HEADER_WIDTH,
  DEFAULT_ZOOM_CONFIG,
  CHROME_ZOOM_LEVELS,
} from '../../core/constants.js'
import { dateToX, xToDate } from '../../core/utils.js'
import type {
  GanttChartOption,
  GanttChartOptionCalendar,
  GanttChartOptionZoom,
  GanttRow,
  GanttSemanticZoomConfig,
  GanttSemanticZoomScale,
  ZoomChangeEventDetail,
} from '../../core/types.js'

export const DAYS_PER_MONTH = 30.4375

export const DEFAULT_SEMANTIC_SCALES: readonly GanttSemanticZoomScale[] = [
  'month',
  'week',
  'day',
  'hour',
] as const

export interface ResolvedSemanticZoomConfig {
  enabled: boolean
  scales: GanttSemanticZoomScale[]
  thresholds: {
    monthToWeekPxPerDay: number
    weekToDayPxPerDay: number
    dayToHourPxPerDay: number
  }
  minEquivalentPxPerDay: number
  maxEquivalentPxPerDay: number
  autoSnapDuration: boolean
}

/**
 * オプションからセマンティック・ズーム設定を正規化して返す（無効時は null）
 */
export function resolveSemanticZoomConfig(
  zoomOption?: GanttChartOptionZoom,
): ResolvedSemanticZoomConfig | null {
  const raw = zoomOption?.semanticScale
  if (!raw) return null
  if (typeof raw === 'object' && raw.enabled === false) return null

  const cfg: GanttSemanticZoomConfig = typeof raw === 'object' ? raw : {}
  const scales =
    cfg.scales && cfg.scales.length > 0
      ? cfg.scales
      : ([...DEFAULT_SEMANTIC_SCALES] as GanttSemanticZoomScale[])

  return {
    enabled: true,
    scales,
    thresholds: {
      monthToWeekPxPerDay: cfg.thresholds?.monthToWeekPxPerDay ?? 7,
      weekToDayPxPerDay: cfg.thresholds?.weekToDayPxPerDay ?? 22,
      dayToHourPxPerDay: cfg.thresholds?.dayToHourPxPerDay ?? 180,
    },
    minEquivalentPxPerDay: Math.max(0.2, cfg.minEquivalentPxPerDay ?? 1.5),
    maxEquivalentPxPerDay: Math.max(10, cfg.maxEquivalentPxPerDay ?? 1440),
    autoSnapDuration: cfg.autoSnapDuration !== false,
  }
}

/**
 * 1日あたりの換算ピクセル幅から表示スケール（month / week / day / hour）を判定する
 */
export function resolveSemanticScale(
  eqPxPerDay: number,
  config: ResolvedSemanticZoomConfig,
): GanttSemanticZoomScale {
  const { monthToWeekPxPerDay, weekToDayPxPerDay, dayToHourPxPerDay } = config.thresholds
  let rawScale: GanttSemanticZoomScale
  if (eqPxPerDay < monthToWeekPxPerDay) {
    rawScale = 'month'
  } else if (eqPxPerDay < weekToDayPxPerDay) {
    rawScale = 'week'
  } else if (eqPxPerDay < dayToHourPxPerDay) {
    rawScale = 'day'
  } else {
    rawScale = 'hour'
  }

  if (config.scales.includes(rawScale)) {
    return rawScale
  }

  // 指定されていないスケールに該当した場合は、許可されたスケールの中で最も近いものを選択
  const order: GanttSemanticZoomScale[] = ['month', 'week', 'day', 'hour']
  const targetIdx = order.indexOf(rawScale)
  let bestScale = config.scales[0] ?? 'day'
  let bestDist = Infinity
  for (const candidate of config.scales) {
    const dist = Math.abs(order.indexOf(candidate) - targetIdx)
    if (dist < bestDist) {
      bestDist = dist
      bestScale = candidate
    }
  }
  return bestScale
}

export interface SemanticCalendarOverrides {
  scale: GanttSemanticZoomScale
  calendar: Partial<GanttChartOptionCalendar>
  snapDuration?: number
}

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
  public semanticEqPxPerDay: number | null = null

  private isZoomInitialized = false
  private prevInitialPercent: number | undefined = undefined
  private prevBasePxPerDay: number | undefined = undefined
  private prevBasePxPerMonth: number | undefined = undefined
  private prevSemanticActive = false

  constructor(host: ZoomControllerHost) {
    this.host = host
    host.addController(this)
  }

  hostConnected(): void {}

  hostDisconnected(): void {}

  public get zoomOption(): GanttChartOptionZoom | undefined {
    return this.host.option?.zoom
  }

  public get semanticConfig(): ResolvedSemanticZoomConfig | null {
    if (this.zoomOption?.enabled !== true) return null
    return resolveSemanticZoomConfig(this.zoomOption)
  }

  public get isSemanticZoomActive(): boolean {
    return this.semanticConfig !== null
  }

  /**
   * 基準となる初期カレンダー設定の換算 pxPerDay
   */
  public get baseEquivalentPxPerDay(): number {
    const cal = this.host.option?.calendar
    if (cal?.pxPerMonth !== undefined) {
      return cal.pxPerMonth / DAYS_PER_MONTH
    }
    return cal?.pxPerDay ?? 50
  }

  /**
   * セマンティック・ズーム時の現在換算 pxPerDay
   */
  public get currentEquivalentPxPerDay(): number {
    if (this.semanticEqPxPerDay !== null) {
      return this.semanticEqPxPerDay
    }
    return this.baseEquivalentPxPerDay * (this.zoomPercent / 100)
  }

  /**
   * 現在適用中のセマンティック表示スケール（セマンティック・ズーム無効時は undefined）
   */
  public get activeSemanticScale(): GanttSemanticZoomScale | undefined {
    const cfg = this.semanticConfig
    if (!cfg) return undefined
    return resolveSemanticScale(this.currentEquivalentPxPerDay, cfg)
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
    if (this.isSemanticZoomActive) {
      return this.zoomOption?.scaleElements?.rowHeader === true
    }
    return this.zoomOption?.scaleElements?.rowHeader !== false
  }

  public get isScaleBarHeightEnabled(): boolean {
    if (this.isSemanticZoomActive) {
      return this.zoomOption?.scaleElements?.barHeight === true
    }
    return this.zoomOption?.scaleElements?.barHeight !== false
  }

  public get isScaleFontEnabled(): boolean {
    if (this.isSemanticZoomActive) {
      return this.zoomOption?.scaleElements?.fontScale === true
    }
    return this.zoomOption?.scaleElements?.fontScale !== false
  }

  /**
   * 現在有効な pxPerDay（ズームオーバーライドがあればそちらを優先）
   */
  public get effectivePxPerDay(): number {
    const semScale = this.activeSemanticScale
    if (semScale !== undefined) {
      const eq = this.currentEquivalentPxPerDay
      if (semScale === 'month') {
        return Math.max(0.5, Math.round(eq * 100) / 100)
      }
      return Math.max(2, Math.round(eq * 100) / 100)
    }

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
    const semScale = this.activeSemanticScale
    if (semScale !== undefined) {
      if (semScale === 'month') {
        const eq = this.currentEquivalentPxPerDay
        return Math.max(20, Math.round(eq * DAYS_PER_MONTH * 100) / 100)
      }
      return undefined
    }

    if (this.zoomPxPerMonth !== null) return this.zoomPxPerMonth
    if (this.host.option?.calendar?.pxPerMonth === undefined) return undefined
    const base = this.host.option.calendar.pxPerMonth
    if (this.zoomOption?.enabled && this.isScaleCalendarEnabled) {
      return Math.max(10, Math.round(base * this.effectiveZoomScale))
    }
    return base
  }

  /**
   * セマンティック・ズーム有効時に currentOption へ適用するカレンダー・スナップ設定オーバーライド
   */
  public getSemanticCalendarOverrides(): SemanticCalendarOverrides | null {
    const cfg = this.semanticConfig
    if (!cfg) return null
    const scale = resolveSemanticScale(this.currentEquivalentPxPerDay, cfg)
    const baseCal = this.host.option?.calendar
    const keepQuarters = Boolean(baseCal?.showQuarters && !baseCal?.showMonthsRow)

    switch (scale) {
      case 'month':
        return {
          scale,
          calendar: {
            showMonthsRow: true,
            showQuarters: true,
            showMonths: false,
            showWeeks: false,
            showDays: false,
            showTime: false,
          },
          snapDuration: cfg.autoSnapDuration ? 1440 : undefined,
        }
      case 'week':
        return {
          scale,
          calendar: {
            showMonthsRow: false,
            showQuarters: keepQuarters,
            showMonths: true,
            showWeeks: true,
            showDays: false,
            showTime: false,
          },
          snapDuration: cfg.autoSnapDuration ? 1440 : undefined,
        }
      case 'day':
        return {
          scale,
          calendar: {
            showMonthsRow: false,
            showQuarters: keepQuarters,
            showMonths: true,
            showWeeks: false,
            showDays: true,
            showTime: false,
          },
          snapDuration: cfg.autoSnapDuration ? 1440 : undefined,
        }
      case 'hour':
        return {
          scale,
          calendar: {
            showMonthsRow: false,
            showQuarters: false,
            showMonths: false,
            showWeeks: false,
            showDays: true,
            showTime: true,
          },
          snapDuration: cfg.autoSnapDuration ? 60 : undefined,
        }
    }
  }

  /**
   * 現在有効な行ヘッダー幅（ズーム連動）
   */
  public get effectiveRowHeaderWidth(): number {
    const baseWidth = this.host.baseRowHeaderWidth || (this.host.option?.rowHeader?.width ?? DEFAULT_ROW_HEADER_WIDTH)
    const maxWidth = this.host.option?.rowHeader?.maxWidth ?? 2000
    if (this.zoomOption?.enabled && this.isScaleRowHeaderEnabled) {
      const clampedScale = this.isSemanticZoomActive
        ? Math.max(0.75, Math.min(1.35, this.effectiveZoomScale))
        : this.effectiveZoomScale
      return Math.max(60, Math.min(maxWidth, Math.round(baseWidth * clampedScale)))
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
      const clampedScale = this.isSemanticZoomActive
        ? Math.max(0.8, Math.min(1.3, this.effectiveZoomScale))
        : this.effectiveZoomScale
      return base * clampedScale
    }
    return base
  }

  /**
   * オプション変更時のズーム初期化・再同期処理
   */
  public syncWithOption(): void {
    const currentInitial = this.zoomOption?.initialPercent
    const currentBaseDay = this.host.option?.calendar?.pxPerDay
    const currentBaseMonth = this.host.option?.calendar?.pxPerMonth
    const currentSemanticActive = this.isSemanticZoomActive

    const calendarScaleChanged =
      this.isZoomInitialized &&
      (currentBaseDay !== this.prevBasePxPerDay ||
        currentBaseMonth !== this.prevBasePxPerMonth ||
        currentSemanticActive !== this.prevSemanticActive)

    if (!this.isZoomInitialized) {
      this.isZoomInitialized = true
      this.prevInitialPercent = currentInitial
      this.zoomPercent = currentInitial ?? DEFAULT_ZOOM_CONFIG.DEFAULT_PERCENT
    } else if (currentInitial !== undefined && currentInitial !== this.prevInitialPercent) {
      this.prevInitialPercent = currentInitial
      this.zoomPercent = currentInitial
      this.semanticEqPxPerDay = null
    }

    this.prevBasePxPerDay = currentBaseDay
    this.prevBasePxPerMonth = currentBaseMonth
    this.prevSemanticActive = currentSemanticActive

    if (calendarScaleChanged) {
      this.semanticEqPxPerDay = null
    }

    // 利用側が option を直接変更した場合、従来のズームオーバーライドをリセット
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
    const semanticScale = this.activeSemanticScale
    this.host.dispatchEvent(
      new CustomEvent<ZoomChangeEventDetail>('zoom-change', {
        detail: {
          pxPerDay: this.effectivePxPerDay,
          pxPerMonth: isMonthMode ? this.effectivePxPerMonth : undefined,
          zoomScale: this.effectiveZoomScale,
          zoomPercent: this.zoomPercent,
          ...(semanticScale ? { semanticScale } : {}),
        },
        bubbles: true,
        composed: true,
      }),
    )
  }

  /**
   * セマンティック・ズーム時に指定した基準日時（またはクライアントX座標／ビューポート中央）を維持しながら
   * 換算 pxPerDay を更新する。
   */
  public zoomSemanticToAtPoint(
    targetEqPxPerDay: number,
    clientX?: number,
    scrollContainer?: HTMLElement | null,
    explicitAnchorDate?: Date,
  ): boolean {
    const cfg = this.semanticConfig
    if (!cfg) return false

    const clampedEq = Math.max(
      cfg.minEquivalentPxPerDay,
      Math.min(cfg.maxEquivalentPxPerDay, targetEqPxPerDay),
    )

    const currentEq = this.currentEquivalentPxPerDay
    if (Math.abs(clampedEq - currentEq) < 0.001 && this.semanticEqPxPerDay !== null) {
      return false
    }

    const container =
      scrollContainer ??
      (this.host.shadowRoot?.querySelector('.scroll-container') as HTMLElement | null)
    const calStart = this.host.option?.calendar?.start ?? new Date()

    let anchorDate = explicitAnchorDate
    if (!anchorDate && container) {
      const rect = container.getBoundingClientRect()
      const viewportOffsetX =
        clientX !== undefined
          ? clientX - rect.left - this.host.currentRowHeaderWidth
          : (container.clientWidth - this.host.currentRowHeaderWidth) / 2
      const oldContentX = Math.max(0, container.scrollLeft + viewportOffsetX)
      anchorDate = xToDate(oldContentX, calStart, this.effectivePxPerDay, this.effectivePxPerMonth)
    }

    this.semanticEqPxPerDay = clampedEq
    this.zoomPxPerDay = null
    this.zoomPxPerMonth = null
    const baseEq = Math.max(0.01, this.baseEquivalentPxPerDay)
    this.zoomPercent = Math.max(1, Math.round((clampedEq / baseEq) * 100))

    if (this.isScaleRowHeaderEnabled) {
      this.host.currentRowHeaderWidth = this.effectiveRowHeaderWidth
    }
    if (this.isScaleFontEnabled) {
      this.host.style.setProperty('--moguchart-font-scale', String(this.effectiveFontScale))
    }

    const applyAnchorScroll = () => {
      if (!container || !anchorDate) return
      const rect = container.getBoundingClientRect()
      const viewportOffsetX =
        clientX !== undefined
          ? clientX - rect.left - this.host.currentRowHeaderWidth
          : (container.clientWidth - this.host.currentRowHeaderWidth) / 2
      const newContentX = dateToX(
        anchorDate,
        calStart,
        this.effectivePxPerDay,
        this.effectivePxPerMonth,
      )
      container.scrollLeft = Math.max(0, newContentX - viewportOffsetX)
    }

    this.host.invalidateLayoutCache()
    this.host.requestUpdate()
    applyAnchorScroll()
    this.host.updateComplete.then(applyAnchorScroll)
    this.dispatchZoomChange()
    return true
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

    // セマンティック・ズーム有効時: スケール境界を跨いで連続ズーム＋カーソル直下の日時を完全維持
    if (this.isSemanticZoomActive) {
      const step = this.host.option?.zoom?.step ?? 1.15
      const factor = e.deltaY > 0 ? 1 / step : step
      const nextEq = this.currentEquivalentPxPerDay * factor
      this.zoomSemanticToAtPoint(nextEq, e.clientX, scrollContainer)
      return
    }

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
   * ピンチ操作など、指定したクライアントX座標のタイムライン位置（anchorUnits）を維持しながら
   * スムーズにズームパーセンテージを変更する。
   */
  public zoomToPercentAtPoint(
    percent: number,
    clientX: number,
    scrollContainer: HTMLElement | null,
    anchorUnits?: number,
  ): boolean {
    if (this.isSemanticZoomActive) {
      const targetEq = this.baseEquivalentPxPerDay * (percent / 100)
      return this.zoomSemanticToAtPoint(targetEq, clientX, scrollContainer)
    }

    const minPercent = this.host.option?.zoom?.minPercent ?? DEFAULT_ZOOM_CONFIG.MIN_PERCENT
    const maxPercent = this.host.option?.zoom?.maxPercent ?? DEFAULT_ZOOM_CONFIG.MAX_PERCENT
    const clamped = Math.max(minPercent, Math.min(maxPercent, Math.round(percent)))

    const isMonthMode = this.effectivePxPerMonth !== undefined
    const oldEffectivePx = isMonthMode ? this.effectivePxPerMonth! : this.effectivePxPerDay

    let computedAnchorUnits = anchorUnits
    if (computedAnchorUnits === undefined && scrollContainer) {
      const rect = scrollContainer.getBoundingClientRect()
      const contentX = clientX - rect.left + scrollContainer.scrollLeft - this.host.currentRowHeaderWidth
      computedAnchorUnits = Math.max(0, contentX) / oldEffectivePx
    }

    const changed =
      this.zoomPercent !== clamped || this.zoomPxPerDay !== null || this.zoomPxPerMonth !== null

    if (changed) {
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

    if (scrollContainer && computedAnchorUnits !== undefined) {
      const newEffectivePx = isMonthMode ? this.effectivePxPerMonth! : this.effectivePxPerDay
      const applyScroll = () => {
        const rect = scrollContainer.getBoundingClientRect()
        const viewportOffsetX = clientX - rect.left - this.host.currentRowHeaderWidth
        const targetScrollLeft = Math.max(0, computedAnchorUnits! * newEffectivePx - viewportOffsetX)
        scrollContainer.scrollLeft = targetScrollLeft
      }
      applyScroll()
      if (changed) {
        this.host.updateComplete.then(applyScroll)
      }
    }

    return changed
  }

  /**
   * 指定したパーセンテージにズームを設定する。
   */
  public zoomToPercent(percent: number): void {
    if (this.isSemanticZoomActive) {
      const targetEq = this.baseEquivalentPxPerDay * (percent / 100)
      this.zoomSemanticToAtPoint(targetEq)
      return
    }

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
    if (this.isSemanticZoomActive) {
      if (step !== undefined) {
        this.zoomToPercent(this.zoomPercent + step)
        return
      }
      const factor = this.host.option?.zoom?.step ?? 1.25
      this.zoomSemanticToAtPoint(this.currentEquivalentPxPerDay * factor)
      return
    }

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
    if (this.isSemanticZoomActive) {
      if (step !== undefined) {
        this.zoomToPercent(Math.max(1, this.zoomPercent - step))
        return
      }
      const factor = this.host.option?.zoom?.step ?? 1.25
      this.zoomSemanticToAtPoint(this.currentEquivalentPxPerDay / factor)
      return
    }

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
    if (this.isSemanticZoomActive) {
      this.zoomSemanticToAtPoint(value)
      return
    }

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

    if (this.isSemanticZoomActive) {
      const diffMs = maxEnd.getTime() - minStart.getTime()
      const totalDays = Math.max(0.25, diffMs / (1000 * 60 * 60 * 24))
      const targetPxPerDay = availableWidth / totalDays
      this.zoomSemanticToAtPoint(targetPxPerDay)
      requestAnimationFrame(() => {
        const startX = this.host.getDateX(minStart!) + labelWidth
        container.scrollLeft = Math.max(0, startX - 10)
      })
      return
    }

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
    if (this.isSemanticZoomActive) {
      this.semanticEqPxPerDay = null
      this.zoomPxPerDay = null
      this.zoomPxPerMonth = null
      this.zoomPercent = DEFAULT_ZOOM_CONFIG.DEFAULT_PERCENT
      this.host.invalidateLayoutCache()
      this.host.requestUpdate()
      this.dispatchZoomChange()
      return
    }

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

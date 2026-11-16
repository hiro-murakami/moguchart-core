import {
  addWorkingTimeMs,
  computeWorkingDurationMs,
  snapToWorkingStartMs,
} from '../../core/auto-schedule.js'
import { jaLocale } from '../../core/i18n.js'
import type { PluginManager } from '../../core/plugin.js'
import type {
  GanttChartOption,
  GanttRow,
  GanttTask,
  GanttTaskMoveMode,
  TaskConstraintType,
  TaskUpdateEventDetail,
} from '../../core/types.js'
import { isMilestoneTask } from '../../core/utils.js'

export interface TaskConstraintInfo {
  type: TaskConstraintType
  date: Date
  isMilestone: boolean
  taskName: string
}

export interface ActiveConstraintBoundary {
  type: TaskConstraintType
  boundaryDate: Date
  labelText: string
  isViolating: boolean
}

export interface ActiveConstraintDragState {
  snet?: ActiveConstraintBoundary
  fnlt?: ActiveConstraintBoundary
}

export interface ConstraintDragGuideHost extends HTMLElement {
  rows: GanttRow[]
  option: GanttChartOption
  theme: 'light' | 'dark'
  currentRowHeaderWidth: number
  currentScrollLeft?: number
  currentScrollTop?: number
  viewportWidth?: number
  viewportHeight?: number
  pluginManager?: PluginManager
  calculateLayout(): { layouts: Array<{ top: number; height: number }>; totalHeight: number }
  getDateX(date: Date): number
}

const LEGACY_APP_PLUGIN_NAME = 'schedule-constraint-drag-guide'

const isSummaryTask = (task: GanttTask): boolean => {
  return (
    task.type === 'summary' ||
    String(task.id).endsWith('-summary') ||
    Boolean((task as unknown as { isSummary?: boolean }).isSummary)
  )
}

const parseConstraintDate = (raw: Date | string | undefined | null): Date | null => {
  if (!raw) return null
  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime()) ? null : new Date(raw.getTime())
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    const dateOnlyMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
    if (dateOnlyMatch) {
      const d = new Date(
        Number(dateOnlyMatch[1]),
        Number(dateOnlyMatch[2]) - 1,
        Number(dateOnlyMatch[3]),
        0,
        0,
        0,
        0,
      )
      return Number.isNaN(d.getTime()) ? null : d
    }
    const parsed = new Date(trimmed)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  return null
}

/**
 * タスクから有効なスケジュール制約情報 (SNET / FNLT) を抽出する（サマリータスクは除外）
 */
export function extractTaskConstraint(task: GanttTask | undefined | null): TaskConstraintInfo | null {
  if (!task || isSummaryTask(task)) return null
  const attr = (task as unknown as {
    attribute?: { constraintType?: TaskConstraintType; constraintDate?: Date | string; type?: string }
  }).attribute
  const type = task.constraintType ?? attr?.constraintType
  if (type !== 'SNET' && type !== 'FNLT') return null

  const rawDate = task.constraintDate ?? attr?.constraintDate
  const parsed = parseConstraintDate(rawDate as Date | string | undefined)
  if (!parsed) return null

  const isMilestone = isMilestoneTask(task) || attr?.type === 'milestone'
  return {
    type,
    date: parsed,
    isMilestone,
    taskName: task.name || '',
  }
}

/**
 * スケジュール制約日時を表示用文字列にフォーマットする。
 * 通常タスクの FNLT で 00:00 境界（排他的終了日時）が設定されている場合は、
 * 終了日・デッドライン表示と同様に前日（月モードでは前月）として表記する。
 */
export function formatConstraintDateLabel(
  constraintDate: Date,
  constraintType: TaskConstraintType,
  isMilestone: boolean,
  option: GanttChartOption,
): string {
  const locale = option.locale ?? jaLocale
  const isMonthly = Boolean(option.calendar?.pxPerMonth)
  const isHourly = Boolean(option.calendar?.showTime)

  if (isMonthly) {
    if (constraintType === 'FNLT' && !isMilestone) {
      const d = new Date(constraintDate.getTime() - 1)
      d.setDate(1)
      d.setHours(0, 0, 0, 0)
      return locale.yearMonthFormat(d)
    }
    return locale.yearMonthFormat(constraintDate)
  }

  if (isHourly) {
    if (constraintDate.getHours() === 0 && constraintDate.getMinutes() === 0) {
      return `${locale.dateFormat(constraintDate)} 00:00`
    }
    return locale.dateTimeFormat(constraintDate)
  }

  const display = new Date(constraintDate.getTime())
  if (
    constraintType === 'FNLT' &&
    !isMilestone &&
    display.getHours() === 0 &&
    display.getMinutes() === 0
  ) {
    display.setDate(display.getDate() - 1)
  }

  if (display.getHours() !== 0 || display.getMinutes() !== 0) {
    return locale.dateTimeFormat(display)
  }
  return locale.dateFormat(display)
}

/**
 * ドラッグガイドのラベルバッジ文言を構築する
 */
export function buildConstraintBadgeText(
  constraint: TaskConstraintInfo,
  effectiveDate: Date,
  option: GanttChartOption,
  includeTaskName: boolean,
  isViolating: boolean,
): string {
  const locale = option.locale ?? jaLocale
  const dateStr = formatConstraintDateLabel(
    effectiveDate,
    constraint.type,
    constraint.isMilestone,
    option,
  )
  const prefixName =
    includeTaskName && constraint.taskName
      ? `${constraint.taskName.length > 14 ? `${constraint.taskName.slice(0, 14)}…` : constraint.taskName}: `
      : ''

  if (constraint.type === 'SNET') {
    const body = locale.dragOverlay.constraintSnet
      ? locale.dragOverlay.constraintSnet(dateStr)
      : `${dateStr} 以降に開始 (SNET)`
    return `${isViolating ? '⚠' : '⇥'} ${prefixName}${body}`
  }

  const body = locale.dragOverlay.constraintFnlt
    ? locale.dragOverlay.constraintFnlt(dateStr)
    : `${dateStr} までに終了 (FNLT)`
  return `${isViolating ? '⚠ ' : ''}${prefixName}${body}${isViolating ? '' : ' ⇥'}`
}

/**
 * 稼働日維持モード時の SNET 実効開始日時を算出する
 */
export function resolveEffectiveSnetDate(
  constraint: TaskConstraintInfo,
  isMoveOperation: boolean,
  checker?: (ms: number) => boolean,
): Date {
  if (isMoveOperation && !constraint.isMilestone && checker) {
    return new Date(snapToWorkingStartMs(constraint.date.getTime(), checker))
  }
  return constraint.date
}

const startOfMonthDate = (date: Date): Date => {
  const d = new Date(date.getTime())
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

const addMonthsDate = (date: Date, months: number): Date => {
  const d = startOfMonthDate(date)
  d.setMonth(d.getMonth() + months)
  return d
}

/**
 * タスク移動後の期間をスケジュール制約（SNET / FNLT）の境界内にクランプする
 */
export function clampMovedTaskDates(
  origTask: GanttTask,
  proposedStart: Date,
  proposedEnd: Date,
  options?: {
    isMonthly?: boolean
    checker?: (ms: number) => boolean
  },
): { start: Date; end: Date; clamped: boolean } {
  const constraint = extractTaskConstraint(origTask)
  if (!constraint) {
    return { start: proposedStart, end: proposedEnd, clamped: false }
  }

  const origStart = new Date(origTask.start)
  const origEnd = new Date(origTask.end)
  const isMonthly = Boolean(options?.isMonthly)
  const checker = options?.checker

  if (constraint.isMilestone) {
    const cMs = constraint.date.getTime()
    if (constraint.type === 'SNET' && proposedStart.getTime() < cMs) {
      return { start: new Date(cMs), end: new Date(cMs), clamped: true }
    }
    if (constraint.type === 'FNLT' && proposedStart.getTime() > cMs) {
      return { start: new Date(cMs), end: new Date(cMs), clamped: true }
    }
    return { start: proposedStart, end: proposedEnd, clamped: false }
  }

  if (isMonthly) {
    const monthsCount = Math.max(
      1,
      (origEnd.getFullYear() - origStart.getFullYear()) * 12 +
        (origEnd.getMonth() - origStart.getMonth()),
    )
    if (constraint.type === 'SNET') {
      const minStart = startOfMonthDate(constraint.date)
      if (proposedStart.getTime() < minStart.getTime()) {
        const clampedEnd = addMonthsDate(minStart, monthsCount)
        return { start: minStart, end: clampedEnd, clamped: true }
      }
    } else {
      const maxEnd = startOfMonthDate(constraint.date)
      if (proposedEnd.getTime() > maxEnd.getTime()) {
        const clampedStart = addMonthsDate(maxEnd, -monthsCount)
        return { start: clampedStart, end: maxEnd, clamped: true }
      }
    }
    return { start: proposedStart, end: proposedEnd, clamped: false }
  }

  if (checker && origEnd.getTime() > origStart.getTime()) {
    const workingDurationMs = computeWorkingDurationMs(
      origStart.getTime(),
      origEnd.getTime(),
      checker,
    )
    if (constraint.type === 'SNET') {
      const minStartMs = snapToWorkingStartMs(constraint.date.getTime(), checker)
      if (proposedStart.getTime() < minStartMs) {
        const clampedEndMs =
          workingDurationMs > 0
            ? addWorkingTimeMs(minStartMs, workingDurationMs, checker)
            : minStartMs
        return { start: new Date(minStartMs), end: new Date(clampedEndMs), clamped: true }
      }
    } else {
      const maxEndMs = constraint.date.getTime()
      if (proposedEnd.getTime() > maxEndMs) {
        const clampedStartMs =
          workingDurationMs > 0
            ? addWorkingTimeMs(maxEndMs, -workingDurationMs, checker)
            : maxEndMs
        const clampedEndMs =
          workingDurationMs > 0
            ? addWorkingTimeMs(clampedStartMs, workingDurationMs, checker)
            : clampedStartMs
        return { start: new Date(clampedStartMs), end: new Date(clampedEndMs), clamped: true }
      }
    }
    return { start: proposedStart, end: proposedEnd, clamped: false }
  }

  const durationMs = Math.max(0, origEnd.getTime() - origStart.getTime())
  if (constraint.type === 'SNET') {
    const minStartMs = constraint.date.getTime()
    if (proposedStart.getTime() < minStartMs) {
      return {
        start: new Date(minStartMs),
        end: new Date(minStartMs + durationMs),
        clamped: true,
      }
    }
  } else {
    const maxEndMs = constraint.date.getTime()
    if (proposedEnd.getTime() > maxEndMs) {
      return {
        start: new Date(maxEndMs - durationMs),
        end: new Date(maxEndMs),
        clamped: true,
      }
    }
  }

  return { start: proposedStart, end: proposedEnd, clamped: false }
}

/**
 * タスクリサイズ後の期間をスケジュール制約（SNET / FNLT）の境界内にクランプする
 */
export function clampResizedTaskDates(
  origTask: GanttTask,
  proposedStart: Date,
  proposedEnd: Date,
  options?: {
    isMonthly?: boolean
    snapMinutes?: number
  },
): { start: Date; end: Date; clamped: boolean } {
  const constraint = extractTaskConstraint(origTask)
  if (!constraint || constraint.isMilestone) {
    return { start: proposedStart, end: proposedEnd, clamped: false }
  }

  const origStartMs = new Date(origTask.start).getTime()
  const origEndMs = new Date(origTask.end).getTime()
  const isMonthly = Boolean(options?.isMonthly)
  const snapMinutes = Math.max(1, options?.snapMinutes ?? 1440)
  const minSnapMs = snapMinutes * 60 * 1000

  // 左端リサイズかつ SNET 違反
  if (
    constraint.type === 'SNET' &&
    proposedStart.getTime() !== origStartMs &&
    proposedStart.getTime() < constraint.date.getTime()
  ) {
    const clampedStart = isMonthly
      ? startOfMonthDate(constraint.date)
      : new Date(constraint.date.getTime())
    let clampedEnd = proposedEnd
    if (clampedEnd.getTime() <= clampedStart.getTime()) {
      clampedEnd = isMonthly
        ? addMonthsDate(clampedStart, 1)
        : new Date(clampedStart.getTime() + minSnapMs)
    }
    return { start: clampedStart, end: clampedEnd, clamped: true }
  }

  // 右端リサイズかつ FNLT 違反
  if (
    constraint.type === 'FNLT' &&
    proposedEnd.getTime() !== origEndMs &&
    proposedEnd.getTime() > constraint.date.getTime()
  ) {
    const clampedEnd = isMonthly
      ? startOfMonthDate(constraint.date)
      : new Date(constraint.date.getTime())
    let clampedStart = proposedStart
    if (clampedStart.getTime() >= clampedEnd.getTime()) {
      clampedStart = isMonthly
        ? addMonthsDate(clampedEnd, -1)
        : new Date(clampedEnd.getTime() - minSnapMs)
    }
    return { start: clampedStart, end: clampedEnd, clamped: true }
  }

  return { start: proposedStart, end: proposedEnd, clamped: false }
}

const estimateBadgeWidth = (text: string): number => {
  let w = 20
  for (let i = 0; i < text.length; i++) {
    w += text.charCodeAt(i) > 255 ? 11.5 : 6.8
  }
  return Math.max(150, Math.ceil(w))
}

/**
 * ガントチャート上での SNET / FNLT スケジュール制約ドラッグガイド（シェード・境界ライン・ラベルバッジ）を
 * 直接DOM操作で高速に制御するマネージャー
 */
export class ConstraintDragGuideManager {
  private host: ConstraintDragGuideHost
  private activeState: ActiveConstraintDragState | null = null

  private rootEl: HTMLDivElement | null = null
  private snetShadeEl: HTMLDivElement | null = null
  private snetLineEl: HTMLDivElement | null = null
  private snetBadgeEl: HTMLDivElement | null = null
  private fnltShadeEl: HTMLDivElement | null = null
  private fnltLineEl: HTMLDivElement | null = null
  private fnltBadgeEl: HTMLDivElement | null = null

  private globalCleanupAttached = false

  constructor(host: ConstraintDragGuideHost) {
    this.host = host
  }

  public get isActive(): boolean {
    return this.activeState !== null
  }

  public getState(): ActiveConstraintDragState | null {
    return this.activeState
  }

  public isLegacyPluginRegistered(): boolean {
    return Boolean(this.host.pluginManager?.hasPlugin(LEGACY_APP_PLUGIN_NAME))
  }

  public isGuideEnabled(): boolean {
    return (
      !this.host.option?.readOnly &&
      this.host.option?.constraint?.enabled !== false &&
      this.host.option?.constraint?.showDragGuide !== false &&
      !this.isLegacyPluginRegistered()
    )
  }

  public isClampEnabled(): boolean {
    return (
      !this.host.option?.readOnly &&
      this.host.option?.constraint?.enabled !== false &&
      this.host.option?.constraint?.clampOnDrop !== false &&
      !this.isLegacyPluginRegistered()
    )
  }

  private ensureDOMElements(containerLayer: HTMLElement): void {
    if (typeof document === 'undefined') return
    if (!this.rootEl) {
      const root = document.createElement('div')
      root.className = 'schedule-constraint-drag-guide'
      root.style.cssText = 'position: absolute; inset: 0; pointer-events: none; overflow: visible;'

      const createShade = (kind: TaskConstraintType) => {
        const el = document.createElement('div')
        el.className = 'constraint-guide-shade'
        el.dataset.constraint = kind
        el.style.cssText =
          'position: absolute; top: 0; pointer-events: none; display: none; transition: background-color 0.12s ease;'
        return el
      }

      const createLine = (kind: TaskConstraintType) => {
        const el = document.createElement('div')
        el.className = 'constraint-guide-line'
        el.dataset.constraint = kind
        el.style.cssText =
          'position: absolute; top: 0; width: 0; pointer-events: none; display: none; box-sizing: border-box;'
        return el
      }

      const createBadge = (kind: TaskConstraintType) => {
        const el = document.createElement('div')
        el.className = 'constraint-guide-badge'
        el.dataset.constraint = kind
        el.style.cssText = [
          'position: absolute',
          'pointer-events: none',
          'display: none',
          'padding: 3px 8px',
          'border-radius: 4px',
          'font-size: 11px',
          'font-weight: 600',
          'line-height: 1.3',
          'white-space: nowrap',
          'box-shadow: 0 2px 6px rgba(0, 0, 0, 0.28)',
          'z-index: 2',
          'letter-spacing: 0.01em',
        ].join('; ')
        return el
      }

      this.snetShadeEl = createShade('SNET')
      this.snetLineEl = createLine('SNET')
      this.snetBadgeEl = createBadge('SNET')
      this.fnltShadeEl = createShade('FNLT')
      this.fnltLineEl = createLine('FNLT')
      this.fnltBadgeEl = createBadge('FNLT')

      root.appendChild(this.snetShadeEl)
      root.appendChild(this.fnltShadeEl)
      root.appendChild(this.snetLineEl)
      root.appendChild(this.fnltLineEl)
      root.appendChild(this.snetBadgeEl)
      root.appendChild(this.fnltBadgeEl)
      this.rootEl = root
    }

    if (this.rootEl.parentElement !== containerLayer) {
      containerLayer.appendChild(this.rootEl)
    }
  }

  private hideAllElements(): void {
    const els = [
      this.snetShadeEl,
      this.snetLineEl,
      this.snetBadgeEl,
      this.fnltShadeEl,
      this.fnltLineEl,
      this.fnltBadgeEl,
    ]
    for (const el of els) {
      if (el) {
        el.style.display = 'none'
        delete el.dataset.violating
      }
    }
  }

  private handleGlobalDragTerminate = (): void => {
    if (!this.activeState) return
    requestAnimationFrame(() => {
      if (this.activeState) {
        this.clear()
      }
    })
  }

  private attachGlobalSafetyListeners(): void {
    if (this.globalCleanupAttached || typeof window === 'undefined') return
    this.globalCleanupAttached = true
    window.addEventListener('pointerup', this.handleGlobalDragTerminate, true)
    window.addEventListener('pointercancel', this.handleGlobalDragTerminate, true)
    window.addEventListener('blur', this.handleGlobalDragTerminate)
  }

  private detachGlobalSafetyListeners(): void {
    if (!this.globalCleanupAttached || typeof window === 'undefined') return
    this.globalCleanupAttached = false
    window.removeEventListener('pointerup', this.handleGlobalDragTerminate, true)
    window.removeEventListener('pointercancel', this.handleGlobalDragTerminate, true)
    window.removeEventListener('blur', this.handleGlobalDragTerminate)
  }

  public clear(): void {
    this.activeState = null
    this.detachGlobalSafetyListeners()
    this.hideAllElements()
  }

  public destroy(): void {
    this.clear()
    if (this.rootEl?.parentElement) {
      this.rootEl.parentElement.removeChild(this.rootEl)
    }
    this.rootEl = null
    this.snetShadeEl = null
    this.snetLineEl = null
    this.snetBadgeEl = null
    this.fnltShadeEl = null
    this.fnltLineEl = null
    this.fnltBadgeEl = null
  }

  /**
   * ドラッグ中・リサイズ中のイベントから移動可能範囲ガイド状態を更新しDOMへ反映する
   */
  public updateFromTaskUpdate(
    detail: TaskUpdateEventDetail & { mode?: GanttTaskMoveMode | string },
  ): void {
    if (
      !this.isGuideEnabled() ||
      !detail.isDragging ||
      detail.isCancel ||
      detail.isOutside ||
      detail.mode === 'copy'
    ) {
      this.clear()
      return
    }

    const isMoveOperation = detail.dx !== undefined
    const selectedIds = detail.selectedTaskIds

    // 1. 複数タスク一括移動時（最も厳しい SNET / FNLT を同時表示可能）
    if (isMoveOperation && selectedIds && selectedIds.length >= 2) {
      const selectedSet = new Set(selectedIds.map(String))
      let strictestSnet: {
        constraint: TaskConstraintInfo
        boundaryDate: Date
        minAllowedDx: number
      } | null = null
      let strictestFnlt: {
        constraint: TaskConstraintInfo
        boundaryDate: Date
        maxAllowedDx: number
      } | null = null

      for (const row of this.host.rows) {
        for (const task of row.tasks) {
          if (!selectedSet.has(String(task.id))) continue
          const constraint = extractTaskConstraint(task)
          if (!constraint) continue

          const origStart = new Date(task.start)
          const origEnd = new Date(task.end)
          const boundaryDate = constraint.date

          if (constraint.type === 'SNET') {
            const minAllowedDx = this.host.getDateX(boundaryDate) - this.host.getDateX(origStart)
            if (!strictestSnet || minAllowedDx > strictestSnet.minAllowedDx) {
              strictestSnet = { constraint, boundaryDate, minAllowedDx }
            }
          } else if (constraint.type === 'FNLT') {
            const refEdge = constraint.isMilestone ? origStart : origEnd
            const maxAllowedDx = this.host.getDateX(boundaryDate) - this.host.getDateX(refEdge)
            if (!strictestFnlt || maxAllowedDx < strictestFnlt.maxAllowedDx) {
              strictestFnlt = { constraint, boundaryDate, maxAllowedDx }
            }
          }
        }
      }

      if (!strictestSnet && !strictestFnlt) {
        this.clear()
        return
      }

      const dx = detail.dx ?? 0
      const nextState: ActiveConstraintDragState = {}

      if (strictestSnet) {
        const isViolating = dx < strictestSnet.minAllowedDx - 0.5
        nextState.snet = {
          type: 'SNET',
          boundaryDate: strictestSnet.boundaryDate,
          labelText: buildConstraintBadgeText(
            strictestSnet.constraint,
            strictestSnet.boundaryDate,
            this.host.option,
            true,
            isViolating,
          ),
          isViolating,
        }
      }

      if (strictestFnlt) {
        const isViolating = dx > strictestFnlt.maxAllowedDx + 0.5
        nextState.fnlt = {
          type: 'FNLT',
          boundaryDate: strictestFnlt.boundaryDate,
          labelText: buildConstraintBadgeText(
            strictestFnlt.constraint,
            strictestFnlt.boundaryDate,
            this.host.option,
            true,
            isViolating,
          ),
          isViolating,
        }
      }

      this.activeState = nextState
      this.attachGlobalSafetyListeners()
      this.syncDOM()
      return
    }

    // 2. 単一タスクの移動またはリサイズ時
    let targetTask: GanttTask | undefined
    const idStr = String(detail.id)
    for (const row of this.host.rows) {
      const found = row.tasks.find((t) => String(t.id) === idStr)
      if (found) {
        targetTask = found
        break
      }
    }

    if (!targetTask) {
      this.clear()
      return
    }

    const constraint = extractTaskConstraint(targetTask)
    if (!constraint) {
      this.clear()
      return
    }

    const boundaryDate = constraint.date
    const origStart = new Date(targetTask.start)
    const origEnd = new Date(targetTask.end)

    if (constraint.type === 'SNET') {
      const isViolating = isMoveOperation
        ? this.host.getDateX(origStart) + (detail.dx ?? 0) < this.host.getDateX(boundaryDate) - 0.5
        : new Date(detail.start).getTime() < boundaryDate.getTime()
      this.activeState = {
        snet: {
          type: 'SNET',
          boundaryDate,
          labelText: buildConstraintBadgeText(
            constraint,
            boundaryDate,
            this.host.option,
            false,
            isViolating,
          ),
          isViolating,
        },
      }
    } else {
      const refOrigEdge = constraint.isMilestone ? origStart : origEnd
      const checkResizeEdgeMs = constraint.isMilestone
        ? new Date(detail.start).getTime()
        : new Date(detail.end).getTime()
      const isViolating = isMoveOperation
        ? this.host.getDateX(refOrigEdge) + (detail.dx ?? 0) > this.host.getDateX(boundaryDate) + 0.5
        : checkResizeEdgeMs > boundaryDate.getTime()
      this.activeState = {
        fnlt: {
          type: 'FNLT',
          boundaryDate,
          labelText: buildConstraintBadgeText(
            constraint,
            boundaryDate,
            this.host.option,
            false,
            isViolating,
          ),
          isViolating,
        },
      }
    }

    this.attachGlobalSafetyListeners()
    this.syncDOM()
  }

  private applyBoundaryStyles(
    shadeEl: HTMLDivElement,
    lineEl: HTMLDivElement,
    badgeEl: HTMLDivElement,
    boundary: ActiveConstraintBoundary | undefined,
    ctx: {
      theme: 'light' | 'dark'
      contentWidth: number
      totalHeight: number
      rowHeaderWidth: number
      viewportWidth: number
      scrollLeft: number
      scrollTop: number
    },
    badgeVerticalOffsetPx: number,
  ): void {
    const overlayHeight = Math.max(0, ctx.totalHeight)
    if (!boundary || overlayHeight <= 0) {
      shadeEl.style.display = 'none'
      lineEl.style.display = 'none'
      badgeEl.style.display = 'none'
      delete shadeEl.dataset.violating
      delete lineEl.dataset.violating
      delete badgeEl.dataset.violating
      return
    }

    const isDark = ctx.theme === 'dark'
    const isViolating = boundary.isViolating
    const violatingAttr = isViolating ? 'true' : 'false'
    const timelineViewportWidth = Math.max(0, ctx.viewportWidth - ctx.rowHeaderWidth)
    const viewLeft = ctx.scrollLeft
    const viewRight = ctx.scrollLeft + timelineViewportWidth
    const renderClipMinX = Math.max(0, viewLeft - 400)
    const renderClipMaxX = Math.min(ctx.contentWidth, viewRight + 400)

    const rawBoundaryX = this.host.getDateX(boundary.boundaryDate)
    const clampedLineX = Math.max(0, Math.min(ctx.contentWidth, rawBoundaryX))

    // シェード範囲計算（SNET: 0 .. boundaryX, FNLT: boundaryX .. contentWidth）
    const rawShadeStart = boundary.type === 'SNET' ? 0 : clampedLineX
    const rawShadeEnd = boundary.type === 'SNET' ? clampedLineX : ctx.contentWidth
    const shadeLeft = Math.max(rawShadeStart, renderClipMinX)
    const shadeRight = Math.min(rawShadeEnd, renderClipMaxX)
    const shadeWidth = Math.max(0, shadeRight - shadeLeft)

    if (shadeWidth > 0) {
      const baseBg = isViolating
        ? isDark
          ? 'rgba(69, 10, 10, 0.50)'
          : 'rgba(220, 38, 38, 0.14)'
        : isDark
          ? 'rgba(2, 6, 23, 0.48)'
          : 'rgba(15, 23, 42, 0.20)'
      const stripeColor = isViolating
        ? isDark
          ? 'rgba(248, 113, 113, 0.16)'
          : 'rgba(220, 38, 38, 0.11)'
        : isDark
          ? 'rgba(148, 163, 184, 0.11)'
          : 'rgba(15, 23, 42, 0.08)'

      shadeEl.dataset.violating = violatingAttr
      shadeEl.style.display = 'block'
      shadeEl.style.left = `${shadeLeft}px`
      shadeEl.style.width = `${shadeWidth}px`
      shadeEl.style.height = `${overlayHeight}px`
      shadeEl.style.backgroundColor = baseBg
      shadeEl.style.backgroundImage = `repeating-linear-gradient(-45deg, ${stripeColor} 0px, ${stripeColor} 6px, transparent 6px, transparent 14px)`
    } else {
      shadeEl.style.display = 'none'
      delete shadeEl.dataset.violating
    }

    // 境界ライン（画面付近にある場合のみ表示）
    if (rawBoundaryX >= renderClipMinX && rawBoundaryX <= renderClipMaxX) {
      const lineColor = isViolating ? '#ef4444' : '#3b82f6'
      lineEl.dataset.violating = violatingAttr
      lineEl.style.display = 'block'
      lineEl.style.left = `${clampedLineX}px`
      lineEl.style.height = `${overlayHeight}px`
      lineEl.style.borderLeft = isViolating ? `2px solid ${lineColor}` : `2px dashed ${lineColor}`
      lineEl.style.boxShadow = isViolating ? '0 0 8px rgba(239, 68, 68, 0.65)' : 'none'
    } else {
      lineEl.style.display = 'none'
      delete lineEl.dataset.violating
    }

    // ラベルバッジ（境界線またはシェード領域が可視範囲にかかっている場合に表示）
    const isRegionVisible =
      (rawBoundaryX >= viewLeft - 20 && rawBoundaryX <= viewRight + 20) ||
      (rawShadeEnd > viewLeft && rawShadeStart < viewRight)

    if (isRegionVisible && timelineViewportWidth > 80) {
      badgeEl.dataset.violating = violatingAttr
      badgeEl.style.display = 'block'
      badgeEl.textContent = boundary.labelText
      if (isViolating) {
        badgeEl.style.backgroundColor = '#dc2626'
        badgeEl.style.color = '#ffffff'
        badgeEl.style.border = '1px solid rgba(255, 255, 255, 0.35)'
      } else {
        badgeEl.style.backgroundColor = isDark
          ? 'rgba(30, 58, 138, 0.94)'
          : 'rgba(37, 99, 235, 0.94)'
        badgeEl.style.color = '#ffffff'
        badgeEl.style.border = '1px solid rgba(147, 197, 253, 0.45)'
      }

      const maxBadgeTop = Math.max(4, overlayHeight - 26)
      badgeEl.style.top = `${Math.max(4, Math.min(maxBadgeTop, ctx.scrollTop + badgeVerticalOffsetPx))}px`

      // 境界位置に寄せて配置し、タイムライン可視領域の左右端でクランプ
      const estimatedWidth = estimateBadgeWidth(boundary.labelText)
      const minBadgeLeft = viewLeft + 8
      const maxBadgeLeft = Math.max(minBadgeLeft, viewRight - estimatedWidth - 12)
      const preferredLeft =
        boundary.type === 'SNET'
          ? clampedLineX + 6
          : Math.max(0, clampedLineX - estimatedWidth - 6)
      const finalBadgeLeft = Math.max(minBadgeLeft, Math.min(maxBadgeLeft, preferredLeft))
      badgeEl.style.left = `${finalBadgeLeft}px`
    } else {
      badgeEl.style.display = 'none'
      delete badgeEl.dataset.violating
    }
  }

  /**
   * 現在のスクロール位置・ビューポート幅・テーマに合わせてガイドDOMを同期する
   */
  public syncDOM(): void {
    if (!this.activeState || !this.isGuideEnabled()) {
      this.hideAllElements()
      return
    }

    const containerLayer = this.host.shadowRoot?.querySelector(
      '.constraint-drag-guide-layer',
    ) as HTMLElement | null
    if (!containerLayer) return

    this.ensureDOMElements(containerLayer)
    if (
      !this.snetShadeEl ||
      !this.snetLineEl ||
      !this.snetBadgeEl ||
      !this.fnltShadeEl ||
      !this.fnltLineEl ||
      !this.fnltBadgeEl
    ) {
      return
    }

    const scrollContainer = this.host.shadowRoot?.querySelector(
      '.scroll-container',
    ) as HTMLElement | null
    const contentWidth = Math.max(0, this.host.getDateX(this.host.option.calendar.end))
    const { totalHeight } = this.host.calculateLayout()
    const rowHeaderWidth = this.host.currentRowHeaderWidth
    const scrollLeft = scrollContainer?.scrollLeft ?? this.host.currentScrollLeft ?? 0
    const scrollTop = scrollContainer?.scrollTop ?? this.host.currentScrollTop ?? 0
    const viewportWidth = scrollContainer?.clientWidth || this.host.viewportWidth || 800

    const ctx = {
      theme: this.host.theme,
      contentWidth,
      totalHeight,
      rowHeaderWidth,
      viewportWidth,
      scrollLeft,
      scrollTop,
    }

    this.applyBoundaryStyles(
      this.snetShadeEl,
      this.snetLineEl,
      this.snetBadgeEl,
      this.activeState.snet,
      ctx,
      8,
    )
    const fnltOffset = this.activeState.snet ? 36 : 8
    this.applyBoundaryStyles(
      this.fnltShadeEl,
      this.fnltLineEl,
      this.fnltBadgeEl,
      this.activeState.fnlt,
      ctx,
      fnltOffset,
    )
  }
}

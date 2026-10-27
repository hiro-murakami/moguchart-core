import type {
  AutoScheduleCalendarMode,
  AutoScheduleMode,
  DependencyEndpoint,
  DependencyType,
  GanttDependency,
  GanttDependencyLink,
  GanttNonWorkingDateInput,
  GanttRow,
  GanttTask,
} from './types'

/**
 * 自動スケジューリングおよび稼働日計算オプション
 */
export interface AutoScheduleOptions {
  /**
   * スケジュール制約モード (デフォルト: 'push-only')
   * - 'push-only': 先行タスクとの依存制約（＋ラグ）に違反する場合のみ後続タスクを後ろへ押し出す
   * - 'strict': 先行タスクの位置（＋ラグ）に合わせて後続タスクを常に厳密に追従させる
   */
  mode?: AutoScheduleMode
  /**
   * タスクの movable 設定 ('none' | 'y') を尊重して自動移動対象から除外するか (デフォルト: true)
   */
  respectMovable?: boolean
  /**
   * 稼働日（休日除外）計算モード (デフォルト: 'calendar')
   * - 'calendar': カレンダー通り（土日・祝日を含めて計算）
   * - 'weekends': 営業日ベース（非営業曜日・カスタム休日を除外）
   * - 'weekends-holidays': 営業日ベース（非営業曜日・カスタム休日および祝日を除外）
   */
  calendarMode?: AutoScheduleCalendarMode
  /**
   * 祝日判定関数 ('weekends-holidays' モード時に使用)
   */
  isHoliday?: (date: Date) => boolean
  /**
   * 非営業日とする曜日配列 (0=日曜, 1=月曜, ..., 6=土曜。デフォルト: [0, 6])
   */
  nonWorkingDays?: number[]
  /**
   * 日付単位のカスタム休日（単一日または期間）の配列
   */
  nonWorkingDates?: GanttNonWorkingDateInput[]
}

/**
 * 自動スケジューリング計算結果
 */
export interface AutoScheduleResult {
  /** 更新後の行配列（変更がない場合は元の参照を維持） */
  rows: GanttRow[]
  /** 自動スケジューリングによって日時が更新されたタスクIDの配列 */
  updatedTaskIds: string[]
  /** 1つ以上のタスクが更新されたかどうか */
  hasChanges: boolean
}

/**
 * 依存関係要素（文字列またはオブジェクト）から先行タスクIDを取得する
 */
export function getDependencyTaskId(dep: GanttDependency): string {
  return typeof dep === 'string' ? dep : dep.taskId
}

/**
 * 依存関係要素を正規化された GanttDependencyLink オブジェクトに変換する
 */
export function normalizeDependencyLink(dep: GanttDependency): Required<GanttDependencyLink> {
  if (typeof dep === 'string') {
    return {
      taskId: dep,
      type: 'FS',
      lag: 0,
    }
  }
  return {
    taskId: dep.taskId,
    type: dep.type ?? 'FS',
    lag: typeof dep.lag === 'number' && !Number.isNaN(dep.lag) ? dep.lag : 0,
  }
}

/**
 * 接続元・接続先のエンドポイントから依存関係タイプ ('FS' | 'SS' | 'FF' | 'SF') を判定する
 */
export function endpointsToDependencyType(
  sourceEndpoint?: DependencyEndpoint | string | null,
  targetEndpoint?: DependencyEndpoint | string | null,
): DependencyType {
  const src = sourceEndpoint === 'start' || sourceEndpoint === 'left' ? 'start' : 'end'
  const tgt = targetEndpoint === 'end' || targetEndpoint === 'right' ? 'end' : 'start'

  if (src === 'start' && tgt === 'start') return 'SS'
  if (src === 'end' && tgt === 'end') return 'FF'
  if (src === 'start' && tgt === 'end') return 'SF'
  return 'FS'
}

/**
 * 依存関係タイプ ('FS' | 'SS' | 'FF' | 'SF') から接続元・接続先のエンドポイントを取得する
 */
export function dependencyTypeToEndpoints(type?: DependencyType): {
  sourceEndpoint: DependencyEndpoint
  targetEndpoint: DependencyEndpoint
} {
  switch (type) {
    case 'SS':
      return { sourceEndpoint: 'start', targetEndpoint: 'start' }
    case 'FF':
      return { sourceEndpoint: 'end', targetEndpoint: 'end' }
    case 'SF':
      return { sourceEndpoint: 'start', targetEndpoint: 'end' }
    case 'FS':
    default:
      return { sourceEndpoint: 'end', targetEndpoint: 'start' }
  }
}

/**
 * 後方互換性を保ちつつ依存関係エントリを生成する。
 * 標準の 'FS' かつ lag === 0 の場合はシンプルなタスクID文字列を返し、
 * それ以外（'SS', 'FF', 'SF' または lag 指定あり）の場合は GanttDependencyLink オブジェクトを返す。
 */
export function createDependencyEntry(
  sourceTaskId: string,
  type: DependencyType = 'FS',
  lag = 0,
): GanttDependency {
  if (type === 'FS' && (!lag || lag === 0)) {
    return sourceTaskId
  }
  const link: GanttDependencyLink = {
    taskId: sourceTaskId,
    type,
  }
  if (lag && lag !== 0) {
    link.lag = lag
  }
  return link
}

/**
 * 依存関係配列の中に指定した先行タスクIDが含まれているか判定する
 */
export function hasDependencyTarget(
  dependencies: GanttDependency[] | undefined,
  sourceTaskId: string,
): boolean {
  if (!dependencies || dependencies.length === 0) return false
  return dependencies.some((dep) => getDependencyTaskId(dep) === sourceTaskId)
}

/**
 * 依存関係配列から指定した先行タスクIDを除外した新しい配列を返す
 */
export function removeDependencyTarget(
  dependencies: GanttDependency[] | undefined,
  sourceTaskId: string,
): GanttDependency[] {
  if (!dependencies) return []
  return dependencies.filter((dep) => getDependencyTaskId(dep) !== sourceTaskId)
}

/**
 * ローカルタイムゾーンにおけるその日の開始時刻 (00:00:00.000) のミリ秒を取得する
 */
function getStartOfDayMs(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/**
 * ローカルタイムゾーンにおける翌日の開始時刻 (00:00:00.000) のミリ秒を取得する
 */
function getStartOfNextDayMs(dayStartMs: number): number {
  const d = new Date(dayStartMs)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 1)
  return d.getTime()
}

/**
 * ローカルタイムゾーンにおける前日の開始時刻 (00:00:00.000) のミリ秒を取得する
 */
function getStartOfPrevDayMs(dayStartMs: number): number {
  const d = new Date(dayStartMs)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - 1)
  return d.getTime()
}

/**
 * Date オブジェクトまたは日付文字列 ('YYYY-MM-DD' / 'YYYY/MM/DD') を
 * ローカルタイムゾーンの 00:00:00.000 のミリ秒に変換する
 */
export function parseLocalDateToStartOfDayMs(input: Date | string | undefined | null): number | null {
  if (!input) return null
  if (input instanceof Date) {
    const t = input.getTime()
    if (Number.isNaN(t)) return null
    const d = new Date(t)
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }
  if (typeof input === 'string') {
    const trimmed = input.trim()
    const match = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
    if (match) {
      const year = Number(match[1])
      const month = Number(match[2]) - 1
      const day = Number(match[3])
      const d = new Date(year, month, day, 0, 0, 0, 0)
      if (!Number.isNaN(d.getTime())) {
        return d.getTime()
      }
    }
    const parsed = new Date(trimmed)
    if (!Number.isNaN(parsed.getTime())) {
      parsed.setHours(0, 0, 0, 0)
      return parsed.getTime()
    }
  }
  return null
}

export interface NormalizedNonWorkingDateMeta {
  name?: string
  color?: string
}

export interface NormalizedNonWorkingDates {
  singleDates: Map<number, NormalizedNonWorkingDateMeta>
  ranges: Array<{
    startMs: number
    endMs: number
    name?: string
    color?: string
  }>
}

/**
 * nonWorkingDates 配列を高速判定用のデータ構造に正規化する
 */
export function normalizeNonWorkingDates(
  inputs?: GanttNonWorkingDateInput[],
): NormalizedNonWorkingDates {
  const singleDates = new Map<number, NormalizedNonWorkingDateMeta>()
  const ranges: Array<{ startMs: number; endMs: number; name?: string; color?: string }> = []

  if (!Array.isArray(inputs) || inputs.length === 0) {
    return { singleDates, ranges }
  }

  for (const item of inputs) {
    if (!item) continue
    if (item instanceof Date || typeof item === 'string') {
      const ms = parseLocalDateToStartOfDayMs(item)
      if (ms !== null && !singleDates.has(ms)) {
        singleDates.set(ms, {})
      }
      continue
    }
    if (typeof item === 'object') {
      if (item.date !== undefined) {
        const ms = parseLocalDateToStartOfDayMs(item.date)
        if (ms !== null) {
          singleDates.set(ms, { name: item.name, color: item.color })
        }
      }
      if (item.start !== undefined || item.end !== undefined) {
        const sMs = item.start !== undefined ? parseLocalDateToStartOfDayMs(item.start) : null
        const eMs = item.end !== undefined ? parseLocalDateToStartOfDayMs(item.end) : null
        if (sMs !== null && eMs !== null) {
          ranges.push({
            startMs: Math.min(sMs, eMs),
            endMs: Math.max(sMs, eMs),
            name: item.name,
            color: item.color,
          })
        } else if (sMs !== null) {
          singleDates.set(sMs, { name: item.name, color: item.color })
        } else if (eMs !== null) {
          singleDates.set(eMs, { name: item.name, color: item.color })
        }
      }
    }
  }

  return { singleDates, ranges }
}

/**
 * 指定日の 00:00:00 ミリ秒が正規化済み nonWorkingDates に一致するか判定し、メタ情報を返す
 */
export function matchNonWorkingDateEntry(
  dayStartMs: number,
  normalized: NormalizedNonWorkingDates,
): NormalizedNonWorkingDateMeta | null {
  const targetMs = getStartOfDayMs(dayStartMs)
  const single = normalized.singleDates.get(targetMs)
  if (single) return single
  for (const r of normalized.ranges) {
    if (targetMs >= r.startMs && targetMs <= r.endMs) {
      return { name: r.name, color: r.color }
    }
  }
  return null
}

export interface CustomHolidayResolverOptions {
  isHoliday?: (date: Date) => boolean
  nonWorkingDays?: number[]
  nonWorkingDates?: GanttNonWorkingDateInput[]
}

export interface CustomHolidayResolver {
  /** 指定日が nonWorkingDates または isHoliday に該当するかどうか */
  isHolidayDate: (date: Date) => boolean
  /** 指定日が nonWorkingDates に該当するか（メタ情報付き） */
  getCustomDateMeta: (date: Date) => NormalizedNonWorkingDateMeta | null
  /** 指定日の曜日が nonWorkingDays (未指定時は [0, 6]) に含まれるかどうか */
  isNonWorkingDayOfWeek: (date: Date) => boolean
  /** カスタム nonWorkingDays が明示指定されているかどうか */
  hasCustomNonWorkingDays: boolean
}

/**
 * カレンダー描画・行背景・稼働日計算で共通利用する休日リゾルバーを生成する
 */
export function createCustomHolidayResolver(
  options?: CustomHolidayResolverOptions,
): CustomHolidayResolver {
  const hasCustomNonWorkingDays = Array.isArray(options?.nonWorkingDays)
  const restDaysSet = new Set<number>(hasCustomNonWorkingDays ? options!.nonWorkingDays! : [0, 6])
  const normalizedDates = normalizeNonWorkingDates(options?.nonWorkingDates)
  const hasCustomDates =
    normalizedDates.singleDates.size > 0 || normalizedDates.ranges.length > 0
  const isHolidayFn = options?.isHoliday

  const getCustomDateMeta = (date: Date): NormalizedNonWorkingDateMeta | null => {
    if (!hasCustomDates) return null
    return matchNonWorkingDateEntry(date.getTime(), normalizedDates)
  }

  const isHolidayDate = (date: Date): boolean => {
    if (hasCustomDates && matchNonWorkingDateEntry(date.getTime(), normalizedDates) !== null) {
      return true
    }
    return isHolidayFn ? !!isHolidayFn(date) : false
  }

  const isNonWorkingDayOfWeek = (date: Date): boolean => {
    return restDaysSet.has(date.getDay())
  }

  return {
    isHolidayDate,
    getCustomDateMeta,
    isNonWorkingDayOfWeek,
    hasCustomNonWorkingDays,
  }
}

/**
 * 稼働日計算モードと祝日・カスタム休日設定から、非営業日判定関数を生成する
 * ('calendar' の場合は null を返す)
 */
export function createNonWorkingDayChecker(
  calendarMode: AutoScheduleCalendarMode = 'calendar',
  isHoliday?: (date: Date) => boolean,
  nonWorkingDays?: number[],
  nonWorkingDates?: GanttNonWorkingDateInput[],
): ((dayStartMs: number) => boolean) | null {
  if (!calendarMode || calendarMode === 'calendar') return null
  const restDaysSet = new Set<number>(Array.isArray(nonWorkingDays) ? nonWorkingDays : [0, 6])
  const normalizedDates = normalizeNonWorkingDates(nonWorkingDates)
  const hasCustomDates =
    normalizedDates.singleDates.size > 0 || normalizedDates.ranges.length > 0

  return (dayStartMs: number): boolean => {
    const normalizedDayMs = getStartOfDayMs(dayStartMs)
    const d = new Date(normalizedDayMs)
    const dow = d.getDay()
    if (restDaysSet.has(dow)) return true
    if (hasCustomDates && matchNonWorkingDateEntry(normalizedDayMs, normalizedDates) !== null) {
      return true
    }
    if (calendarMode === 'weekends-holidays' && isHoliday) {
      return !!isHoliday(d)
    }
    return false
  }
}

const MS_PER_DAY = 1000 * 60 * 60 * 24

/**
 * 指定された期間 [start, end) に含まれる稼働日数（営業日数）を算出する公開ユーティリティ関数。
 * options.calendarMode が未指定の場合は、isHoliday の有無に応じて 'weekends-holidays' または 'weekends' として計算する。
 * options.calendarMode === 'calendar' が明示された場合は暦日数を返す。
 */
export function countWorkingDays(
  start: Date,
  end: Date,
  options?: AutoScheduleOptions,
): number {
  const startMs = start instanceof Date ? start.getTime() : new Date(start as any).getTime()
  const endMs = end instanceof Date ? end.getTime() : new Date(end as any).getTime()
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
    return 0
  }

  const effectiveMode: AutoScheduleCalendarMode =
    options?.calendarMode ?? (options?.isHoliday ? 'weekends-holidays' : 'weekends')

  if (effectiveMode === 'calendar') {
    return Math.max(1, Math.round((endMs - startMs) / MS_PER_DAY))
  }

  const isNonWorkingDay = createNonWorkingDayChecker(
    effectiveMode,
    options?.isHoliday,
    options?.nonWorkingDays,
    options?.nonWorkingDates,
  )
  if (!isNonWorkingDay) {
    return Math.max(1, Math.round((endMs - startMs) / MS_PER_DAY))
  }

  let workingMs = 0
  let dayStart = getStartOfDayMs(startMs)
  let guard = 0

  while (dayStart < endMs && guard < 10000) {
    guard++
    const dayEnd = getStartOfNextDayMs(dayStart)
    if (!isNonWorkingDay(dayStart)) {
      const segStart = Math.max(startMs, dayStart)
      const segEnd = Math.min(endMs, dayEnd)
      if (segEnd > segStart) {
        workingMs += segEnd - segStart
      }
    }
    dayStart = dayEnd
  }

  return Math.max(0, Math.round((workingMs / MS_PER_DAY) * 100) / 100)
}

/**
 * 開始日時から指定した稼働日数（workingDays）を進めた終了日時（または開始日時）を算出する公開ユーティリティ関数。
 * options.calendarMode が未指定の場合は、isHoliday の有無に応じて 'weekends-holidays' または 'weekends' として計算する。
 */
export function addWorkingDays(
  start: Date,
  workingDays: number,
  options?: AutoScheduleOptions,
): Date {
  const startMs = start instanceof Date ? start.getTime() : new Date(start as any).getTime()
  if (Number.isNaN(startMs) || workingDays === 0) {
    return new Date(startMs)
  }

  const effectiveMode: AutoScheduleCalendarMode =
    options?.calendarMode ?? (options?.isHoliday ? 'weekends-holidays' : 'weekends')

  const deltaMs = workingDays * MS_PER_DAY
  if (effectiveMode === 'calendar') {
    return new Date(startMs + deltaMs)
  }

  const isNonWorkingDay = createNonWorkingDayChecker(
    effectiveMode,
    options?.isHoliday,
    options?.nonWorkingDays,
    options?.nonWorkingDates,
  )
  if (!isNonWorkingDay) {
    return new Date(startMs + deltaMs)
  }

  return new Date(addWorkingTimeMs(startMs, deltaMs, isNonWorkingDay))
}

/**
 * 指定された期間 [startMs, endMs] に含まれる営業日ベースの所要時間（ミリ秒）を算出する。
 * タスク全体が非営業日のみに配置されていた場合は、期間が0に潰れるのを防ぐため暦日期間を返す。
 */
export function computeWorkingDurationMs(
  startMs: number,
  endMs: number,
  isNonWorkingDay: (dayStartMs: number) => boolean,
): number {
  if (endMs <= startMs) return 0

  let workingMs = 0
  let dayStart = getStartOfDayMs(startMs)
  let guard = 0

  while (dayStart < endMs && guard < 10000) {
    guard++
    const dayEnd = getStartOfNextDayMs(dayStart)
    if (!isNonWorkingDay(dayStart)) {
      const segStart = Math.max(startMs, dayStart)
      const segEnd = Math.min(endMs, dayEnd)
      if (segEnd > segStart) {
        workingMs += segEnd - segStart
      }
    }
    dayStart = dayEnd
  }

  if (workingMs === 0 && endMs > startMs) {
    return endMs - startMs
  }
  return workingMs
}

/**
 * 指定時刻が非営業日に該当する場合、翌営業日の開始時刻 (00:00:00) へ進める
 */
export function snapToWorkingStartMs(
  ms: number,
  isNonWorkingDay: (dayStartMs: number) => boolean,
): number {
  let cursor = ms
  let dayStart = getStartOfDayMs(cursor)
  let guard = 0
  while (isNonWorkingDay(dayStart) && guard < 3660) {
    guard++
    dayStart = getStartOfNextDayMs(dayStart)
    cursor = dayStart
  }
  return cursor
}

/**
 * 基準時刻から営業日ベースで指定ミリ秒（正: 未来方向 / 負: 過去方向）を進めた時刻を算出する
 */
export function addWorkingTimeMs(
  anchorMs: number,
  deltaMs: number,
  isNonWorkingDay: (dayStartMs: number) => boolean,
): number {
  if (deltaMs === 0) return anchorMs

  if (deltaMs > 0) {
    let cursor = snapToWorkingStartMs(anchorMs, isNonWorkingDay)
    let remaining = deltaMs
    let guard = 0

    while (remaining > 0 && guard < 10000) {
      guard++
      const dayStart = getStartOfDayMs(cursor)
      const dayEnd = getStartOfNextDayMs(dayStart)
      if (!isNonWorkingDay(dayStart)) {
        const avail = dayEnd - cursor
        if (remaining <= avail) {
          return cursor + remaining
        }
        remaining -= avail
      }
      cursor = dayEnd
    }
    return cursor
  }

  // deltaMs < 0: 過去方向へ営業時間を遡る
  let cursor = anchorMs
  let remaining = -deltaMs
  let guard = 0

  while (remaining > 0 && guard < 10000) {
    guard++
    const dayStart = getStartOfDayMs(cursor)
    if (cursor > dayStart) {
      if (!isNonWorkingDay(dayStart)) {
        const avail = cursor - dayStart
        if (remaining <= avail) {
          return cursor - remaining
        }
        remaining -= avail
      }
      cursor = dayStart
    } else {
      const prevDayStart = getStartOfPrevDayMs(dayStart)
      if (!isNonWorkingDay(prevDayStart)) {
        const avail = dayStart - prevDayStart
        if (remaining <= avail) {
          return dayStart - remaining
        }
        remaining -= avail
      }
      cursor = prevDayStart
    }
  }
  return cursor
}

/**
 * 単一の先行タスク制約に基づき、後続タスクに要求される開始時刻（ミリ秒）を計算する
 */
export function computeRequiredStartMs(
  predStartMs: number,
  predEndMs: number,
  succDurationMs: number,
  type: DependencyType = 'FS',
  lagMinutes = 0,
  isNonWorkingDay?: ((dayStartMs: number) => boolean) | null,
): number {
  const lagMs = lagMinutes * 60 * 1000
  if (!isNonWorkingDay) {
    switch (type) {
      case 'SS':
        return predStartMs + lagMs
      case 'FF':
        return predEndMs + lagMs - succDurationMs
      case 'SF':
        return predStartMs + lagMs - succDurationMs
      case 'FS':
      default:
        return predEndMs + lagMs
    }
  }

  switch (type) {
    case 'SS': {
      const afterLag = addWorkingTimeMs(predStartMs, lagMs, isNonWorkingDay)
      return snapToWorkingStartMs(afterLag, isNonWorkingDay)
    }
    case 'FF': {
      const reqEndMs = addWorkingTimeMs(predEndMs, lagMs, isNonWorkingDay)
      if (succDurationMs <= 0) {
        return snapToWorkingStartMs(reqEndMs, isNonWorkingDay)
      }
      const candidateStartMs = addWorkingTimeMs(reqEndMs, -succDurationMs, isNonWorkingDay)
      const candidateEndMs = addWorkingTimeMs(candidateStartMs, succDurationMs, isNonWorkingDay)
      if (candidateEndMs < reqEndMs) {
        return snapToWorkingStartMs(reqEndMs, isNonWorkingDay)
      }
      return candidateStartMs
    }
    case 'SF': {
      const reqEndMs = addWorkingTimeMs(predStartMs, lagMs, isNonWorkingDay)
      if (succDurationMs <= 0) {
        return snapToWorkingStartMs(reqEndMs, isNonWorkingDay)
      }
      const candidateStartMs = addWorkingTimeMs(reqEndMs, -succDurationMs, isNonWorkingDay)
      const candidateEndMs = addWorkingTimeMs(candidateStartMs, succDurationMs, isNonWorkingDay)
      if (candidateEndMs < reqEndMs) {
        return snapToWorkingStartMs(reqEndMs, isNonWorkingDay)
      }
      return candidateStartMs
    }
    case 'FS':
    default: {
      const afterLag = addWorkingTimeMs(predEndMs, lagMs, isNonWorkingDay)
      return snapToWorkingStartMs(afterLag, isNonWorkingDay)
    }
  }
}

/**
 * 先行タスクの変更に伴い、依存関係を持つ後続タスクの日程をトポロジカルソート順でカスケード更新する。
 *
 * @param rows 全行データ
 * @param changedTaskIds 変更の起点となったタスクIDの配列または集合（省略時は依存関係を持つ全タスクを対象にスケジュール計算）
 * @param options 自動スケジューリング設定
 */
export function propagateAutoSchedule(
  rows: GanttRow[],
  changedTaskIds?: Iterable<string>,
  options: AutoScheduleOptions = {},
): AutoScheduleResult {
  const mode: AutoScheduleMode = options.mode ?? 'push-only'
  const respectMovable = options.respectMovable !== false
  const isNonWorkingDay = createNonWorkingDayChecker(
    options.calendarMode,
    options.isHoliday,
    options.nonWorkingDays,
    options.nonWorkingDates,
  )

  // 1. 全通常タスクのマップと依存グラフを構築
  const taskMap = new Map<
    string,
    {
      task: GanttTask
      startMs: number
      endMs: number
      durationMs: number
      workingDurationMs: number
      links: Required<GanttDependencyLink>[]
    }
  >()
  const successors = new Map<string, string[]>()

  for (const row of rows) {
    for (const task of row.tasks ?? []) {
      if (task.type === 'summary' || (task as any).isSummary) continue
      const startMs = task.start instanceof Date ? task.start.getTime() : new Date(task.start as any).getTime()
      const endMs = task.end instanceof Date ? task.end.getTime() : new Date(task.end as any).getTime()
      if (Number.isNaN(startMs) || Number.isNaN(endMs)) continue

      const durationMs = Math.max(0, endMs - startMs)
      const workingDurationMs = isNonWorkingDay
        ? computeWorkingDurationMs(startMs, endMs, isNonWorkingDay)
        : durationMs
      const links = (task.dependencies ?? []).map(normalizeDependencyLink)
      taskMap.set(task.id, {
        task,
        startMs,
        endMs,
        durationMs,
        workingDurationMs,
        links,
      })
    }
  }

  if (taskMap.size < 2) {
    return { rows, updatedTaskIds: [], hasChanges: false }
  }

  // 有効な先行タスクからのみ successors を構築
  for (const [taskId, entry] of taskMap) {
    const validLinks = entry.links.filter((l) => l.taskId !== taskId && taskMap.has(l.taskId))
    entry.links = validLinks
    for (const link of validLinks) {
      const list = successors.get(link.taskId) ?? []
      if (!list.includes(taskId)) {
        list.push(taskId)
        successors.set(link.taskId, list)
      }
    }
  }

  // 2. 更新対象となる下流タスク集合 (downstreamSet) を特定
  const changedSet = changedTaskIds ? new Set(changedTaskIds) : null
  const downstreamSet = new Set<string>()

  if (changedSet && changedSet.size > 0) {
    const bfsQueue: string[] = []
    for (const id of changedSet) {
      if (taskMap.has(id)) {
        bfsQueue.push(id)
      }
    }
    while (bfsQueue.length > 0) {
      const currentId = bfsQueue.shift()!
      for (const succId of successors.get(currentId) ?? []) {
        if (changedSet.has(succId)) continue
        if (!downstreamSet.has(succId)) {
          downstreamSet.add(succId)
          bfsQueue.push(succId)
        }
      }
    }
  } else {
    // 起点指定なしの場合は、有効な先行タスクを持つすべてのタスクを対象とする
    for (const [taskId, entry] of taskMap) {
      if (entry.links.length > 0) {
        downstreamSet.add(taskId)
      }
    }
  }

  if (downstreamSet.size === 0) {
    return { rows, updatedTaskIds: [], hasChanges: false }
  }

  // 3. downstreamSet 内のトポロジカルソート（Kahnのアルゴリズム）
  const inDegree = new Map<string, number>()
  for (const id of downstreamSet) {
    const entry = taskMap.get(id)!
    let deg = 0
    const seenPreds = new Set<string>()
    for (const link of entry.links) {
      if (downstreamSet.has(link.taskId) && !seenPreds.has(link.taskId)) {
        seenPreds.add(link.taskId)
        deg++
      }
    }
    inDegree.set(id, deg)
  }

  const queue: string[] = []
  for (const [id, deg] of inDegree) {
    if (deg === 0) {
      queue.push(id)
    }
  }

  const topoOrder: string[] = []
  while (queue.length > 0) {
    const currentId = queue.shift()!
    topoOrder.push(currentId)
    for (const succId of successors.get(currentId) ?? []) {
      if (!downstreamSet.has(succId)) continue
      const nextDeg = (inDegree.get(succId) ?? 0) - 1
      inDegree.set(succId, nextDeg)
      if (nextDeg === 0) {
        queue.push(succId)
      }
    }
  }

  // 4. トポロジカル順に各後続タスクの新しい開始・終了時刻を算出
  const updatedDates = new Map<string, { start: Date; end: Date }>()

  for (const taskId of topoOrder) {
    const entry = taskMap.get(taskId)
    if (!entry || entry.links.length === 0) continue

    // movable 設定のチェック
    if (
      respectMovable &&
      (entry.task.movable === 'none' || entry.task.movable === 'y' || (entry.task.movable as any) === false)
    ) {
      continue
    }

    const effectiveDurationMs = isNonWorkingDay ? entry.workingDurationMs : entry.durationMs

    let maxRequiredStartMs = -Infinity
    for (const link of entry.links) {
      const pred = taskMap.get(link.taskId)
      if (!pred) continue
      const reqStartMs = computeRequiredStartMs(
        pred.startMs,
        pred.endMs,
        effectiveDurationMs,
        link.type,
        link.lag,
        isNonWorkingDay,
      )
      if (reqStartMs > maxRequiredStartMs) {
        maxRequiredStartMs = reqStartMs
      }
    }

    if (maxRequiredStartMs === -Infinity) continue

    const rawTargetStartMs =
      mode === 'strict' ? maxRequiredStartMs : Math.max(entry.startMs, maxRequiredStartMs)

    if (!isNonWorkingDay) {
      if (rawTargetStartMs !== entry.startMs) {
        const targetEndMs = rawTargetStartMs + entry.durationMs
        entry.startMs = rawTargetStartMs
        entry.endMs = targetEndMs
        updatedDates.set(taskId, {
          start: new Date(rawTargetStartMs),
          end: new Date(targetEndMs),
        })
      }
    } else if (mode === 'strict' || rawTargetStartMs > entry.startMs) {
      const targetStartMs = snapToWorkingStartMs(rawTargetStartMs, isNonWorkingDay)
      const targetEndMs =
        effectiveDurationMs > 0
          ? addWorkingTimeMs(targetStartMs, effectiveDurationMs, isNonWorkingDay)
          : targetStartMs
      if (targetStartMs !== entry.startMs || targetEndMs !== entry.endMs) {
        entry.startMs = targetStartMs
        entry.endMs = targetEndMs
        updatedDates.set(taskId, {
          start: new Date(targetStartMs),
          end: new Date(targetEndMs),
        })
      }
    }
  }

  if (updatedDates.size === 0) {
    return { rows, updatedTaskIds: [], hasChanges: false }
  }

  // 5. 変更があったタスクを含む行のみイミュータブルに更新
  const nextRows = rows.map((row) => {
    const hasUpdatedTask = (row.tasks ?? []).some((t) => updatedDates.has(t.id))
    if (!hasUpdatedTask) return row
    return {
      ...row,
      tasks: row.tasks.map((t) => {
        const updated = updatedDates.get(t.id)
        if (!updated) return t
        return {
          ...t,
          start: updated.start,
          end: updated.end,
        }
      }),
    }
  })

  return {
    rows: nextRows,
    updatedTaskIds: [...updatedDates.keys()],
    hasChanges: true,
  }
}

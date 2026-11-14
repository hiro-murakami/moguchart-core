import {
  normalizeDependencyLink,
  resolveHolidayMeta,
} from './auto-schedule'
import type {
  GanttHolidayChecker,
  GanttRow,
  GanttTask,
  TaskWithLane,
  ThemeColorPalette,
} from './types'
import type { MoguchartLocale } from './i18n'
import { jaLocale } from './i18n'
import { THEME_COLORS } from './theme'

/**
 * 指定されたタスクがマイルストーンタスク (type === 'milestone') かどうかを判定します。
 */
export function isMilestoneTask(task?: GanttTask | null): boolean {
  return task?.type === 'milestone'
}

/**
 * 指定された日付のチャート上のX座標（ピクセル）を計算します。
 * @param date 対象の日付
 * @param startDate チャートの開始日
 * @param pxPerDay 1日あたりのピクセル幅
 * @returns 開始日からのピクセル距離
 */
export const dateToX = (date: Date, startDate: Date, pxPerDay: number, pxPerMonth?: number) => {
  if (pxPerMonth !== undefined) {
    const startY = startDate.getFullYear()
    const startM = startDate.getMonth()
    const targetY = date.getFullYear()
    const targetM = date.getMonth()

    const monthDiff = (targetY - startY) * 12 + (targetM - startM)

    const daysInStartMonth = new Date(startY, startM + 1, 0).getDate()
    const startFraction =
      (startDate.getDate() - 1 + startDate.getHours() / 24 + startDate.getMinutes() / 1440) / daysInStartMonth

    const daysInTargetMonth = new Date(targetY, targetM + 1, 0).getDate()
    const targetFraction =
      (date.getDate() - 1 + date.getHours() / 24 + date.getMinutes() / 1440) / daysInTargetMonth

    return (monthDiff + targetFraction - startFraction) * pxPerMonth
  }

  const diffTime = date.getTime() - startDate.getTime()
  const diffDays = diffTime / (1000 * 60 * 60 * 24)
  return diffDays * pxPerDay
}

/**
 * チャート上のX座標から日付を計算します。
 * @param x チャートのX座標（ピクセル）
 * @param startDate チャートの開始日
 * @param pxPerDay 1日あたりのピクセル幅
 * @param pxPerMonth 月あたりのピクセル幅（指定された場合、月単位の等幅表示になる）
 * @returns 座標に対応する日付
 */
export const xToDate = (x: number, startDate: Date, pxPerDay: number, pxPerMonth?: number): Date => {
  if (pxPerMonth !== undefined) {
    const startY = startDate.getFullYear()
    const startM = startDate.getMonth()
    const daysInStartMonth = new Date(startY, startM + 1, 0).getDate()
    const startFraction =
      (startDate.getDate() - 1 + startDate.getHours() / 24 + startDate.getMinutes() / 1440) / daysInStartMonth

    const totalMonthFraction = x / pxPerMonth + startFraction

    let targetM = startM + Math.floor(totalMonthFraction)
    let targetY = startY + Math.floor(targetM / 12)
    targetM = targetM % 12
    if (targetM < 0) {
      targetM += 12
      targetY -= 1
    }

    const targetFraction = totalMonthFraction - Math.floor(totalMonthFraction)
    const daysInTargetMonth = new Date(targetY, targetM + 1, 0).getDate()

    const totalDays = targetFraction * daysInTargetMonth
    const day = 1 + Math.floor(totalDays)
    const totalHours = (totalDays - Math.floor(totalDays)) * 24
    const hours = Math.floor(totalHours)
    const minutes = Math.round((totalHours - hours) * 60)

    return new Date(targetY, targetM, day, hours, minutes)
  }

  const diffDays = x / pxPerDay
  return new Date(startDate.getTime() + diffDays * 24 * 60 * 60 * 1000)
}

/**
 * タスクの重なりを計算し、各タスクが表示されるべき「レーン（段）」を決定します。
 * @param tasks 同じ行にあるタスクの配列
 * @returns レーン番号が追加されたタスクの配列と、その行で必要なレーンの総数
 */
export function calculateTaskLanes(tasks: GanttTask[]): {
  tasksWithLanes: TaskWithLane[]
  laneCount: number
} {
  if (!tasks.length) {
    return { tasksWithLanes: [], laneCount: 1 }
  }

  const rowTaskMap = new Map<string, GanttTask>()
  for (const t of tasks) {
    rowTaskMap.set(t.id, t)
  }

  // 同一行の先行タスクと FS かつ lag === 0 で接続されており、
  // かつ先行タスクの終了日時と後続タスクの開始日時が接している（隙間がない）場合、
  // 同じレーンに配置すると接続線の長さが 0 になり選択できなくなるため、別レーンに配置する。
  const getBlockedLanes = (
    task: GanttTask,
    assignedRelativeLaneMap: Map<string, number>,
  ): Set<number> => {
    const blocked = new Set<number>()
    if (!task.dependencies) return blocked
    for (const rawDep of task.dependencies) {
      const link = normalizeDependencyLink(rawDep)
      if (link.type === 'FS' && link.lag === 0) {
        const pred = rowTaskMap.get(link.taskId)
        const predLane = assignedRelativeLaneMap.get(link.taskId)
        if (pred && predLane !== undefined && task.start.getTime() <= pred.end.getTime()) {
          blocked.add(predLane)
        }
      }
    }
    return blocked
  }

  const summaryTasks = tasks.filter((t) => t.type === 'summary')
  const normalTasks = tasks.filter((t) => t.type !== 'summary')

  if (summaryTasks.length > 0) {
    // サマリータスクは最上段（レーン0）に配置
    const taskLaneMap = new Map<string, number>()
    for (const st of summaryTasks) {
      taskLaneMap.set(st.id, 0)
    }

    if (normalTasks.length === 0) {
      return {
        tasksWithLanes: tasks.map((task) => ({
          ...task,
          lane: taskLaneMap.get(task.id) ?? 0,
        })),
        laneCount: 1,
      }
    }

    // 通常タスクはレーン1以降に配置（通常タスク同士の重なり計算）
    const sortedNormalTasks = [...normalTasks].sort((a, b) => a.start.getTime() - b.start.getTime())
    const lanes: Date[] = []
    const laneLastWasPoint: boolean[] = []
    const normalRelativeLaneMap = new Map<string, number>()

    for (const task of sortedNormalTasks) {
      const blockedLanes = getBlockedLanes(task, normalRelativeLaneMap)
      const isPoint = isMilestoneTask(task) || task.end.getTime() <= task.start.getTime()
      let assignedLane = -1
      for (let i = 0; i < lanes.length; i++) {
        const canPlace =
          laneLastWasPoint[i] && isPoint ? task.start > lanes[i] : task.start >= lanes[i]
        if (canPlace && !blockedLanes.has(i)) {
          lanes[i] = task.end
          laneLastWasPoint[i] = isPoint
          assignedLane = i
          break
        }
      }
      if (assignedLane === -1) {
        lanes.push(task.end)
        laneLastWasPoint.push(isPoint)
        assignedLane = lanes.length - 1
      }
      normalRelativeLaneMap.set(task.id, assignedLane)
      // サマリータスクがレーン0のため +1 オフセット
      taskLaneMap.set(task.id, assignedLane + 1)
    }

    return {
      tasksWithLanes: tasks.map((task) => ({
        ...task,
        lane: taskLaneMap.get(task.id) ?? 0,
      })),
      laneCount: 1 + (lanes.length || 1),
    }
  }

  // 開始日でタスクをソート
  const sortedTasks = [...tasks].sort((a, b) => a.start.getTime() - b.start.getTime())

  // 各レーンの「最後尾のタスクの終了日時」を保持する配列
  // インデックスがレーン番号に対応します
  const lanes: Date[] = []
  const laneLastWasPoint: boolean[] = []
  const taskLaneMap = new Map<string, number>()

  for (const task of sortedTasks) {
    const blockedLanes = getBlockedLanes(task, taskLaneMap)
    const isPoint = isMilestoneTask(task) || task.end.getTime() <= task.start.getTime()
    let assignedLane = -1
    // 既存のレーンに空きがあるか探す
    for (let i = 0; i < lanes.length; i++) {
      // このレーンの最後のタスク終了日よりも、現在のタスク開始日が後であれば配置可能
      const canPlace =
        laneLastWasPoint[i] && isPoint ? task.start > lanes[i] : task.start >= lanes[i]
      if (canPlace && !blockedLanes.has(i)) {
        lanes[i] = task.end // レーンの終了日を更新
        laneLastWasPoint[i] = isPoint
        assignedLane = i
        break
      }
    }
    // 空きがなければ新しいレーンを作成
    if (assignedLane === -1) {
      lanes.push(task.end)
      laneLastWasPoint.push(isPoint)
      assignedLane = lanes.length - 1
    }
    taskLaneMap.set(task.id, assignedLane)
  }

  // 元の順序を維持したままレーン情報を付与
  const tasksWithLanes = tasks.map((task) => ({
    ...task,
    lane: taskLaneMap.get(task.id) ?? 0,
  }))

  return {
    tasksWithLanes,
    laneCount: lanes.length || 1,
  }
}

/** カレンダー描画で許容する最大日数上限（約100年分、極端な日付によるタブフリーズ・OOM防止） */
export const MAX_CALENDAR_DAYS = 36525

const UNSAFE_CSS_TOKEN_RE = /[;{}<>\\\r\n]/
const UNSAFE_CSS_KEYWORD_RE =
  /(\/\*|\*\/|url\s*\(|expression\s*\(|@import|javascript\s*:|-moz-binding|behavior\s*:)/i
const SAFE_CSS_PROP_RE = /^(--[a-zA-Z0-9_-]+|[a-zA-Z][a-zA-Z0-9-]*)$/

/**
 * 単一のCSSプロパティ値（色指定など）をサニタイズし、CSSインジェクションや外部リクエスト(`url(...)`)を防止します。
 * 不正なトークンが含まれる場合は `fallback` を返します。
 */
export function sanitizeCssValue(value: string | undefined, fallback = ''): string {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  if (!trimmed) return fallback
  if (UNSAFE_CSS_TOKEN_RE.test(trimmed) || UNSAFE_CSS_KEYWORD_RE.test(trimmed)) {
    return fallback
  }
  return trimmed
}

/**
 * インラインstyle属性文字列（`prop: value; ...`）を宣言単位で検証・サニタイズします。
 * 構文破壊文字、`url(...)` 等の外部参照、およびビューポート固定によるUI偽装（`position: fixed/sticky`）を除去します。
 */
export function sanitizeInlineStyle(style: string | undefined): string {
  if (typeof style !== 'string') return ''
  const trimmed = style.trim()
  if (!trimmed) return ''
  if (/[{}<>\\\r\n]/.test(trimmed) || /(\/\*|\*\/)/.test(trimmed)) {
    return ''
  }

  const safeDeclarations: string[] = []
  for (const rawPart of trimmed.split(';')) {
    const part = rawPart.trim()
    if (!part) continue
    const colonIdx = part.indexOf(':')
    if (colonIdx <= 0) continue
    const prop = part.slice(0, colonIdx).trim()
    const rawVal = part.slice(colonIdx + 1).trim()
    if (!SAFE_CSS_PROP_RE.test(prop)) continue
    if (prop.toLowerCase() === 'position' && /^(fixed|sticky)\b/i.test(rawVal)) {
      continue
    }
    const safeVal = sanitizeCssValue(rawVal, '')
    if (!safeVal) continue
    safeDeclarations.push(`${prop}: ${safeVal}`)
  }

  return safeDeclarations.join('; ')
}

/**
 * 現在のテーマ設定とカスタムテーマをマージして、最終的なカラーパレットを生成します。
 * @param theme ベースとなるテーマ名 ('light' | 'dark')
 * @param customTheme 上書きするカスタムカラー設定
 * @returns マージされたカラーパレット
 */
export const getThemeColors = (
  theme: 'light' | 'dark',
  customTheme?: Partial<ThemeColorPalette>,
): ThemeColorPalette => {
  const base = THEME_COLORS[theme] || THEME_COLORS.light
  if (!customTheme) return { ...base }
  const merged: ThemeColorPalette = { ...base }
  for (const key of Object.keys(customTheme) as Array<keyof ThemeColorPalette>) {
    if (key === ('__proto__' as any) || key === ('constructor' as any) || key === ('prototype' as any)) {
      continue
    }
    const raw = customTheme[key]
    if (typeof raw === 'string') {
      const fallback = base[key] ?? ''
      ;(merged as any)[key] = raw === '' ? '' : sanitizeCssValue(raw, fallback)
    }
  }
  return merged
}

export interface CalendarColorHolidayOptions {
  nonWorkingDays?: number[]
}

/**
 * 指定された日付に対応する背景色（休日、土日、カスタム定休日など）を取得します。
 * @param date 対象の日付
 * @param colors カラーパレット
 * @param isHoliday 祝日・休日判定関数 (オプション)。指定がない場合は祝日判定を行いません。
 * @param calendarOptions カスタム非営業曜日設定 (オプション)
 * @returns 背景色のCSSカラー文字列。平日の場合は空文字を返すことがあります。
 */
export const getCalendarColor = (
  date: Date,
  colors: ThemeColorPalette,
  isHoliday?: GanttHolidayChecker,
  calendarOptions?: CalendarColorHolidayOptions,
): string => {
  const holidayMeta = isHoliday ? resolveHolidayMeta(isHoliday(date)) : null
  if (holidayMeta) {
    const safeHolidayColor = holidayMeta.color ? sanitizeCssValue(holidayMeta.color, '') : ''
    return safeHolidayColor || colors.holiday
  }

  const dayOfWeek = date.getDay()
  // 曜日ごとの色定義テーブル (0: 日曜, ..., 6: 土曜)
  const weekColors = [
    colors.sunday,
    colors.monday ?? '',
    colors.tuesday ?? '',
    colors.wednesday ?? '',
    colors.thursday ?? '',
    colors.friday ?? '',
    colors.saturday,
  ]

  if (Array.isArray(calendarOptions?.nonWorkingDays)) {
    if (calendarOptions.nonWorkingDays.includes(dayOfWeek)) {
      if (dayOfWeek === 0) return colors.sunday
      if (dayOfWeek === 6) return colors.saturday
      return weekColors[dayOfWeek] || colors.holiday
    }
    // nonWorkingDaysに含まれない曜日は営業日扱い（平日カスタム色がある場合のみ適用）
    return dayOfWeek >= 1 && dayOfWeek <= 5 ? weekColors[dayOfWeek] : ''
  }

  return weekColors[dayOfWeek]
}

/**
 * 開始日と終了日から日数を計算します。
 * 不正な日付や逆転した期間に対しては 0 を返し、上限 `MAX_CALENDAR_DAYS` でクランプします。
 * @param start 開始日
 * @param end 終了日
 * @returns 日数
 */
export function getTotalDays(start: Date, end: Date): number {
  if (!(start instanceof Date) || !(end instanceof Date)) return 0
  const startMs = start.getTime()
  const endMs = end.getTime()
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) return 0
  const diffDays = (endMs - startMs) / (1000 * 60 * 60 * 24)
  return Math.min(diffDays, MAX_CALENDAR_DAYS)
}

/**
 * 期間を「◯日◯時間◯分」の形式でフォーマットします。
 * @param start 開始日
 * @param end 終了日
 * @param locale ロケール設定 (デフォルト: 日本語)
 */
export const formatDuration = (start: Date, end: Date, locale?: MoguchartLocale): string => {
  const loc = locale ?? jaLocale
  const diff = end.getTime() - start.getTime()
  // 期間はミリ秒単位
  // 日数
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const remainAfterDays = diff % (1000 * 60 * 60 * 24)
  // 時間
  const hours = Math.floor(remainAfterDays / (1000 * 60 * 60))
  const remainAfterHours = remainAfterDays % (1000 * 60 * 60)
  // 分
  const minutes = Math.floor(remainAfterHours / (1000 * 60))

  let result = ''
  if (days > 0) {
    result += loc.duration.days(days)
  }
  if (hours > 0) {
    result += loc.duration.hours(hours)
  }
  if (minutes > 0) {
    result += loc.duration.minutes(minutes)
  }
  return result || loc.duration.zero
}

/**
 * 進捗率を 0〜100 の範囲に正規化します。
 * @param value 入力値
 * @param precision 丸め桁数 (デフォルト: 1)
 * @returns 0〜100 の数値
 */
export function clampProgress(value: number, precision = 1): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0
  }
  const factor = Math.pow(10, precision)
  const rounded = Math.round(value * factor) / factor
  return Math.min(100, Math.max(0, rounded))
}

/**
 * 行内またはタスク配列の単純平均進捗率を計算します。
 * 進捗率が未指定のタスクは除外して計算します。進捗のあるタスクが存在しない場合は 0 を返します。
 * @param rowOrTasks 対象の行またはタスク配列
 * @returns 平均進捗率 (0〜100)
 */
export function calculateRowProgress(rowOrTasks: GanttRow | GanttTask[]): number {
  const tasks = Array.isArray(rowOrTasks) ? rowOrTasks : rowOrTasks.tasks || []
  const tasksWithProgress = tasks.filter(
    (t) => typeof t.progress === 'number' && !Number.isNaN(t.progress),
  )
  if (tasksWithProgress.length === 0) {
    return 0
  }
  const total = tasksWithProgress.reduce((sum, t) => sum + clampProgress(t.progress!), 0)
  return clampProgress(total / tasksWithProgress.length)
}

/**
 * 行内またはタスク配列の期間（時間）に応じた加重平均進捗率を計算します。
 * 進捗率が未指定のタスクは除外して計算します。
 * @param rowOrTasks 対象の行またはタスク配列
 * @returns 加重平均進捗率 (0〜100)
 */
export function calculateWeightedRowProgress(rowOrTasks: GanttRow | GanttTask[]): number {
  const tasks = Array.isArray(rowOrTasks) ? rowOrTasks : rowOrTasks.tasks || []
  const tasksWithProgress = tasks.filter(
    (t) => typeof t.progress === 'number' && !Number.isNaN(t.progress),
  )
  if (tasksWithProgress.length === 0) {
    return 0
  }

  let totalDuration = 0
  let weightedProgressSum = 0

  for (const task of tasksWithProgress) {
    const duration = Math.max(task.end.getTime() - task.start.getTime(), 1)
    totalDuration += duration
    weightedProgressSum += clampProgress(task.progress!) * duration
  }

  if (totalDuration === 0) {
    return 0
  }

  return clampProgress(weightedProgressSum / totalDuration)
}

/**
 * 全行に含まれるタスクの期間加重平均進捗率を計算します。
 * @param rows ガントチャートの全行
 * @returns プロジェクト全体の加重平均進捗率 (0〜100)
 */
export function calculateProjectProgress(rows: GanttRow[]): number {
  if (!rows || rows.length === 0) {
    return 0
  }
  const allTasks: GanttTask[] = []
  for (const row of rows) {
    if (row.tasks && row.tasks.length > 0) {
      allTasks.push(...row.tasks)
    }
  }
  return calculateWeightedRowProgress(allTasks)
}

/**
 * タスクの当初計画（ベースライン）に対する遅延・前倒し状況を計算します。
 *
 * @param task 対象タスク
 * @returns 遅延状況オブジェクト
 */
export function calculateTaskDelay(task: GanttTask): {
  isDelayed: boolean
  delayMs: number
  delayDays: number
  isAhead: boolean
  aheadMs: number
  aheadDays: number
} {
  if (!task.baseline || !task.baseline.end || !task.end) {
    return {
      isDelayed: false,
      delayMs: 0,
      delayDays: 0,
      isAhead: false,
      aheadMs: 0,
      aheadDays: 0,
    }
  }

  const actualEndTime = task.end instanceof Date ? task.end.getTime() : new Date(task.end).getTime()
  const baselineEndTime =
    task.baseline.end instanceof Date ? task.baseline.end.getTime() : new Date(task.baseline.end).getTime()

  const diffMs = actualEndTime - baselineEndTime
  const oneDayMs = 1000 * 60 * 60 * 24

  if (diffMs > 0) {
    return {
      isDelayed: true,
      delayMs: diffMs,
      delayDays: Math.round((diffMs / oneDayMs) * 10) / 10,
      isAhead: false,
      aheadMs: 0,
      aheadDays: 0,
    }
  } else if (diffMs < 0) {
    const aheadMs = -diffMs
    return {
      isDelayed: false,
      delayMs: 0,
      delayDays: 0,
      isAhead: true,
      aheadMs,
      aheadDays: Math.round((aheadMs / oneDayMs) * 10) / 10,
    }
  }

  return {
    isDelayed: false,
    delayMs: 0,
    delayDays: 0,
    isAhead: false,
    aheadMs: 0,
    aheadDays: 0,
  }
}

/**
 * プロジェクト全体（全行）のベースラインに対する進捗・遅延の要約を計算します。
 *
 * @param rows ガントチャートの全行
 * @returns 要約統計オブジェクト
 */
export function calculateProjectBaselineSummary(rows: GanttRow[]): {
  totalBaselineTasks: number
  delayedTasksCount: number
  aheadTasksCount: number
  onScheduleTasksCount: number
  maxDelayDays: number
} {
  let totalBaselineTasks = 0
  let delayedTasksCount = 0
  let aheadTasksCount = 0
  let onScheduleTasksCount = 0
  let maxDelayDays = 0

  if (!rows || rows.length === 0) {
    return {
      totalBaselineTasks: 0,
      delayedTasksCount: 0,
      aheadTasksCount: 0,
      onScheduleTasksCount: 0,
      maxDelayDays: 0,
    }
  }

  for (const row of rows) {
    if (!row.tasks) continue
    for (const task of row.tasks) {
      // サマリータスクは重複集計を防ぐため除外
      if (task.type === 'summary') continue
      if (!task.baseline) continue

      totalBaselineTasks++
      const { isDelayed, isAhead, delayDays } = calculateTaskDelay(task)

      if (isDelayed) {
        delayedTasksCount++
        if (delayDays > maxDelayDays) {
          maxDelayDays = delayDays
        }
      } else if (isAhead) {
        aheadTasksCount++
      } else {
        onScheduleTasksCount++
      }
    }
  }

  return {
    totalBaselineTasks,
    delayedTasksCount,
    aheadTasksCount,
    onScheduleTasksCount,
    maxDelayDays,
  }
}

/**
 * タスクのデッドライン（期限）に対する超過・残日数の状況を計算します。
 *
 * @param task 対象タスク
 * @returns デッドライン状況オブジェクト
 */
export function calculateTaskDeadline(task: GanttTask): {
  hasDeadline: boolean
  isOverdue: boolean
  overdueMs: number
  overdueDays: number
  remainingMs: number
  remainingDays: number
} {
  if (!task || task.type === 'summary' || !task.deadline || !task.end) {
    return {
      hasDeadline: false,
      isOverdue: false,
      overdueMs: 0,
      overdueDays: 0,
      remainingMs: 0,
      remainingDays: 0,
    }
  }

  const actualEndTime = task.end instanceof Date ? task.end.getTime() : new Date(task.end).getTime()
  const deadlineTime =
    task.deadline instanceof Date ? task.deadline.getTime() : new Date(task.deadline).getTime()

  if (Number.isNaN(actualEndTime) || Number.isNaN(deadlineTime)) {
    return {
      hasDeadline: false,
      isOverdue: false,
      overdueMs: 0,
      overdueDays: 0,
      remainingMs: 0,
      remainingDays: 0,
    }
  }

  const diffMs = actualEndTime - deadlineTime
  const oneDayMs = 1000 * 60 * 60 * 24

  if (diffMs > 0) {
    return {
      hasDeadline: true,
      isOverdue: true,
      overdueMs: diffMs,
      overdueDays: Math.round((diffMs / oneDayMs) * 10) / 10,
      remainingMs: 0,
      remainingDays: 0,
    }
  } else if (diffMs < 0) {
    const remainingMs = -diffMs
    return {
      hasDeadline: true,
      isOverdue: false,
      overdueMs: 0,
      overdueDays: 0,
      remainingMs,
      remainingDays: Math.round((remainingMs / oneDayMs) * 10) / 10,
    }
  }

  return {
    hasDeadline: true,
    isOverdue: false,
    overdueMs: 0,
    overdueDays: 0,
    remainingMs: 0,
    remainingDays: 0,
  }
}

export interface ThrottledFunction<T extends (...args: any[]) => void> {
  (...args: Parameters<T>): void
  cancel: () => void
  flush: () => void
}

/**
 * Leading + Trailing 実行に対応した軽量スロットル関数。
 * 外部依存 (lodash-es) を排除しつつ `.cancel()` / `.flush()` 互換インターフェースを提供します。
 */
export function throttle<T extends (...args: any[]) => void>(
  fn: T,
  waitMs: number,
): ThrottledFunction<T> {
  let timerId: ReturnType<typeof setTimeout> | null = null
  let lastInvokeTime: number | null = null
  let lastArgs: Parameters<T> | null = null
  let lastThis: any = null

  const invoke = (time: number) => {
    lastInvokeTime = time
    const args = lastArgs
    const ctx = lastThis
    lastArgs = null
    lastThis = null
    if (args) {
      fn.apply(ctx, args)
    }
  }

  const throttled = function (this: any, ...args: Parameters<T>) {
    const now = Date.now()
    lastArgs = args
    lastThis = this

    if (lastInvokeTime === null) {
      invoke(now)
      return
    }

    const remaining = waitMs - (now - lastInvokeTime)
    if (remaining <= 0 || remaining > waitMs) {
      if (timerId !== null) {
        clearTimeout(timerId)
        timerId = null
      }
      invoke(now)
    } else if (timerId === null) {
      timerId = setTimeout(() => {
        timerId = null
        invoke(Date.now())
      }, remaining)
    }
  } as ThrottledFunction<T>

  throttled.cancel = () => {
    if (timerId !== null) {
      clearTimeout(timerId)
      timerId = null
    }
    lastInvokeTime = null
    lastArgs = null
    lastThis = null
  }

  throttled.flush = () => {
    if (timerId !== null) {
      clearTimeout(timerId)
      timerId = null
      invoke(Date.now())
    }
  }

  return throttled
}

const MONTH_NAMES_FULL_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

const MONTH_NAMES_SHORT_EN = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

const WEEKDAY_NAMES_FULL_EN = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const

const WEEKDAY_NAMES_SHORT_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const WEEKDAY_NAMES_MIN_EN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const

const CALENDAR_FORMAT_TOKEN_RE =
  /\[([^\]]*)\]|Y{4}|Y{2}|M{1,4}|D{1,2}|d{1,4}|H{1,2}|h{1,2}|a|A|m{1,2}|s{1,2}/g

/**
 * dayjs 互換トークン (`YYYY`, `YY`, `MMMM`, `MMM`, `MM`, `M`, `DD`, `D`, `[literal]` 等) を用いて
 * Date オブジェクトを文字列にフォーマットします。
 */
export function formatCalendarDate(date: Date, pattern: string): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return ''
  }
  const year = date.getFullYear()
  const monthIndex = date.getMonth()
  const month = monthIndex + 1
  const day = date.getDate()
  const weekday = date.getDay()
  const hours = date.getHours()
  const hours12 = hours % 12 || 12
  const minutes = date.getMinutes()
  const seconds = date.getSeconds()

  return pattern.replace(CALENDAR_FORMAT_TOKEN_RE, (match, escaped: string | undefined) => {
    if (escaped !== undefined) return escaped
    switch (match) {
      case 'YYYY':
        return String(year).padStart(4, '0')
      case 'YY':
        return String(year).slice(-2)
      case 'MMMM':
        return MONTH_NAMES_FULL_EN[monthIndex] ?? ''
      case 'MMM':
        return MONTH_NAMES_SHORT_EN[monthIndex] ?? ''
      case 'MM':
        return String(month).padStart(2, '0')
      case 'M':
        return String(month)
      case 'DD':
        return String(day).padStart(2, '0')
      case 'D':
        return String(day)
      case 'dddd':
        return WEEKDAY_NAMES_FULL_EN[weekday] ?? ''
      case 'ddd':
        return WEEKDAY_NAMES_SHORT_EN[weekday] ?? ''
      case 'dd':
        return WEEKDAY_NAMES_MIN_EN[weekday] ?? ''
      case 'd':
        return String(weekday)
      case 'HH':
        return String(hours).padStart(2, '0')
      case 'H':
        return String(hours)
      case 'hh':
        return String(hours12).padStart(2, '0')
      case 'h':
        return String(hours12)
      case 'A':
        return hours < 12 ? 'AM' : 'PM'
      case 'a':
        return hours < 12 ? 'am' : 'pm'
      case 'mm':
        return String(minutes).padStart(2, '0')
      case 'm':
        return String(minutes)
      case 'ss':
        return String(seconds).padStart(2, '0')
      case 's':
        return String(seconds)
      default:
        return match
    }
  })
}




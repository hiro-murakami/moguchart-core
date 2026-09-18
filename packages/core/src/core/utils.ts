import type { GanttRow, GanttTask, TaskWithLane, ThemeColorPalette } from './types'
import type { MoguchartLocale } from './i18n'
import { jaLocale } from './i18n'
import { THEME_COLORS } from './theme'

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

    for (const task of sortedNormalTasks) {
      let assignedLane = -1
      for (let i = 0; i < lanes.length; i++) {
        if (task.start >= lanes[i]) {
          lanes[i] = task.end
          assignedLane = i
          break
        }
      }
      if (assignedLane === -1) {
        lanes.push(task.end)
        assignedLane = lanes.length - 1
      }
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
  const taskLaneMap = new Map<string, number>()

  for (const task of sortedTasks) {
    let assignedLane = -1
    // 既存のレーンに空きがあるか探す
    for (let i = 0; i < lanes.length; i++) {
      // このレーンの最後のタスク終了日よりも、現在のタスク開始日が後であれば配置可能
      if (task.start >= lanes[i]) {
        lanes[i] = task.end // レーンの終了日を更新
        assignedLane = i
        break
      }
    }
    // 空きがなければ新しいレーンを作成
    if (assignedLane === -1) {
      lanes.push(task.end)
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
  return { ...base, ...customTheme }
}

/**
 * 指定された日付に対応する背景色（休日、土日など）を取得します。
 * @param date 対象の日付
 * @param colors カラーパレット
 * @param isHoliday 祝日判定関数 (オプション)。指定がない場合は祝日判定を行いません。
 * @returns 背景色のCSSカラー文字列。平日の場合は空文字を返すことがあります。
 */
export const getCalendarColor = (
  date: Date,
  colors: ThemeColorPalette,
  isHoliday?: (date: Date) => boolean,
): string => {
  const dayOfWeek = date.getDay()
  const isHolidayDay = isHoliday ? isHoliday(date) : false

  if (isHolidayDay) {
    return colors.holiday
  }
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
  return weekColors[dayOfWeek]
}

/**
 * 開始日と終了日から日数を計算します。
 * @param start 開始日
 * @param end 終了日
 * @returns 日数
 */
export function getTotalDays(start: Date, end: Date): number {
  const diffTime = end.getTime() - start.getTime()
  const diffDays = diffTime / (1000 * 60 * 60 * 24)
  return diffDays
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


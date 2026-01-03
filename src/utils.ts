import type { GanttTask, TaskWithLane, ThemeColorPalette } from '@/types'
import { THEME_COLORS } from '@/theme'

/**
 * 指定された日付のチャート上のX座標（ピクセル）を計算します。
 * @param date 対象の日付
 * @param startDate チャートの開始日
 * @param pxPerDay 1日あたりのピクセル幅
 * @returns 開始日からのピクセル距離
 */
export const dateToX = (date: Date, startDate: Date, pxPerDay: number) => {
  const diffTime = date.getTime() - startDate.getTime()
  const diffDays = diffTime / (1000 * 60 * 60 * 24)
  return diffDays * pxPerDay
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

  // 開始日でタスクをソート
  const sortedTasks = [...tasks].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  )

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
 * @param isHoliday 祝日判定関数 (オプション)。指定がない場合は @holiday-jp/holiday_jp を使用します。
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

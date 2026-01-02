import type { GanttTask, TaskWithLane } from '@/types'
import * as holiday_jp from '@holiday-jp/holiday_jp'
import { THEME_COLORS } from '@/theme'

// ユーティリティ: 日付からX座標を計算
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

  const lanes: Date[] = [] // 各レーンに最後に配置されたタスクの終了日を保持
  const taskLaneMap = new Map<string, number>()

  for (const task of sortedTasks) {
    let assignedLane = -1
    // 既存のレーンに空きがあるか探す
    for (let i = 0; i < lanes.length; i++) {
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

export const getCalendarColor = (
  date: Date,
  theme: 'light' | 'dark' = 'light',
): string => {
  const dayOfWeek = date.getDay()
  const isHolidayDay = holiday_jp.isHoliday(date)
  const colors = THEME_COLORS[theme] || THEME_COLORS.light

  if (isHolidayDay) {
    return colors.holiday
  } else if (dayOfWeek === 0) {
    return colors.sunday
  } else if (dayOfWeek === 6) {
    return colors.saturday
  }
  return ''
}

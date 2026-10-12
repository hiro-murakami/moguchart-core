import type { GanttColumn, GanttBuiltinColumnId, GanttRow, GanttTask } from './types'
import type { MoguchartLocale } from './i18n'
import { jaLocale } from './i18n'

/**
 * 組み込みカラムのデフォルト仕様定義
 */
export const DEFAULT_GRID_COLUMN_CONFIGS: Record<
  GanttBuiltinColumnId,
  {
    width: number
    minWidth: number
    align: 'left' | 'center' | 'right'
    isTreeColumn?: boolean
  }
> = {
  wbs: { width: 60, minWidth: 40, align: 'center' },
  name: { width: 200, minWidth: 80, align: 'left', isTreeColumn: true },
  startDate: { width: 100, minWidth: 70, align: 'center' },
  endDate: { width: 100, minWidth: 70, align: 'center' },
  duration: { width: 80, minWidth: 50, align: 'right' },
  progress: { width: 80, minWidth: 50, align: 'right' },
}

/**
 * 複数タスク（またはサマリータスク）の日程・期間・加重平均進捗率を計算する
 */
export function calculateRowSummaryDates(tasks: GanttTask[]): {
  start: Date | null
  end: Date | null
  durationDays: number
  progress: number | undefined
} {
  if (!tasks || tasks.length === 0) {
    return {
      start: null,
      end: null,
      durationDays: 0,
      progress: undefined,
    }
  }

  let minStart = Infinity
  let maxEnd = -Infinity
  let totalDurationMs = 0
  let weightedProgressSum = 0
  let hasAnyProgress = false

  for (const task of tasks) {
    if (!task.start || !task.end) continue
    const s = task.start.getTime()
    const e = task.end.getTime()
    if (Number.isNaN(s) || Number.isNaN(e)) continue

    if (s < minStart) minStart = s
    if (e > maxEnd) maxEnd = e

    const duration = Math.max(1, e - s)
    totalDurationMs += duration

    if (task.progress !== undefined && !Number.isNaN(task.progress)) {
      hasAnyProgress = true
      weightedProgressSum += (task.progress ?? 0) * duration
    }
  }

  if (minStart === Infinity || maxEnd === -Infinity) {
    return {
      start: null,
      end: null,
      durationDays: 0,
      progress: undefined,
    }
  }

  const startDate = new Date(minStart)
  const endDate = new Date(maxEnd)

  // カレンダー日数スパン (開始日から終了日までの日数、端数切り上げ)
  const msPerDay = 1000 * 60 * 60 * 24
  // 日付境界を考慮した実日数計算
  const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime()
  const endDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()).getTime()
  const durationDays = Math.max(1, Math.round((endDay - startDay) / msPerDay) + 1)

  const calculatedProgress =
    hasAnyProgress && totalDurationMs > 0
      ? Math.round((weightedProgressSum / totalDurationMs) * 10) / 10
      : undefined

  return {
    start: startDate,
    end: endDate,
    durationDays,
    progress: calculatedProgress,
  }
}

/**
 * カラム定義配列を正規化し、デフォルト値やロケール文字列を補完する
 */
export function normalizeGridColumns(
  columns?: GanttColumn[],
  locale?: MoguchartLocale,
): GanttColumn[] {
  const currentLocale = locale ?? jaLocale
  const defaultTitles: Record<string, string> = {
    wbs: currentLocale.grid?.columns.wbs ?? 'WBS',
    name: currentLocale.grid?.columns.name ?? 'タスク名',
    startDate: currentLocale.grid?.columns.startDate ?? '開始日',
    endDate: currentLocale.grid?.columns.endDate ?? '終了日',
    duration: currentLocale.grid?.columns.duration ?? '期間',
    progress: currentLocale.grid?.columns.progress ?? '進捗率',
  }

  // カラム未指定時のデフォルト組み込みカラムセット
  const rawColumns: GanttColumn[] =
    columns && columns.length > 0
      ? columns
      : [
          { id: 'wbs' },
          { id: 'name' },
          { id: 'startDate' },
          { id: 'endDate' },
          { id: 'duration' },
          { id: 'progress' },
        ]

  let hasTreeCol = false

  const normalized = rawColumns.map((col) => {
    const builtinConfig = (DEFAULT_GRID_COLUMN_CONFIGS as any)[col.id]
    const width = col.width ?? builtinConfig?.width ?? 100
    const minWidth = col.minWidth ?? builtinConfig?.minWidth ?? 40
    const align = col.align ?? builtinConfig?.align ?? 'left'
    const resizable = col.resizable !== false
    const visible = col.visible !== false
    const isTreeColumn = col.isTreeColumn ?? (builtinConfig?.isTreeColumn || false)

    if (isTreeColumn && visible) {
      hasTreeCol = true
    }

    const title = col.title ?? defaultTitles[col.id] ?? col.id

    return {
      ...col,
      title,
      width,
      minWidth,
      align,
      resizable,
      visible,
      isTreeColumn,
    }
  })

  // もしツリー列が指定されていなければ、name カラム、または先頭の可視カラムにツリー列フラグを付与
  if (!hasTreeCol && normalized.length > 0) {
    const nameCol = normalized.find((c) => c.id === 'name' && c.visible !== false)
    if (nameCol) {
      nameCol.isTreeColumn = true
    } else {
      const firstVisible = normalized.find((c) => c.visible !== false)
      if (firstVisible) {
        firstVisible.isTreeColumn = true
      }
    }
  }

  return normalized
}

/**
 * 指定されたカラムのセル生値を行およびタスク群から取得する
 */
export function getGridCellValue(
  column: GanttColumn,
  row: GanttRow,
  tasks: GanttTask[],
  wbsCode?: string,
): any {
  if (column.valueGetter) {
    return column.valueGetter(row, tasks, wbsCode)
  }

  const summary = calculateRowSummaryDates(tasks)

  switch (column.id) {
    case 'wbs':
      return wbsCode ?? row.wbsCode ?? ''
    case 'name':
      return row.name
    case 'startDate':
      return summary.start
    case 'endDate':
      return summary.end
    case 'duration':
      return summary.durationDays
    case 'progress':
      return summary.progress
    default:
      if (column.field && (row as any)[column.field] !== undefined) {
        return (row as any)[column.field]
      }
      return undefined
  }
}

/**
 * セル値をフォーマットして表示用文字列にする
 */
export function formatGridCellValue(
  column: GanttColumn,
  value: any,
  row: GanttRow,
  tasks: GanttTask[],
  locale?: MoguchartLocale,
): string {
  const currentLocale = locale ?? jaLocale

  if (column.formatter) {
    return column.formatter(value, row, tasks, currentLocale)
  }

  if (value === null || value === undefined) {
    return ''
  }

  switch (column.id) {
    case 'wbs':
    case 'name':
      return String(value)
    case 'startDate':
    case 'endDate':
      if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return currentLocale.dateFormat(value)
      }
      return ''
    case 'duration':
      if (typeof value === 'number' && value > 0) {
        return currentLocale.duration.days(value)
      }
      return '-'
    case 'progress':
      if (typeof value === 'number' && !Number.isNaN(value)) {
        return `${Math.round(value)}%`
      }
      return '-'
    default:
      return String(value)
  }
}

import type {
  GanttColumn,
  GanttBuiltinColumnId,
  GanttColumnEditorType,
  GanttRow,
  GanttTask,
} from './types'
import type { MoguchartLocale } from './i18n'
import { jaLocale } from './i18n'
import {
  addWorkingDays,
  countWorkingDays,
  createNonWorkingDayChecker,
  snapToWorkingStartMs,
  type AutoScheduleOptions,
} from './auto-schedule'
import { formatDuration, isMilestoneTask } from './utils'

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
  startMonth: { width: 100, minWidth: 70, align: 'center' },
  endMonth: { width: 100, minWidth: 70, align: 'center' },
  startDateTime: { width: 130, minWidth: 80, align: 'center' },
  endDateTime: { width: 130, minWidth: 80, align: 'center' },
  duration: { width: 80, minWidth: 50, align: 'right' },
  workingDays: { width: 80, minWidth: 50, align: 'right' },
  progress: { width: 80, minWidth: 50, align: 'right' },
}

/**
 * 複数タスク（またはサマリータスク）の日程・期間・加重平均進捗率を計算する
 */
export function calculateRowSummaryDates(tasks: GanttTask[]): {
  start: Date | null
  end: Date | null
  durationDays: number
  durationMs: number
  progress: number | undefined
} {
  if (!tasks || tasks.length === 0) {
    return {
      start: null,
      end: null,
      durationDays: 0,
      durationMs: 0,
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
      durationMs: 0,
      progress: undefined,
    }
  }

  const startDate = new Date(minStart)
  const endDate = new Date(maxEnd)

  // カレンダー日数スパン (開始日から終了日までの日数)
  const msPerDay = 1000 * 60 * 60 * 24
  // 日付境界を考慮した実日数計算
  const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime()
  const endDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()).getTime()
  const allMilestones = tasks.length > 0 && tasks.every((t) => isMilestoneTask(t))
  const durationDays =
    allMilestones && endDay <= startDay
      ? 0
      : Math.max(1, Math.round((endDay - startDay) / msPerDay))
  const durationMs = allMilestones && maxEnd <= minStart ? 0 : Math.max(0, maxEnd - minStart)

  const calculatedProgress =
    hasAnyProgress && totalDurationMs > 0
      ? Math.round((weightedProgressSum / totalDurationMs) * 10) / 10
      : undefined

  return {
    start: startDate,
    end: endDate,
    durationDays,
    durationMs,
    progress: calculatedProgress,
  }
}

/**
 * カラム定義配列を正規化し、デフォルト値やロケール文字列を補完する
 */
export function normalizeGridColumns(
  columns?: GanttColumn[],
  locale?: MoguchartLocale,
  isMonthMode?: boolean,
  isTimeMode?: boolean,
): GanttColumn[] {
  const currentLocale = locale ?? jaLocale
  const startDateTitle = isMonthMode
    ? (currentLocale.grid?.columns.startMonth ?? '開始月')
    : isTimeMode
      ? (currentLocale.grid?.columns.startDateTime ?? '開始日時')
      : (currentLocale.grid?.columns.startDate ?? '開始日')
  const endDateTitle = isMonthMode
    ? (currentLocale.grid?.columns.endMonth ?? '終了月')
    : isTimeMode
      ? (currentLocale.grid?.columns.endDateTime ?? '終了日時')
      : (currentLocale.grid?.columns.endDate ?? '終了日')

  const defaultTitles: Record<string, string> = {
    wbs: currentLocale.grid?.columns.wbs ?? 'WBS',
    name: currentLocale.grid?.columns.name ?? 'タスク名',
    startDate: startDateTitle,
    endDate: endDateTitle,
    startMonth: currentLocale.grid?.columns.startMonth ?? '開始月',
    endMonth: currentLocale.grid?.columns.endMonth ?? '終了月',
    startDateTime: currentLocale.grid?.columns.startDateTime ?? '開始日時',
    endDateTime: currentLocale.grid?.columns.endDateTime ?? '終了日時',
    duration: currentLocale.grid?.columns.duration ?? '期間',
    workingDays: currentLocale.grid?.columns.workingDays ?? '稼働日',
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
    let defaultWidth = builtinConfig?.width ?? 100
    let defaultMinWidth = builtinConfig?.minWidth ?? 40

    if (isTimeMode) {
      if (col.id === 'startDate' || col.id === 'endDate' || col.id === 'startDateTime' || col.id === 'endDateTime') {
        defaultWidth = 130
        defaultMinWidth = 80
      } else if (col.id === 'duration') {
        defaultWidth = 90
        defaultMinWidth = 60
      }
    }

    const width = col.width ?? defaultWidth
    const minWidth = col.minWidth ?? defaultMinWidth
    const align = col.align ?? builtinConfig?.align ?? 'left'
    const resizable = col.resizable !== false
    const reorderable = col.reorderable !== false
    const visible = col.visible !== false
    const isTreeColumn = col.isTreeColumn ?? (builtinConfig?.isTreeColumn || false)

    if (isTreeColumn && visible) {
      hasTreeCol = true
    }

    const isAutoStartDateTitle =
      !col.title ||
      col.title === '開始日' ||
      col.title === '開始月' ||
      col.title === '開始日時' ||
      col.title === 'Start Date' ||
      col.title === 'Start Month' ||
      col.title === 'Start Date/Time' ||
      col.title === currentLocale.grid?.columns.startDate ||
      col.title === currentLocale.grid?.columns.startMonth ||
      col.title === currentLocale.grid?.columns.startDateTime

    const isAutoEndDateTitle =
      !col.title ||
      col.title === '終了日' ||
      col.title === '終了月' ||
      col.title === '終了日時' ||
      col.title === 'End Date' ||
      col.title === 'End Month' ||
      col.title === 'End Date/Time' ||
      col.title === currentLocale.grid?.columns.endDate ||
      col.title === currentLocale.grid?.columns.endMonth ||
      col.title === currentLocale.grid?.columns.endDateTime

    let title: string
    if (col.id === 'startDate' && isAutoStartDateTitle) {
      title = startDateTitle
    } else if (col.id === 'endDate' && isAutoEndDateTitle) {
      title = endDateTitle
    } else {
      title = col.title ?? defaultTitles[col.id] ?? col.id
    }

    return {
      ...col,
      title,
      width,
      minWidth,
      align,
      resizable,
      reorderable,
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
 * カラム配列内の指定カラムをターゲットカラムの左または右に移動した新しい配列を返す
 */
export function reorderGridColumns(
  columns: GanttColumn[],
  sourceColumnId: string,
  targetColumnId: string,
  position: 'left' | 'right',
): GanttColumn[] {
  if (!columns || columns.length <= 1 || sourceColumnId === targetColumnId) {
    return columns ? [...columns] : []
  }
  const sourceIdx = columns.findIndex((c) => c.id === sourceColumnId)
  const targetIdx = columns.findIndex((c) => c.id === targetColumnId)
  if (sourceIdx === -1 || targetIdx === -1) {
    return [...columns]
  }
  const sourceCol = columns[sourceIdx]
  const targetCol = columns[targetIdx]
  if (sourceCol.reorderable === false || targetCol.reorderable === false) {
    return [...columns]
  }

  const next = columns.filter((c) => c.id !== sourceColumnId)
  const newTargetIdx = next.findIndex((c) => c.id === targetColumnId)
  if (newTargetIdx === -1) {
    return [...columns]
  }
  const insertIdx = position === 'left' ? newTargetIdx : newTargetIdx + 1
  next.splice(insertIdx, 0, sourceCol)
  return next
}

/**
 * 指定されたカラムのセル生値を行およびタスク群から取得する
 */
export function getGridCellValue(
  column: GanttColumn,
  row: GanttRow,
  tasks: GanttTask[],
  wbsCode?: string,
  calendarOptions?: AutoScheduleOptions,
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
    case 'startMonth':
    case 'startDateTime':
      return summary.start
    case 'endDate':
    case 'endMonth':
    case 'endDateTime':
      return summary.end
    case 'duration':
      return summary.durationDays
    case 'workingDays':
      if (!summary.start || !summary.end) return 0
      if (tasks.length > 0 && tasks.every((t) => isMilestoneTask(t))) return 0
      return countWorkingDays(summary.start, summary.end, calendarOptions)
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
  isMonthMode?: boolean,
  isTimeMode?: boolean,
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
        if (isMonthMode) {
          const targetDate =
            column.id === 'endDate'
              ? new Date(value.getFullYear(), value.getMonth() - 1, 1)
              : value
          return currentLocale.yearMonthFormat
            ? currentLocale.yearMonthFormat(targetDate)
            : `${targetDate.getFullYear()}/${targetDate.getMonth() + 1}`
        }
        if (isTimeMode) {
          const dateStr = currentLocale.dateFormat(value)
          const h = value.getHours().toString().padStart(2, '0')
          const m = value.getMinutes().toString().padStart(2, '0')
          return `${dateStr} ${h}:${m}`
        }
        if (column.id === 'endDate') {
          const summary = calculateRowSummaryDates(tasks)
          if (
            value.getHours() === 0 &&
            value.getMinutes() === 0 &&
            (!summary.start || summary.start.getTime() < value.getTime())
          ) {
            return currentLocale.dateFormat(
              new Date(value.getFullYear(), value.getMonth(), value.getDate() - 1),
            )
          }
        }
        return currentLocale.dateFormat(value)
      }
      return ''
    case 'startMonth':
    case 'endMonth':
      if (value instanceof Date && !Number.isNaN(value.getTime())) {
        const targetDate =
          column.id === 'endMonth'
            ? new Date(value.getFullYear(), value.getMonth() - 1, 1)
            : value
        return currentLocale.yearMonthFormat
          ? currentLocale.yearMonthFormat(targetDate)
          : `${targetDate.getFullYear()}/${targetDate.getMonth() + 1}`
      }
      return ''
    case 'startDateTime':
    case 'endDateTime':
      if (value instanceof Date && !Number.isNaN(value.getTime())) {
        const dateStr = currentLocale.dateFormat(value)
        const h = value.getHours().toString().padStart(2, '0')
        const m = value.getMinutes().toString().padStart(2, '0')
        return `${dateStr} ${h}:${m}`
      }
      return ''
    case 'duration':
      if (tasks.length > 0 && tasks.every((t) => isMilestoneTask(t))) {
        return currentLocale.duration.days(0)
      }
      if (isTimeMode) {
        const summary = calculateRowSummaryDates(tasks)
        if (summary.start && summary.end) {
          return formatDuration(summary.start, summary.end, currentLocale)
        }
        return '-'
      }
      if (typeof value === 'number' && value > 0) {
        return currentLocale.duration.days(value)
      }
      return '-'
    case 'workingDays':
      if (tasks.length > 0 && tasks.every((t) => isMilestoneTask(t))) {
        return currentLocale.duration.days(0)
      }
      if (typeof value === 'number' && value > 0) {
        return currentLocale.duration.days(value)
      }
      return '-'
    case 'progress':
      if (tasks.length > 0 && tasks.every((t) => isMilestoneTask(t)) && value === undefined) {
        return '-'
      }
      if (typeof value === 'number' && !Number.isNaN(value)) {
        return `${Math.round(value)}%`
      }
      return '-'
    default:
      return String(value)
  }
}

const TASK_BOUND_COLUMN_IDS = new Set<string>([
  'startDate',
  'endDate',
  'startMonth',
  'endMonth',
  'startDateTime',
  'endDateTime',
  'duration',
  'workingDays',
  'progress',
])

/**
 * カラムと現在の表示モードから使用するエディタ種別を解決する
 */
export function resolveColumnEditorType(
  column: GanttColumn,
  isMonthMode?: boolean,
  isTimeMode?: boolean,
): GanttColumnEditorType {
  if (column.editor && typeof column.editor === 'string') {
    return column.editor
  }

  switch (column.id) {
    case 'startDate':
    case 'endDate':
      if (isMonthMode) return 'month'
      if (isTimeMode) return 'datetime'
      return 'date'
    case 'startMonth':
    case 'endMonth':
      return 'month'
    case 'startDateTime':
    case 'endDateTime':
      return 'datetime'
    case 'duration':
    case 'workingDays':
    case 'progress':
      return 'number'
    case 'name':
      return 'text'
    default:
      if (
        column.editorOptions &&
        (typeof column.editorOptions === 'function' || column.editorOptions.length > 0)
      ) {
        return 'select'
      }
      return 'text'
  }
}

/**
 * 指定されたセルがインライン編集可能かどうかを判定する
 */
export function isGridCellEditable(
  column: GanttColumn,
  row: GanttRow,
  tasks: GanttTask[],
  hasChildren?: boolean,
  gridEditable?: boolean,
): boolean {
  if (column.editable === false) {
    return false
  }
  if (!gridEditable && column.editable === undefined) {
    return false
  }
  if (typeof column.editable === 'function') {
    return Boolean(column.editable(row, tasks))
  }

  if (column.id === 'wbs') {
    return column.editable === true && Boolean(column.valueSetter)
  }

  if (TASK_BOUND_COLUMN_IDS.has(column.id)) {
    if (column.valueSetter) {
      return true
    }
    if ((row as any).isSummary || hasChildren || (tasks ?? []).some((t) => t.type === 'summary')) {
      return false
    }
    const normalTasks = (tasks ?? []).filter((t) => t.type !== 'summary' && !(t as any).isSummary)
    if (normalTasks.length !== 1) return false
    const singleTask = normalTasks[0]
    if (isMilestoneTask(singleTask)) {
      if (column.id === 'duration' || column.id === 'workingDays' || column.id === 'progress') {
        return false
      }
      if (singleTask.movable === 'none') return false
      return true
    }
    if (column.id === 'progress') {
      if (singleTask.progressResizable === false) return false
    } else {
      if (singleTask.resizable === false || singleTask.movable === 'none') return false
    }
    return true
  }

  if (column.id === 'name') {
    return true
  }

  if (column.valueSetter || column.field || typeof column.editor === 'function') {
    return true
  }

  return false
}

function formatDateInputString(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function formatMonthInputString(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${yyyy}-${mm}`
}

function formatDateTimeInputString(d: Date): string {
  const datePart = formatDateInputString(d)
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${datePart}T${hh}:${min}`
}

function parseDateInputString(str: string, refDate?: Date | null): Date | null {
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(str.trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  const hours = refDate ? refDate.getHours() : 0
  const minutes = refDate ? refDate.getMinutes() : 0
  const seconds = refDate ? refDate.getSeconds() : 0
  const ms = refDate ? refDate.getMilliseconds() : 0
  const d = new Date(year, month, day, hours, minutes, seconds, ms)
  if (Number.isNaN(d.getTime())) return null
  return d
}

function parseMonthInputString(str: string, isEndMonth: boolean): Date | null {
  const match = /^(\d{4})-(\d{1,2})$/.exec(str.trim())
  if (!match) return null
  const year = Number(match[1])
  const monthIndex = Number(match[2]) - 1
  // 終了月は翌月1日00:00として保持する規約
  const d = isEndMonth ? new Date(year, monthIndex + 1, 1) : new Date(year, monthIndex, 1)
  if (Number.isNaN(d.getTime())) return null
  return d
}

function parseDateTimeInputString(str: string): Date | null {
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/.exec(
    str.trim(),
  )
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  const hours = Number(match[4])
  const minutes = Number(match[5])
  const seconds = match[6] ? Number(match[6]) : 0
  const d = new Date(year, month, day, hours, minutes, seconds)
  if (Number.isNaN(d.getTime())) return null
  return d
}

/**
 * インライン編集用入力コントロールの初期値文字列を生成する
 */
export function formatGridCellEditValue(
  column: GanttColumn,
  value: any,
  _row: GanttRow,
  tasks: GanttTask[],
  isMonthMode?: boolean,
  isTimeMode?: boolean,
): string {
  const editorType = resolveColumnEditorType(column, isMonthMode, isTimeMode)

  if (column.id === 'duration') {
    if (isTimeMode) {
      const summary = calculateRowSummaryDates(tasks)
      if (summary.start && summary.end) {
        const hours = Math.max(0.5, Math.round((summary.durationMs / (1000 * 60 * 60)) * 100) / 100)
        return String(hours)
      }
      return '1'
    }
    return typeof value === 'number' && value > 0 ? String(value) : '1'
  }

  if (column.id === 'workingDays') {
    return typeof value === 'number' && value > 0 ? String(value) : '1'
  }

  if (column.id === 'progress') {
    return typeof value === 'number' && !Number.isNaN(value)
      ? String(Math.round(value * 10) / 10)
      : '0'
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    if (editorType === 'month') {
      const isEndCol = column.id === 'endMonth' || (column.id === 'endDate' && Boolean(isMonthMode))
      const target = isEndCol
        ? new Date(value.getFullYear(), value.getMonth() - 1, 1)
        : value
      return formatMonthInputString(target)
    }
    if (editorType === 'datetime') {
      return formatDateTimeInputString(value)
    }
    if (editorType === 'date' && column.id === 'endDate') {
      const summary = calculateRowSummaryDates(tasks)
      if (
        value.getHours() === 0 &&
        value.getMinutes() === 0 &&
        (!summary.start || summary.start.getTime() < value.getTime())
      ) {
        return formatDateInputString(
          new Date(value.getFullYear(), value.getMonth(), value.getDate() - 1),
        )
      }
    }
    return formatDateInputString(value)
  }

  if (value === null || value === undefined) {
    return ''
  }

  return String(value)
}

/**
 * セルの編集結果を行データ（および単一タスク）に反映する
 */
export function applyGridCellEdit(
  column: GanttColumn,
  row: GanttRow,
  rawInputValue: any,
  isMonthMode?: boolean,
  isTimeMode?: boolean,
  wbsCode?: string,
  calendarOptions?: AutoScheduleOptions,
): { changed: boolean; oldValue: any; newValue: any } {
  const tasks = row.tasks ?? []
  const normalTasks = tasks.filter((t) => t.type !== 'summary' && !(t as any).isSummary)
  const singleTask = normalTasks.length === 1 ? normalTasks[0] : undefined
  const oldValue = getGridCellValue(column, row, normalTasks, wbsCode, calendarOptions)
  const editorType = resolveColumnEditorType(column, isMonthMode, isTimeMode)

  if (column.valueSetter) {
    let parsedCustomValue: any = rawInputValue
    if (typeof rawInputValue === 'string') {
      if (editorType === 'number') {
        const n = Number(rawInputValue)
        if (Number.isNaN(n)) {
          return { changed: false, oldValue, newValue: oldValue }
        }
        parsedCustomValue = n
      } else if (editorType === 'date') {
        const d = parseDateInputString(rawInputValue, oldValue instanceof Date ? oldValue : null)
        if (!d) return { changed: false, oldValue, newValue: oldValue }
        parsedCustomValue = d
      } else if (editorType === 'month') {
        const d = parseMonthInputString(rawInputValue, false)
        if (!d) return { changed: false, oldValue, newValue: oldValue }
        parsedCustomValue = d
      } else if (editorType === 'datetime') {
        const d = parseDateTimeInputString(rawInputValue)
        if (!d) return { changed: false, oldValue, newValue: oldValue }
        parsedCustomValue = d
      }
    }
    const setterResult = column.valueSetter(row, parsedCustomValue, normalTasks, column)
    if (setterResult === false) {
      return { changed: false, oldValue, newValue: oldValue }
    }
    if (setterResult && typeof setterResult === 'object') {
      Object.assign(row, setterResult)
    }
    const newValue = getGridCellValue(column, row, normalTasks, wbsCode, calendarOptions)
    const isSame =
      oldValue instanceof Date && newValue instanceof Date
        ? oldValue.getTime() === newValue.getTime()
        : oldValue === newValue
    return { changed: !isSame, oldValue, newValue }
  }

  switch (column.id) {
    case 'name': {
      const nextName = String(rawInputValue ?? '').trim()
      if (!nextName || nextName === row.name) {
        return { changed: false, oldValue, newValue: row.name }
      }
      const prevRowName = row.name
      row.name = nextName
      if (singleTask && (!singleTask.name || singleTask.name === prevRowName)) {
        singleTask.name = nextName
      }
      return { changed: true, oldValue: prevRowName, newValue: nextName }
    }

    case 'startDate':
    case 'startMonth':
    case 'startDateTime': {
      if (!singleTask) {
        return { changed: false, oldValue, newValue: oldValue }
      }
      let nextStart: Date | null = null
      if (rawInputValue instanceof Date) {
        nextStart = new Date(rawInputValue.getTime())
      } else if (typeof rawInputValue === 'string') {
        if (editorType === 'month') {
          nextStart = parseMonthInputString(rawInputValue, false)
        } else if (editorType === 'datetime') {
          nextStart = parseDateTimeInputString(rawInputValue)
        } else {
          nextStart = parseDateInputString(rawInputValue, singleTask.start)
        }
      }
      if (!nextStart || Number.isNaN(nextStart.getTime())) {
        return { changed: false, oldValue, newValue: oldValue }
      }
      if (singleTask.start && singleTask.start.getTime() === nextStart.getTime()) {
        return { changed: false, oldValue, newValue: oldValue }
      }
      const prevStart = singleTask.start ? new Date(singleTask.start.getTime()) : null
      singleTask.start = nextStart
      if (isMilestoneTask(singleTask)) {
        singleTask.end = new Date(nextStart.getTime())
        return { changed: true, oldValue: prevStart, newValue: nextStart }
      }
      // 開始日が終了日を超えた場合は終了日を開始日に合わせる（月モードの場合は翌月1日、日モードの場合は翌日0時）
      if (singleTask.end && nextStart.getTime() > singleTask.end.getTime()) {
        if (editorType === 'month') {
          singleTask.end = new Date(nextStart.getFullYear(), nextStart.getMonth() + 1, 1)
        } else if (editorType === 'datetime') {
          singleTask.end = new Date(nextStart.getTime() + 60 * 60 * 1000)
        } else if (
          editorType === 'date' &&
          singleTask.end.getHours() === 0 &&
          singleTask.end.getMinutes() === 0
        ) {
          singleTask.end = new Date(nextStart.getFullYear(), nextStart.getMonth(), nextStart.getDate() + 1)
        } else {
          singleTask.end = new Date(nextStart.getTime())
        }
      } else if (
        editorType === 'month' &&
        singleTask.end &&
        nextStart.getTime() >= singleTask.end.getTime()
      ) {
        singleTask.end = new Date(nextStart.getFullYear(), nextStart.getMonth() + 1, 1)
      } else if (
        editorType === 'date' &&
        singleTask.end &&
        singleTask.end.getHours() === 0 &&
        singleTask.end.getMinutes() === 0 &&
        nextStart.getTime() >= singleTask.end.getTime()
      ) {
        singleTask.end = new Date(nextStart.getFullYear(), nextStart.getMonth(), nextStart.getDate() + 1)
      }
      return { changed: true, oldValue: prevStart, newValue: nextStart }
    }

    case 'endDate':
    case 'endMonth':
    case 'endDateTime': {
      if (!singleTask) {
        return { changed: false, oldValue, newValue: oldValue }
      }
      let nextEnd: Date | null = null
      if (rawInputValue instanceof Date) {
        nextEnd = new Date(rawInputValue.getTime())
      } else if (typeof rawInputValue === 'string') {
        if (editorType === 'month') {
          nextEnd = parseMonthInputString(rawInputValue, !isMilestoneTask(singleTask))
        } else if (editorType === 'datetime') {
          nextEnd = parseDateTimeInputString(rawInputValue)
        } else {
          const parsed = parseDateInputString(rawInputValue, singleTask.end)
          if (parsed) {
            if (isMilestoneTask(singleTask)) {
              nextEnd = parsed
            } else if (
              column.id === 'endDate' &&
              (!singleTask.end ||
                (singleTask.end.getHours() === 0 && singleTask.end.getMinutes() === 0))
            ) {
              nextEnd = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate() + 1)
            } else {
              nextEnd = parsed
            }
          }
        }
      }
      if (!nextEnd || Number.isNaN(nextEnd.getTime())) {
        return { changed: false, oldValue, newValue: oldValue }
      }
      if (singleTask.end && singleTask.end.getTime() === nextEnd.getTime()) {
        return { changed: false, oldValue, newValue: oldValue }
      }
      const prevEnd = singleTask.end ? new Date(singleTask.end.getTime()) : null
      singleTask.end = nextEnd
      if (isMilestoneTask(singleTask)) {
        singleTask.start = new Date(nextEnd.getTime())
        return { changed: true, oldValue: prevEnd, newValue: nextEnd }
      }
      // 終了日が開始日より前になった場合は開始日を終了日に合わせる
      if (singleTask.start && nextEnd.getTime() < singleTask.start.getTime()) {
        if (editorType === 'month') {
          singleTask.start = new Date(nextEnd.getFullYear(), nextEnd.getMonth() - 1, 1)
        } else if (
          editorType === 'date' &&
          nextEnd.getHours() === 0 &&
          nextEnd.getMinutes() === 0
        ) {
          singleTask.start = new Date(nextEnd.getFullYear(), nextEnd.getMonth(), nextEnd.getDate() - 1)
        } else {
          singleTask.start = new Date(nextEnd.getTime())
        }
      } else if (
        editorType === 'month' &&
        singleTask.start &&
        nextEnd.getTime() <= singleTask.start.getTime()
      ) {
        singleTask.start = new Date(nextEnd.getFullYear(), nextEnd.getMonth() - 1, 1)
      } else if (
        editorType === 'date' &&
        singleTask.start &&
        nextEnd.getHours() === 0 &&
        nextEnd.getMinutes() === 0 &&
        nextEnd.getTime() <= singleTask.start.getTime()
      ) {
        singleTask.start = new Date(nextEnd.getFullYear(), nextEnd.getMonth(), nextEnd.getDate() - 1)
      }
      return { changed: true, oldValue: prevEnd, newValue: nextEnd }
    }

    case 'duration': {
      if (!singleTask || !singleTask.start || isMilestoneTask(singleTask)) {
        return { changed: false, oldValue, newValue: oldValue }
      }
      const numVal = typeof rawInputValue === 'number' ? rawInputValue : Number(rawInputValue)
      if (Number.isNaN(numVal) || numVal <= 0) {
        return { changed: false, oldValue, newValue: oldValue }
      }
      if (isTimeMode) {
        const prevHours =
          Math.round(
            ((singleTask.end.getTime() - singleTask.start.getTime()) / (1000 * 60 * 60)) * 100,
          ) / 100
        const nextHours = Math.max(0.25, numVal)
        if (prevHours === nextHours) {
          return { changed: false, oldValue: prevHours, newValue: nextHours }
        }
        singleTask.end = new Date(singleTask.start.getTime() + Math.round(nextHours * 3600000))
        return { changed: true, oldValue: prevHours, newValue: nextHours }
      } else {
        const nextDays = Math.max(1, Math.round(numVal))
        const prevDays = typeof oldValue === 'number' ? oldValue : 1
        if (nextDays === prevDays) {
          return { changed: false, oldValue: prevDays, newValue: nextDays }
        }
        const s = singleTask.start
        const e = singleTask.end ?? s
        singleTask.end = new Date(
          s.getFullYear(),
          s.getMonth(),
          s.getDate() + nextDays,
          e.getHours(),
          e.getMinutes(),
          e.getSeconds(),
          e.getMilliseconds(),
        )
        return { changed: true, oldValue: prevDays, newValue: nextDays }
      }
    }

    case 'workingDays': {
      if (!singleTask || !singleTask.start || isMilestoneTask(singleTask)) {
        return { changed: false, oldValue, newValue: oldValue }
      }
      const numVal = typeof rawInputValue === 'number' ? rawInputValue : Number(rawInputValue)
      if (Number.isNaN(numVal) || numVal <= 0) {
        return { changed: false, oldValue, newValue: oldValue }
      }
      const nextWorkingDays = Math.max(1, Math.round(numVal))
      const prevWorkingDays = typeof oldValue === 'number' ? oldValue : 1
      if (nextWorkingDays === prevWorkingDays) {
        return { changed: false, oldValue: prevWorkingDays, newValue: nextWorkingDays }
      }
      const effectiveMode =
        calendarOptions?.calendarMode ??
        (calendarOptions?.isHoliday ? 'weekends-holidays' : 'weekends')
      const checker = createNonWorkingDayChecker(
        effectiveMode,
        calendarOptions?.isHoliday,
        calendarOptions?.nonWorkingDays,
      )
      if (checker) {
        const snappedStartMs = snapToWorkingStartMs(singleTask.start.getTime(), checker)
        if (snappedStartMs !== singleTask.start.getTime()) {
          singleTask.start = new Date(snappedStartMs)
        }
      }
      singleTask.end = addWorkingDays(singleTask.start, nextWorkingDays, {
        ...calendarOptions,
        calendarMode: effectiveMode,
      })
      return { changed: true, oldValue: prevWorkingDays, newValue: nextWorkingDays }
    }

    case 'progress': {
      if (!singleTask) {
        return { changed: false, oldValue, newValue: oldValue }
      }
      const numVal = typeof rawInputValue === 'number' ? rawInputValue : Number(rawInputValue)
      if (Number.isNaN(numVal)) {
        return { changed: false, oldValue, newValue: oldValue }
      }
      const clamped = Math.min(100, Math.max(0, Math.round(numVal * 10) / 10))
      const prevProgress = singleTask.progress
      if (prevProgress === clamped) {
        return { changed: false, oldValue: prevProgress, newValue: clamped }
      }
      singleTask.progress = clamped
      return { changed: true, oldValue: prevProgress, newValue: clamped }
    }

    default: {
      if (column.field) {
        let nextVal: any = rawInputValue
        if (editorType === 'number' && typeof rawInputValue === 'string') {
          if (rawInputValue.trim() === '') {
            nextVal = undefined
          } else {
            const parsed = Number(rawInputValue)
            if (Number.isNaN(parsed)) {
              return { changed: false, oldValue, newValue: oldValue }
            }
            nextVal = parsed
          }
        }
        const prevVal = (row as any)[column.field]
        if (prevVal === nextVal) {
          return { changed: false, oldValue: prevVal, newValue: nextVal }
        }
        ;(row as any)[column.field] = nextVal
        return { changed: true, oldValue: prevVal, newValue: nextVal }
      }
      return { changed: false, oldValue, newValue: oldValue }
    }
  }
}


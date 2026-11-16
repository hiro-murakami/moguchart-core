import type {
  GanttColumn,
  GanttBuiltinColumnId,
  GanttColumnEditorType,
  GanttRow,
  GanttTask,
  GridCellNavigationDirection,
  GridSortDirection,
  GridCellRange,
} from './types.js'
import type { MoguchartLocale } from './i18n.js'
import { jaLocale } from './i18n.js'
import {
  addWorkingDays,
  countWorkingDays,
  createNonWorkingDayChecker,
  snapToWorkingStartMs,
  type AutoScheduleOptions,
} from './auto-schedule.js'
import { formatDuration, isMilestoneTask } from './utils.js'

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
  deadline: { width: 100, minWidth: 70, align: 'center' },
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
  deadline: Date | null
} {
  if (!tasks || tasks.length === 0) {
    return {
      start: null,
      end: null,
      durationDays: 0,
      durationMs: 0,
      progress: undefined,
      deadline: null,
    }
  }

  let minStart = Infinity
  let maxEnd = -Infinity
  let totalDurationMs = 0
  let weightedProgressSum = 0
  let hasAnyProgress = false
  let maxDeadline = -Infinity

  for (const task of tasks) {
    if (task.type !== 'summary' && task.deadline) {
      const dl = task.deadline instanceof Date ? task.deadline.getTime() : new Date(task.deadline).getTime()
      if (!Number.isNaN(dl) && dl > maxDeadline) {
        maxDeadline = dl
      }
    }
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

  const deadlineDate = maxDeadline !== -Infinity ? new Date(maxDeadline) : null

  if (minStart === Infinity || maxEnd === -Infinity) {
    return {
      start: null,
      end: null,
      durationDays: 0,
      durationMs: 0,
      progress: undefined,
      deadline: deadlineDate,
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
    deadline: deadlineDate,
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
    deadline: currentLocale.grid?.columns.deadline ?? '期限',
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
      if (
        col.id === 'startDate' ||
        col.id === 'endDate' ||
        col.id === 'startDateTime' ||
        col.id === 'endDateTime' ||
        col.id === 'deadline'
      ) {
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
    const sortable = col.sortable !== false
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
      sortable,
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

  // 左固定（pinned）カラムが1つ以上存在する場合は、相対順序を維持しつつ左固定カラムを先頭に集約する
  if (normalized.some((c) => isGridColumnPinned(c))) {
    const pinnedCols = normalized.filter((c) => isGridColumnPinned(c))
    const unpinnedCols = normalized.filter((c) => !isGridColumnPinned(c))
    return [...pinnedCols, ...unpinnedCols]
  }

  return normalized
}

/**
 * カラムが左固定（ピン留め）指定されているかどうかを判定する
 */
export function isGridColumnPinned(col?: Pick<GanttColumn, 'pinned'> | null): boolean {
  return col?.pinned === true || col?.pinned === 'left'
}

/**
 * 可視グリッドカラムを左固定（pinned）ペインとスクロール可能ペインに分割した結果
 */
export interface PartitionedGridColumns {
  pinnedColumns: GanttColumn[]
  scrollableColumns: GanttColumn[]
  orderedColumns: GanttColumn[]
  pinnedWidth: number
  scrollableWidth: number
}

/**
 * 可視カラム配列を左固定グループとスクロールグループに分割し、各領域の幅合計を算出する
 */
export function partitionGridColumns(columns: GanttColumn[]): PartitionedGridColumns {
  const pinnedColumns: GanttColumn[] = []
  const scrollableColumns: GanttColumn[] = []
  let pinnedWidth = 0
  let scrollableWidth = 0

  for (const col of columns) {
    const w = col.width ?? 100
    if (isGridColumnPinned(col)) {
      pinnedColumns.push(col)
      pinnedWidth += w
    } else {
      scrollableColumns.push(col)
      scrollableWidth += w
    }
  }

  return {
    pinnedColumns,
    scrollableColumns,
    orderedColumns: [...pinnedColumns, ...scrollableColumns],
    pinnedWidth,
    scrollableWidth,
  }
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
  if (isGridColumnPinned(sourceCol) !== isGridColumnPinned(targetCol)) {
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

const UNSAFE_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

/**
 * プロトタイプ汚染を引き起こす危険なオブジェクトキーかどうかを判定する
 */
export function isUnsafePropertyKey(key: string): boolean {
  return UNSAFE_OBJECT_KEYS.has(key)
}

const FORMULA_TRIGGER_RE = /^[ \t]*(?:[=@]|[+-](?=\S))/
const SAFE_SIGNED_NUMBER_RE = /^[ \t]*[+-]?\d+(?:\.\d+)?%?$/

/**
 * スプレッドシート（Excel / Google Sheets 等）への貼り付け・出力時の数式インジェクションを防止する
 */
export function sanitizeSpreadsheetFormula(text: string): string {
  if (!text) return text
  if (SAFE_SIGNED_NUMBER_RE.test(text)) return text
  if (FORMULA_TRIGGER_RE.test(text)) {
    return `'${text}`
  }
  return text
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
    case 'deadline':
      return summary.deadline
    default:
      if (
        column.field &&
        !isUnsafePropertyKey(column.field) &&
        Object.prototype.hasOwnProperty.call(row, column.field) &&
        (row as any)[column.field] !== undefined
      ) {
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
    case 'deadline':
      if (value instanceof Date && !Number.isNaN(value.getTime())) {
        const allMilestones = tasks.length > 0 && tasks.every((t) => isMilestoneTask(t))
        if (isMonthMode) {
          const targetDate =
            column.id === 'endDate' || (column.id === 'deadline' && !allMilestones)
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
        } else if (column.id === 'deadline') {
          if (!allMilestones && value.getHours() === 0 && value.getMinutes() === 0) {
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
  'deadline',
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
    case 'deadline':
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

/**
 * 現在のセル（currentRowId, currentColumnId）から指定方向にある次のインライン編集可能セルを検索する。
 * 編集不可のセルは自動的にスキップし、'next' / 'prev' は行端で次行・前行へ折り返す。
 */
export function findAdjacentEditableCell(
  displayRows: GanttRow[],
  allRows: GanttRow[],
  columns: GanttColumn[],
  currentRowId: string,
  currentColumnId: string,
  direction: GridCellNavigationDirection,
  gridEditable?: boolean,
): { rowId: string; columnId: string } | null {
  const visibleColumns = (columns ?? []).filter((c) => c.visible !== false)
  if (visibleColumns.length === 0 || !displayRows || displayRows.length === 0) {
    return null
  }

  const currentRowIndex = displayRows.findIndex((r) => r.id === currentRowId)
  const currentColIndex = visibleColumns.findIndex((c) => c.id === currentColumnId)
  if (currentRowIndex === -1 || currentColIndex === -1) {
    return null
  }

  const rowsWithChildren = new Set<string>()
  for (const r of allRows ?? displayRows) {
    if (r.parentId) {
      rowsWithChildren.add(r.parentId)
    }
  }

  const canEdit = (row: GanttRow, col: GanttColumn): boolean =>
    isGridCellEditable(col, row, row.tasks ?? [], rowsWithChildren.has(row.id), gridEditable)

  if (direction === 'next') {
    // 1. 現在行の右側のカラムを探索
    const currentRow = displayRows[currentRowIndex]
    for (let cIdx = currentColIndex + 1; cIdx < visibleColumns.length; cIdx++) {
      if (canEdit(currentRow, visibleColumns[cIdx])) {
        return { rowId: currentRow.id, columnId: visibleColumns[cIdx].id }
      }
    }
    // 2. 次の行以降を先頭カラムから順に探索
    for (let rIdx = currentRowIndex + 1; rIdx < displayRows.length; rIdx++) {
      const row = displayRows[rIdx]
      for (let cIdx = 0; cIdx < visibleColumns.length; cIdx++) {
        if (canEdit(row, visibleColumns[cIdx])) {
          return { rowId: row.id, columnId: visibleColumns[cIdx].id }
        }
      }
    }
    return null
  }

  if (direction === 'prev') {
    // 1. 現在行の左側のカラムを探索
    const currentRow = displayRows[currentRowIndex]
    for (let cIdx = currentColIndex - 1; cIdx >= 0; cIdx--) {
      if (canEdit(currentRow, visibleColumns[cIdx])) {
        return { rowId: currentRow.id, columnId: visibleColumns[cIdx].id }
      }
    }
    // 2. 前の行以前を末尾カラムから逆順に探索
    for (let rIdx = currentRowIndex - 1; rIdx >= 0; rIdx--) {
      const row = displayRows[rIdx]
      for (let cIdx = visibleColumns.length - 1; cIdx >= 0; cIdx--) {
        if (canEdit(row, visibleColumns[cIdx])) {
          return { rowId: row.id, columnId: visibleColumns[cIdx].id }
        }
      }
    }
    return null
  }

  if (direction === 'down') {
    const col = visibleColumns[currentColIndex]
    for (let rIdx = currentRowIndex + 1; rIdx < displayRows.length; rIdx++) {
      const row = displayRows[rIdx]
      if (canEdit(row, col)) {
        return { rowId: row.id, columnId: col.id }
      }
    }
    return null
  }

  if (direction === 'up') {
    const col = visibleColumns[currentColIndex]
    for (let rIdx = currentRowIndex - 1; rIdx >= 0; rIdx--) {
      const row = displayRows[rIdx]
      if (canEdit(row, col)) {
        return { rowId: row.id, columnId: col.id }
      }
    }
    return null
  }

  return null
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
  const trimmed = str.trim()
  let year: number
  let month: number
  let day: number
  const ymdMatch = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(trimmed)
  if (ymdMatch) {
    year = Number(ymdMatch[1])
    month = Number(ymdMatch[2]) - 1
    day = Number(ymdMatch[3])
  } else {
    const mdyMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed)
    if (!mdyMatch) return null
    month = Number(mdyMatch[1]) - 1
    day = Number(mdyMatch[2])
    year = Number(mdyMatch[3])
  }
  const hours = refDate ? refDate.getHours() : 0
  const minutes = refDate ? refDate.getMinutes() : 0
  const seconds = refDate ? refDate.getSeconds() : 0
  const ms = refDate ? refDate.getMilliseconds() : 0
  const d = new Date(year, month, day, hours, minutes, seconds, ms)
  if (Number.isNaN(d.getTime())) return null
  return d
}

function parseMonthInputString(str: string, isEndMonth: boolean): Date | null {
  const match = /^(\d{4})[-/](\d{1,2})$/.exec(str.trim())
  if (!match) return null
  const year = Number(match[1])
  const monthIndex = Number(match[2]) - 1
  // 終了月は翌月1日00:00として保持する規約
  const d = isEndMonth ? new Date(year, monthIndex + 1, 1) : new Date(year, monthIndex, 1)
  if (Number.isNaN(d.getTime())) return null
  return d
}

function parseDateTimeInputString(str: string): Date | null {
  const trimmed = str.trim()
  const match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/.exec(
    trimmed,
  )
  if (match) {
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
  const mdyMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/.exec(
    trimmed,
  )
  if (!mdyMatch) return null
  const month = Number(mdyMatch[1]) - 1
  const day = Number(mdyMatch[2])
  const year = Number(mdyMatch[3])
  const hours = Number(mdyMatch[4])
  const minutes = Number(mdyMatch[5])
  const seconds = mdyMatch[6] ? Number(mdyMatch[6]) : 0
  const d = new Date(year, month, day, hours, minutes, seconds)
  if (Number.isNaN(d.getTime())) return null
  return d
}

function parseGridNumericInput(val: any): number {
  if (typeof val === 'number') return val
  if (typeof val !== 'string') return NaN
  const trimmed = val.trim()
  if (!trimmed) return NaN
  const direct = Number(trimmed)
  if (!Number.isNaN(direct)) return direct
  const hmMatch = /^(\d+(?:\.\d+)?)\s*(?:時間|hours?|hrs?|h)\s*(?:(\d+(?:\.\d+)?)\s*(?:分|minutes?|mins?|m))?$/i.exec(
    trimmed,
  )
  if (hmMatch) {
    return Number(hmMatch[1]) + (hmMatch[2] ? Number(hmMatch[2]) / 60 : 0)
  }
  const minMatch = /^(\d+(?:\.\d+)?)\s*(?:分|minutes?|mins?|m)$/i.exec(trimmed)
  if (minMatch) {
    return Number(minMatch[1]) / 60
  }
  const unitMatch = /^([+-]?\d+(?:\.\d+)?)\s*(?:%|日|days?|d)?$/i.exec(trimmed)
  return unitMatch ? Number(unitMatch[1]) : NaN
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
    const allMilestones = tasks.length > 0 && tasks.every((t) => isMilestoneTask(t))
    if (editorType === 'month') {
      const isEndCol =
        column.id === 'endMonth' ||
        ((column.id === 'endDate' || (column.id === 'deadline' && !allMilestones)) &&
          Boolean(isMonthMode))
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
    } else if (editorType === 'date' && column.id === 'deadline') {
      if (!allMilestones && value.getHours() === 0 && value.getMinutes() === 0) {
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
        const n = parseGridNumericInput(rawInputValue)
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
      for (const key of Object.keys(setterResult)) {
        if (!isUnsafePropertyKey(key)) {
          ;(row as any)[key] = (setterResult as any)[key]
        }
      }
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
      const numVal = parseGridNumericInput(rawInputValue)
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
      const numVal = parseGridNumericInput(rawInputValue)
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
      const numVal = parseGridNumericInput(rawInputValue)
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

    case 'deadline': {
      if (!singleTask) {
        return { changed: false, oldValue, newValue: oldValue }
      }
      if (
        rawInputValue === null ||
        rawInputValue === undefined ||
        (typeof rawInputValue === 'string' && rawInputValue.trim() === '')
      ) {
        if (!singleTask.deadline) {
          return { changed: false, oldValue, newValue: undefined }
        }
        const prevDeadline = new Date(singleTask.deadline.getTime())
        singleTask.deadline = undefined
        return { changed: true, oldValue: prevDeadline, newValue: undefined }
      }

      let nextDeadline: Date | null = null
      if (rawInputValue instanceof Date) {
        nextDeadline = new Date(rawInputValue.getTime())
      } else if (typeof rawInputValue === 'string') {
        if (editorType === 'month') {
          nextDeadline = parseMonthInputString(rawInputValue, !isMilestoneTask(singleTask))
        } else if (editorType === 'datetime') {
          nextDeadline = parseDateTimeInputString(rawInputValue)
        } else {
          const parsed = parseDateInputString(rawInputValue, singleTask.deadline)
          if (parsed) {
            if (isMilestoneTask(singleTask)) {
              nextDeadline = parsed
            } else if (
              !singleTask.deadline ||
              (singleTask.deadline.getHours() === 0 && singleTask.deadline.getMinutes() === 0)
            ) {
              nextDeadline = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate() + 1)
            } else {
              nextDeadline = parsed
            }
          }
        }
      }
      if (!nextDeadline || Number.isNaN(nextDeadline.getTime())) {
        return { changed: false, oldValue, newValue: oldValue }
      }
      if (singleTask.deadline && singleTask.deadline.getTime() === nextDeadline.getTime()) {
        return { changed: false, oldValue, newValue: oldValue }
      }
      const prevDeadline = singleTask.deadline ? new Date(singleTask.deadline.getTime()) : null
      singleTask.deadline = nextDeadline
      return { changed: true, oldValue: prevDeadline, newValue: nextDeadline }
    }

    default: {
      if (column.field && !isUnsafePropertyKey(column.field)) {
        let nextVal: any = rawInputValue
        if (editorType === 'number' && typeof rawInputValue === 'string') {
          if (rawInputValue.trim() === '') {
            nextVal = undefined
          } else {
            const parsed = parseGridNumericInput(rawInputValue)
            if (Number.isNaN(parsed)) {
              return { changed: false, oldValue, newValue: oldValue }
            }
            nextVal = parsed
          }
        }
        const prevVal = Object.prototype.hasOwnProperty.call(row, column.field)
          ? (row as any)[column.field]
          : undefined
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

// ============================================================
// カラムソート（WBS階層維持ソート）
// ============================================================

/**
 * WBSコード文字列（例: "1.2", "1.10"）を数値セグメント単位で比較する
 */
export function compareWbsCodes(a: string, b: string): number {
  if (a === b) return 0
  if (!a) return 1
  if (!b) return -1
  const partsA = a.split('.').map((p) => Number(p))
  const partsB = b.split('.').map((p) => Number(p))
  const len = Math.max(partsA.length, partsB.length)
  for (let i = 0; i < len; i++) {
    const valA = partsA[i]
    const valB = partsB[i]
    if (valA === undefined) return -1
    if (valB === undefined) return 1
    if (!Number.isNaN(valA) && !Number.isNaN(valB)) {
      if (valA !== valB) return valA - valB
    } else {
      const cmp = String(partsA[i]).localeCompare(String(partsB[i]))
      if (cmp !== 0) return cmp
    }
  }
  return 0
}

function isEmptyGridSortValue(val: any): boolean {
  if (val === null || val === undefined || val === '') return true
  if (typeof val === 'number' && Number.isNaN(val)) return true
  if (val instanceof Date && Number.isNaN(val.getTime())) return true
  return false
}

/**
 * 2つの行の特定カラム値を比較する（空値は昇順・降順ともに末尾へ配置）
 */
export function compareGridRowValues(
  rowA: GanttRow,
  rowB: GanttRow,
  column: GanttColumn,
  direction: GridSortDirection,
  wbsCodes?: Map<string, string>,
  calendarOptions?: AutoScheduleOptions,
): number {
  const tasksA = rowA.tasks ?? []
  const tasksB = rowB.tasks ?? []
  const valA = getGridCellValue(column, rowA, tasksA, wbsCodes?.get(rowA.id), calendarOptions)
  const valB = getGridCellValue(column, rowB, tasksB, wbsCodes?.get(rowB.id), calendarOptions)

  const emptyA = isEmptyGridSortValue(valA)
  const emptyB = isEmptyGridSortValue(valB)
  if (emptyA && emptyB) return 0
  if (emptyA) return 1
  if (emptyB) return -1

  const sign = direction === 'desc' ? -1 : 1

  if (column.comparator) {
    return column.comparator(valA, valB, rowA, rowB) * sign
  }

  if (column.id === 'wbs') {
    return compareWbsCodes(String(valA), String(valB)) * sign
  }

  if (valA instanceof Date && valB instanceof Date) {
    return (valA.getTime() - valB.getTime()) * sign
  }

  if (typeof valA === 'number' && typeof valB === 'number') {
    return (valA - valB) * sign
  }

  return String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' }) * sign
}

/**
 * WBS親子階層構造を維持したまま、同一親（同じ階層レベル）の兄弟行同士をソートする
 */
export function sortGridRowsHierarchically(
  rows: GanttRow[],
  column: GanttColumn,
  direction: GridSortDirection,
  options?: {
    wbsCodes?: Map<string, string>
    calendarOptions?: AutoScheduleOptions
  },
): GanttRow[] {
  if (!rows || rows.length <= 1) return [...(rows ?? [])]

  const rowIds = new Set(rows.map((r) => r.id))
  const originalIndex = new Map<string, number>()
  rows.forEach((r, idx) => originalIndex.set(r.id, idx))

  const rootRows: GanttRow[] = []
  const childrenMap = new Map<string, GanttRow[]>()

  for (const row of rows) {
    if (row.parentId && rowIds.has(row.parentId)) {
      let siblings = childrenMap.get(row.parentId)
      if (!siblings) {
        siblings = []
        childrenMap.set(row.parentId, siblings)
      }
      siblings.push(row)
    } else {
      rootRows.push(row)
    }
  }

  const sortSiblings = (siblings: GanttRow[]): GanttRow[] => {
    return [...siblings].sort((a, b) => {
      const cmp = compareGridRowValues(
        a,
        b,
        column,
        direction,
        options?.wbsCodes,
        options?.calendarOptions,
      )
      if (cmp !== 0) return cmp
      return (originalIndex.get(a.id) ?? 0) - (originalIndex.get(b.id) ?? 0)
    })
  }

  const result: GanttRow[] = []
  const visited = new Set<string>()

  const traverse = (siblings: GanttRow[]) => {
    const sorted = sortSiblings(siblings)
    for (const row of sorted) {
      if (visited.has(row.id)) continue
      visited.add(row.id)
      result.push(row)
      const children = childrenMap.get(row.id)
      if (children && children.length > 0) {
        traverse(children)
      }
    }
  }

  traverse(rootRows)

  // 万一循環参照等で未訪問の行があれば元の順序で末尾に追加
  if (result.length < rows.length) {
    for (const row of rows) {
      if (!visited.has(row.id)) {
        result.push(row)
      }
    }
  }

  return result
}

// ============================================================
// 固定フッター集計行（最小開始日・最大終了日・合計期間・加重平均進捗率）
// ============================================================

export interface GridFooterSummary {
  rowCount: number
  leafRowCount: number
  taskCount: number
  start: Date | null
  end: Date | null
  durationDays: number
  durationMs: number
  workingDays: number
  progress: number
  deadline: Date | null
}

/**
 * 全行（親行の重複集計を避けるため、葉タスクまたは通常タスク）からフッター集計値を算出する
 */
export function calculateGridFooterSummary(
  rows: GanttRow[],
  calendarOptions?: AutoScheduleOptions,
): GridFooterSummary {
  if (!rows || rows.length === 0) {
    return {
      rowCount: 0,
      leafRowCount: 0,
      taskCount: 0,
      start: null,
      end: null,
      durationDays: 0,
      durationMs: 0,
      workingDays: 0,
      progress: 0,
      deadline: null,
    }
  }

  const parentIds = new Set<string>()
  for (const r of rows) {
    if (r.parentId) parentIds.add(r.parentId)
  }

  const leafRows = rows.filter((r) => !parentIds.has(r.id))
  const targetRows = leafRows.length > 0 ? leafRows : rows

  const allNormalTasks: GanttTask[] = []
  for (const row of targetRows) {
    const tasks = row.tasks ?? []
    for (const t of tasks) {
      if (t.type !== 'summary' && !(t as any).isSummary) {
        allNormalTasks.push(t)
      }
    }
  }

  const summary = calculateRowSummaryDates(allNormalTasks)
  const workingDays =
    summary.start && summary.end
      ? countWorkingDays(summary.start, summary.end, calendarOptions)
      : 0

  return {
    rowCount: rows.length,
    leafRowCount: leafRows.length,
    taskCount: allNormalTasks.length,
    start: summary.start,
    end: summary.end,
    durationDays: summary.durationDays,
    durationMs: summary.durationMs,
    workingDays,
    progress: summary.progress ?? 0,
    deadline: summary.deadline,
  }
}

/**
 * フッターセルの集計値を取得する
 */
export function getGridFooterCellValue(
  column: GanttColumn,
  rows: GanttRow[],
  footerSummary: GridFooterSummary,
  footerLabel?: string,
  locale?: MoguchartLocale,
): any {
  if (column.footerValueGetter) {
    return column.footerValueGetter(rows, column)
  }

  switch (column.id) {
    case 'wbs':
      return ''
    case 'name':
      return footerLabel ?? locale?.grid?.footerLabel ?? '集計'
    case 'startDate':
    case 'startMonth':
    case 'startDateTime':
      return footerSummary.start
    case 'endDate':
    case 'endMonth':
    case 'endDateTime':
      return footerSummary.end
    case 'duration':
      return footerSummary.start && footerSummary.end ? footerSummary.durationDays : null
    case 'workingDays':
      return footerSummary.start && footerSummary.end ? footerSummary.workingDays : null
    case 'progress':
      return footerSummary.taskCount > 0 ? footerSummary.progress : null
    case 'deadline':
      return footerSummary.deadline
    default:
      return ''
  }
}

/**
 * フッターセルの表示文字列をフォーマットする
 */
export function formatGridFooterCellValue(
  column: GanttColumn,
  value: any,
  rows: GanttRow[],
  footerSummary: GridFooterSummary,
  locale?: MoguchartLocale,
  isMonthMode?: boolean,
  isTimeMode?: boolean,
): string {
  const currentLocale = locale ?? jaLocale

  if (column.footerFormatter) {
    return column.footerFormatter(value, rows, column)
  }

  if (value === null || value === undefined || value === '') {
    return ''
  }

  if (column.id === 'name') {
    return String(value)
  }

  if (column.id === 'duration' && typeof value === 'number') {
    if (isTimeMode && footerSummary.start && footerSummary.end) {
      return formatDuration(footerSummary.start, footerSummary.end, currentLocale)
    }
    return currentLocale.duration.days(value)
  }

  if (column.id === 'workingDays' && typeof value === 'number') {
    return currentLocale.duration.days(value)
  }

  if (column.id === 'progress' && typeof value === 'number') {
    return `${Math.round(value)}%`
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return ''
    if (
      column.id === 'startMonth' ||
      column.id === 'endMonth' ||
      (isMonthMode && (column.id === 'startDate' || column.id === 'endDate' || column.id === 'deadline'))
    ) {
      const isEndCol =
        column.id === 'endMonth' || (isMonthMode && (column.id === 'endDate' || column.id === 'deadline'))
      const targetDate = isEndCol
        ? new Date(value.getFullYear(), value.getMonth() - 1, 1)
        : value
      return currentLocale.yearMonthFormat
        ? currentLocale.yearMonthFormat(targetDate)
        : `${targetDate.getFullYear()}/${targetDate.getMonth() + 1}`
    }
    if (
      column.id === 'startDateTime' ||
      column.id === 'endDateTime' ||
      (isTimeMode && (column.id === 'startDate' || column.id === 'endDate' || column.id === 'deadline'))
    ) {
      const dateStr = currentLocale.dateFormat(value)
      const h = value.getHours().toString().padStart(2, '0')
      const m = value.getMinutes().toString().padStart(2, '0')
      return `${dateStr} ${h}:${m}`
    }
    if (column.id === 'endDate' || column.id === 'deadline') {
      if (
        value.getHours() === 0 &&
        value.getMinutes() === 0 &&
        (column.id === 'deadline' || !footerSummary.start || footerSummary.start.getTime() < value.getTime())
      ) {
        return currentLocale.dateFormat(
          new Date(value.getFullYear(), value.getMonth(), value.getDate() - 1),
        )
      }
    }
    return currentLocale.dateFormat(value)
  }

  return String(value)
}

// ============================================================
// セル範囲選択 ＆ TSV クリップボード連携
// ============================================================

export interface ResolvedGridCellRange {
  startRowIndex: number
  endRowIndex: number
  startColumnIndex: number
  endColumnIndex: number
  rowIds: string[]
  columnIds: string[]
  rowIdSet: Set<string>
  columnIdSet: Set<string>
  anchorRowId: string
  anchorColumnId: string
}

/**
 * セル選択範囲（アンカー〜フォーカス）を表示行・表示カラムのインデックス範囲へ解決する
 */
export function resolveGridCellRange(
  displayRows: GanttRow[],
  columns: GanttColumn[],
  range: GridCellRange | null | undefined,
): ResolvedGridCellRange | null {
  if (!range) return null

  const r1 = displayRows.findIndex((r) => r.id === range.start.rowId)
  const r2 = displayRows.findIndex((r) => r.id === range.end.rowId)
  const c1 = columns.findIndex((c) => c.id === range.start.columnId)
  const c2 = columns.findIndex((c) => c.id === range.end.columnId)

  if (r1 === -1 || r2 === -1 || c1 === -1 || c2 === -1) {
    return null
  }

  const startRowIndex = Math.min(r1, r2)
  const endRowIndex = Math.max(r1, r2)
  const startColumnIndex = Math.min(c1, c2)
  const endColumnIndex = Math.max(c1, c2)

  const rowIds: string[] = []
  for (let i = startRowIndex; i <= endRowIndex; i++) {
    rowIds.push(displayRows[i].id)
  }

  const columnIds: string[] = []
  for (let j = startColumnIndex; j <= endColumnIndex; j++) {
    columnIds.push(columns[j].id)
  }

  return {
    startRowIndex,
    endRowIndex,
    startColumnIndex,
    endColumnIndex,
    rowIds,
    columnIds,
    rowIdSet: new Set(rowIds),
    columnIdSet: new Set(columnIds),
    anchorRowId: range.start.rowId,
    anchorColumnId: range.start.columnId,
  }
}

/**
 * 選択範囲のセル群をタブ区切りテキスト（TSV）に変換する
 */
export function formatGridRangeToTsv(
  displayRows: GanttRow[],
  columns: GanttColumn[],
  range: GridCellRange,
  options?: {
    locale?: MoguchartLocale
    isMonthMode?: boolean
    isTimeMode?: boolean
    wbsCodes?: Map<string, string>
    calendarOptions?: AutoScheduleOptions
    sanitizeFormulas?: boolean
  },
): { tsv: string; rowIds: string[]; columnIds: string[] } {
  const resolved = resolveGridCellRange(displayRows, columns, range)
  if (!resolved) {
    return { tsv: '', rowIds: [], columnIds: [] }
  }

  const shouldSanitize = options?.sanitizeFormulas !== false
  const lines: string[] = []
  for (let r = resolved.startRowIndex; r <= resolved.endRowIndex; r++) {
    const row = displayRows[r]
    const tasks = row.tasks ?? []
    const wbsCode = options?.wbsCodes?.get(row.id)
    const cells: string[] = []
    for (let c = resolved.startColumnIndex; c <= resolved.endColumnIndex; c++) {
      const col = columns[c]
      const val = getGridCellValue(col, row, tasks, wbsCode, options?.calendarOptions)
      const formatted = formatGridCellValue(
        col,
        val,
        row,
        tasks,
        options?.locale,
        options?.isMonthMode,
        options?.isTimeMode,
      )
      // TSV 内でタブや改行が含まれる場合はスペースに置換し、必要に応じて数式プレフィックスを無害化
      const normalizedCell = String(formatted ?? '').replace(/[\t\r\n]+/g, ' ')
      cells.push(shouldSanitize ? sanitizeSpreadsheetFormula(normalizedCell) : normalizedCell)
    }
    lines.push(cells.join('\t'))
  }

  return {
    tsv: lines.join('\n'),
    rowIds: resolved.rowIds,
    columnIds: resolved.columnIds,
  }
}

/**
 * クリップボード等のTSV文字列を2次元配列にパースする
 */
export function parseTsvString(
  tsv: string,
  options?: { unescapeFormulas?: boolean },
): string[][] {
  if (!tsv) return []
  const shouldUnescape = options?.unescapeFormulas !== false
  const normalized = tsv.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const rawLines = normalized.split('\n')
  // スプレッドシートからのコピー時に末尾に空改行が付与されるケースを除去
  if (rawLines.length > 1 && rawLines[rawLines.length - 1] === '') {
    rawLines.pop()
  }
  return rawLines.map((line) =>
    line.split('\t').map((cell) => {
      if (shouldUnescape && cell.startsWith("'") && FORMULA_TRIGGER_RE.test(cell.slice(1))) {
        return cell.slice(1)
      }
      return cell
    }),
  )
}



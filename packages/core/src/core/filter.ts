import type { GanttColumn, GanttRow, GanttTask } from './types.js'
import { getGridCellValue, isUnsafePropertyKey } from './grid.js'
import {
  calculateTaskDeadline,
  calculateTaskDelay,
  clampProgress,
  isMilestoneTask,
} from './utils.js'
import { computeChildRowIds, computeRowWbsCodes } from './wbs.js'

/**
 * フィルタ非一致行の表示モード
 * - `'hide'`: 非一致行を非表示にする（一致した子孫を持つ祖先行はWBS階層維持のため残す）
 * - `'dim'`: 全行を表示したまま、非一致の行およびタスクを減光表示（`_isFilteredOut: true`）する
 */
export type GanttFilterMode = 'hide' | 'dim'

/**
 * 組み込みの進捗・遅延ステータスフィルタ種別
 */
export type GanttFilterStatus = 'all' | 'incomplete' | 'completed' | 'overdue' | 'inProgress'

/**
 * カスタムフィルタ述語関数に渡される行コンテキスト
 */
export interface GanttFilterRowContext {
  /** 評価対象の行データ */
  row: GanttRow
  /** 評価対象行に属するタスク一覧（自動生成サマリーを除く実タスク） */
  tasks: GanttTask[]
  /** WBS階層の深さ（ルート行は 0） */
  depth: number
  /** ルートから直近の親までの祖先行ID配列 */
  ancestorIds: string[]
  /** WBSコード（例: "1.2.1"） */
  wbsCode?: string
}

/**
 * WBS階層維持フィルタリング・検索の設定オブジェクト
 */
export interface GanttFilterConfig {
  /** テキスト部分一致検索（大文字小文字区別なし。行名・タスク名・WBSコード・指定グリッド列/fieldsを対象） */
  query?: string
  /** query 検索対象とする GanttRow / GanttTask の追加フィールド名（例: ['assignee', 'department']） */
  fields?: string[]
  /** ステータス相当の進捗・遅延フィルタ（デフォルト: 'all'） */
  status?: GanttFilterStatus
  /** タスク種別フィルタ */
  taskTypes?: Array<'task' | 'milestone' | 'summary'>
  /** 指定した期間と重なるタスクを持つ行に絞り込み */
  dateRange?: { start?: Date; end?: Date }
  /** カスタム判定関数（指定時は組み込み条件との AND 評価） */
  predicate?: (ctx: GanttFilterRowContext) => boolean
  /** 非一致行の表示モード（デフォルト: 'hide'） */
  mode?: GanttFilterMode
  /** 'hide' モード時に一致した子孫を持つ折りたたみ親行を一時展開するか（デフォルト: true） */
  autoExpandMatches?: boolean
  /** 親行自体が一致した場合に配下の子孫行もすべて表示対象に含めるか（デフォルト: false） */
  includeDescendantsOfMatchedParent?: boolean
}

/**
 * フィルタリング評価結果
 */
export interface GanttFilterResult {
  /** いずれかのフィルタ条件が有効かどうか */
  active: boolean
  /** 適用された表示モード */
  mode: GanttFilterMode
  /** 条件に直接一致した行IDの集合 */
  matchedRowIds: Set<string>
  /** 画面上に表示・強調維持すべき行IDの集合（matchedRowIds + 維持された祖先行 + 必要に応じ子孫行） */
  visibleRowIds: Set<string>
  /** 条件に一致したタスクIDの集合 */
  matchedTaskIds: Set<string>
  /** 評価対象の全行数 */
  totalRowCount: number
  /** 直接一致した行数 */
  matchedRowCount: number
  /** 祖先維持等を含めた表示対象行数 */
  visibleRowCount: number
}

/**
 * `evaluateRowFilter` の補助オプション
 */
export interface EvaluateRowFilterOptions {
  /** 検索対象に含めるグリッドカラム定義配列 */
  columns?: GanttColumn[]
  /** 事前計算済みのWBSコードマップ（省略時は内部で自動算出） */
  wbsCodes?: Map<string, string>
  /** `'overdue'` 判定の基準日時（省略時は現在時刻 `new Date()`） */
  now?: Date
  /** `row.visible === false` の非表示行も評価対象に含めるか（デフォルト: false） */
  includeHidden?: boolean
}

/**
 * 指定されたフィルタ設定に有効な絞り込み条件が含まれているかを判定します。
 */
export function isFilterConfigActive(config?: GanttFilterConfig | null): boolean {
  if (!config) return false
  if (typeof config.query === 'string' && config.query.trim().length > 0) return true
  if (config.status && config.status !== 'all') return true
  if (Array.isArray(config.taskTypes) && config.taskTypes.length > 0) return true
  if (config.dateRange && (config.dateRange.start != null || config.dateRange.end != null)) {
    return true
  }
  if (typeof config.predicate === 'function') return true
  return false
}

function toSafeSearchString(val: unknown): string {
  if (val === null || val === undefined) return ''
  if (typeof val === 'string') return val
  if (typeof val === 'number' || typeof val === 'boolean') return String(val)
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    const y = val.getFullYear()
    const m = String(val.getMonth() + 1).padStart(2, '0')
    const d = String(val.getDate()).padStart(2, '0')
    return `${y}-${m}-${d} ${y}/${m}/${d}`
  }
  return ''
}

function getEffectiveTaskType(task: GanttTask): 'task' | 'milestone' | 'summary' {
  if (task.type === 'summary') return 'summary'
  if (isMilestoneTask(task)) return 'milestone'
  return 'task'
}

function matchesTaskStatus(task: GanttTask, status: GanttFilterStatus, nowMs: number): boolean {
  if (!status || status === 'all') return true
  const progress = clampProgress(task.progress ?? 0)
  switch (status) {
    case 'completed':
      return progress >= 100
    case 'incomplete':
      return progress < 100
    case 'inProgress':
      return progress > 0 && progress < 100
    case 'overdue': {
      if (calculateTaskDeadline(task).isOverdue) return true
      if (calculateTaskDelay(task).isDelayed) return true
      if (progress >= 100) return false
      const endMs = task.end instanceof Date ? task.end.getTime() : new Date(task.end).getTime()
      return !Number.isNaN(endMs) && endMs < nowMs
    }
    default:
      return true
  }
}

function matchesTaskDateRange(
  task: GanttTask,
  dateRange?: { start?: Date; end?: Date },
): boolean {
  if (!dateRange || (dateRange.start == null && dateRange.end == null)) return true
  const taskStartMs =
    task.start instanceof Date ? task.start.getTime() : new Date(task.start).getTime()
  const taskEndMs = task.end instanceof Date ? task.end.getTime() : new Date(task.end).getTime()
  if (Number.isNaN(taskStartMs) || Number.isNaN(taskEndMs)) return false

  const rangeStartMs =
    dateRange.start != null
      ? dateRange.start instanceof Date
        ? dateRange.start.getTime()
        : new Date(dateRange.start).getTime()
      : -Infinity
  const rangeEndMs =
    dateRange.end != null
      ? dateRange.end instanceof Date
        ? dateRange.end.getTime()
        : new Date(dateRange.end).getTime()
      : Infinity

  if (Number.isNaN(rangeStartMs) || Number.isNaN(rangeEndMs)) return false
  return taskEndMs >= rangeStartMs && taskStartMs <= rangeEndMs
}

/**
 * WBSツリー構造を考慮して行配列に対するフィルタリング・検索結果を計算する純粋関数です。
 */
export function evaluateRowFilter(
  rows: GanttRow[],
  config?: GanttFilterConfig | null,
  options?: EvaluateRowFilterOptions,
): GanttFilterResult {
  const mode: GanttFilterMode = config?.mode ?? 'hide'
  const includeHidden = options?.includeHidden === true
  const eligibleRows = includeHidden ? rows : rows.filter((r) => r.visible !== false)
  const active = isFilterConfigActive(config)

  if (!active) {
    const allRowIds = new Set<string>()
    const allTaskIds = new Set<string>()
    for (const row of eligibleRows) {
      allRowIds.add(row.id)
      for (const task of row.tasks ?? []) {
        allTaskIds.add(task.id)
      }
    }
    return {
      active: false,
      mode,
      matchedRowIds: allRowIds,
      visibleRowIds: new Set(allRowIds),
      matchedTaskIds: allTaskIds,
      totalRowCount: eligibleRows.length,
      matchedRowCount: eligibleRows.length,
      visibleRowCount: eligibleRows.length,
    }
  }

  const rowMap = new Map<string, GanttRow>()
  for (const row of rows) {
    rowMap.set(row.id, row)
  }

  const wbsCodes = options?.wbsCodes ?? computeRowWbsCodes(rows)
  const nowMs = (options?.now ?? new Date()).getTime()
  const normalizedQuery = config!.query?.trim().toLowerCase() ?? ''
  const hasQuery = normalizedQuery.length > 0
  const hasStatusFilter = Boolean(config!.status && config!.status !== 'all')
  const hasTaskTypeFilter = Boolean(config!.taskTypes && config!.taskTypes.length > 0)
  const hasDateRangeFilter = Boolean(
    config!.dateRange && (config!.dateRange.start != null || config!.dateRange.end != null),
  )
  const requiresTaskMatch = hasStatusFilter || hasTaskTypeFilter || hasDateRangeFilter

  const safeFields = (config!.fields ?? []).filter((f) => typeof f === 'string' && !isUnsafePropertyKey(f))
  const searchableColumns = (options?.columns ?? []).filter(
    (col) => col.visible !== false && (col.field || col.valueGetter || col.id === 'wbs' || col.id === 'name'),
  )

  const ancestorIdsCache = new Map<string, string[]>()
  const getAncestorIds = (row: GanttRow): string[] => {
    const cached = ancestorIdsCache.get(row.id)
    if (cached) return cached

    const chain: string[] = []
    const visited = new Set<string>([row.id])
    let currParentId = row.parentId
    while (currParentId) {
      if (visited.has(currParentId)) break
      visited.add(currParentId)
      const parent = rowMap.get(currParentId)
      if (!parent) break
      chain.unshift(parent.id)
      currParentId = parent.parentId
    }
    ancestorIdsCache.set(row.id, chain)
    return chain
  }

  const matchedRowIds = new Set<string>()
  const matchedTaskIds = new Set<string>()

  for (const row of eligibleRows) {
    const realTasks = (row.tasks ?? []).filter((t) => t.id !== `${row.id}-summary`)
    const wbsCode = wbsCodes.get(row.id)
    const ancestorIds = getAncestorIds(row)

    if (typeof config!.predicate === 'function') {
      const passedPredicate = config!.predicate({
        row,
        tasks: realTasks,
        depth: ancestorIds.length,
        ancestorIds,
        wbsCode,
      })
      if (!passedPredicate) {
        continue
      }
    }

    let rowTextMatched = false
    if (hasQuery) {
      const rowCandidates: string[] = [row.name ?? '']
      if (wbsCode) rowCandidates.push(wbsCode)
      for (const field of safeFields) {
        rowCandidates.push(toSafeSearchString((row as unknown as Record<string, unknown>)[field]))
      }
      for (const col of searchableColumns) {
        const val = getGridCellValue(col, row, realTasks, wbsCode)
        rowCandidates.push(toSafeSearchString(val))
      }
      rowTextMatched = rowCandidates.some(
        (candidate) => candidate.length > 0 && candidate.toLowerCase().includes(normalizedQuery),
      )
    }

    const rowMatchedTaskIds: string[] = []
    for (const task of realTasks) {
      if (hasTaskTypeFilter && !config!.taskTypes!.includes(getEffectiveTaskType(task))) {
        continue
      }
      if (hasStatusFilter && !matchesTaskStatus(task, config!.status!, nowMs)) {
        continue
      }
      if (hasDateRangeFilter && !matchesTaskDateRange(task, config!.dateRange)) {
        continue
      }
      if (hasQuery && !rowTextMatched) {
        const taskCandidates: string[] = [task.name ?? '']
        for (const field of safeFields) {
          taskCandidates.push(toSafeSearchString((task as unknown as Record<string, unknown>)[field]))
        }
        const taskTextMatched = taskCandidates.some(
          (candidate) => candidate.length > 0 && candidate.toLowerCase().includes(normalizedQuery),
        )
        if (!taskTextMatched) {
          continue
        }
      }
      rowMatchedTaskIds.push(task.id)
    }

    const isRowMatched =
      rowMatchedTaskIds.length > 0 || (!requiresTaskMatch && (!hasQuery || rowTextMatched))

    if (isRowMatched) {
      matchedRowIds.add(row.id)
      for (const taskId of rowMatchedTaskIds) {
        matchedTaskIds.add(taskId)
      }
    }
  }

  // WBS階層維持: 一致した行の祖先行を visibleRowIds に追加
  const visibleRowIds = new Set<string>(matchedRowIds)
  for (const matchedId of matchedRowIds) {
    const row = rowMap.get(matchedId)
    if (!row) continue
    for (const ancestorId of getAncestorIds(row)) {
      const ancestorRow = rowMap.get(ancestorId)
      if (ancestorRow && (includeHidden || ancestorRow.visible !== false)) {
        visibleRowIds.add(ancestorId)
      }
    }
  }

  // オプション: 親行自体が一致した場合に配下の子孫行・タスクもすべて可視対象に含める
  if (config!.includeDescendantsOfMatchedParent === true) {
    for (const matchedId of matchedRowIds) {
      const descendantIds = computeChildRowIds(rows, matchedId, true)
      for (const descId of descendantIds) {
        const descRow = rowMap.get(descId)
        if (descRow && (includeHidden || descRow.visible !== false)) {
          visibleRowIds.add(descId)
          for (const task of descRow.tasks ?? []) {
            matchedTaskIds.add(task.id)
          }
        }
      }
    }
  }

  return {
    active: true,
    mode,
    matchedRowIds,
    visibleRowIds,
    matchedTaskIds,
    totalRowCount: eligibleRows.length,
    matchedRowCount: matchedRowIds.size,
    visibleRowCount: visibleRowIds.size,
  }
}

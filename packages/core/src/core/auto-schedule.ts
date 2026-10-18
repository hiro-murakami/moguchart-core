import type {
  AutoScheduleMode,
  DependencyEndpoint,
  DependencyType,
  GanttDependency,
  GanttDependencyLink,
  GanttRow,
  GanttTask,
} from './types'

/**
 * 自動スケジューリング実行オプション
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
 * 単一の先行タスク制約に基づき、後続タスクに要求される開始時刻（ミリ秒）を計算する
 */
export function computeRequiredStartMs(
  predStartMs: number,
  predEndMs: number,
  succDurationMs: number,
  type: DependencyType = 'FS',
  lagMinutes = 0,
): number {
  const lagMs = lagMinutes * 60 * 1000
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

  // 1. 全通常タスクのマップと依存グラフを構築
  const taskMap = new Map<
    string,
    {
      task: GanttTask
      startMs: number
      endMs: number
      durationMs: number
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

      const links = (task.dependencies ?? []).map(normalizeDependencyLink)
      taskMap.set(task.id, {
        task,
        startMs,
        endMs,
        durationMs: Math.max(0, endMs - startMs),
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

    let maxRequiredStartMs = -Infinity
    for (const link of entry.links) {
      const pred = taskMap.get(link.taskId)
      if (!pred) continue
      const reqStartMs = computeRequiredStartMs(
        pred.startMs,
        pred.endMs,
        entry.durationMs,
        link.type,
        link.lag,
      )
      if (reqStartMs > maxRequiredStartMs) {
        maxRequiredStartMs = reqStartMs
      }
    }

    if (maxRequiredStartMs === -Infinity) continue

    const targetStartMs =
      mode === 'strict' ? maxRequiredStartMs : Math.max(entry.startMs, maxRequiredStartMs)

    if (targetStartMs !== entry.startMs) {
      const targetEndMs = targetStartMs + entry.durationMs
      entry.startMs = targetStartMs
      entry.endMs = targetEndMs
      updatedDates.set(taskId, {
        start: new Date(targetStartMs),
        end: new Date(targetEndMs),
      })
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

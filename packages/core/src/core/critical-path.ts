import type { GanttRow } from './types'

/**
 * 依存関係グラフからクリティカルパス上のタスクIDの集合を計算する。
 *
 * 手動スケジュールのガントチャート向けに最適化:
 * - 依存関係グラフの中で最長のチェーン（最終タスクの終了時刻が最も遅いパス）を検出する
 * - 依存関係に参加していない独立タスクはクリティカルパス計算から除外する
 *
 * アルゴリズム:
 * 1. 全タスクを走査し依存関係グラフを構築
 * 2. 依存関係に参加しているタスクのみを抽出
 * 3. トポロジカルソート順に前方パス（最早終了時刻 EF）を計算
 * 4. 最終タスクから逆方向にバックトラックし、最長パスを構成するタスクを収集
 *
 * @param rows ガントチャートの全行データ
 * @returns クリティカルパス上のタスクID集合
 */
export function computeCriticalPath(rows: GanttRow[]): Set<string> {
  // 全タスクをフラットに収集
  const taskMap = new Map<string, { start: number; end: number; duration: number; dependencies: string[] }>()
  const successors = new Map<string, string[]>()
  const inDegree = new Map<string, number>()

  for (const row of rows) {
    for (const task of row.tasks) {
      const deps = task.dependencies ?? []
      const startTime = task.start instanceof Date ? task.start.getTime() : new Date(task.start as any).getTime()
      const endTime = task.end instanceof Date ? task.end.getTime() : new Date(task.end as any).getTime()

      // 不正な日時の場合はスキップ
      if (isNaN(startTime) || isNaN(endTime)) continue

      taskMap.set(task.id, {
        start: startTime,
        end: endTime,
        duration: endTime - startTime,
        dependencies: deps,
      })
      inDegree.set(task.id, 0)
    }
  }

  // 依存関係グラフ構築
  // 同時に、依存関係に参加しているタスクIDを記録
  const connectedTaskIds = new Set<string>()

  for (const [taskId, task] of taskMap) {
    let validDepCount = 0
    for (const depId of task.dependencies) {
      if (taskMap.has(depId)) {
        validDepCount++
        const succs = successors.get(depId) ?? []
        succs.push(taskId)
        successors.set(depId, succs)
        // 依存元・依存先の両方を「接続済み」として記録
        connectedTaskIds.add(taskId)
        connectedTaskIds.add(depId)
      }
    }
    inDegree.set(taskId, validDepCount)
  }

  // 接続されたタスクが2つ未満 → 空
  if (connectedTaskIds.size < 2) return new Set()

  // トポロジカルソート（Kahnのアルゴリズム）
  // 接続されたタスクのみでソート
  const queue: string[] = []
  for (const id of connectedTaskIds) {
    if ((inDegree.get(id) ?? 0) === 0) queue.push(id)
  }

  const topoOrder: string[] = []
  while (queue.length > 0) {
    const current = queue.shift()!
    topoOrder.push(current)
    for (const succ of successors.get(current) ?? []) {
      if (!connectedTaskIds.has(succ)) continue
      const newDegree = (inDegree.get(succ) ?? 0) - 1
      inDegree.set(succ, newDegree)
      if (newDegree === 0) queue.push(succ)
    }
  }

  // 循環依存のノードを除外
  if (topoOrder.length < connectedTaskIds.size) {
    const sortedSet = new Set(topoOrder)
    for (const id of connectedTaskIds) {
      if (!sortedSet.has(id)) connectedTaskIds.delete(id)
    }
    if (connectedTaskIds.size < 2) return new Set()
  }

  // --- 前方パス: 各タスクの「最早終了時刻（EF）」を計算 ---
  const ef = new Map<string, number>()
  const criticalPredecessor = new Map<string, string | null>()

  for (const id of topoOrder) {
    const task = taskMap.get(id)
    if (!task) continue

    const validDeps = task.dependencies.filter((depId) => ef.has(depId))

    if (validDeps.length === 0) {
      // チェーンの起点: 自身の終了時刻がEF
      ef.set(id, task.end)
      criticalPredecessor.set(id, null)
    } else {
      // 依存あり: 前任の EF + 自身の duration が最大のものを選択
      let bestEF = -Infinity
      let bestPred: string | null = null

      for (const depId of validDeps) {
        const depEF = ef.get(depId)!
        const candidateEF = depEF + task.duration
        if (candidateEF > bestEF) {
          bestEF = candidateEF
          bestPred = depId
        }
      }

      // 自タスクの実際の終了時刻の方が遅い場合も考慮
      if (task.end > bestEF) {
        bestEF = task.end
      }

      ef.set(id, bestEF)
      criticalPredecessor.set(id, bestPred)
    }
  }

  // --- 最長パスの終端を特定 ---
  // 後続タスクを持たない接続済みタスク（シンクノード）の中で、EFが最大のものを見つける
  const sinkNodes: string[] = []
  for (const id of topoOrder) {
    const succs = (successors.get(id) ?? []).filter((s) => connectedTaskIds.has(s))
    if (succs.length === 0) {
      sinkNodes.push(id)
    }
  }

  if (sinkNodes.length === 0) return new Set()

  // EFが最大のシンクノードを終端とする
  let endNode = sinkNodes[0]
  let maxEF = ef.get(sinkNodes[0]) ?? 0
  for (let i = 1; i < sinkNodes.length; i++) {
    const nodeEF = ef.get(sinkNodes[i]) ?? 0
    if (nodeEF > maxEF) {
      maxEF = nodeEF
      endNode = sinkNodes[i]
    }
  }

  // --- バックトラック: 終端から始端まで辿ってクリティカルパスを構成 ---
  const criticalTaskIds = new Set<string>()
  let current: string | null = endNode
  while (current !== null) {
    criticalTaskIds.add(current)
    current = criticalPredecessor.get(current) ?? null
  }

  // パスが1タスクだけの場合（チェーンになっていない）は空を返す
  if (criticalTaskIds.size <= 1) return new Set()

  return criticalTaskIds
}

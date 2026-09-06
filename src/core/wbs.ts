import type { GanttRow, GanttTask } from './types'

/**
 * 各行の階層レベル（深さ: ルートは0, その子は1, 孫は2...）を計算します。
 * 循環参照や存在しない親IDがある場合でも安全にフォールバックします。
 *
 * @param rows ガント行の配列
 * @returns 行ID -> 階層レベルのMap
 */
export function computeRowLevels(rows: GanttRow[]): Map<string, number> {
  const rowMap = new Map<string, GanttRow>()
  for (const row of rows) {
    rowMap.set(row.id, row)
  }

  const levels = new Map<string, number>()

  for (const row of rows) {
    if (levels.has(row.id)) continue

    let level = 0
    let currParentId = row.parentId
    const visited = new Set<string>([row.id])

    while (currParentId) {
      if (visited.has(currParentId)) {
        // 循環参照を検出した場合はループを終了
        break
      }
      visited.add(currParentId)

      const parentRow = rowMap.get(currParentId)
      if (!parentRow) {
        // 存在しない親ID
        break
      }

      level++
      currParentId = parentRow.parentId
    }

    levels.set(row.id, level)
  }

  return levels
}

/**
 * 各行のWBSコード（例: "1", "1.1", "1.2", "2", "2.1"...）を行の順序に基づいて自動採番します。
 *
 * @param rows ガント行の配列
 * @returns 行ID -> WBSコードのMap
 */
export function computeRowWbsCodes(rows: GanttRow[]): Map<string, string> {
  const rowMap = new Map<string, GanttRow>()
  for (const row of rows) {
    rowMap.set(row.id, row)
  }

  const wbsCodes = new Map<string, string>()
  // 各親ID配下での現在のカウンター（親ID -> 次のインデックス数値）
  const counters = new Map<string, number>()

  for (const row of rows) {
    const parentIdKey = row.parentId && rowMap.has(row.parentId) ? row.parentId : '__root__'
    const currentCount = (counters.get(parentIdKey) ?? 0) + 1
    counters.set(parentIdKey, currentCount)

    if (parentIdKey === '__root__') {
      wbsCodes.set(row.id, String(currentCount))
    } else {
      const parentWbs = wbsCodes.get(row.parentId!) ?? ''
      const code = parentWbs ? `${parentWbs}.${currentCount}` : String(currentCount)
      wbsCodes.set(row.id, code)
    }
  }

  return wbsCodes
}

/**
 * 指定された親行の直下、または再帰的なすべての子孫行IDを取得します。
 *
 * @param rows ガント行の配列
 * @param parentId 親行のID
 * @param recursive 再帰的に孫以降も取得するかどうか (デフォルト: true)
 * @returns 子行IDの配列
 */
export function computeChildRowIds(
  rows: GanttRow[],
  parentId: string,
  recursive = true,
): string[] {
  const childrenMap = new Map<string, string[]>()
  for (const row of rows) {
    if (row.parentId) {
      const list = childrenMap.get(row.parentId) ?? []
      list.push(row.id)
      childrenMap.set(row.parentId, list)
    }
  }

  const result: string[] = []
  const queue = [...(childrenMap.get(parentId) ?? [])]
  const visited = new Set<string>()

  while (queue.length > 0) {
    const childId = queue.shift()!
    if (visited.has(childId)) continue
    visited.add(childId)
    result.push(childId)

    if (recursive) {
      const nextChildren = childrenMap.get(childId)
      if (nextChildren) {
        queue.push(...nextChildren)
      }
    }
  }

  return result
}

/**
 * 折りたたまれた親行を持つ子孫行を除外した、実際に画面に表示されるべき可視行リストを返します。
 *
 * @param rows ガント行の配列
 * @param includeHidden `row.visible === false` の行も含めるか (showHiddenRows 用、デフォルト: false)
 * @returns 表示対象の行配列
 */
export function computeVisibleTreeRows(
  rows: GanttRow[],
  includeHidden = false,
): GanttRow[] {
  const rowMap = new Map<string, GanttRow>()
  for (const row of rows) {
    rowMap.set(row.id, row)
  }

  // collapsed === true な親IDのSet
  const collapsedParentIds = new Set<string>()
  for (const row of rows) {
    if (row.collapsed) {
      collapsedParentIds.add(row.id)
    }
  }

  return rows.filter((row) => {
    if (!includeHidden && row.visible === false) {
      return false
    }

    // 先祖のいずれかが collapsed かどうかをチェック
    let currParentId = row.parentId
    const visited = new Set<string>()

    while (currParentId) {
      if (visited.has(currParentId)) break
      visited.add(currParentId)

      if (collapsedParentIds.has(currParentId)) {
        return false
      }

      const parentRow = rowMap.get(currParentId)
      currParentId = parentRow?.parentId
    }

    return true
  })
}

/**
 * 子タスクの配列から、親サマリータスク（最小開始日〜最大終了日、加重平均進捗率）を計算します。
 *
 * @param childTasks 子タスクの配列
 * @param template サマリータスクの基本プロパティ（id, name 等）
 * @returns 計算されたサマリータスク。子タスクがない場合は null
 */
export function computeSummaryTask(
  childTasks: GanttTask[],
  template?: Partial<GanttTask>,
): GanttTask | null {
  if (!childTasks || childTasks.length === 0) {
    return null
  }

  let minStart = childTasks[0].start.getTime()
  let maxEnd = childTasks[0].end.getTime()
  let totalDurationMs = 0
  let weightedProgressSum = 0
  let hasAnyProgress = false

  for (const task of childTasks) {
    const s = task.start.getTime()
    const e = task.end.getTime()
    if (s < minStart) minStart = s
    if (e > maxEnd) maxEnd = e

    const duration = Math.max(1, e - s)
    totalDurationMs += duration

    if (task.progress !== undefined && !Number.isNaN(task.progress)) {
      hasAnyProgress = true
      weightedProgressSum += (task.progress ?? 0) * duration
    }
  }

  const calculatedProgress =
    hasAnyProgress && totalDurationMs > 0
      ? Math.round((weightedProgressSum / totalDurationMs) * 10) / 10
      : undefined

  return {
    id: template?.id ?? 'summary-task',
    name: template?.name ?? '',
    start: new Date(minStart),
    end: new Date(maxEnd),
    type: 'summary',
    movable: 'none',
    resizable: false,
    progress: calculatedProgress,
    ...template,
    // type, movable, resizable はサマリー固定
    style: template?.style,
  }
}

/**
 * 行ドラッグ＆ドロップ時に、移動先が安全かつWBSの階層構造（親子関係）を維持できるかを判定します。
 *
 * - 循環参照ガード: 移動対象自身または自身の子孫へのドロップ、および自身の親を自身（または自身の子孫）にするドロップは禁止
 * - 展開中親行の直下ガード: 展開中の親行の bottom は最初の子行の前への割り込みになるため禁止（親自身の子行の先頭移動を除く）
 * - ドロップ先に応じた階層（parentId）の変化:
 *   - ルート行へのドロップ: ルート行（parentId = null）に移動
 *   - 子行へのドロップ: その子行の兄弟行（同じ parentId）に移動
 *   - 親行へのドロップ: bottom なら先頭子行に移動、top なら親行の前（親行の兄弟）に移動
 *
 * @param rows ガント行の配列
 * @param movingRowIds 移動しようとしている行ID（単一または複数）
 * @param targetRowId ドロップ先の行ID
 * @param position ドロップ位置 ('top' または 'bottom'、省略時は行へのドロップ可否全般)
 * @returns ドロップ可能なら true, 不正な移動なら false
 */
export function canDropRow(
  rows: GanttRow[],
  movingRowIds: string | string[],
  targetRowId: string,
  position?: 'top' | 'bottom',
): boolean {
  const ids = Array.isArray(movingRowIds) ? movingRowIds : [movingRowIds]
  if (ids.length === 0) return false

  // 自分自身へのドロップは不可
  if (ids.includes(targetRowId)) {
    return false
  }

  const rowMap = new Map<string, GanttRow>()
  for (const r of rows) {
    rowMap.set(r.id, r)
  }

  const targetRow = rowMap.get(targetRowId)
  if (!targetRow) return false

  // 移動対象行の取得
  const movingRows: GanttRow[] = []
  for (const id of ids) {
    const r = rowMap.get(id)
    if (r) movingRows.push(r)
  }
  if (movingRows.length === 0) return false

  // 循環参照ガード 1: 移動対象自身またはその子孫に targetRowId が含まれていないか検証
  for (const id of ids) {
    const descendantIds = computeChildRowIds(rows, id, true)
    if (descendantIds.includes(targetRowId)) {
      return false
    }
  }

  // 移動対象の親IDを確認（すべて同一親でなければならない）
  const firstParentId = movingRows[0].parentId ?? null
  const allSameParent = movingRows.every((r) => (r.parentId ?? null) === firstParentId)
  if (!allSameParent) {
    // 異なる親を持つ行が混ざっている複数行移動は禁止
    return false
  }

  // もしターゲットが子を持ち、かつ展開されている場合、
  // 移動対象がその親自身の子行でなければ（先頭への移動以外）、親行の bottom に割り込むと最初の子の前に挟まるため禁止
  if (position === 'bottom') {
    const targetHasChildren = rows.some((r) => r.parentId === targetRow.id)
    if (targetHasChildren && !targetRow.collapsed) {
      if (firstParentId !== targetRow.id) {
        return false
      }
    }
  }

  // ドロップ先で決まる新しい親IDの決定:
  // 1) ターゲットが自身の直接の親行（targetRow.id === firstParentId）の場合:
  //    - bottom: 親配下の先頭に移動（親はそのまま firstParentId）
  //    - top: 親行の前へ移動（親は targetRow.parentId）
  // 2) ターゲットがそれ以外の行の場合:
  //    - 常に targetRow.parentId が新しい親IDとなる
  const newParentId =
    firstParentId !== null && targetRow.id === firstParentId && position === 'bottom'
      ? firstParentId
      : (targetRow.parentId ?? null)

  // 循環参照ガード 2: 新しい親IDが移動対象自身またはその子孫であってはならない
  // （例: 親行 P を P の子行 C の兄弟にすることはできない）
  if (newParentId !== null) {
    if (ids.includes(newParentId)) {
      return false
    }
    for (const id of ids) {
      const descendantIds = computeChildRowIds(rows, id, true)
      if (descendantIds.includes(newParentId)) {
        return false
      }
    }
  }

  return true
}

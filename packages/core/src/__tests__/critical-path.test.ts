import { describe, it, expect } from 'vitest'
import { computeCriticalPath } from '../core/critical-path'
import type { GanttRow } from '../core/types'

const d = (year: number, month: number, day: number) => new Date(year, month - 1, day)

describe('computeCriticalPath', () => {
  it('線形チェーン A→B→C のクリティカルパスを検出する', () => {
    const rows: GanttRow[] = [
      {
        id: '1',
        name: 'Row 1',
        tasks: [
          { id: 'A', name: 'A', start: d(2025, 1, 1), end: d(2025, 1, 6) },
          { id: 'B', name: 'B', start: d(2025, 1, 6), end: d(2025, 1, 11), dependencies: ['A'] },
          { id: 'C', name: 'C', start: d(2025, 1, 11), end: d(2025, 1, 16), dependencies: ['B'] },
        ],
      },
    ]

    const result = computeCriticalPath(rows)
    expect(result.has('A')).toBe(true)
    expect(result.has('B')).toBe(true)
    expect(result.has('C')).toBe(true)
  })

  it('並行パスで最長パスのみがクリティカルパスとなる', () => {
    // パス1: A(5日) → C(5日) = EF: A.end + C.dur = Jan6 + 5 = Jan11 + 5 = 10日チェーン
    // パス2: B(3日) → C(5日) = EF: B.end + C.dur = Jan4 + 5 = 8日チェーン
    // A→C がクリティカルパス（Cはどちらからもdepだが、Aの方がEFが遅い）
    const rows: GanttRow[] = [
      {
        id: '1',
        name: 'Row 1',
        tasks: [
          { id: 'A', name: 'A', start: d(2025, 1, 1), end: d(2025, 1, 6) },
          { id: 'B', name: 'B', start: d(2025, 1, 1), end: d(2025, 1, 4) },
          { id: 'C', name: 'C', start: d(2025, 1, 6), end: d(2025, 1, 11), dependencies: ['A', 'B'] },
        ],
      },
    ]

    const result = computeCriticalPath(rows)
    expect(result.has('A')).toBe(true)
    expect(result.has('C')).toBe(true)
    // Bはクリティカルパス上にない
    expect(result.has('B')).toBe(false)
  })

  it('タスク間にギャップがあっても最長パスを検出する', () => {
    // A(1/1〜1/5) → B(1/10〜1/15): 5日間のギャップがある
    const rows: GanttRow[] = [
      {
        id: '1',
        name: 'Row 1',
        tasks: [
          { id: 'A', name: 'A', start: d(2025, 1, 1), end: d(2025, 1, 5) },
          { id: 'B', name: 'B', start: d(2025, 1, 10), end: d(2025, 1, 15), dependencies: ['A'] },
        ],
      },
    ]

    const result = computeCriticalPath(rows)
    expect(result.has('A')).toBe(true)
    expect(result.has('B')).toBe(true)
  })

  it('依存関係がないタスクのみの場合は空集合を返す', () => {
    const rows: GanttRow[] = [
      {
        id: '1',
        name: 'Row 1',
        tasks: [
          { id: 'A', name: 'A', start: d(2025, 1, 1), end: d(2025, 1, 6) },
          { id: 'B', name: 'B', start: d(2025, 1, 3), end: d(2025, 1, 8) },
        ],
      },
    ]

    const result = computeCriticalPath(rows)
    expect(result.size).toBe(0)
  })

  it('タスクが1つだけの場合は空集合を返す', () => {
    const rows: GanttRow[] = [
      {
        id: '1',
        name: 'Row 1',
        tasks: [{ id: 'A', name: 'A', start: d(2025, 1, 1), end: d(2025, 1, 6) }],
      },
    ]

    const result = computeCriticalPath(rows)
    expect(result.size).toBe(0)
  })

  it('空の行配列では空集合を返す', () => {
    const result = computeCriticalPath([])
    expect(result.size).toBe(0)
  })

  it('複数行にまたがる依存関係を処理できる', () => {
    const rows: GanttRow[] = [
      {
        id: '1',
        name: 'Row 1',
        tasks: [{ id: 'A', name: 'A', start: d(2025, 1, 1), end: d(2025, 1, 6) }],
      },
      {
        id: '2',
        name: 'Row 2',
        tasks: [{ id: 'B', name: 'B', start: d(2025, 1, 6), end: d(2025, 1, 11), dependencies: ['A'] }],
      },
    ]

    const result = computeCriticalPath(rows)
    expect(result.has('A')).toBe(true)
    expect(result.has('B')).toBe(true)
  })

  it('存在しないタスクへの依存関係を無視する', () => {
    const rows: GanttRow[] = [
      {
        id: '1',
        name: 'Row 1',
        tasks: [
          { id: 'A', name: 'A', start: d(2025, 1, 1), end: d(2025, 1, 6) },
          { id: 'B', name: 'B', start: d(2025, 1, 6), end: d(2025, 1, 11), dependencies: ['A', 'NONEXISTENT'] },
        ],
      },
    ]

    const result = computeCriticalPath(rows)
    expect(result.has('A')).toBe(true)
    expect(result.has('B')).toBe(true)
  })

  it('分岐のあるグラフで最長パスを正しく検出する', () => {
    // A(5日) → C(3日) → E(5日) = A.end(6) + C.dur(3) = 9 + E.dur(5) = 14 ← 最長
    // A(5日) → D(2日) → E(5日) = A.end(6) + D.dur(2) = 8 + E.dur(5) = 13
    // B(3日) → D(2日) → E(5日) = B.end(4) + D.dur(2) = 6 + E.dur(5) = 11
    const rows: GanttRow[] = [
      {
        id: '1',
        name: 'Row 1',
        tasks: [
          { id: 'A', name: 'A', start: d(2025, 1, 1), end: d(2025, 1, 6) },
          { id: 'B', name: 'B', start: d(2025, 1, 1), end: d(2025, 1, 4) },
          { id: 'C', name: 'C', start: d(2025, 1, 6), end: d(2025, 1, 9), dependencies: ['A'] },
          { id: 'D', name: 'D', start: d(2025, 1, 6), end: d(2025, 1, 8), dependencies: ['A', 'B'] },
          { id: 'E', name: 'E', start: d(2025, 1, 9), end: d(2025, 1, 14), dependencies: ['C', 'D'] },
        ],
      },
    ]

    const result = computeCriticalPath(rows)
    // 最長パス: A → C → E
    expect(result.has('A')).toBe(true)
    expect(result.has('C')).toBe(true)
    expect(result.has('E')).toBe(true)
    // B, D は最長パスに含まれない
    expect(result.has('B')).toBe(false)
    expect(result.has('D')).toBe(false)
  })

  it('依存関係に参加していない独立タスクが混在しても正しくクリティカルパスを検出する', () => {
    // X, Y は独立タスク（依存関係なし）。Y の終了日が最も遅い。
    // A → B のチェーンが唯一の依存関係。
    const rows: GanttRow[] = [
      {
        id: '1',
        name: 'Row 1',
        tasks: [
          { id: 'X', name: 'X', start: d(2025, 1, 1), end: d(2025, 1, 3) },
          { id: 'A', name: 'A', start: d(2025, 1, 1), end: d(2025, 1, 6) },
          { id: 'B', name: 'B', start: d(2025, 1, 6), end: d(2025, 1, 11), dependencies: ['A'] },
          { id: 'Y', name: 'Y', start: d(2025, 1, 1), end: d(2025, 12, 31) }, // 年末まで！
        ],
      },
    ]

    const result = computeCriticalPath(rows)
    // A → B のチェーンがクリティカルパス
    expect(result.has('A')).toBe(true)
    expect(result.has('B')).toBe(true)
    // X, Y は独立タスクなのでクリティカルパスに含まれない
    expect(result.has('X')).toBe(false)
    expect(result.has('Y')).toBe(false)
  })
})

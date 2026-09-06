import { describe, it, expect } from 'vitest'
import type { GanttRow, GanttTask } from '../core/types'
import {
  computeRowLevels,
  computeRowWbsCodes,
  computeChildRowIds,
  computeVisibleTreeRows,
  computeSummaryTask,
  canDropRow,
} from '../core/wbs'

describe('WBS Utilities', () => {
  const sampleRows: GanttRow[] = [
    { id: 'p1', name: 'プロジェクトA', parentId: null, tasks: [] },
    { id: 'phase1', name: '要件定義フェーズ', parentId: 'p1', tasks: [] },
    { id: 't1', name: 'ヒアリング', parentId: 'phase1', tasks: [] },
    { id: 't2', name: '要件定義書作成', parentId: 'phase1', tasks: [] },
    { id: 'phase2', name: '設計フェーズ', parentId: 'p1', tasks: [] },
    { id: 't3', name: '基本設計', parentId: 'phase2', tasks: [] },
    { id: 'p2', name: 'プロジェクトB', parentId: null, tasks: [] },
  ]

  describe('computeRowLevels', () => {
    it('階層の深さ（level）を正しく計算できる', () => {
      const levels = computeRowLevels(sampleRows)
      expect(levels.get('p1')).toBe(0)
      expect(levels.get('phase1')).toBe(1)
      expect(levels.get('t1')).toBe(2)
      expect(levels.get('t2')).toBe(2)
      expect(levels.get('phase2')).toBe(1)
      expect(levels.get('t3')).toBe(2)
      expect(levels.get('p2')).toBe(0)
    })

    it('存在しない親IDや循環参照があっても無限ループにならず安全にフォールバックする', () => {
      const circularRows: GanttRow[] = [
        { id: 'r1', name: 'Row 1', parentId: 'r2', tasks: [] },
        { id: 'r2', name: 'Row 2', parentId: 'r1', tasks: [] },
        { id: 'r3', name: 'Row 3', parentId: 'non-existent', tasks: [] },
      ]
      const levels = computeRowLevels(circularRows)
      expect(levels.has('r1')).toBe(true)
      expect(levels.has('r2')).toBe(true)
      expect(levels.get('r3')).toBe(0)
    })
  })

  describe('computeRowWbsCodes', () => {
    it('WBS番号（1, 1.1, 1.1.1等）を正しく採番できる', () => {
      const wbsCodes = computeRowWbsCodes(sampleRows)
      expect(wbsCodes.get('p1')).toBe('1')
      expect(wbsCodes.get('phase1')).toBe('1.1')
      expect(wbsCodes.get('t1')).toBe('1.1.1')
      expect(wbsCodes.get('t2')).toBe('1.1.2')
      expect(wbsCodes.get('phase2')).toBe('1.2')
      expect(wbsCodes.get('t3')).toBe('1.2.1')
      expect(wbsCodes.get('p2')).toBe('2')
    })
  })

  describe('computeChildRowIds', () => {
    it('親行の配下にある直下の子行のみを取得できる (recursive: false)', () => {
      const children = computeChildRowIds(sampleRows, 'p1', false)
      expect(children).toEqual(['phase1', 'phase2'])
    })

    it('親行の配下にあるすべての孫行も含めて取得できる (recursive: true)', () => {
      const allDescendants = computeChildRowIds(sampleRows, 'p1', true)
      expect(allDescendants).toContain('phase1')
      expect(allDescendants).toContain('t1')
      expect(allDescendants).toContain('t2')
      expect(allDescendants).toContain('phase2')
      expect(allDescendants).toContain('t3')
      expect(allDescendants).not.toContain('p2')
      expect(allDescendants.length).toBe(5)
    })
  })

  describe('computeVisibleTreeRows', () => {
    it('折りたたまれていない場合は全行が表示される', () => {
      const visible = computeVisibleTreeRows(sampleRows)
      expect(visible.map((r) => r.id)).toEqual(sampleRows.map((r) => r.id))
    })

    it('中間親行（phase1）が折りたたまれた場合、その子タスク（t1, t2）のみ除外される', () => {
      const rowsWithCollapse = sampleRows.map((r) =>
        r.id === 'phase1' ? { ...r, collapsed: true } : r,
      )
      const visible = computeVisibleTreeRows(rowsWithCollapse)
      expect(visible.map((r) => r.id)).toEqual(['p1', 'phase1', 'phase2', 't3', 'p2'])
    })

    it('ルート親行（p1）が折りたたまれた場合、その配下のすべての行が除外される', () => {
      const rowsWithCollapse = sampleRows.map((r) =>
        r.id === 'p1' ? { ...r, collapsed: true } : r,
      )
      const visible = computeVisibleTreeRows(rowsWithCollapse)
      expect(visible.map((r) => r.id)).toEqual(['p1', 'p2'])
    })

    it('visible: false の行も適切にフィルタリングされる', () => {
      const rowsWithHidden = sampleRows.map((r) =>
        r.id === 'p2' ? { ...r, visible: false } : r,
      )
      const visible = computeVisibleTreeRows(rowsWithHidden)
      expect(visible.map((r) => r.id)).not.toContain('p2')

      // includeHidden: true の場合は含まれる
      const visibleWithHidden = computeVisibleTreeRows(rowsWithHidden, true)
      expect(visibleWithHidden.map((r) => r.id)).toContain('p2')
    })
  })

  describe('computeSummaryTask', () => {
    it('子タスク群から開始日・終了日（最小〜最大）および加重平均進捗率を算出する', () => {
      const childTasks: GanttTask[] = [
        {
          id: 'c1',
          name: 'Task 1',
          start: new Date('2024-01-01'),
          end: new Date('2024-01-05'), // 4日
          progress: 100,
        },
        {
          id: 'c2',
          name: 'Task 2',
          start: new Date('2024-01-03'),
          end: new Date('2024-01-09'), // 6日
          progress: 50,
        },
      ]

      const summary = computeSummaryTask(childTasks, { id: 'sum-1', name: 'フェーズ集計' })
      expect(summary).not.toBeNull()
      expect(summary!.id).toBe('sum-1')
      expect(summary!.name).toBe('フェーズ集計')
      expect(summary!.start).toEqual(new Date('2024-01-01'))
      expect(summary!.end).toEqual(new Date('2024-01-09'))
      expect(summary!.type).toBe('summary')
      expect(summary!.movable).toBe('none')
      expect(summary!.resizable).toBe(false)
      // 加重平均進捗率: (100 * 4 + 50 * 6) / 10 = 70%
      expect(summary!.progress).toBe(70)
    })

    it('子タスクが空の場合は null を返す', () => {
      const summary = computeSummaryTask([])
      expect(summary).toBeNull()
    })
  })

  describe('canDropRow', () => {
    it('自分自身へのドロップは禁止 (false)', () => {
      expect(canDropRow(sampleRows, 'p1', 'p1')).toBe(false)
    })

    it('自分の子孫へのドロップは循環参照防止のため禁止 (false)', () => {
      expect(canDropRow(sampleRows, 'p1', 'phase1')).toBe(false)
      expect(canDropRow(sampleRows, 'p1', 't1')).toBe(false)
      expect(canDropRow(sampleRows, 'phase1', 't2')).toBe(false)
    })

    it('子行をインデントグループ外（ルート行）へドロップしてルート行にすることは許可 (true)', () => {
      // phase1 (親: p1) を別ルート p2 にドロップ（ルート行へ脱出移動）
      expect(canDropRow(sampleRows, 'phase1', 'p2')).toBe(true)
      // t1 (親: phase1) を祖父 p1 の top にドロップ（ルート行へ脱出移動）
      expect(canDropRow(sampleRows, 't1', 'p1', 'top')).toBe(true)
    })

    it('同一親ブロック内（兄弟行間または親行直下）での移動および親行前への脱出は許可 (true)', () => {
      // t1 と t2 は同じ phase1 配下の兄弟行
      expect(canDropRow(sampleRows, 't1', 't2')).toBe(true)
      // phase1 と phase2 は同じ p1 配下の兄弟行
      expect(canDropRow(sampleRows, 'phase1', 'phase2')).toBe(true)
      // 子行 t2 を親 phase1 の直下 (bottom) にドロップして先頭に配置
      expect(canDropRow(sampleRows, 't2', 'phase1', 'bottom')).toBe(true)
      // 親 phase1 の top にドロップして親の前に脱出（phase1 の兄弟になる）
      expect(canDropRow(sampleRows, 't2', 'phase1', 'top')).toBe(true)
    })

    it('開いている子行の間に階層外の行（ルート行や別親の子行）をドロップして兄弟化することは許可 (true)', () => {
      // ルート行 p2 を子行 phase1 (親: p1) の位置にドロップ（p1 配下の兄弟行として取り込み）
      expect(canDropRow(sampleRows, 'p2', 'phase1')).toBe(true)
      // ルート行 p2 を孫子行 t1 (親: phase1) の位置にドロップ（phase1 配下の兄弟行として取り込み）
      expect(canDropRow(sampleRows, 'p2', 't1')).toBe(true)
      // 別親の子行 t1 (親: phase1) を子行 phase2 (親: p1) にドロップ（phase2 の兄弟として取り込み）
      expect(canDropRow(sampleRows, 't1', 'phase2')).toBe(true)
    })

    it('親行を自身の子孫行配下にドロップすることは循環参照防止のため禁止 (false)', () => {
      // p1 の子孫には phase1, t1, t2, phase2, t3 がいる
      // 親行 p1 を子行 phase1 の兄弟にしようとするのは禁止
      expect(canDropRow(sampleRows, 'p1', 'phase1')).toBe(false)
      // 親行 phase1 を自身の子行 t1 の兄弟にしようとするのは禁止
      expect(canDropRow(sampleRows, 'phase1', 't1')).toBe(false)
    })

    it('ルート行同士の並び替えは許可', () => {
      // ルート行 p2 をルート行 p1 の top にドロップ
      expect(canDropRow(sampleRows, 'p2', 'p1', 'top')).toBe(true)
    })
  })
})

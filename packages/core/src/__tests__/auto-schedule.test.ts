import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  normalizeDependencyLink,
  endpointsToDependencyType,
  dependencyTypeToEndpoints,
  computeRequiredStartMs,
  propagateAutoSchedule,
  createDependencyEntry,
} from '../core/auto-schedule'
import { GanttChartElement } from '../components/gantt-chart'
import type { GanttChartOption, GanttRow } from '../core/types'

// Mock ResizeObserver
;(globalThis as any).ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

const d = (year: number, month: number, day: number, hour = 0, minute = 0) =>
  new Date(year, month - 1, day, hour, minute)

const createDefaultOption = (overrides?: Partial<GanttChartOption>): GanttChartOption => ({
  bar: { height: 28, margin: 4, cornerRadius: 4 },
  rowHeader: { width: 200 },
  calendar: { start: d(2025, 1, 1), end: d(2025, 1, 31), pxPerDay: 40 },
  ...overrides,
})

describe('auto-schedule helpers', () => {
  it('文字列とオブジェクトの両方の依存定義を正規化できる', () => {
    expect(normalizeDependencyLink('t1')).toEqual({
      taskId: 't1',
      type: 'FS',
      lag: 0,
    })
    expect(normalizeDependencyLink({ taskId: 't2', type: 'SS', lag: 1440 })).toEqual({
      taskId: 't2',
      type: 'SS',
      lag: 1440,
    })
    expect(normalizeDependencyLink({ taskId: 't3' })).toEqual({
      taskId: 't3',
      type: 'FS',
      lag: 0,
    })
  })

  it('エンドポイントと DependencyType を相互変換できる', () => {
    expect(endpointsToDependencyType('end', 'start')).toBe('FS')
    expect(endpointsToDependencyType('start', 'start')).toBe('SS')
    expect(endpointsToDependencyType('end', 'end')).toBe('FF')
    expect(endpointsToDependencyType('start', 'end')).toBe('SF')

    expect(dependencyTypeToEndpoints('FS')).toEqual({ sourceEndpoint: 'end', targetEndpoint: 'start' })
    expect(dependencyTypeToEndpoints('SS')).toEqual({ sourceEndpoint: 'start', targetEndpoint: 'start' })
    expect(dependencyTypeToEndpoints('FF')).toEqual({ sourceEndpoint: 'end', targetEndpoint: 'end' })
    expect(dependencyTypeToEndpoints('SF')).toEqual({ sourceEndpoint: 'start', targetEndpoint: 'end' })
  })

  it('createDependencyEntry は FS + lag=0 のとき後方互換の文字列を返し、それ以外はオブジェクトを返す', () => {
    expect(createDependencyEntry('t1', 'FS', 0)).toBe('t1')
    expect(createDependencyEntry('t1', 'SS', 0)).toEqual({ taskId: 't1', type: 'SS' })
    expect(createDependencyEntry('t1', 'FS', 60)).toEqual({ taskId: 't1', type: 'FS', lag: 60 })
  })

  it('computeRequiredStartMs が FS / SS / FF / SF および lag を正しく計算する', () => {
    const predStart = d(2025, 1, 5).getTime()
    const predEnd = d(2025, 1, 10).getTime()
    const succDuration = 3 * 24 * 60 * 60 * 1000 // 3日間
    const oneDayMinutes = 1440
    const oneDayMs = 24 * 60 * 60 * 1000

    // FS: predEnd + lag
    expect(computeRequiredStartMs(predStart, predEnd, succDuration, 'FS', 0)).toBe(predEnd)
    expect(computeRequiredStartMs(predStart, predEnd, succDuration, 'FS', oneDayMinutes)).toBe(predEnd + oneDayMs)
    expect(computeRequiredStartMs(predStart, predEnd, succDuration, 'FS', -oneDayMinutes)).toBe(predEnd - oneDayMs)

    // SS: predStart + lag
    expect(computeRequiredStartMs(predStart, predEnd, succDuration, 'SS', 0)).toBe(predStart)
    expect(computeRequiredStartMs(predStart, predEnd, succDuration, 'SS', oneDayMinutes)).toBe(predStart + oneDayMs)

    // FF: predEnd + lag - succDuration
    expect(computeRequiredStartMs(predStart, predEnd, succDuration, 'FF', 0)).toBe(predEnd - succDuration)

    // SF: predStart + lag - succDuration
    expect(computeRequiredStartMs(predStart, predEnd, succDuration, 'SF', 0)).toBe(predStart - succDuration)
  })
})

describe('propagateAutoSchedule', () => {
  it('線形チェーン A → B → C (FS) で先行タスクの後ろ倒しをカスケード伝播する', () => {
    const rows: GanttRow[] = [
      {
        id: 'r1',
        name: 'Row 1',
        tasks: [
          // Aが 1/1〜1/8 に延びた状態（Bは 1/5〜1/10 のまま）
          { id: 'A', name: 'A', start: d(2025, 1, 1), end: d(2025, 1, 8) },
          { id: 'B', name: 'B', start: d(2025, 1, 5), end: d(2025, 1, 10), dependencies: ['A'] },
          { id: 'C', name: 'C', start: d(2025, 1, 10), end: d(2025, 1, 12), dependencies: ['B'] },
        ],
      },
    ]

    const result = propagateAutoSchedule(rows, ['A'])
    const tasks = result.rows[0].tasks
    // B は期間5日間を維持して 1/8〜1/13 にシフト
    expect(tasks[1].start).toEqual(d(2025, 1, 8))
    expect(tasks[1].end).toEqual(d(2025, 1, 13))
    // C は期間2日間を維持して 1/13〜1/15 にシフト
    expect(tasks[2].start).toEqual(d(2025, 1, 13))
    expect(tasks[2].end).toEqual(d(2025, 1, 15))
    expect(result.updatedTaskIds).toEqual(['B', 'C'])
    expect(result.hasChanges).toBe(true)
  })

  it('SS / FF / SF と lag（ラグ・リード）の組み合わせを計算する', () => {
    const rows: GanttRow[] = [
      {
        id: 'r1',
        name: 'Row 1',
        tasks: [
          { id: 'A', name: 'A', start: d(2025, 1, 10), end: d(2025, 1, 15) },
          // SS + 2日ラグ: 1/12 開始になるべき (期間4日 → 1/12〜1/16)
          {
            id: 'B',
            name: 'B',
            start: d(2025, 1, 1),
            end: d(2025, 1, 5),
            dependencies: [{ taskId: 'A', type: 'SS', lag: 2 * 1440 }],
          },
          // FF + 0ラグ: Bの終了(1/16)に合わせて終了すべき (期間3日 → 1/13〜1/16)
          {
            id: 'C',
            name: 'C',
            start: d(2025, 1, 1),
            end: d(2025, 1, 4),
            dependencies: [{ taskId: 'B', type: 'FF', lag: 0 }],
          },
          // SF + 0ラグ: Aの開始(1/10)に合わせて終了すべき (期間2日 → 1/8〜1/10)
          {
            id: 'D',
            name: 'D',
            start: d(2025, 1, 1),
            end: d(2025, 1, 3),
            dependencies: [{ taskId: 'A', type: 'SF', lag: 0 }],
          },
        ],
      },
    ]

    const result = propagateAutoSchedule(rows)
    const tasks = result.rows[0].tasks
    expect(tasks[1].start).toEqual(d(2025, 1, 12))
    expect(tasks[1].end).toEqual(d(2025, 1, 16))
    expect(tasks[2].start).toEqual(d(2025, 1, 13))
    expect(tasks[2].end).toEqual(d(2025, 1, 16))
    expect(tasks[3].start).toEqual(d(2025, 1, 8))
    expect(tasks[3].end).toEqual(d(2025, 1, 10))
  })

  it('ダイヤモンド型依存グラフ (A → B, A → C, B&C → D) で最も遅い制約が優先される', () => {
    const rows: GanttRow[] = [
      {
        id: 'r1',
        name: 'Row 1',
        tasks: [
          { id: 'A', name: 'A', start: d(2025, 1, 1), end: d(2025, 1, 5) },
          { id: 'B', name: 'B', start: d(2025, 1, 5), end: d(2025, 1, 8), dependencies: ['A'] }, // 1/8 終了
          { id: 'C', name: 'C', start: d(2025, 1, 5), end: d(2025, 1, 12), dependencies: ['A'] }, // 1/12 終了
          { id: 'D', name: 'D', start: d(2025, 1, 6), end: d(2025, 1, 10), dependencies: ['B', 'C'] },
        ],
      },
    ]

    const result = propagateAutoSchedule(rows, ['A'])
    const taskD = result.rows[0].tasks[3]
    expect(taskD.start).toEqual(d(2025, 1, 12))
    expect(taskD.end).toEqual(d(2025, 1, 16))
  })

  it('push-only モードでは余裕がある後続タスクを前倒しせず、strict モードでは前倒しする', () => {
    const rows: GanttRow[] = [
      {
        id: 'r1',
        name: 'Row 1',
        tasks: [
          { id: 'A', name: 'A', start: d(2025, 1, 1), end: d(2025, 1, 4) },
          // B は 1/10 開始で、A(1/4終了)との間に6日間の余裕がある
          { id: 'B', name: 'B', start: d(2025, 1, 10), end: d(2025, 1, 15), dependencies: ['A'] },
        ],
      },
    ]

    const pushOnlyResult = propagateAutoSchedule(rows, ['A'], { mode: 'push-only' })
    expect(pushOnlyResult.rows[0].tasks[1].start).toEqual(d(2025, 1, 10))
    expect(pushOnlyResult.updatedTaskIds.length).toBe(0)
    expect(pushOnlyResult.hasChanges).toBe(false)

    const strictResult = propagateAutoSchedule(rows, ['A'], { mode: 'strict' })
    expect(strictResult.rows[0].tasks[1].start).toEqual(d(2025, 1, 4))
    expect(strictResult.rows[0].tasks[1].end).toEqual(d(2025, 1, 9))
    expect(strictResult.updatedTaskIds).toContain('B')
    expect(strictResult.hasChanges).toBe(true)
  })

  it('respectMovable: true のとき movable: "none" のタスクは移動しない', () => {
    const rows: GanttRow[] = [
      {
        id: 'r1',
        name: 'Row 1',
        tasks: [
          { id: 'A', name: 'A', start: d(2025, 1, 1), end: d(2025, 1, 10) },
          { id: 'B', name: 'B', start: d(2025, 1, 5), end: d(2025, 1, 8), movable: 'none', dependencies: ['A'] },
        ],
      },
    ]

    const result = propagateAutoSchedule(rows, ['A'], { respectMovable: true })
    expect(result.rows[0].tasks[1].start).toEqual(d(2025, 1, 5))
    expect(result.updatedTaskIds.length).toBe(0)
  })

  it('循環依存 (A ↔ B) が存在しても無限ループせず安全に終了する', () => {
    const rows: GanttRow[] = [
      {
        id: 'r1',
        name: 'Row 1',
        tasks: [
          { id: 'A', name: 'A', start: d(2025, 1, 1), end: d(2025, 1, 5), dependencies: ['B'] },
          { id: 'B', name: 'B', start: d(2025, 1, 2), end: d(2025, 1, 6), dependencies: ['A'] },
        ],
      },
    ]

    expect(() => propagateAutoSchedule(rows, ['A'])).not.toThrow()
  })
})

describe('GanttChartElement auto-schedule & advanced dependency integration', () => {
  let chart: GanttChartElement

  beforeEach(() => {
    chart = new GanttChartElement()
  })

  afterEach(() => {
    chart.remove()
  })

  it('FS / SS / FF / SF の依存関係線が適切な data-dependency-type 属性付きで描画される', async () => {
    chart.option = createDefaultOption()
    chart.rows = [
      {
        id: 'r1',
        name: 'Row 1',
        tasks: [
          { id: 't1', name: 'T1', start: d(2025, 1, 2), end: d(2025, 1, 6) },
          {
            id: 't2',
            name: 'T2',
            start: d(2025, 1, 6),
            end: d(2025, 1, 10),
            dependencies: [
              't1',
              { taskId: 't1', type: 'SS' },
              { taskId: 't1', type: 'FF' },
              { taskId: 't1', type: 'SF' },
            ],
          },
        ],
      },
    ]
    document.body.appendChild(chart)
    await chart.updateComplete

    const groups = chart.shadowRoot?.querySelectorAll('g.dependency-group')
    expect(groups?.length).toBe(4)
    const types = Array.from(groups || []).map((g) => g.getAttribute('data-dependency-type'))
    expect(types).toEqual(['FS', 'SS', 'FF', 'SF'])
  })

  it('chart.autoSchedule() メソッドで全タスクの依存制約を一括適用し、Undo/Redoで1ステップで戻せる', async () => {
    chart.option = createDefaultOption({
      dependency: { autoSchedule: true, scheduleMode: 'push-only' },
    })
    chart.rows = [
      {
        id: 'r1',
        name: 'Row 1',
        tasks: [
          { id: 't1', name: 'T1', start: d(2025, 1, 1), end: d(2025, 1, 10) },
          { id: 't2', name: 'T2', start: d(2025, 1, 5), end: d(2025, 1, 8), dependencies: ['t1'] },
          { id: 't3', name: 'T3', start: d(2025, 1, 6), end: d(2025, 1, 9), dependencies: ['t2'] },
        ],
      },
    ]
    document.body.appendChild(chart)
    await chart.updateComplete

    chart.autoSchedule()
    await chart.updateComplete

    expect(chart.rows[0].tasks[1].start).toEqual(d(2025, 1, 10))
    expect(chart.rows[0].tasks[1].end).toEqual(d(2025, 1, 13))
    expect(chart.rows[0].tasks[2].start).toEqual(d(2025, 1, 13))
    expect(chart.rows[0].tasks[2].end).toEqual(d(2025, 1, 16))

    // 1回の Undo で t2, t3 の両方が元の位置に戻る
    expect(chart.canUndo).toBe(true)
    chart.undo()
    await chart.updateComplete

    expect(chart.rows[0].tasks[1].start).toEqual(d(2025, 1, 5))
    expect(chart.rows[0].tasks[2].start).toEqual(d(2025, 1, 6))

    // Redo で再び自動スケジュール適用後の状態になる
    chart.redo()
    await chart.updateComplete
    expect(chart.rows[0].tasks[1].start).toEqual(d(2025, 1, 10))
    expect(chart.rows[0].tasks[2].start).toEqual(d(2025, 1, 13))
  })
})

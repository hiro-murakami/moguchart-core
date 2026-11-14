import { afterEach, describe, expect, it, vi } from 'vitest'
import '../index'
import {
  evaluateRowFilter,
  isFilterConfigActive,
  type FilterChangeEventDetail,
  type GanttChartElement,
  type GanttChartOption,
  type GanttRow,
} from '../index'

function createWbsSampleRows(): GanttRow[] {
  return [
    {
      id: 'root-1',
      name: '1. 要件・設計フェーズ',
      parentId: null,
      collapsed: true,
      tasks: [],
    },
    {
      id: 'phase-1-1',
      name: '基本設計',
      parentId: 'root-1',
      collapsed: true,
      tasks: [],
    },
    {
      id: 'leaf-1-1-1',
      name: 'APIインターフェース定義',
      parentId: 'phase-1-1',
      assignee: '田中',
      tasks: [
        {
          id: 't-api',
          name: 'REST API仕様書作成',
          start: new Date(2026, 3, 1),
          end: new Date(2026, 3, 5),
          progress: 40,
        },
      ],
    } as GanttRow,
    {
      id: 'leaf-1-1-2',
      name: 'DBスキーマ設計',
      parentId: 'phase-1-1',
      assignee: '佐藤',
      tasks: [
        {
          id: 't-db',
          name: 'ER図レビュー完了',
          start: new Date(2026, 3, 6),
          end: new Date(2026, 3, 6),
          type: 'milestone',
          progress: 100,
        },
      ],
    } as GanttRow,
    {
      id: 'root-2',
      name: '2. 実装・テストフェーズ',
      parentId: null,
      collapsed: false,
      tasks: [],
    },
    {
      id: 'leaf-2-1',
      name: 'フロントエンド実装',
      parentId: 'root-2',
      assignee: '鈴木',
      tasks: [
        {
          id: 't-fe',
          name: '画面コンポーネント実装',
          start: new Date(2026, 3, 7),
          end: new Date(2026, 3, 12),
          deadline: new Date(2026, 3, 10),
          progress: 20,
        },
      ],
    } as GanttRow,
  ]
}

function createBaseOption(overrides?: Partial<GanttChartOption>): GanttChartOption {
  return {
    calendar: {
      start: new Date(2026, 3, 1),
      end: new Date(2026, 3, 20),
      pxPerDay: 32,
    },
    tree: {
      enabled: true,
      showWbsCode: true,
      autoSummary: true,
    },
    grid: {
      enabled: true,
      columns: [{ id: 'wbs' }, { id: 'name' }, { id: 'progress' }],
    },
    ...overrides,
  }
}

describe('WBS-Aware Row Filtering & Search API', () => {
  const mountedElements: HTMLElement[] = []

  afterEach(() => {
    for (const el of mountedElements) {
      el.remove()
    }
    mountedElements.length = 0
  })

  it('isFilterConfigActive detects active vs empty filter configurations', () => {
    expect(isFilterConfigActive(null)).toBe(false)
    expect(isFilterConfigActive(undefined)).toBe(false)
    expect(isFilterConfigActive({})).toBe(false)
    expect(isFilterConfigActive({ query: '   ', status: 'all' })).toBe(false)
    expect(isFilterConfigActive({ query: 'API' })).toBe(true)
    expect(isFilterConfigActive({ status: 'overdue' })).toBe(true)
    expect(isFilterConfigActive({ taskTypes: ['milestone'] })).toBe(true)
    expect(isFilterConfigActive({ dateRange: { start: new Date(2026, 3, 1) } })).toBe(true)
    expect(isFilterConfigActive({ predicate: () => true })).toBe(true)
  })

  it('preserves full ancestor WBS chain when only a deep leaf row matches', () => {
    const rows = createWbsSampleRows()
    const res = evaluateRowFilter(rows, { query: 'api' })

    expect(res.active).toBe(true)
    expect([...res.matchedRowIds]).toEqual(['leaf-1-1-1'])
    expect([...res.matchedTaskIds]).toEqual(['t-api'])
    expect(res.visibleRowIds.has('root-1')).toBe(true)
    expect(res.visibleRowIds.has('phase-1-1')).toBe(true)
    expect(res.visibleRowIds.has('leaf-1-1-1')).toBe(true)
    expect(res.visibleRowIds.has('leaf-1-1-2')).toBe(false)
    expect(res.visibleRowIds.has('root-2')).toBe(false)
    expect(res.visibleRowIds.has('leaf-2-1')).toBe(false)
    expect(res.matchedRowCount).toBe(1)
    expect(res.visibleRowCount).toBe(3)
  })

  it('supports custom fields, status, taskTypes, dateRange, predicate, and includeDescendantsOfMatchedParent', () => {
    const rows = createWbsSampleRows()

    // custom fields ('assignee')
    const byAssignee = evaluateRowFilter(rows, {
      query: '田中',
      fields: ['assignee'],
    })
    expect([...byAssignee.matchedRowIds]).toEqual(['leaf-1-1-1'])

    // overdue status (deadline exceeded on leaf-2-1)
    const overdue = evaluateRowFilter(
      rows,
      { status: 'overdue' },
      { now: new Date(2026, 3, 2) },
    )
    expect([...overdue.matchedRowIds]).toEqual(['leaf-2-1'])
    expect(overdue.visibleRowIds.has('root-2')).toBe(true)

    // milestone taskTypes
    const milestones = evaluateRowFilter(rows, { taskTypes: ['milestone'] })
    expect([...milestones.matchedRowIds]).toEqual(['leaf-1-1-2'])

    // dateRange overlap
    const inRange = evaluateRowFilter(rows, {
      dateRange: { start: new Date(2026, 3, 8), end: new Date(2026, 3, 9) },
    })
    expect([...inRange.matchedRowIds]).toEqual(['leaf-2-1'])

    // predicate with context (depth & wbsCode)
    const byPredicate = evaluateRowFilter(rows, {
      predicate: (ctx) => ctx.depth === 2 && ctx.wbsCode === '1.1.2',
    })
    expect([...byPredicate.matchedRowIds]).toEqual(['leaf-1-1-2'])

    // includeDescendantsOfMatchedParent
    const parentWithDescendants = evaluateRowFilter(rows, {
      query: '要件・設計',
      includeDescendantsOfMatchedParent: true,
    })
    expect([...parentWithDescendants.matchedRowIds]).toEqual(['root-1'])
    expect(parentWithDescendants.visibleRowIds.has('phase-1-1')).toBe(true)
    expect(parentWithDescendants.visibleRowIds.has('leaf-1-1-1')).toBe(true)
    expect(parentWithDescendants.visibleRowIds.has('leaf-1-1-2')).toBe(true)
  })

  it('non-destructively expands collapsed ancestors in hide mode and restores collapsed state on clearFilter()', async () => {
    const chart = document.createElement('gantt-chart') as GanttChartElement
    chart.option = createBaseOption()
    chart.rows = createWbsSampleRows()
    document.body.appendChild(chart)
    mountedElements.push(chart)
    await chart.updateComplete

    // 初期状態: root-1 が collapsed: true なので配下の phase-1-1 / leaf-1-1-* は非表示
    expect(chart.displayRows.map((r) => r.id)).toEqual(['root-1', 'root-2', 'leaf-2-1'])

    const filterEvents: FilterChangeEventDetail[] = []
    chart.addEventListener('filter-change', ((e: CustomEvent<FilterChangeEventDetail>) => {
      filterEvents.push(e.detail)
    }) as EventListener)

    // 折りたたまれた階層の奥にある leaf-1-1-1 を検索
    const res = chart.setFilter({ query: 'API' })
    await chart.updateComplete

    expect(res.active).toBe(true)
    expect(filterEvents).toHaveLength(1)
    expect(filterEvents[0].result.matchedRowCount).toBe(1)

    // 一時展開により root-1 -> phase-1-1 -> leaf-1-1-1 が表示され、無関係なブランチは非表示
    expect(chart.displayRows.map((r) => r.id)).toEqual(['root-1', 'phase-1-1', 'leaf-1-1-1'])

    // 元の chart.rows の collapsed フラグは破壊されていないこと
    expect(chart.rows.find((r) => r.id === 'root-1')?.collapsed).toBe(true)
    expect(chart.rows.find((r) => r.id === 'phase-1-1')?.collapsed).toBe(true)

    // clearFilter() で元の折りたたみ状態に完全復帰すること
    const cleared = chart.clearFilter()
    await chart.updateComplete

    expect(cleared.active).toBe(false)
    expect(filterEvents).toHaveLength(2)
    expect(chart.getFilter()).toBeNull()
    expect(chart.displayRows.map((r) => r.id)).toEqual(['root-1', 'root-2', 'leaf-2-1'])
  })

  it('dims non-matching rows and tasks in dim mode without mutating source rows', async () => {
    const rows = createWbsSampleRows().map((r) => ({ ...r, collapsed: false }))
    const chart = document.createElement('gantt-chart') as GanttChartElement
    chart.option = createBaseOption()
    chart.rows = rows
    document.body.appendChild(chart)
    mountedElements.push(chart)
    await chart.updateComplete

    chart.setFilter({ query: 'フロントエンド', mode: 'dim' })
    await chart.updateComplete

    // 全6行が表示されたまま維持される
    expect(chart.displayRows).toHaveLength(6)

    const root1Display = chart.displayRows.find((r) => r.id === 'root-1')!
    const leaf111Display = chart.displayRows.find((r) => r.id === 'leaf-1-1-1')!
    const root2Display = chart.displayRows.find((r) => r.id === 'root-2')!
    const leaf21Display = chart.displayRows.find((r) => r.id === 'leaf-2-1')!

    // 非一致ブランチは行・タスク・自動サマリーのすべてが _isFilteredOut: true
    expect((root1Display as any)._isFilteredOut).toBe(true)
    expect((root1Display.tasks[0] as any)._isFilteredOut).toBe(true)
    expect((leaf111Display as any)._isFilteredOut).toBe(true)
    expect((leaf111Display.tasks[0] as any)._isFilteredOut).toBe(true)

    // 一致した leaf-2-1 とその親 root-2 は減光されない
    expect((root2Display as any)._isFilteredOut).toBeUndefined()
    expect((root2Display.tasks[0] as any)._isFilteredOut).toBeUndefined()
    expect((leaf21Display as any)._isFilteredOut).toBeUndefined()
    expect((leaf21Display.tasks[0] as any)._isFilteredOut).toBeUndefined()

    // 元の chart.rows には _isFilteredOut が一切汚染されていないこと
    expect((chart.rows.find((r) => r.id === 'leaf-1-1-1') as any)._isFilteredOut).toBeUndefined()
    expect(
      (chart.rows.find((r) => r.id === 'leaf-1-1-1')!.tasks[0] as any)._isFilteredOut,
    ).toBeUndefined()

    // gantt-row の DOM 上で非一致行ヘッダーに .row-filtered-out が付与されること
    const rowEls = Array.from(chart.shadowRoot!.querySelectorAll('gantt-row'))
    await Promise.all(rowEls.map((el: any) => el.updateComplete))
    const leaf111El = rowEls.find((el: any) => el.row.id === 'leaf-1-1-1')!
    const leaf21El = rowEls.find((el: any) => el.row.id === 'leaf-2-1')!
    expect(leaf111El.shadowRoot!.querySelector('.row-header.row-filtered-out')).not.toBeNull()
    expect(leaf21El.shadowRoot!.querySelector('.row-header.row-filtered-out')).toBeNull()

    // option.filter の宣言的更新とも同期すること
    const onFilterChange = vi.fn()
    chart.addEventListener('filter-change', onFilterChange)
    chart.option = {
      ...chart.option,
      filter: { status: 'completed', mode: 'hide' },
    }
    await chart.updateComplete
    expect(onFilterChange).toHaveBeenCalledTimes(1)
    expect(chart.displayRows.map((r) => r.id)).toEqual(['root-1', 'phase-1-1', 'leaf-1-1-2'])
  })
})

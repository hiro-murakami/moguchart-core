import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GanttChartElement } from '../components/gantt-chart'
import type { GanttRow, GanttTask } from '../core/types'
import { calculateTaskLanes } from '../core/utils'

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

describe('GanttChartElement WBS Integration', () => {
  let element: GanttChartElement
  let rows: GanttRow[]

  beforeEach(() => {
    element = new GanttChartElement()
    rows = [
      {
        id: 'p1',
        name: '親プロジェクト',
        parentId: null,
        tasks: [],
      },
      {
        id: 'phase1',
        name: 'フェーズ1',
        parentId: 'p1',
        tasks: [
          {
            id: 't-phase1',
            name: 'フェーズ1タスク',
            start: new Date('2024-01-01'),
            end: new Date('2024-01-05'),
            progress: 100,
          },
        ],
      },
      {
        id: 'phase2',
        name: 'フェーズ2',
        parentId: 'p1',
        tasks: [
          {
            id: 't-phase2',
            name: 'フェーズ2タスク',
            start: new Date('2024-01-06'),
            end: new Date('2024-01-10'),
            progress: 50,
          },
        ],
      },
      {
        id: 'p2',
        name: '別プロジェクト',
        parentId: null,
        tasks: [
          {
            id: 't-p2',
            name: '独立タスク',
            start: new Date('2024-01-01'),
            end: new Date('2024-01-10'),
          },
        ],
      },
    ]
    element.rows = rows
    element.option = {
      calendar: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
        pxPerDay: 50,
      },
      enableRowReordering: true,
      tree: {
        enabled: true,
        autoSummary: true,
      },
    }
    document.body.appendChild(element)
  })

  afterEach(() => {
    document.body.removeChild(element)
  })

  it('初期状態では全行が displayRows に含まれる', () => {
    expect((element as any).displayRows.map((r: GanttRow) => r.id)).toEqual([
      'p1',
      'phase1',
      'phase2',
      'p2',
    ])
  })

  it('親行 p1 を折りたたむと配下の子行が displayRows から除外される', async () => {
    element.toggleRowCollapse('p1', true)
    await element.updateComplete

    expect((element as any).displayRows.map((r: GanttRow) => r.id)).toEqual(['p1', 'p2'])
  })

  it('collapseAll と expandAll で一括開閉できる', async () => {
    element.collapseAll()
    await element.updateComplete
    expect((element as any).displayRows.map((r: GanttRow) => r.id)).toEqual(['p1', 'p2'])

    element.expandAll()
    await element.updateComplete
    expect((element as any).displayRows.map((r: GanttRow) => r.id)).toEqual([
      'p1',
      'phase1',
      'phase2',
      'p2',
    ])
  })

  it('row-toggle-collapse イベントが発火する', async () => {
    let eventDetail: any = null
    element.addEventListener('row-toggle-collapse', (e: any) => {
      eventDetail = e.detail
    })

    element.toggleRowCollapse('p1')
    await element.updateComplete

    expect(eventDetail).not.toBeNull()
    expect(eventDetail.rowId).toBe('p1')
    expect(eventDetail.collapsed).toBe(true)
  })

  it('親行の tasks が空の場合、配下の子タスクから自動的にサマリータスクが生成される', () => {
    const displayP1 = (element as any).displayRows.find((r: GanttRow) => r.id === 'p1')
    expect(displayP1).toBeDefined()
    expect(displayP1.tasks.length).toBe(1)

    const summaryTask = displayP1.tasks[0]
    expect(summaryTask.type).toBe('summary')
    expect(summaryTask.start).toEqual(new Date('2024-01-01'))
    expect(summaryTask.end).toEqual(new Date('2024-01-10'))
    expect(summaryTask.movable).toBe('none')
    expect(summaryTask.resizable).toBe(false)
    // 加重平均進捗: 100(4日) + 50(4日) = 75%
    expect(summaryTask.progress).toBe(75)
  })

  it('親行に通常タスクが存在する場合でも、サマリータスクと通常タスクの両方が親行に表示される', async () => {
    // p1 に直接通常タスクを追加
    element.rows = element.rows.map((r) => {
      if (r.id === 'p1') {
        return {
          ...r,
          tasks: [
            {
              id: 'p1-normal-task',
              name: '親行の独自タスク',
              start: new Date('2024-01-03'),
              end: new Date('2024-01-07'),
              progress: 20,
            },
          ],
        }
      }
      return r
    })
    await element.updateComplete

    const displayP1 = (element as any).displayRows.find((r: GanttRow) => r.id === 'p1')
    expect(displayP1).toBeDefined()
    // サマリータスクと親行の通常タスクの2つが存在すること
    expect(displayP1.tasks.length).toBe(2)

    const summaryTask = displayP1.tasks.find((t: GanttTask) => t.type === 'summary')
    const normalTask = displayP1.tasks.find((t: GanttTask) => t.id === 'p1-normal-task')
    expect(summaryTask).toBeDefined()
    expect(normalTask).toBeDefined()

    // レーン計算でもサマリータスクが最上段、通常タスクが下段になること
    const { tasksWithLanes, laneCount } = calculateTaskLanes(displayP1.tasks)
    expect(laneCount).toBe(2)
    expect(tasksWithLanes.find((t) => t.id === summaryTask.id)?.lane).toBe(0)
    expect(tasksWithLanes.find((t) => t.id === normalTask.id)?.lane).toBe(1)
  })

  it('親行を並び替えた際、配下の子行も一緒にブロック連動して移動する', async () => {
    // p1 を p2 の下に移動
    await (element as any).reorderRows('p1', 'p2', 'bottom')
    await element.updateComplete

    // p2 の後ろに p1, phase1, phase2 がひと塊で移動する
    expect(element.rows.map((r) => r.id)).toEqual(['p2', 'p1', 'phase1', 'phase2'])
  })

  it('自分自身の子孫への移動（循環参照）は安全にキャンセルされ、順序が維持される', async () => {
    // p1 を自分の子 phase1 の下に移動しようとする
    await (element as any).reorderRows('p1', 'phase1', 'bottom')
    await element.updateComplete

    // 順序が変わっていないことを確認
    expect(element.rows.map((r) => r.id)).toEqual(['p1', 'phase1', 'phase2', 'p2'])
  })

  it('親行を折りたたんだ後に行をクリックして選択しても折りたたみが維持される', async () => {
    // p1 を折りたたむ
    element.toggleRowCollapse('p1', true)
    await element.updateComplete
    expect((element as any).displayRows.map((r: GanttRow) => r.id)).toEqual(['p1', 'p2'])

    // 他の行 (p2) をクリックして選択状態を変更
    ;(element as any).handleRowClicked(
      new CustomEvent('row-clicked', {
        detail: {
          rowId: 'p2',
          event: new MouseEvent('click'),
        },
      }),
    )
    await element.updateComplete

    // p2 が選択されていること
    expect((element as any).selectedRows.has('p2')).toBe(true)
    // 折りたたみが勝手に展開されていないこと
    expect((element as any).displayRows.map((r: GanttRow) => r.id)).toEqual(['p1', 'p2'])
  })

  it('親行を折りたたんだ後、親コンポーネントが再レンダリングされて元の rows が再代入されても折りたたみが維持される', async () => {
    // p1 を折りたたむ
    element.toggleRowCollapse('p1', true)
    await element.updateComplete
    expect((element as any).displayRows.map((r: GanttRow) => r.id)).toEqual(['p1', 'p2'])

    // 親コンポーネントが再レンダリングされて、collapsed が設定されていない元の rows を再代入
    element.rows = [...rows]
    await element.updateComplete

    // 折りたたみが維持されていること
    expect((element as any).displayRows.map((r: GanttRow) => r.id)).toEqual(['p1', 'p2'])
    const p1 = element.rows.find((r) => r.id === 'p1')
    expect(p1?.collapsed).toBe(true)
  })

  it('外部から明示的に row.collapsed = false が渡された場合は展開される', async () => {
    element.toggleRowCollapse('p1', true)
    await element.updateComplete
    expect((element as any).displayRows.map((r: GanttRow) => r.id)).toEqual(['p1', 'p2'])

    // 外部から明示的に collapsed: false を指定して代入
    element.rows = rows.map((r) => (r.id === 'p1' ? { ...r, collapsed: false } : r))
    await element.updateComplete

    // 外部指定を尊重して展開されること
    expect((element as any).displayRows.map((r: GanttRow) => r.id)).toEqual([
      'p1',
      'phase1',
      'phase2',
      'p2',
    ])
  })

  it('toggleRowCollapse 時に rows-change イベントが発火する', async () => {
    let rowsChangeFired = false
    let rowsDetail: GanttRow[] = []
    element.addEventListener('rows-change', (e: any) => {
      rowsChangeFired = true
      rowsDetail = e.detail
    })

    element.toggleRowCollapse('p1', true)
    await element.updateComplete

    expect(rowsChangeFired).toBe(true)
    const p1 = rowsDetail.find((r) => r.id === 'p1')
    expect(p1?.collapsed).toBe(true)
  })

  it('折りたたまれた親行の直下に別の行をドロップした際、子行たちの末尾の後ろに配置されること', async () => {
    // p1 (子: phase1, phase2) を折りたたむ
    element.toggleRowCollapse('p1', true)
    await element.updateComplete
    expect((element as any).displayRows.map((r: GanttRow) => r.id)).toEqual(['p1', 'p2'])

    // p2 を p1 の直下 (bottom) にドロップ
    await (element as any).reorderRows('p2', 'p1', 'bottom')
    await element.updateComplete

    // p2 は p1 の子行 (phase1, phase2) の後ろに配置されること
    expect(element.rows.map((r) => r.id)).toEqual(['p1', 'phase1', 'phase2', 'p2'])

    // p1 を展開したときも、子行たちの上に p2 が割り込んでいないこと
    element.toggleRowCollapse('p1', false)
    await element.updateComplete
    expect((element as any).displayRows.map((r: GanttRow) => r.id)).toEqual([
      'p1',
      'phase1',
      'phase2',
      'p2',
    ])
  })

  it('子行をインデントグループの外（ルート行）にD&Dしたとき、ルート行となりparentIdがnullに更新される', async () => {
    let reorderedDetail: any = null
    element.addEventListener('row-reordered', ((e: CustomEvent) => {
      reorderedDetail = e.detail
    }) as EventListener)

    // phase1 は親 p1 の子行。これを別プロジェクト p2 (ルート行) の下に移動
    await (element as any).reorderRows('phase1', 'p2', 'bottom')
    await element.updateComplete

    // phase1 は p2 の後ろに配置される
    expect(element.rows.map((r) => r.id)).toEqual(['p1', 'phase2', 'p2', 'phase1'])

    // phase1 の parentId が null (ルート行) に更新されていること
    const phase1Row = element.rows.find((r) => r.id === 'phase1')
    expect(phase1Row?.parentId).toBeNull()

    // row-reordered イベントの detail.rows にも反映されていること
    expect(reorderedDetail).not.toBeNull()
    const phase1InDetail = reorderedDetail.rows.find((r: any) => r.id === 'phase1')
    expect(phase1InDetail?.parentId).toBeNull()
  })

  it('子行を同一親内の兄弟行へD&Dした場合は正しく並び替わる', async () => {
    // phase1 を兄弟 phase2 の下に移動
    await (element as any).reorderRows('phase1', 'phase2', 'bottom')
    await element.updateComplete

    // p1 の配下で phase2, phase1 の順に並び替わっていること
    expect(element.rows.map((r) => r.id)).toEqual(['p1', 'phase2', 'phase1', 'p2'])
  })

  it('開いている子行の間に階層外のルート行をD&Dしたとき、子行の兄弟となりparentIdが更新される', async () => {
    let reorderedDetail: any = null
    element.addEventListener('row-reordered', ((e: CustomEvent) => {
      reorderedDetail = e.detail
    }) as EventListener)

    // ルート行 p2 を子行 phase1 の下 (bottom) にドロップ
    await (element as any).reorderRows('p2', 'phase1', 'bottom')
    await element.updateComplete

    // p2 は phase1 と phase2 の間に挿入される
    expect(element.rows.map((r) => r.id)).toEqual(['p1', 'phase1', 'p2', 'phase2'])

    // p2 の parentId が phase1 の親である 'p1' に自動更新されていること
    const p2Row = element.rows.find((r) => r.id === 'p2')
    expect(p2Row?.parentId).toBe('p1')

    // row-reordered イベントの detail.rows にも反映されていること
    expect(reorderedDetail).not.toBeNull()
    const p2InDetail = reorderedDetail.rows.find((r: any) => r.id === 'p2')
    expect(p2InDetail?.parentId).toBe('p1')
  })

  it('子行を別のインデントグループの子行にD&Dしたとき、そちらのグループの兄弟となりparentIdが更新される', async () => {
    // p2 の配下に子行 p2-child を持つ構成を作成
    element.rows = [
      { id: 'p1', name: 'プロジェクト1', parentId: null, tasks: [] },
      { id: 'c1', name: 'P1の子1', parentId: 'p1', tasks: [] },
      { id: 'c2', name: 'P1の子2', parentId: 'p1', tasks: [] },
      { id: 'p2', name: 'プロジェクト2', parentId: null, tasks: [] },
      { id: 'p2_c1', name: 'P2の子1', parentId: 'p2', tasks: [] },
    ]
    await element.updateComplete

    let reorderedDetail: any = null
    element.addEventListener('row-reordered', ((e: CustomEvent) => {
      reorderedDetail = e.detail
    }) as EventListener)

    // c1 (親: p1) を p2_c1 (親: p2) の下 (bottom) にドロップ
    await (element as any).reorderRows('c1', 'p2_c1', 'bottom')
    await element.updateComplete

    // c1 は p2_c1 の後ろに配置される
    expect(element.rows.map((r) => r.id)).toEqual(['p1', 'c2', 'p2', 'p2_c1', 'c1'])

    // c1 の parentId が p2_c1 の親である 'p2' に自動更新されていること
    const c1Row = element.rows.find((r) => r.id === 'c1')
    expect(c1Row?.parentId).toBe('p2')

    // row-reordered イベントの detail.rows にも反映されていること
    expect(reorderedDetail).not.toBeNull()
    const c1InDetail = reorderedDetail.rows.find((r: any) => r.id === 'c1')
    expect(c1InDetail?.parentId).toBe('p2')
  })

  it('D&Dで移動できない位置では禁止マーク（dropEffect: noneかつpreventDefault未呼出）になり、可能位置ではmoveになる', async () => {
    await element.updateComplete

    // p1 (親行) をドラッグ開始
    ;(element as any).handleRowDragStart(
      new CustomEvent('row-dragstart', { detail: { rowId: 'p1' } }),
    )

    // layout を取得して各行の Y 座標を確認
    const { layouts } = (element as any).calculateLayout()
    const phase1Index = (element as any).displayRows.findIndex((r: GanttRow) => r.id === 'phase1')
    const p2Index = (element as any).displayRows.findIndex((r: GanttRow) => r.id === 'p2')

    const phase1Layout = layouts[phase1Index]
    const p2Layout = layouts[p2Index]

    // 1. 移動不可な位置 (自身の子孫行 phase1 の上: 循環参照) での dragover
    const invalidPreventDefault = vi.fn()
    const invalidDataTransfer: any = { types: ['text/plain'], dropEffect: '' }
    const invalidDragEvent = {
      clientY: phase1Layout.top + phase1Layout.height / 2 + (element as any).calendarHeight,
      dataTransfer: invalidDataTransfer,
      preventDefault: invalidPreventDefault,
    } as any

    // mock getBoundingClientRect for container
    const container = element.shadowRoot?.querySelector('.scroll-container') as HTMLElement
    if (container) {
      container.getBoundingClientRect = () => ({ top: 0, left: 0, width: 800, height: 600 } as any)
    }

    ;(element as any).handleContainerDragOver(invalidDragEvent)

    // ドロップ不可のため preventDefault は呼ばれず（ブラウザがOS禁止マークを表示）、dropEffect は 'none'、インジケータは非表示
    expect(invalidPreventDefault).not.toHaveBeenCalled()
    expect(invalidDataTransfer.dropEffect).toBe('none')
    expect((element as any).dragOverRowId).toBeNull()

    // 2. 移動可能な位置 (別プロジェクト p2 の top) の上での dragover
    const validPreventDefault = vi.fn()
    const validDataTransfer: any = { types: ['text/plain'], dropEffect: '' }
    const validDragEvent = {
      clientY: p2Layout.top + 2 + (element as any).calendarHeight, // top 領域
      dataTransfer: validDataTransfer,
      preventDefault: validPreventDefault,
    } as any

    ;(element as any).handleContainerDragOver(validDragEvent)

    // ドロップ可能なため preventDefault が呼ばれ、dropEffect は 'move'、インジケータが表示される
    expect(validPreventDefault).toHaveBeenCalled()
    expect(validDataTransfer.dropEffect).toBe('move')
    expect((element as any).dragOverRowId).toBe('p2')

    // 3. ドラッグ終了時のクリーンアップ
    ;(element as any).handleRowDragEnd()
    expect((element as any).dragOverRowId).toBeNull()
  })

  describe('サマリータスクの色設定', () => {
    it('option.tree.summaryColor でサマリータスクの既定色を設定できる', async () => {
      element.option = {
        ...element.option,
        calendar: {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-31'),
          pxPerDay: 20,
        },
        tree: {
          enabled: true,
          autoSummary: true,
          summaryColor: '#10b981',
        },
      }
      await element.updateComplete

      const displayRows = (element as any).displayRows
      const p1Row = displayRows.find((r: GanttRow) => r.id === 'p1')
      const summaryTask = p1Row?.tasks.find((t: any) => t.type === 'summary')

      expect(summaryTask).toBeDefined()
      expect(summaryTask?.style).toContain('background-color: #10b981;')
    })

    it('row.summaryColor が指定されている場合、option.tree.summaryColor より優先して行個別色が適用される', async () => {
      element.option = {
        ...element.option,
        calendar: {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-31'),
          pxPerDay: 20,
        },
        tree: {
          enabled: true,
          autoSummary: true,
          summaryColor: '#10b981',
        },
      }

      // p1 行に個別色を設定
      element.rows = element.rows.map((r) =>
        r.id === 'p1' ? { ...r, summaryColor: '#f59e0b' } : r,
      )
      await element.updateComplete

      const displayRows = (element as any).displayRows
      const p1Row = displayRows.find((r: GanttRow) => r.id === 'p1')
      const summaryTask = p1Row?.tasks.find((t: any) => t.type === 'summary')

      expect(summaryTask).toBeDefined()
      expect(summaryTask?.style).toContain('background-color: #f59e0b;')
    })
  })
})






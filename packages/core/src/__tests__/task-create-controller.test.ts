import { describe, it, expect, vi, afterEach } from 'vitest'
import '../components/gantt-chart'
import type { GanttChartElement } from '../components/gantt-chart'
import type {
  GanttChartOption,
  GanttRow,
  TaskCreateEventDetail,
} from '../core/types'
import type { GanttPlugin } from '../core/plugin'

vi.stubGlobal(
  'ResizeObserver',
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
)

describe('TaskCreateController (A-4: Timeline Task Creation)', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.clearAllMocks()
  })

  const createChart = async (
    optionOverrides: Partial<GanttChartOption> = {},
    customRows?: GanttRow[],
  ) => {
    const rows: GanttRow[] =
      customRows ??
      [
        {
          id: 'row-1',
          name: 'Empty Row 1',
          tasks: [],
        },
        {
          id: 'row-2',
          name: 'Row 2 With Task',
          tasks: [
            {
              id: 'existing-1',
              name: 'Existing Task',
              start: new Date(2026, 3, 2, 0, 0, 0),
              end: new Date(2026, 3, 5, 0, 0, 0),
            },
          ],
        },
      ]

    const option: GanttChartOption = {
      calendar: {
        start: new Date(2026, 3, 1, 0, 0, 0),
        end: new Date(2026, 3, 30, 0, 0, 0),
        pxPerDay: 50,
      },
      rowHeader: {
        width: 100,
      },
      history: {
        enabled: true,
      },
      taskCreation: true,
      ...optionOverrides,
    }

    const el = document.createElement('gantt-chart') as GanttChartElement
    el.rows = rows
    el.option = option
    document.body.appendChild(el)
    await el.updateComplete

    const container = el.shadowRoot?.querySelector('.scroll-container') as HTMLElement
    container.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        right: 1000,
        bottom: 600,
        width: 1000,
        height: 600,
        x: 0,
        y: 0,
        toJSON: () => {},
      }) as DOMRect

    return { el, container }
  }

  it('Alt + ドラッグでタイムライン空白部にスナップ済みタスクを作成し、Undo / Redo が機能する', async () => {
    const { el, container } = await createChart()

    const createdEvents: TaskCreateEventDetail[] = []
    el.addEventListener('task-create', (e: Event) => {
      createdEvents.push((e as CustomEvent<TaskCreateEventDetail>).detail)
    })

    // row-1 (Y=15), X=200 (timelineX=100 => day +2 = 4/3) から X=340 (timelineX=240 => day +4.8 -> ceil 5 = 4/6) へ Alt+ドラッグ
    container.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 200,
        clientY: 15,
        button: 0,
        altKey: true,
        bubbles: true,
        composed: true,
      }),
    )
    await el.updateComplete

    window.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: 340,
        clientY: 15,
        altKey: true,
        bubbles: true,
        composed: true,
      }),
    )
    await el.updateComplete

    // ドラッグ中はゴーストプレビューが保持されていること
    expect((el as any)._taskCreateController.createPreview).not.toBeNull()
    // マーキー選択ボックスは表示されないこと
    expect(el.shadowRoot?.querySelector('.marquee-selection-box')).toBeNull()

    window.dispatchEvent(
      new PointerEvent('pointerup', {
        clientX: 340,
        clientY: 15,
        altKey: true,
        bubbles: true,
        composed: true,
      }),
    )
    await el.updateComplete

    expect(createdEvents).toHaveLength(1)
    const detail = createdEvents[0]
    expect(detail.rowId).toBe('row-1')
    expect(detail.source).toBe('drag')
    expect(detail.task.start).toEqual(new Date(2026, 3, 3, 0, 0, 0))
    expect(detail.task.end).toEqual(new Date(2026, 3, 6, 0, 0, 0))
    expect(el.rows[0].tasks).toHaveLength(1)
    expect(el.selectedTasks.has(detail.task.id)).toBe(true)

    // Undo で作成前の空配列に戻り、Redo で復元されること
    expect(el.canUndo).toBe(true)
    el.undo()
    await el.updateComplete
    expect(el.rows[0].tasks).toHaveLength(0)

    expect(el.canRedo).toBe(true)
    el.redo()
    await el.updateComplete
    expect(el.rows[0].tasks).toHaveLength(1)
    expect(el.rows[0].tasks[0].id).toBe(detail.task.id)
  })

  it('逆方向（右から左）への Alt + ドラッグでも開始・終了日時が正しく正規化される', async () => {
    const { el, container } = await createChart()

    container.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 350, // timelineX = 250 (day +5 = 4/6)
        clientY: 15,
        button: 0,
        altKey: true,
        bubbles: true,
        composed: true,
      }),
    )
    window.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: 200, // timelineX = 100 (day +2 = 4/3)
        clientY: 15,
        altKey: true,
        bubbles: true,
        composed: true,
      }),
    )
    window.dispatchEvent(
      new PointerEvent('pointerup', {
        clientX: 200,
        clientY: 15,
        altKey: true,
        bubbles: true,
        composed: true,
      }),
    )
    await el.updateComplete

    expect(el.rows[0].tasks).toHaveLength(1)
    expect(el.rows[0].tasks[0].start).toEqual(new Date(2026, 3, 3, 0, 0, 0))
    expect(el.rows[0].tasks[0].end).toEqual(new Date(2026, 3, 6, 0, 0, 0))
  })

  it('ダブルクリックでデフォルト期間の新規タスクを作成し、Alt なしドラッグでは既存のマーキー選択と共存する', async () => {
    const { el, container } = await createChart({
      taskCreation: {
        enabled: true,
        trigger: 'alt-drag-or-dblclick',
        defaultDurationMinutes: 2880, // 2日間
        defaultTaskName: 'クイックタスク',
      },
    })

    const createdEvents: TaskCreateEventDetail[] = []
    el.addEventListener('task-create', (e: Event) => {
      createdEvents.push((e as CustomEvent<TaskCreateEventDetail>).detail)
    })

    // 1. Alt なしドラッグ -> タスクは作成されず、マーキー選択が動作する
    container.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 120,
        clientY: 50,
        button: 0,
        altKey: false,
        bubbles: true,
        composed: true,
      }),
    )
    window.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: 350,
        clientY: 90,
        altKey: false,
        bubbles: true,
        composed: true,
      }),
    )
    await el.updateComplete
    expect(el.shadowRoot?.querySelector('.marquee-selection-box')).not.toBeNull()

    window.dispatchEvent(
      new PointerEvent('pointerup', {
        clientX: 350,
        clientY: 90,
        bubbles: true,
        composed: true,
      }),
    )
    await el.updateComplete
    expect(createdEvents).toHaveLength(0)
    expect(el.selectedTasks.has('existing-1')).toBe(true)

    // 2. 空行へのダブルクリック -> 2日間のタスクが作成される
    container.dispatchEvent(
      new MouseEvent('dblclick', {
        clientX: 250, // timelineX = 150 -> day +3 = 4/4
        clientY: 15,
        bubbles: true,
        composed: true,
      }),
    )
    await el.updateComplete

    expect(createdEvents).toHaveLength(1)
    expect(createdEvents[0].source).toBe('dblclick')
    expect(createdEvents[0].task.name).toBe('クイックタスク')
    expect(createdEvents[0].task.start).toEqual(new Date(2026, 3, 4, 0, 0, 0))
    expect(createdEvents[0].task.end).toEqual(new Date(2026, 3, 6, 0, 0, 0))
  })

  it('Escape キーでドラッグ作成中のプレビューをキャンセルし、サマリー行への誤作成を防止する', async () => {
    const treeRows: GanttRow[] = [
      { id: 'parent-1', name: 'Summary Row', tasks: [] },
      {
        id: 'child-1',
        parentId: 'parent-1',
        name: 'Child Row',
        tasks: [
          {
            id: 'c-task',
            name: 'Child Task',
            start: new Date(2026, 3, 2),
            end: new Date(2026, 3, 4),
          },
        ],
      },
    ]

    const { el, container } = await createChart(
      {
        tree: { enabled: true, autoSummary: true },
        taskCreation: { enabled: true, allowOnSummaryRow: false },
      },
      treeRows,
    )

    // サマリー行 (row index 0, Y=15) でのダブルクリックは無視されること
    container.dispatchEvent(
      new MouseEvent('dblclick', {
        clientX: 250,
        clientY: 15,
        bubbles: true,
        composed: true,
      }),
    )
    await el.updateComplete
    expect(el.rows[0].tasks).toHaveLength(0)

    // 子行 (row index 1, Y=55) で Alt+ドラッグ開始後、Escape でキャンセル
    const childLayout = el.calculateLayout().layouts[1]
    const childY = childLayout.top + 10

    container.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 300,
        clientY: childY,
        button: 0,
        altKey: true,
        bubbles: true,
        composed: true,
      }),
    )
    window.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: 420,
        clientY: childY,
        altKey: true,
        bubbles: true,
        composed: true,
      }),
    )
    await el.updateComplete
    expect((el as any)._taskCreateController.createPreview).not.toBeNull()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await el.updateComplete

    expect((el as any)._taskCreateController.createPreview).toBeNull()
    expect(el.rows[1].tasks).toHaveLength(1) // 既存1件のまま増えない
  })

  it('beforeTaskCreate / afterTaskCreate プラグインフックおよび createTask ファクトリが動作する', async () => {
    let allowCreate = false
    const beforeSpy = vi.fn(() => allowCreate)
    const afterSpy = vi.fn()

    const guardPlugin: GanttPlugin = {
      name: 'task-create-guard',
      install() {},
      hooks: {
        beforeTaskCreate: beforeSpy,
        afterTaskCreate: afterSpy,
      },
    }

    const { el, container } = await createChart({
      plugins: [guardPlugin],
      taskCreation: {
        enabled: true,
        createTask: ({ row }) => ({
          name: `${row.name} - Custom`,
          progress: 25,
        }),
      },
    })

    // 1回目: beforeTaskCreate が false を返すためキャンセルされる
    container.dispatchEvent(
      new MouseEvent('dblclick', {
        clientX: 200,
        clientY: 15,
        bubbles: true,
        composed: true,
      }),
    )
    await el.updateComplete
    expect(beforeSpy).toHaveBeenCalledTimes(1)
    expect(afterSpy).not.toHaveBeenCalled()
    expect(el.rows[0].tasks).toHaveLength(0)

    // 2回目: beforeTaskCreate が true を返し、createTask のカスタム属性で作成される
    allowCreate = true
    container.dispatchEvent(
      new MouseEvent('dblclick', {
        clientX: 200,
        clientY: 15,
        bubbles: true,
        composed: true,
      }),
    )
    await el.updateComplete
    expect(beforeSpy).toHaveBeenCalledTimes(2)
    expect(afterSpy).toHaveBeenCalledTimes(1)
    expect(el.rows[0].tasks).toHaveLength(1)
    expect(el.rows[0].tasks[0].name).toBe('Empty Row 1 - Custom')
    expect(el.rows[0].tasks[0].progress).toBe(25)
  })
})

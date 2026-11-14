import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '../index'
import {
  enLocale,
  normalizeDependencyLink,
  type DependencyUpdateEventDetail,
  type GanttChartElement,
  type GanttChartOption,
  type GanttRow,
} from '../index'

;(globalThis as any).ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

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

describe('Built-in Dependency Edit Popover & updateDependency API', () => {
  let chart: GanttChartElement
  let baseRows: GanttRow[]
  let baseOption: GanttChartOption

  beforeEach(async () => {
    baseRows = [
      {
        id: 'row-1',
        name: '設計',
        tasks: [
          {
            id: 'task-1',
            name: '基本設計',
            start: new Date(2026, 3, 2),
            end: new Date(2026, 3, 6),
          },
        ],
      },
      {
        id: 'row-2',
        name: '実装',
        tasks: [
          {
            id: 'task-2',
            name: 'API実装',
            start: new Date(2026, 3, 8),
            end: new Date(2026, 3, 12),
            dependencies: ['task-1'],
          },
        ],
      },
    ]

    baseOption = {
      calendar: {
        start: new Date(2026, 3, 1),
        end: new Date(2026, 3, 30),
        pxPerDay: 40,
      },
      dependency: {
        autoSchedule: true,
      },
      history: {
        enabled: true,
      },
    }

    chart = document.createElement('gantt-chart') as GanttChartElement
    chart.option = baseOption
    chart.rows = baseRows
    document.body.appendChild(chart)
    await chart.updateComplete
  })

  afterEach(() => {
    chart.remove()
  })

  it('opens popover on dependency dblclick and .dependency-edit-btn click, and respects readOnly / enableEditPopover', async () => {
    expect(chart.shadowRoot?.querySelector('.dependency-edit-popover')).toBeNull()

    const editBtn = chart.shadowRoot?.querySelector('.dependency-edit-btn') as SVGGElement
    expect(editBtn).not.toBeNull()

    // 1) .dependency-edit-btn クリックで開く
    editBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await chart.updateComplete
    expect(chart.shadowRoot?.querySelector('.dependency-edit-popover')).not.toBeNull()

    // Escape キーで閉じる
    chart.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await chart.updateComplete
    expect(chart.shadowRoot?.querySelector('.dependency-edit-popover')).toBeNull()

    // 2) .dependency-hit-area の dblclick で開く
    const hitArea = chart.shadowRoot?.querySelector('.dependency-hit-area') as SVGPathElement
    hitArea.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    await chart.updateComplete
    expect(chart.shadowRoot?.querySelector('.dependency-edit-popover')).not.toBeNull()

    chart.closeDependencyEditPopover()
    await chart.updateComplete

    // 3) enableEditPopover: false の場合は開かない
    chart.option = {
      ...baseOption,
      dependency: { ...baseOption.dependency, enableEditPopover: false },
    }
    await chart.updateComplete
    expect(chart.shadowRoot?.querySelector('.dependency-edit-btn')).toBeNull()
    const hitAreaDisabled = chart.shadowRoot?.querySelector('.dependency-hit-area') as SVGPathElement
    hitAreaDisabled.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    await chart.updateComplete
    expect(chart.shadowRoot?.querySelector('.dependency-edit-popover')).toBeNull()

    // 4) enableEditPopover: false かつ showEditButton: true の場合はボタンが表示され dependency-edit が発火し、組み込みポップオーバーは開かない
    const editEvents: Array<{ sourceTaskId: string; targetTaskId: string }> = []
    chart.addEventListener('dependency-edit', ((e: CustomEvent) => {
      editEvents.push({ sourceTaskId: e.detail.sourceTaskId, targetTaskId: e.detail.targetTaskId })
    }) as EventListener)
    chart.option = {
      ...baseOption,
      dependency: { ...baseOption.dependency, enableEditPopover: false, showEditButton: true },
    }
    await chart.updateComplete
    const customEditBtn = chart.shadowRoot?.querySelector('.dependency-edit-btn') as SVGGElement
    expect(customEditBtn).not.toBeNull()
    customEditBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await chart.updateComplete
    expect(chart.shadowRoot?.querySelector('.dependency-edit-popover')).toBeNull()
    expect(editEvents).toEqual([{ sourceTaskId: 'task-1', targetTaskId: 'task-2' }])

    // 5) readOnly: true の場合は開かない
    chart.option = {
      ...baseOption,
      readOnly: true,
    }
    await chart.updateComplete
    expect(chart.openDependencyEditPopover('task-1', 'task-2')).toBe(false)
  })

  it('supports editPopoverTrigger: click and English locale labels', async () => {
    chart.option = {
      ...baseOption,
      locale: enLocale,
      dependency: {
        ...baseOption.dependency,
        editPopoverTrigger: 'click',
      },
    }
    await chart.updateComplete

    const hitArea = chart.shadowRoot?.querySelector('.dependency-hit-area') as SVGPathElement
    hitArea.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await chart.updateComplete

    const popover = chart.shadowRoot?.querySelector('.dependency-edit-popover')
    expect(popover).not.toBeNull()
    expect(popover?.textContent).toContain('Edit Dependency')
    expect(popover?.textContent).toContain('Lag (d)')
  })

  it('updates dependency type & lag, triggers autoSchedule, emits dependency-update, and supports undo/redo', async () => {
    const updateEvents: DependencyUpdateEventDetail[] = []
    chart.addEventListener('dependency-update', ((e: CustomEvent<DependencyUpdateEventDetail>) => {
      updateEvents.push(e.detail)
    }) as EventListener)

    // ポップオーバーを開く
    const editBtn = chart.shadowRoot?.querySelector('.dependency-edit-btn') as SVGGElement
    editBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await chart.updateComplete

    // 種別を FS -> SS に変更
    const ssBtn = chart.shadowRoot?.querySelector(
      '.dependency-type-btn[data-dep-type="SS"]',
    ) as HTMLButtonElement
    expect(ssBtn).not.toBeNull()
    ssBtn.click()
    await chart.updateComplete

    // ラグを +2日 に変更 (+1 ボタンを2回クリック)
    const incBtn = chart.shadowRoot?.querySelector('.dependency-lag-inc-btn') as HTMLButtonElement
    incBtn.click()
    incBtn.click()
    await chart.updateComplete

    // 保存前はイベント未発火
    expect(updateEvents).toHaveLength(0)

    // 保存ボタンをクリック
    const saveBtn = chart.shadowRoot?.querySelector(
      '.dependency-popover-btn-save',
    ) as HTMLButtonElement
    saveBtn.click()
    await chart.updateComplete

    // ポップオーバーが閉じ、dependency-update イベントが1回発火
    expect(chart.shadowRoot?.querySelector('.dependency-edit-popover')).toBeNull()
    expect(updateEvents).toHaveLength(1)
    expect(updateEvents[0].sourceTaskId).toBe('task-1')
    expect(updateEvents[0].targetTaskId).toBe('task-2')
    expect(updateEvents[0].previousDependency).toEqual({
      taskId: 'task-1',
      type: 'FS',
      lag: 0,
    })
    expect(updateEvents[0].dependency).toEqual({
      taskId: 'task-1',
      type: 'SS',
      lag: 2880,
    })

    // autoSchedule により task-2 の開始日が task-1 開始日 (4/2) + 2日 = 4/4 に再計算されていること
    const updatedTask2 = chart.rows[1].tasks[0]
    expect(normalizeDependencyLink(updatedTask2.dependencies![0])).toEqual({
      taskId: 'task-1',
      type: 'SS',
      lag: 2880,
    })
    expect(updatedTask2.start.getTime()).toBe(new Date(2026, 3, 4).getTime())
    expect(updatedTask2.end.getTime()).toBe(new Date(2026, 3, 8).getTime())
    expect(updateEvents[0].affectedTasks).toHaveLength(1)

    // Undo で元の FS / lag:0 / 4月8日開始 に復元されること
    await chart.undo()
    await chart.updateComplete
    const undoneTask2 = chart.rows[1].tasks[0]
    expect(normalizeDependencyLink(undoneTask2.dependencies![0])).toEqual({
      taskId: 'task-1',
      type: 'FS',
      lag: 0,
    })
    expect(undoneTask2.start.getTime()).toBe(new Date(2026, 3, 8).getTime())

    // Redo で再び SS / lag:2880 / 4月4日開始 に進むこと
    await chart.redo()
    await chart.updateComplete
    const redoneTask2 = chart.rows[1].tasks[0]
    expect(normalizeDependencyLink(redoneTask2.dependencies![0])).toEqual({
      taskId: 'task-1',
      type: 'SS',
      lag: 2880,
    })
    expect(redoneTask2.start.getTime()).toBe(new Date(2026, 3, 4).getTime())
  })

  it('supports deleting from popover and beforeDependencyUpdate / afterDependencyUpdate plugin hooks', async () => {
    let allowUpdate = false
    const afterHook = vi.fn()

    chart.use({
      name: 'dep-guard-test',
      hooks: {
        beforeDependencyUpdate: () => allowUpdate,
        afterDependencyUpdate: afterHook,
      },
    })

    // beforeDependencyUpdate が false を返す場合はブロックされる
    expect(chart.updateDependency('task-1', 'task-2', { type: 'FF', lagDays: 1 })).toBe(false)
    expect(afterHook).not.toHaveBeenCalled()

    // 許可後は更新され afterDependencyUpdate が呼ばれる
    allowUpdate = true
    expect(chart.updateDependency('task-1', 'task-2', { type: 'FF', lagDays: 1 })).toBe(true)
    expect(afterHook).toHaveBeenCalledTimes(1)

    // ポップオーバー内の削除ボタンから削除できること
    chart.openDependencyEditPopover('task-1', 'task-2')
    await chart.updateComplete
    const deleteBtn = chart.shadowRoot?.querySelector(
      '.dependency-popover-btn-delete',
    ) as HTMLButtonElement
    expect(deleteBtn).not.toBeNull()
    deleteBtn.click()
    await chart.updateComplete

    expect(chart.shadowRoot?.querySelector('.dependency-edit-popover')).toBeNull()
    expect(chart.rows[1].tasks[0].dependencies ?? []).toHaveLength(0)
  })
})

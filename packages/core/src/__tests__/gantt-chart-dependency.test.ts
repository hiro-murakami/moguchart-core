import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GanttChartElement } from '../components/gantt-chart'
import type { GanttChartOption, GanttRow, DependencyDeleteEventDetail, DependencySelectEventDetail } from '../core/types'

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

describe('GanttChart Dependency Add/Delete & Selection', () => {
  let chart: GanttChartElement
  let rows: GanttRow[]
  let defaultOption: GanttChartOption

  beforeEach(async () => {
    chart = new GanttChartElement()
    rows = [
      {
        id: 'row1',
        name: 'Row 1',
        tasks: [
          {
            id: 'task1',
            name: 'Task 1',
            start: new Date('2024-01-02T00:00:00'),
            end: new Date('2024-01-05T00:00:00'),
          },
        ],
      },
      {
        id: 'row2',
        name: 'Row 2',
        tasks: [
          {
            id: 'task2',
            name: 'Task 2',
            start: new Date('2024-01-07T00:00:00'),
            end: new Date('2024-01-10T00:00:00'),
            dependencies: ['task1'], // task2 depends on task1
          },
        ],
      },
    ]

    defaultOption = {
      calendar: {
        start: new Date('2024-01-01T00:00:00'),
        end: new Date('2024-01-31T00:00:00'),
        pxPerDay: 50,
      },
      bar: {
        height: 30,
        margin: 5,
      },
      dependency: {
        showConnectors: true,
        creatable: true,
        deletable: true,
        showDeleteButton: true,
      },
      readOnly: false,
    }

    chart.rows = rows
    chart.option = defaultOption
    document.body.appendChild(chart)
    await chart.updateComplete
  })

  afterEach(() => {
    chart.remove()
  })

  it('renders dependency lines and delete button by default', async () => {
    const depGroup = chart.shadowRoot?.querySelector('.dependency-group')
    expect(depGroup).not.toBeNull()

    const hitArea = chart.shadowRoot?.querySelector('.dependency-hit-area')
    expect(hitArea).not.toBeNull()

    const deleteBtn = chart.shadowRoot?.querySelector('.dependency-delete-btn')
    expect(deleteBtn).not.toBeNull()

    const btnHitArea = deleteBtn?.querySelector('.dependency-delete-btn-hit-area')
    expect(btnHitArea).not.toBeNull()
  })

  it('selects dependency line on hit area click and emits dependency-select', async () => {
    let selectEventDetail: DependencySelectEventDetail | null = null
    chart.addEventListener('dependency-select', ((e: CustomEvent<DependencySelectEventDetail>) => {
      selectEventDetail = e.detail
    }) as EventListener)

    const hitArea = chart.shadowRoot?.querySelector('.dependency-hit-area') as SVGPathElement
    expect(hitArea).not.toBeNull()

    hitArea.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await chart.updateComplete

    expect(selectEventDetail).not.toBeNull()
    expect((selectEventDetail as DependencySelectEventDetail | null)?.selected).toEqual({
      sourceTaskId: 'task1',
      targetTaskId: 'task2',
    })
    expect(chart.selectedDependency).toEqual({
      sourceTaskId: 'task1',
      targetTaskId: 'task2',
    })

    const depGroup = chart.shadowRoot?.querySelector('.dependency-group')
    expect(depGroup?.classList.contains('selected')).toBe(true)
  })

  it('deletes dependency via Delete key when dependency is selected', async () => {
    chart.selectDependency('task1', 'task2')
    await chart.updateComplete

    let deleteEventDetail: DependencyDeleteEventDetail | null = null
    chart.addEventListener('dependency-delete', ((e: CustomEvent<DependencyDeleteEventDetail>) => {
      deleteEventDetail = e.detail
    }) as EventListener)

    chart.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }))
    await chart.updateComplete

    expect(deleteEventDetail).not.toBeNull()
    expect((deleteEventDetail as DependencyDeleteEventDetail | null)?.sourceTaskId).toBe('task1')
    expect((deleteEventDetail as DependencyDeleteEventDetail | null)?.targetTaskId).toBe('task2')
    // 削除後は選択がクリアされること
    expect(chart.selectedDependency).toBeNull()
  })

  it('deletes dependency on delete button click', async () => {
    let deleteEventDetail: DependencyDeleteEventDetail | null = null
    chart.addEventListener('dependency-delete', ((e: CustomEvent<DependencyDeleteEventDetail>) => {
      deleteEventDetail = e.detail
    }) as EventListener)

    const deleteBtn = chart.shadowRoot?.querySelector('.dependency-delete-btn') as SVGGElement
    expect(deleteBtn).not.toBeNull()

    deleteBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await chart.updateComplete

    expect(deleteEventDetail).not.toBeNull()
    expect((deleteEventDetail as DependencyDeleteEventDetail | null)?.sourceTaskId).toBe('task1')
    expect((deleteEventDetail as DependencyDeleteEventDetail | null)?.targetTaskId).toBe('task2')
  })

  it('does not render delete button when showDeleteButton is false', async () => {
    chart.option = {
      ...defaultOption,
      dependency: {
        ...defaultOption.dependency,
        showDeleteButton: false,
      },
    }
    await chart.updateComplete

    const deleteBtn = chart.shadowRoot?.querySelector('.dependency-delete-btn')
    expect(deleteBtn).toBeNull()
  })

  it('does not fire dependency-delete when deletable is false', async () => {
    chart.option = {
      ...defaultOption,
      dependency: {
        ...defaultOption.dependency,
        deletable: false,
      },
    }
    await chart.updateComplete

    let deleted = false
    chart.addEventListener('dependency-delete', () => {
      deleted = true
    })

    // 削除ボタンは描画されないはず
    const deleteBtn = chart.shadowRoot?.querySelector('.dependency-delete-btn')
    expect(deleteBtn).toBeNull()

    // 選択してDeleteキーを押しても発火しないこと
    chart.selectDependency('task1', 'task2')
    chart.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }))
    await chart.updateComplete

    expect(deleted).toBe(false)
  })

  it('does not fire dependency-delete when readOnly is true', async () => {
    chart.option = {
      ...defaultOption,
      readOnly: true,
    }
    await chart.updateComplete

    let deleted = false
    chart.addEventListener('dependency-delete', () => {
      deleted = true
    })

    chart.selectDependency('task1', 'task2')
    chart.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }))
    await chart.updateComplete

    expect(deleted).toBe(false)
  })

  it('prevents connector drag start when creatable is false', async () => {
    chart.option = {
      ...defaultOption,
      dependency: {
        ...defaultOption.dependency,
        creatable: false,
      },
    }
    await chart.updateComplete

    const container = chart.shadowRoot?.querySelector('.scroll-container')
    container?.dispatchEvent(
      new CustomEvent('connector-drag-start', {
        detail: {
          taskId: 'task1',
          endpoint: 'end',
          startX: 100,
          startY: 50,
          clientX: 100,
          clientY: 50,
        },
        bubbles: true,
        composed: true,
      }),
    )

    expect((chart as any).connectorDrag).toBeNull()
  })

  it('clears dependency selection on clearSelection() or Escape key', async () => {
    chart.selectDependency('task1', 'task2')
    await chart.updateComplete
    expect(chart.selectedDependency).not.toBeNull()

    chart.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await chart.updateComplete
    expect(chart.selectedDependency).toBeNull()
  })
})

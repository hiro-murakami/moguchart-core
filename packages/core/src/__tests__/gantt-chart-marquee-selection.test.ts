import { describe, it, expect, vi, afterEach } from 'vitest'
import '../components/gantt-chart'
import type { GanttChartElement } from '../components/gantt-chart'
import type { GanttRow, GanttChartOption } from '../core/types'

// Mock ResizeObserver
vi.stubGlobal(
  'ResizeObserver',
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
)

describe('GanttChartElement Marquee Selection', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  const createChart = async (optionOverrides: Partial<GanttChartOption> = {}) => {
    const rows: GanttRow[] = [
      {
        id: 'row1',
        name: 'Row 1',
        tasks: [
          {
            id: 'task1',
            name: 'Task 1',
            start: new Date('2024-01-02'),
            end: new Date('2024-01-05'),
          },
          {
            id: 'task2',
            name: 'Task 2',
            start: new Date('2024-01-10'),
            end: new Date('2024-01-15'),
          },
        ],
      },
      {
        id: 'row2',
        name: 'Row 2',
        tasks: [
          {
            id: 'task3',
            name: 'Task 3',
            start: new Date('2024-01-03'),
            end: new Date('2024-01-08'),
          },
        ],
      },
    ]

    const option: GanttChartOption = {
      calendar: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
        pxPerDay: 50,
      },
      rowHeader: {
        width: 100,
      },
      ...optionOverrides,
    }

    const el = document.createElement('gantt-chart') as GanttChartElement
    el.rows = rows
    el.option = option
    document.body.appendChild(el)
    await el.updateComplete

    const container = el.shadowRoot?.querySelector('.scroll-container') as HTMLElement
    // jsdom 用の getBoundingClientRect モック
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

    return { el, rows, option, container }
  }

  it('selects multiple tasks intersecting with the marquee selection box', async () => {
    const { el, container } = await createChart()

    let selectionEvent: any = null
    el.addEventListener('bar-selection-change', (e: any) => {
      selectionEvent = e
    })

    // PointerDown on background at (120, 10) (inside row area, X > labelWidth)
    container.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 120,
        clientY: 10,
        button: 0,
        bubbles: true,
        composed: true,
      }),
    )
    await el.updateComplete

    // PointerMove to (400, 120) to cover task1 (row1) and task3 (row2), but not task2 (row1, starts at day 10 => x > 550)
    window.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: 400,
        clientY: 120,
        bubbles: true,
        composed: true,
      }),
    )
    await el.updateComplete

    // Marquee box should be rendered
    const marqueeBox = el.shadowRoot?.querySelector('.marquee-selection-box') as HTMLElement
    expect(marqueeBox).toBeTruthy()

    // PointerUp to finish marquee selection
    window.dispatchEvent(
      new PointerEvent('pointerup', {
        clientX: 400,
        clientY: 120,
        bubbles: true,
        composed: true,
      }),
    )
    await el.updateComplete

    // Marquee box should be cleared
    expect(el.shadowRoot?.querySelector('.marquee-selection-box')).toBeNull()

    // Event should be emitted with task1 and task3
    expect(selectionEvent).toBeTruthy()
    expect(selectionEvent.detail.selectedIds).toContain('task1')
    expect(selectionEvent.detail.selectedIds).toContain('task3')
    expect(selectionEvent.detail.selectedIds).not.toContain('task2')
  })

  it('adds to existing selection when Shift/Ctrl/Cmd key is pressed during marquee selection', async () => {
    const { el, container } = await createChart()

    // Pre-select task2
    ;(el as any).selectedTasks = new Set(['task2'])
    await el.updateComplete

    let selectionEvent: any = null
    el.addEventListener('bar-selection-change', (e: any) => {
      selectionEvent = e
    })

    // PointerDown with shiftKey: true
    container.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 120,
        clientY: 10,
        button: 0,
        shiftKey: true,
        bubbles: true,
        composed: true,
      }),
    )
    await el.updateComplete

    // PointerMove covering task1
    window.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: 300,
        clientY: 60,
        shiftKey: true,
        bubbles: true,
        composed: true,
      }),
    )
    await el.updateComplete

    // PointerUp
    window.dispatchEvent(
      new PointerEvent('pointerup', {
        clientX: 300,
        clientY: 60,
        bubbles: true,
        composed: true,
      }),
    )
    await el.updateComplete

    // Both previous task2 and new task1 should be selected
    expect(selectionEvent).toBeTruthy()
    expect(selectionEvent.detail.selectedIds).toContain('task1')
    expect(selectionEvent.detail.selectedIds).toContain('task2')
  })

  it('resets previous selection when dragging without modifier key', async () => {
    const { el, container } = await createChart()

    // Pre-select task2
    ;(el as any).selectedTasks = new Set(['task2'])
    await el.updateComplete

    let selectionEvent: any = null
    el.addEventListener('bar-selection-change', (e: any) => {
      selectionEvent = e
    })

    // PointerDown without modifier key
    container.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 120,
        clientY: 10,
        button: 0,
        shiftKey: false,
        bubbles: true,
        composed: true,
      }),
    )
    await el.updateComplete

    // PointerMove covering task1
    window.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: 300,
        clientY: 60,
        bubbles: true,
        composed: true,
      }),
    )
    await el.updateComplete

    // PointerUp
    window.dispatchEvent(
      new PointerEvent('pointerup', {
        clientX: 300,
        clientY: 60,
        bubbles: true,
        composed: true,
      }),
    )
    await el.updateComplete

    // Only task1 should be selected, task2 should be removed
    expect(selectionEvent).toBeTruthy()
    expect(selectionEvent.detail.selectedIds).toContain('task1')
    expect(selectionEvent.detail.selectedIds).not.toContain('task2')
  })

  it('does NOT trigger marquee selection when pointer movement is below threshold (treated as click)', async () => {
    const { el, container } = await createChart()

    let selectionEvent: any = null
    el.addEventListener('bar-selection-change', (e: any) => {
      selectionEvent = e
    })

    container.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 120,
        clientY: 10,
        button: 0,
        bubbles: true,
        composed: true,
      }),
    )
    await el.updateComplete

    // Movement less than 4px
    window.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: 122,
        clientY: 11,
        bubbles: true,
        composed: true,
      }),
    )
    await el.updateComplete

    expect(el.shadowRoot?.querySelector('.marquee-selection-box')).toBeNull()

    window.dispatchEvent(
      new PointerEvent('pointerup', {
        clientX: 122,
        clientY: 11,
        bubbles: true,
        composed: true,
      }),
    )
    await el.updateComplete

    // No marquee bar-selection-change event triggered
    expect(selectionEvent).toBeNull()
  })

  it('does NOT trigger marquee selection when option.selection.marquee is false', async () => {
    const { el, container } = await createChart({
      selection: {
        marquee: false,
      },
    })

    container.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 120,
        clientY: 10,
        button: 0,
        bubbles: true,
        composed: true,
      }),
    )
    await el.updateComplete

    window.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: 400,
        clientY: 200,
        bubbles: true,
        composed: true,
      }),
    )
    await el.updateComplete

    expect(el.shadowRoot?.querySelector('.marquee-selection-box')).toBeNull()
  })

  it('applies custom border and background colors from option.selection', async () => {
    const { el, container } = await createChart({
      selection: {
        marquee: true,
        borderColor: '#ff0000',
        backgroundColor: 'rgba(255, 0, 0, 0.2)',
      },
    })

    container.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 120,
        clientY: 10,
        button: 0,
        bubbles: true,
        composed: true,
      }),
    )
    await el.updateComplete

    window.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: 300,
        clientY: 100,
        bubbles: true,
        composed: true,
      }),
    )
    await el.updateComplete

    const marqueeBox = el.shadowRoot?.querySelector('.marquee-selection-box') as HTMLElement
    expect(marqueeBox).toBeTruthy()
    expect(marqueeBox.style.borderColor).toBe('rgb(255, 0, 0)')
    expect(marqueeBox.style.backgroundColor).toBe('rgba(255, 0, 0, 0.2)')
  })
})

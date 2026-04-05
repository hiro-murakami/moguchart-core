import { describe, it, expect, vi, afterEach } from 'vitest'
import '../components/gantt-chart'
import type { GanttChartElement } from '../components/gantt-chart'
import type { GanttRow, GanttChartOption } from '@/core/types'

// Mock ResizeObserver
vi.stubGlobal(
  'ResizeObserver',
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
)

describe('GanttChartElement Right Click Selection', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('selects row on header context menu', async () => {
    const rows: GanttRow[] = [
      { id: 'row1', name: 'Row 1', tasks: [] },
      { id: 'row2', name: 'Row 2', tasks: [] },
    ]
    const option: GanttChartOption = {
      calendar: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
        pxPerDay: 50,
      },
    }

    const el = document.createElement('gantt-chart') as GanttChartElement
    el.rows = rows
    el.option = option
    document.body.appendChild(el)

    await el.updateComplete

    // Simulate right click on the second row header
    const rowElements = el.shadowRoot?.querySelectorAll('gantt-row')
    expect(rowElements?.length).toBe(2)

    const targetRow = rowElements![1]
    const header = targetRow.shadowRoot?.querySelector(
      '.row-header',
    ) as HTMLElement
    expect(header).toBeTruthy()

    let selectionEvent: any = null
    el.addEventListener('row-selection-change', (e: any) => {
      selectionEvent = e
    })

    // Dispatch contextmenu event on the header
    header.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        composed: true,
        button: 2,
      }),
    )

    await el.updateComplete

    // Check if the event was fired with correct details
    expect(selectionEvent).toBeTruthy()
    expect(selectionEvent.detail.selectedIds).toEqual(['row2'])
  })

  it('preserves selection when right clicking an already selected row', async () => {
    const rows: GanttRow[] = [
      { id: 'row1', name: 'Row 1', tasks: [] },
      { id: 'row2', name: 'Row 2', tasks: [] },
    ]
    const option: GanttChartOption = {
      calendar: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
        pxPerDay: 50,
      },
    }

    const el = document.createElement('gantt-chart') as GanttChartElement
    el.rows = rows
    el.option = option
    document.body.appendChild(el)
    await el.updateComplete

    await el.updateComplete

    // Setup listener
    const selectionHistory: string[][] = []
    el.addEventListener('row-selection-change', (e: any) => {
      selectionHistory.push(e.detail.selectedIds)
    })

    // Select row 1
    const rowElements = el.shadowRoot?.querySelectorAll('gantt-row')
    const row1Header = rowElements![0].shadowRoot?.querySelector(
      '.row-header',
    ) as HTMLElement
    row1Header.click()
    await el.updateComplete

    // Select row 2 with Ctrl/Meta to keep row 1 selected
    const rowElements2 = el.shadowRoot?.querySelectorAll('gantt-row')
    const row2Header = rowElements2![1].shadowRoot?.querySelector(
      '.row-header',
    ) as HTMLElement

    row2Header.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        composed: true,
        metaKey: true,
      }),
    )
    await el.updateComplete

    // Verify initial setup via events
    const lastSelection = selectionHistory[selectionHistory.length - 1] || []
    expect(lastSelection).toContain('row1')
    expect(lastSelection).toContain('row2')
    expect(lastSelection.length).toBe(2)

    const eventCountBeforeCtx = selectionHistory.length

    // Right click on row 2 (which is already selected)
    // Re-query to be safe
    const rowElements3 = el.shadowRoot?.querySelectorAll('gantt-row')
    const row2HeaderCtx = rowElements3![1].shadowRoot?.querySelector(
      '.row-header',
    ) as HTMLElement

    row2HeaderCtx.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        composed: true,
        button: 2,
      }),
    )

    await el.updateComplete

    // Should NOT have fired a new selection change event because selection shouldn't change
    expect(selectionHistory.length).toBe(eventCountBeforeCtx)
  })

  it('preserves selection when left clicking an already selected row (without modifiers)', async () => {
    const rows: GanttRow[] = [
      { id: 'row1', name: 'Row 1', tasks: [] },
      { id: 'row2', name: 'Row 2', tasks: [] },
    ]
    const option: GanttChartOption = {
      calendar: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
        pxPerDay: 50,
      },
    }

    const el = document.createElement('gantt-chart') as GanttChartElement
    el.rows = rows
    el.option = option
    document.body.appendChild(el)
    await el.updateComplete

    // Setup listener
    const selectionHistory: string[][] = []
    el.addEventListener('row-selection-change', (e: any) => {
      selectionHistory.push(e.detail.selectedIds)
    })

    // Select row 1
    const rowElements = el.shadowRoot?.querySelectorAll('gantt-row')
    const row1Header = rowElements![0].shadowRoot?.querySelector(
      '.row-header',
    ) as HTMLElement
    row1Header.click()
    await el.updateComplete

    // Select row 2 with Ctrl/Meta to keep row 1 selected
    const rowElements2 = el.shadowRoot?.querySelectorAll('gantt-row')
    const row2Header = rowElements2![1].shadowRoot?.querySelector(
      '.row-header',
    ) as HTMLElement

    row2Header.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        composed: true,
        metaKey: true,
      }),
    )
    await el.updateComplete

    // Verify initial setup via events
    const lastSelection = selectionHistory[selectionHistory.length - 1] || []
    expect(lastSelection).toContain('row1')
    expect(lastSelection).toContain('row2')
    expect(lastSelection.length).toBe(2)

    const eventCountBeforeClick = selectionHistory.length

    // Left click on row 2 (which is already selected) without modifiers
    row2Header.click()
    await el.updateComplete

    // Should NOT have fired a new selection change event because selection shouldn't change
    // (Existing behavior was: it would clear row1 and select row2 again, firing event)
    // New behavior: should preserve, so no event (or same state).
    expect(selectionHistory.length).toBe(eventCountBeforeClick)
  })

  it('updates selection on right click even if another row is selected', async () => {
    const rows: GanttRow[] = [
      { id: 'row1', name: 'Row 1', tasks: [] },
      { id: 'row2', name: 'Row 2', tasks: [] },
    ]
    const option: GanttChartOption = {
      calendar: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
        pxPerDay: 50,
      },
    }

    const el = document.createElement('gantt-chart') as GanttChartElement
    el.rows = rows
    el.option = option
    // Pre-select row 1 (simulating input prop, though internal state is primary)
    // Actually internal state `selectedRows` is what matters for display
    document.body.appendChild(el)
    await el.updateComplete

    // Select row 1 first normally
    const rowElements = el.shadowRoot?.querySelectorAll('gantt-row')
    const row1Header = rowElements![0].shadowRoot?.querySelector(
      '.row-header',
    ) as HTMLElement
    row1Header.click()
    await el.updateComplete

    // Verify row 1 selected
    // We can listen to the event to be sure

    // Now right click row 2
    const row2Header = rowElements![1].shadowRoot?.querySelector(
      '.row-header',
    ) as HTMLElement

    let selectionEvent: any = null
    el.addEventListener('row-selection-change', (e: any) => {
      selectionEvent = e
    })

    row2Header.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        composed: true,
        button: 2,
      }),
    )

    await el.updateComplete

    expect(selectionEvent).toBeTruthy()
    expect(selectionEvent.detail.selectedIds).toEqual(['row2'])
  })
})

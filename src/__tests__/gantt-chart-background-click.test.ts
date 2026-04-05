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

describe('GanttChartElement Background Click Selection Clearing', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('clears selection when left clicking on the container (background)', async () => {
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

    // Select row 1
    const rowElements = el.shadowRoot?.querySelectorAll('gantt-row')
    const row1Header = rowElements![0].shadowRoot?.querySelector(
      '.row-header',
    ) as HTMLElement
    row1Header.click()
    await el.updateComplete

    let selectionEvent: any = null
    el.addEventListener('row-selection-change', (e: any) => {
      selectionEvent = e
    })

    // Click on the scroll-container (background)
    const container = el.shadowRoot?.querySelector(
      '.scroll-container',
    ) as HTMLElement
    container.click()
    await el.updateComplete

    // verify selection is cleared
    // We expect a selection change event with empty array
    expect(selectionEvent).toBeTruthy()
    expect(selectionEvent.detail.selectedIds).toEqual([])
  })

  it('clears selection when right clicking on the container (background)', async () => {
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

    // Select row 1
    const rowElements = el.shadowRoot?.querySelectorAll('gantt-row')
    const row1Header = rowElements![0].shadowRoot?.querySelector(
      '.row-header',
    ) as HTMLElement
    row1Header.click()
    await el.updateComplete

    let selectionEvent: any = null
    el.addEventListener('row-selection-change', (e: any) => {
      selectionEvent = e
    })

    // Right click on the scroll-container
    const container = el.shadowRoot?.querySelector(
      '.scroll-container',
    ) as HTMLElement
    container.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        composed: true,
        button: 2,
      }),
    )
    await el.updateComplete

    // verify selection is cleared
    expect(selectionEvent).toBeTruthy()
    expect(selectionEvent.detail.selectedIds).toEqual([])
  })

  // Test that header click does NOT clear selection (propagation stopped or handled)
  // This essentially verifies that my implementation doesn't break header selection
  it('does NOT clear selection when clicking on a row header', async () => {
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

    let selectionEvent: any = null
    el.addEventListener('row-selection-change', (e: any) => {
      selectionEvent = e
    })

    // Click row 1 header
    const rowElements = el.shadowRoot?.querySelectorAll('gantt-row')
    const row1Header = rowElements![0].shadowRoot?.querySelector(
      '.row-header',
    ) as HTMLElement
    row1Header.click()
    await el.updateComplete

    // Expect row1 selected
    expect(selectionEvent).toBeTruthy()
    expect(selectionEvent.detail.selectedIds).toEqual(['row1'])

    // Reset event
    selectionEvent = null

    // Click row 1 header again (should toggle or keep selected depending on logic, but DEFINITELY not clear all unless deselected)
    // Actually current logic is toggle if ctrl pressed, or select-one if not.
    // Clicking again without modifier re-selects (sets to just this one).
    row1Header.click()
    await el.updateComplete

    // Check it's still ['row1']
    // Note: if it didn't change, event might not fire.
    // But we want to ensure it is NOT []
    // We can check internal state or just ensure no cleared event fired.
    // Let's check public property if available or re-query
    // Wait, `selectedRowIds` is a property but it is updated via event in parent usually.
    // But this component also updates its own `selectedRows` state potentially.
    // The component emits `row-selection-change`.

    // Let's assume the component keeps state or reflects it.
    // We can't easily check internal state private selectedRows.
    // We can assume if no event fired with [], it's good.
    if (selectionEvent) {
      expect(selectionEvent.detail.selectedIds).toEqual(['row1'])
    }
  })
})

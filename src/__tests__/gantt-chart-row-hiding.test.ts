import { describe, it, expect, vi, afterEach } from 'vitest'
import '../components/gantt-chart'
import type { GanttChartElement } from '../components/gantt-chart'
import type { GanttRow, GanttChartOption } from '@/types'

// Mock ResizeObserver
vi.stubGlobal(
  'ResizeObserver',
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
)

describe('GanttChartElement Row Hiding', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('hides rows with visible: false by default', async () => {
    const rows: GanttRow[] = [
      { id: 'row1', name: 'Row 1', tasks: [] },
      { id: 'row2', name: 'Row 2', tasks: [], visible: false },
      { id: 'row3', name: 'Row 3', tasks: [] },
    ]
    const option: GanttChartOption = {
      calendar: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
        pxPerDay: 50,
      },
      bar: { height: 20 },
    }

    const el = document.createElement('gantt-chart') as GanttChartElement
    el.rows = rows
    el.option = option
    document.body.appendChild(el)
    await el.updateComplete

    const rowElements = el.shadowRoot?.querySelectorAll('gantt-row')
    expect(rowElements?.length).toBe(2)

    // Check IDs to be sure
    // rowElements is a NodeList, we need to access the `row` property of the element
    // but pure DOM checking:
    // gantt-row has a property .row
    const row1El = rowElements![0] as any
    const row3El = rowElements![1] as any
    expect(row1El.row.id).toBe('row1')
    expect(row3El.row.id).toBe('row3')
  })

  it('shows hidden rows when showHiddenRows option is true', async () => {
    const rows: GanttRow[] = [
      { id: 'row1', name: 'Row 1', tasks: [] },
      { id: 'row2', name: 'Row 2', tasks: [], visible: false },
    ]
    const option: GanttChartOption = {
      calendar: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
        pxPerDay: 50,
      },
      showHiddenRows: true,
    }

    const el = document.createElement('gantt-chart') as GanttChartElement
    el.rows = rows
    el.option = option
    document.body.appendChild(el)
    await el.updateComplete

    const rowElements = el.shadowRoot?.querySelectorAll('gantt-row')
    expect(rowElements?.length).toBe(2)
    const row2El = rowElements![1] as any
    expect(row2El.row.id).toBe('row2')
  })

  it('updates visibility dynamically', async () => {
    const rows: GanttRow[] = [
      { id: 'row1', name: 'Row 1', tasks: [] },
      { id: 'row2', name: 'Row 2', tasks: [] }, // initially visible (default)
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

    expect(el.shadowRoot?.querySelectorAll('gantt-row').length).toBe(2)

    // Update visibility
    const newRows = [rows[0], { ...rows[1], visible: false }]
    el.rows = newRows
    await el.updateComplete

    expect(el.shadowRoot?.querySelectorAll('gantt-row').length).toBe(1)

    // Enable showHiddenRows
    el.option = { ...option, showHiddenRows: true }
    await el.updateComplete

    expect(el.shadowRoot?.querySelectorAll('gantt-row').length).toBe(2)
  })
})

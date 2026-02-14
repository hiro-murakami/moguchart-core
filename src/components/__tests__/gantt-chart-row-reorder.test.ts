import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GanttChartElement } from '../gantt-chart'
import type { GanttRow } from '@/types'

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
    addListener: vi.fn(), // Deprecated
    removeListener: vi.fn(), // Deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

describe('GanttChartElement Row Reorder', () => {
  let element: GanttChartElement
  let rows: GanttRow[]

  beforeEach(() => {
    element = new GanttChartElement()
    rows = [
      { id: 'row1', name: 'Row 1', tasks: [] },
      { id: 'row2', name: 'Row 2', tasks: [] },
      { id: 'row3', name: 'Row 3', tasks: [] },
      { id: 'row4', name: 'Row 4', tasks: [] },
    ]
    element.rows = rows
    element.option = {
      calendar: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
        pxPerDay: 50,
      },
      enableRowReordering: true,
    }
    document.body.appendChild(element)
  })

  afterEach(() => {
    document.body.removeChild(element)
  })

  it('should reorder a single row', async () => {
    // Simulate reorderRows call directly as it's private but we want to test logic
    // We can cast to any to access private method for testing
    await (element as any).reorderRows('row1', 'row3', 'bottom')

    expect(element.rows.map((r) => r.id)).toEqual(['row2', 'row3', 'row1', 'row4'])
  })

  it('should reorder multiple selected rows', async () => {
    // Select row1 and row3
    element.selectedRowIds = ['row1', 'row3']
    await element.updateComplete

    // Move them to after row2
    // reorderRows(sourceIds, targetId, position)
    await (element as any).reorderRows(['row1', 'row3'], 'row2', 'bottom')

    // Expected order: row2, row1, row3, row4
    expect(element.rows.map((r) => r.id)).toEqual(['row2', 'row1', 'row3', 'row4'])
  })

  it('should reorder multiple selected rows to top', async () => {
    // Select row3 and row4
    element.selectedRowIds = ['row3', 'row4']
    await element.updateComplete

    // Move them to before row1
    await (element as any).reorderRows(['row3', 'row4'], 'row1', 'top')

    // Expected order: row3, row4, row1, row2
    expect(element.rows.map((r) => r.id)).toEqual(['row3', 'row4', 'row1', 'row2'])
  })

  it('should maintain relative order of selected rows', async () => {
    // Select row1 and row3
    element.selectedRowIds = ['row3', 'row1'] // Selection order shouldn't matter for verification if logic preserves index order
    await element.updateComplete

    // Move invalidly? No, reorderRows expects ids to be passed.
    // In handleContainerDrop, we convert Set to Array.
    // The implementation of reorderRows filters newRows by id match, so 'row1' will be found first, then 'row3'.
    // So movingRows will be [row1, row3].

    // Move to after row4
    await (element as any).reorderRows(['row1', 'row3'], 'row4', 'bottom')

    // Expected: row2, row4, row1, row3
    expect(element.rows.map((r) => r.id)).toEqual(['row2', 'row4', 'row1', 'row3'])
  })
})

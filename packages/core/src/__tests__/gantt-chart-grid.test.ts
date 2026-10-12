import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '../components/gantt-chart'
import { GanttChartElement } from '../components/gantt-chart'
import type { GanttChartOption, GanttRow } from '../core/types'

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

describe('gantt-chart multi-column grid', () => {
  let chart: GanttChartElement

  beforeEach(() => {
    chart = new GanttChartElement()
    chart.rows = sampleRows
    chart.option = baseOption
    document.body.appendChild(chart)
  })

  afterEach(() => {
    document.body.removeChild(chart)
  })

  const baseOption: GanttChartOption = {
    calendar: {
      start: new Date(2026, 9, 1),
      end: new Date(2026, 9, 31),
      pxPerDay: 40,
    },
    rowHeader: {
      width: 400,
    },
  }

  const sampleRows: GanttRow[] = [
    {
      id: 'row-1',
      name: 'Task 1',
      tasks: [
        {
          id: 'task-1',
          name: 'Task 1',
          start: new Date(2026, 9, 1),
          end: new Date(2026, 9, 5),
          progress: 80,
        },
      ],
    },
    {
      id: 'row-2',
      name: 'Task 2',
      tasks: [
        {
          id: 'task-2',
          name: 'Task 2',
          start: new Date(2026, 9, 10),
          end: new Date(2026, 9, 20),
          progress: 40,
        },
      ],
    },
  ]

  it('renders single row header by default when grid option is not provided (backward compatibility)', async () => {
    chart.rows = sampleRows
    chart.option = baseOption
    await chart.updateComplete

    const rows = chart.shadowRoot?.querySelectorAll('gantt-row')
    expect(rows?.length).toBe(2)

    const firstRowShadow = rows?.[0].shadowRoot
    const rowHeader = firstRowShadow?.querySelector('.row-header')
    expect(rowHeader).toBeDefined()
    expect(firstRowShadow?.querySelector('.grid-row-container')).toBeNull()
  })

  it('renders multi-column grid headers in calendar when grid is enabled', async () => {
    chart.rows = sampleRows
    chart.option = {
      ...baseOption,
      grid: {
        enabled: true,
        columns: [
          { id: 'wbs', width: 50 },
          { id: 'name', width: 150 },
          { id: 'startDate', width: 90 },
          { id: 'progress', width: 70 },
        ],
      },
    }
    await chart.updateComplete

    const calendar = chart.shadowRoot?.querySelector('gantt-calendar')
    expect(calendar).toBeDefined()
    await calendar?.updateComplete

    const gridHeader = calendar?.shadowRoot?.querySelector('.grid-header-container')
    expect(gridHeader).toBeDefined()

    const headerCells = calendar?.shadowRoot?.querySelectorAll('.grid-header-cell')
    expect(headerCells?.length).toBe(4)
    expect(headerCells?.[0].textContent).toContain('WBS')
    expect(headerCells?.[1].textContent).toContain('タスク名')
  })

  it('renders multi-column grid cells in gantt-row when grid is enabled', async () => {
    chart.rows = sampleRows
    chart.option = {
      ...baseOption,
      grid: {
        enabled: true,
        columns: [
          { id: 'wbs', width: 50 },
          { id: 'name', width: 150 },
          { id: 'startDate', width: 90 },
          { id: 'progress', width: 70 },
        ],
      },
    }
    await chart.updateComplete

    const rows = chart.shadowRoot?.querySelectorAll('gantt-row')
    expect(rows?.length).toBe(2)
    const firstRowShadow = rows?.[0].shadowRoot
    await (rows?.[0] as any).updateComplete

    const gridCells = firstRowShadow?.querySelectorAll('.grid-cell')
    expect(gridCells?.length).toBe(4)

    // Name cell
    expect(firstRowShadow?.querySelector('.grid-cell-name')?.textContent).toContain('Task 1')
    // Start date cell
    expect(firstRowShadow?.querySelector('.grid-cell-startDate')?.textContent).toContain('2026/10/1')
    // Progress cell
    expect(firstRowShadow?.querySelector('.grid-cell-progress')?.textContent).toContain('80%')
  })

  it('supports custom renderCell in grid columns', async () => {
    chart.rows = sampleRows
    chart.option = {
      ...baseOption,
      grid: {
        enabled: true,
        columns: [
          { id: 'name', width: 150 },
          {
            id: 'customBadge',
            title: 'Badge',
            width: 100,
            renderCell: (_val, row) => {
              const span = document.createElement('span')
              span.className = 'custom-badge-el'
              span.textContent = `BADGE-${row.name}`
              return span
            },
          },
        ],
      },
    }
    await chart.updateComplete

    const firstRow = chart.shadowRoot?.querySelectorAll('gantt-row')?.[0]
    await (firstRow as any)?.updateComplete
    const badgeEl = firstRow?.shadowRoot?.querySelector('.custom-badge-el')
    expect(badgeEl).toBeDefined()
    expect(badgeEl?.textContent).toBe('BADGE-Task 1')
  })

  it('aggregates dates, duration, and weighted progress for rows with multiple tasks', async () => {
    const multiTaskRows: GanttRow[] = [
      {
        id: 'multi-row',
        name: 'Sprint 1',
        tasks: [
          {
            id: 't1',
            start: new Date(2026, 9, 1),
            end: new Date(2026, 9, 5),
            progress: 100,
          },
          {
            id: 't2',
            start: new Date(2026, 9, 10),
            end: new Date(2026, 9, 20),
            progress: 50,
          },
        ],
      },
    ]

    chart.rows = multiTaskRows
    chart.option = {
      ...baseOption,
      grid: {
        enabled: true,
        columns: [
          { id: 'name', width: 120 },
          { id: 'startDate', width: 90 },
          { id: 'endDate', width: 90 },
          { id: 'duration', width: 80 },
          { id: 'progress', width: 80 },
        ],
      },
    }
    await chart.updateComplete

    const rowEl = chart.shadowRoot?.querySelectorAll('gantt-row')?.[0]
    await (rowEl as any)?.updateComplete
    const rowShadow = rowEl?.shadowRoot

    expect(rowShadow?.querySelector('.grid-cell-startDate')?.textContent).toContain('2026/10/1')
    expect(rowShadow?.querySelector('.grid-cell-endDate')?.textContent).toContain('2026/10/20')
    expect(rowShadow?.querySelector('.grid-cell-duration')?.textContent).toContain('20日')
    expect(rowShadow?.querySelector('.grid-cell-progress')?.textContent).toContain('64%')
  })

  it('updates column width when column-resize is dispatched', async () => {
    chart.rows = sampleRows
    chart.option = {
      ...baseOption,
      grid: {
        enabled: true,
        columns: [
          { id: 'name', width: 150 },
          { id: 'startDate', width: 100 },
        ],
      },
    }
    await chart.updateComplete

    let receivedDetail: any = null
    chart.addEventListener('column-resize', ((e: CustomEvent) => {
      receivedDetail = e.detail
    }) as EventListener)

    const calendar = chart.shadowRoot?.querySelector('gantt-calendar')
    expect(calendar).toBeDefined()

    // Simulate column-resize event from calendar
    calendar?.dispatchEvent(
      new CustomEvent('column-resize', {
        detail: {
          columnId: 'name',
          width: 250,
          columns: [
            { id: 'name', width: 250 },
            { id: 'startDate', width: 100 },
          ],
        },
        bubbles: true,
        composed: true,
      }),
    )

    expect(receivedDetail).toBeDefined()
    expect(receivedDetail.columnId).toBe('name')
    expect(receivedDetail.width).toBe(250)

    await chart.updateComplete
    const firstRow = chart.shadowRoot?.querySelectorAll('gantt-row')?.[0]
    await (firstRow as any)?.updateComplete
    const nameCell = firstRow?.shadowRoot?.querySelector('.grid-cell-name') as HTMLElement
    expect(nameCell?.style.width).toBe('250px')
  })

  it('preserves user-resized grid header width and column width when row is clicked or option reference changes', async () => {
    chart.rows = sampleRows
    chart.option = {
      ...baseOption,
      grid: {
        enabled: true,
        columns: [
          { id: 'name', width: 150 },
          { id: 'startDate', width: 100 },
        ],
      },
    }
    await chart.updateComplete

    // 1. Simulate resizing row header (splitter resize) to 480px
    chart.currentRowHeaderWidth = 480
    // Trigger pointerup logic
    ;(chart as any)._userResizedHeaderWidth = 480
    ;(chart as any).baseRowHeaderWidth = 480
    chart.requestUpdate()
    await chart.updateComplete

    // 2. Simulate resizing column 'name' to 260px
    const calendar = chart.shadowRoot?.querySelector('gantt-calendar')
    calendar?.dispatchEvent(
      new CustomEvent('column-resize', {
        detail: {
          columnId: 'name',
          width: 260,
          previousWidth: 150,
          isFinal: true,
          columns: [
            { id: 'name', width: 260 },
            { id: 'startDate', width: 100 },
          ],
        },
        bubbles: true,
        composed: true,
      }),
    )
    await chart.updateComplete

    expect(chart.currentRowHeaderWidth).toBe(480)
    let firstRow = chart.shadowRoot?.querySelectorAll('gantt-row')?.[0]
    await (firstRow as any)?.updateComplete
    let nameCell = firstRow?.shadowRoot?.querySelector('.grid-cell-name') as HTMLElement
    expect(nameCell?.style.width).toBe('260px')

    // 3. Simulate clicking a row (fires row-selection-change, causing parent to pass a new option object reference)
    // Note: Parent passes an option object without explicit width change
    chart.option = {
      ...baseOption,
      grid: {
        enabled: true,
        columns: [
          { id: 'name', width: 150 },
          { id: 'startDate', width: 100 },
        ],
      },
    }
    await chart.updateComplete

    // Both grid width (rowHeader width) and column width must be PRESERVED!
    expect(chart.currentRowHeaderWidth).toBe(480)
    firstRow = chart.shadowRoot?.querySelectorAll('gantt-row')?.[0]
    await (firstRow as any)?.updateComplete
    nameCell = firstRow?.shadowRoot?.querySelector('.grid-cell-name') as HTMLElement
    expect(nameCell?.style.width).toBe('260px')
  })
})


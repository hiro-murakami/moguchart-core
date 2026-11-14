import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '../components/gantt-chart'
import { GanttChartElement } from '../components/gantt-chart'
import {
  isGridColumnPinned,
  normalizeGridColumns,
  partitionGridColumns,
  reorderGridColumns,
} from '../core/grid'
import type { GanttChartOption, GanttColumn, GanttRow } from '../core/types'

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

describe('gantt-chart left column pinning (column.pinned)', () => {
  let chart: GanttChartElement

  const sampleRows: GanttRow[] = [
    {
      id: 'row-1',
      name: '設計フェーズ',
      tasks: [
        {
          id: 'task-1',
          name: '基本設計',
          start: new Date(2026, 9, 1),
          end: new Date(2026, 9, 6),
          progress: 60,
        },
      ],
    },
    {
      id: 'row-2',
      name: '開発フェーズ',
      tasks: [
        {
          id: 'task-2',
          name: 'API実装',
          start: new Date(2026, 9, 7),
          end: new Date(2026, 9, 15),
          progress: 20,
        },
      ],
    },
  ]

  beforeEach(() => {
    chart = new GanttChartElement()
    chart.rows = sampleRows
    chart.option = {
      calendar: {
        start: new Date(2026, 9, 1),
        end: new Date(2026, 9, 31),
        pxPerDay: 40,
      },
    }
    document.body.appendChild(chart)
  })

  afterEach(() => {
    document.body.removeChild(chart)
  })

  it('partitions pinned and scrollable columns and consolidates pinned columns to the left', () => {
    const raw: GanttColumn[] = [
      { id: 'startDate', width: 100 },
      { id: 'wbs', width: 60, pinned: true },
      { id: 'endDate', width: 100 },
      { id: 'name', width: 180, pinned: 'left' },
    ]
    const normalized = normalizeGridColumns(raw)
    expect(normalized.map((c) => c.id)).toEqual(['wbs', 'name', 'startDate', 'endDate'])

    const partitioned = partitionGridColumns(normalized)
    expect(partitioned.pinnedColumns.map((c) => c.id)).toEqual(['wbs', 'name'])
    expect(partitioned.scrollableColumns.map((c) => c.id)).toEqual(['startDate', 'endDate'])
    expect(partitioned.pinnedWidth).toBe(240)
    expect(partitioned.scrollableWidth).toBe(200)
    expect(isGridColumnPinned(normalized[0])).toBe(true)
    expect(isGridColumnPinned(normalized[2])).toBe(false)
  })

  it('blocks column reordering across pinned and unpinned groups while allowing intra-group reorder', () => {
    const cols = normalizeGridColumns([
      { id: 'wbs', width: 60, pinned: true },
      { id: 'name', width: 180, pinned: 'left' },
      { id: 'startDate', width: 100 },
      { id: 'endDate', width: 100 },
    ])

    // Pinned <-> Unpinned should be rejected
    const crossAttempt = reorderGridColumns(cols, 'wbs', 'startDate', 'right')
    expect(crossAttempt.map((c) => c.id)).toEqual(['wbs', 'name', 'startDate', 'endDate'])

    // Pinned <-> Pinned should succeed
    const pinnedSwap = reorderGridColumns(cols, 'wbs', 'name', 'right')
    expect(pinnedSwap.map((c) => c.id)).toEqual(['name', 'wbs', 'startDate', 'endDate'])

    // Unpinned <-> Unpinned should succeed
    const unpinnedSwap = reorderGridColumns(cols, 'endDate', 'startDate', 'left')
    expect(unpinnedSwap.map((c) => c.id)).toEqual(['wbs', 'name', 'endDate', 'startDate'])
  })

  it('renders 2-pane pinned + scrollable layout in calendar header, rows, and footer and applies scroll shadow', async () => {
    const option: GanttChartOption = {
      calendar: {
        start: new Date(2026, 9, 1),
        end: new Date(2026, 9, 31),
        pxPerDay: 40,
      },
      grid: {
        enabled: true,
        width: 320,
        showFooter: true,
        columns: [
          { id: 'wbs', width: 60, pinned: true },
          { id: 'name', width: 140, pinned: 'left' },
          { id: 'startDate', width: 110 },
          { id: 'endDate', width: 110 },
          { id: 'duration', width: 80 },
        ],
      },
    }

    chart.rows = sampleRows
    chart.option = option
    await chart.updateComplete

    const calendarEl = chart.shadowRoot?.querySelector('gantt-calendar')
    await (calendarEl as any)?.updateComplete
    const rowEl = chart.shadowRoot?.querySelector('gantt-row')
    await (rowEl as any)?.updateComplete

    // Calendar header 2-pane check
    const calPinned = calendarEl?.shadowRoot?.querySelector('.grid-pinned-left') as HTMLElement | null
    const calTrack = calendarEl?.shadowRoot?.querySelector('.grid-scrollable-track') as HTMLElement | null
    expect(calPinned).not.toBeNull()
    expect(calTrack).not.toBeNull()
    expect(calPinned?.querySelectorAll('.grid-header-cell').length).toBe(2)
    expect(calTrack?.querySelectorAll('.grid-header-cell').length).toBe(3)
    expect(calPinned?.classList.contains('has-scroll-shadow')).toBe(false)

    // Row 2-pane check
    const rowPinned = rowEl?.shadowRoot?.querySelector('.grid-pinned-left') as HTMLElement | null
    const rowTrack = rowEl?.shadowRoot?.querySelector('.grid-scrollable-track') as HTMLElement | null
    expect(rowPinned?.querySelectorAll('.grid-cell').length).toBe(2)
    expect(rowTrack?.querySelectorAll('.grid-cell').length).toBe(3)

    // Footer 2-pane check
    const footerPinned = chart.shadowRoot?.querySelector(
      '.grid-footer-cells-container .grid-pinned-left',
    ) as HTMLElement | null
    const footerTrack = chart.shadowRoot?.querySelector(
      '.grid-footer-cells-container .grid-scrollable-track',
    ) as HTMLElement | null
    expect(footerPinned?.querySelectorAll('.grid-footer-cell').length).toBe(2)
    expect(footerTrack?.querySelectorAll('.grid-footer-cell').length).toBe(3)

    // Scroll right via grid wheel (pinnedWidth=200, width=320 -> scrollableViewport=120, scrollableWidth=300 -> maxScroll=180)
    const headerCell = calTrack?.querySelector('.grid-header-cell') as HTMLElement
    const wheelEvent = new WheelEvent('wheel', {
      deltaX: 90,
      bubbles: true,
      composed: true,
      cancelable: true,
    })
    headerCell.dispatchEvent(wheelEvent)
    await chart.updateComplete
    await (calendarEl as any)?.updateComplete
    await (rowEl as any)?.updateComplete

    expect(chart.currentGridScrollLeft).toBe(90)
    expect(calPinned?.classList.contains('has-scroll-shadow')).toBe(true)
    expect(rowPinned?.classList.contains('has-scroll-shadow')).toBe(true)
    expect(footerPinned?.classList.contains('has-scroll-shadow')).toBe(true)
    expect(calTrack?.style.transform).toContain('translateX(-90px)')
    expect(rowTrack?.style.transform).toContain('translateX(-90px)')
    expect(footerTrack?.style.transform).toContain('translateX(-90px)')

    // Clamps at maxScroll = 300 - (320 - 200) = 180
    headerCell.dispatchEvent(
      new WheelEvent('wheel', { deltaX: 500, bubbles: true, composed: true, cancelable: true }),
    )
    await chart.updateComplete
    expect(chart.currentGridScrollLeft).toBe(180)
  })
})

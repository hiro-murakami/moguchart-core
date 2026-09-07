import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GanttBarElement } from '../components/gantt-bar'
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

describe('GanttBar Connector', () => {
  let bar: GanttBarElement
  const defaultOption: GanttChartOption = {
    calendar: {
      start: new Date('2024-01-01T00:00:00'),
      end: new Date('2024-01-31T00:00:00'),
      pxPerDay: 50,
    },
    bar: {
      height: 30,
      margin: 5,
      cornerRadius: 4,
    },
    dependency: {
      showConnectors: true,
    },
    readOnly: false,
  }

  beforeEach(async () => {
    bar = new GanttBarElement()
    bar.option = defaultOption
    bar.task = {
      id: 'task-1',
      name: 'Regular Task',
      start: new Date('2024-01-02T00:00:00'),
      end: new Date('2024-01-06T00:00:00'),
    }
    document.body.appendChild(bar)
    await bar.updateComplete
  })

  afterEach(() => {
    bar.remove()
  })

  it('renders connectors for regular tasks by default', () => {
    const connLeft = bar.shadowRoot?.querySelector('.connector-left')
    const connRight = bar.shadowRoot?.querySelector('.connector-right')
    expect(connLeft).not.toBeNull()
    expect(connRight).not.toBeNull()
  })

  it('does NOT render connectors for summary tasks', async () => {
    bar.task = {
      id: 'sum-1',
      name: 'Summary Task',
      type: 'summary',
      start: new Date('2024-01-02T00:00:00'),
      end: new Date('2024-01-10T00:00:00'),
    }
    await bar.updateComplete

    const connLeft = bar.shadowRoot?.querySelector('.connector-left')
    const connRight = bar.shadowRoot?.querySelector('.connector-right')
    expect(connLeft).toBeNull()
    expect(connRight).toBeNull()
  })

  it('does not render connectors when dependency.showConnectors is false', async () => {
    bar.option = {
      ...defaultOption,
      dependency: {
        showConnectors: false,
      },
    }
    await bar.updateComplete

    const connLeft = bar.shadowRoot?.querySelector('.connector-left')
    const connRight = bar.shadowRoot?.querySelector('.connector-right')
    expect(connLeft).toBeNull()
    expect(connRight).toBeNull()
  })

  it('does not render connectors when readOnly is true', async () => {
    bar.option = {
      ...defaultOption,
      readOnly: true,
    }
    await bar.updateComplete

    const connLeft = bar.shadowRoot?.querySelector('.connector-left')
    const connRight = bar.shadowRoot?.querySelector('.connector-right')
    expect(connLeft).toBeNull()
    expect(connRight).toBeNull()
  })
})

describe('GanttChart Connector Drag with Summary Tasks', () => {
  let chart: GanttChartElement
  let rows: GanttRow[]

  beforeEach(async () => {
    chart = new GanttChartElement()
    rows = [
      {
        id: 'row1',
        name: 'Row 1',
        tasks: [
          {
            id: 'task1',
            name: 'Regular Task 1',
            start: new Date('2024-01-05T00:00:00'),
            end: new Date('2024-01-10T00:00:00'),
          },
        ],
      },
      {
        id: 'row2',
        name: 'Row 2 (Summary)',
        tasks: [
          {
            id: 'sum1',
            name: 'Summary Task 1',
            type: 'summary',
            start: new Date('2024-01-05T00:00:00'),
            end: new Date('2024-01-15T00:00:00'),
          },
        ],
      },
    ]
    chart.rows = rows
    chart.option = {
      calendar: {
        start: new Date('2024-01-01T00:00:00'),
        end: new Date('2024-01-31T00:00:00'),
        pxPerDay: 50,
      },
      dependency: {
        showConnectors: true,
      },
    }
    document.body.appendChild(chart)
    await chart.updateComplete
  })

  afterEach(() => {
    chart.remove()
  })

  it('ignores connector drag start on summary tasks', () => {
    const container = chart.shadowRoot?.querySelector('.scroll-container')
    container?.dispatchEvent(
      new CustomEvent('connector-drag-start', {
        detail: {
          taskId: 'sum1',
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

  it('starts connector drag on regular tasks', () => {
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

    expect((chart as any).connectorDrag).not.toBeNull()
    expect((chart as any).connectorDrag.sourceTaskId).toBe('task1')
  })

  it('does not fire dependency-create when target is a summary task', () => {
    const container = chart.shadowRoot?.querySelector('.scroll-container')
    let dependencyCreated = false
    chart.addEventListener('dependency-create', () => {
      dependencyCreated = true
    })

    // 通常タスクから開始
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

    // connectorDrag の targetTaskId をサマリータスク sum1 に設定して drag-end
    ;(chart as any).connectorDrag.targetTaskId = 'sum1'
    ;(chart as any).connectorDrag.targetEndpoint = 'start'

    container?.dispatchEvent(
      new CustomEvent('connector-drag-end', {
        detail: {
          cancelled: false,
        },
        bubbles: true,
        composed: true,
      }),
    )

    expect(dependencyCreated).toBe(false)
  })
})

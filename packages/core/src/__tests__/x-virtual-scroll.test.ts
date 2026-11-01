import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { html } from 'lit'
import { GanttChartElement } from '../components/gantt-chart'
import '../components/gantt-chart'
import type { CalendarRangeChangeEventDetail } from '../core/types'

const matchMediaMock = vi.fn()
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: matchMediaMock,
})

globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('X-Axis Virtualization, Quarter Header & Auto-Extend', () => {
  let chart: GanttChartElement

  beforeEach(() => {
    matchMediaMock.mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
  })

  afterEach(() => {
    if (chart && chart.parentNode) {
      chart.parentNode.removeChild(chart)
    }
    vi.clearAllMocks()
  })

  it('virtualizes 3-year timeline cells in gantt-calendar and gantt-row-background, and updates window on horizontal scroll', async () => {
    chart = new GanttChartElement()
    chart.option = {
      calendar: {
        start: new Date('2026-01-01T00:00:00'),
        end: new Date('2028-12-31T23:59:59'), // 3年間（約1096日）
        pxPerDay: 50,
        showRowBackground: true,
      },
    }
    chart.rows = [
      {
        id: 'r1',
        name: 'Row 1',
        tasks: [
          {
            id: 't-near',
            name: 'Near Task',
            start: new Date('2026-01-03T00:00:00'),
            end: new Date('2026-01-08T00:00:00'),
          },
          {
            id: 't-far',
            name: 'Far Task 2028',
            start: new Date('2028-06-01T00:00:00'),
            end: new Date('2028-06-10T00:00:00'),
          },
        ],
      },
    ]
    document.body.appendChild(chart)
    await chart.updateComplete

    const calendarEl = chart.shadowRoot?.querySelector('gantt-calendar') as any
    await calendarEl.updateComplete
    const rowEl = chart.shadowRoot?.querySelector('gantt-row') as any
    await rowEl.updateComplete
    const rowBgEl = rowEl.shadowRoot?.querySelector('gantt-row-background') as any
    await rowBgEl.updateComplete

    // 1096日すべてではなく、可視ウィンドウ周辺のセルのみがDOM生成されること
    const dayCells = calendarEl.shadowRoot?.querySelectorAll('.day-cell') ?? []
    expect(dayCells.length).toBeGreaterThan(10)
    expect(dayCells.length).toBeLessThan(80)

    // 背景セルは可視範囲内かつ週末（着色対象）のみスパース描画されること
    const bgCells = rowBgEl.shadowRoot?.querySelectorAll('.bg-cell') ?? []
    expect(bgCells.length).toBeGreaterThan(2)
    expect(bgCells.length).toBeLessThan(30)

    // 画面外の2028年タスクはカリングされ、2026年1月タスクのみマウントされること
    const initialBars = Array.from(rowEl.shadowRoot?.querySelectorAll('gantt-bar') ?? []) as any[]
    expect(initialBars.map((b) => b.task.id)).toEqual(['t-near'])

    // 選択中のタスクは画面外でもカリングされずにマウントされること
    chart.selectedTaskIds = ['t-far']
    await chart.updateComplete
    await rowEl.updateComplete
    const barsWithSelected = Array.from(rowEl.shadowRoot?.querySelectorAll('gantt-bar') ?? []) as any[]
    expect(barsWithSelected.map((b) => b.task.id)).toContain('t-far')

    // 2028年6月付近（約 880日 * 50px = 44000px）へ横スクロールした際に可視セルが追従すること
    chart.selectedTaskIds = []
    await chart.updateComplete
    chart.scrollToPosition({ left: 44000 })
    await chart.updateComplete
    await calendarEl.updateComplete
    await rowEl.updateComplete

    const scrolledBars = Array.from(rowEl.shadowRoot?.querySelectorAll('gantt-bar') ?? []) as any[]
    expect(scrolledBars.map((b) => b.task.id)).toEqual(['t-far'])
  })

  it('renders full timeline range without culling when isExporting is true or virtualScrollX is false', async () => {
    chart = new GanttChartElement()
    chart.option = {
      calendar: {
        start: new Date('2026-01-01T00:00:00'),
        end: new Date('2026-06-30T23:59:59'), // 181日
        pxPerDay: 40,
      },
    }
    chart.rows = [
      {
        id: 'r1',
        name: 'Row 1',
        tasks: [
          {
            id: 't1',
            name: 'January',
            start: new Date('2026-01-05'),
            end: new Date('2026-01-10'),
          },
          {
            id: 't2',
            name: 'June',
            start: new Date('2026-06-20'),
            end: new Date('2026-06-25'),
          },
        ],
      },
    ]
    document.body.appendChild(chart)
    await chart.updateComplete

    const calendarEl = chart.shadowRoot?.querySelector('gantt-calendar') as any
    const rowEl = chart.shadowRoot?.querySelector('gantt-row') as any
    await calendarEl.updateComplete
    await rowEl.updateComplete

    // 通常表示では6月タスクは画面外カリングされる
    expect(rowEl.shadowRoot?.querySelectorAll('gantt-bar').length).toBe(1)

    // エクスポートモード時は全期間がレンダリングされること
    ;(chart as any).isExporting = true
    await chart.updateComplete
    await calendarEl.updateComplete
    await rowEl.updateComplete

    expect(calendarEl.shadowRoot?.querySelectorAll('.day-cell').length).toBe(181)
    expect(rowEl.shadowRoot?.querySelectorAll('gantt-bar').length).toBe(2)
  })

  it('renders Quarter Header supporting fiscal year start month (e.g. April = Q1) and custom rendering', async () => {
    chart = new GanttChartElement()
    chart.option = {
      calendar: {
        start: new Date('2026-01-01T00:00:00'),
        end: new Date('2026-12-31T23:59:59'),
        pxPerDay: 4,
        pxPerMonth: 120,
        showMonthsRow: true,
        showQuarters: true,
        quarterStartMonth: 4, // 日本の4月始まり会計年度: 2026年1〜3月は FY2025 Q4、4〜6月は FY2026 Q1
        virtualScrollX: false,
      },
      customRendering: {
        calendarQuarterContent: (ctx) => html`<span class="fy-q">FY${ctx.fiscalYear}-Q${ctx.quarter}</span>`,
      },
    }
    chart.rows = [{ id: 'r1', name: 'Row 1', tasks: [] }]
    document.body.appendChild(chart)
    await chart.updateComplete

    const calendarEl = chart.shadowRoot?.querySelector('gantt-calendar') as any
    await calendarEl.updateComplete

    const quarterLabels = Array.from(
      calendarEl.shadowRoot?.querySelectorAll('.quarter-cell .fy-q') ?? [],
    ).map((el: any) => el.textContent?.trim())

    expect(quarterLabels).toEqual([
      'FY2025-Q4', // 2026年1〜3月
      'FY2026-Q1', // 2026年4〜6月
      'FY2026-Q2', // 2026年7〜9月
      'FY2026-Q3', // 2026年10〜12月
    ])
  })

  it('automatically extends calendar range and emits calendar-range-change when task reaches edges with autoExtend enabled', async () => {
    chart = new GanttChartElement()
    chart.option = {
      calendar: {
        start: new Date('2026-04-01T00:00:00'),
        end: new Date('2026-04-15T00:00:00'),
        pxPerDay: 50,
        autoExtend: {
          enabled: true,
          extendDays: 10,
          edgeThresholdPx: 50,
        },
      },
    }
    chart.rows = [
      {
        id: 'r1',
        name: 'Row 1',
        tasks: [
          {
            id: 't1',
            name: 'Extendable Task',
            start: new Date('2026-04-05T00:00:00'),
            end: new Date('2026-04-10T00:00:00'),
          },
        ],
      },
    ]
    document.body.appendChild(chart)
    await chart.updateComplete

    const rangeEvents: CalendarRangeChangeEventDetail[] = []
    chart.addEventListener('calendar-range-change', ((e: CustomEvent<CalendarRangeChangeEventDetail>) => {
      rangeEvents.push(e.detail)
    }) as EventListener)

    // 1. 右端（未来方向）を越える位置へタスクをドロップ（+8日 = +400px -> end が 4/18 になり 4/15 を超過）
    chart.handleTaskUpdate(
      new CustomEvent('task-update', {
        detail: {
          id: 't1',
          name: 'Extendable Task',
          start: new Date('2026-04-05T00:00:00'),
          end: new Date('2026-04-10T00:00:00'),
          dx: 400,
          dy: 0,
          isDragging: false,
          mode: 'move',
        },
      }),
    )

    expect(rangeEvents.length).toBe(1)
    expect(rangeEvents[0].direction).toBe('end')
    expect(chart.option.calendar.end.getTime()).toBeGreaterThan(new Date('2026-04-25T00:00:00').getTime())

    await new Promise((resolve) => requestAnimationFrame(resolve))
    await chart.updateComplete

    // 2. 左端（過去方向）を越える位置へドロップ（maybeAutoExtendCalendar直接検証）
    chart.maybeAutoExtendCalendar(
      new Date('2026-03-28T00:00:00'),
      new Date('2026-04-02T00:00:00'),
      false,
    )

    expect(rangeEvents.length).toBe(2)
    expect(rangeEvents[1].direction).toBe('start')
    expect(chart.option.calendar.start.getTime()).toBeLessThanOrEqual(new Date('2026-03-18T00:00:00').getTime())
  })
})

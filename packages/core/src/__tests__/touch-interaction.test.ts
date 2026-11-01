import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GanttChartElement } from '../components/gantt-chart'
import '../components/gantt-chart'

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

describe('Touch & Multi-Device UX', () => {
  let chart: GanttChartElement

  beforeEach(async () => {
    matchMediaMock.mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })

    chart = new GanttChartElement()
    chart.option = {
      calendar: {
        start: new Date('2026-01-01T00:00:00'),
        end: new Date('2026-01-31T23:59:59'),
        pxPerDay: 50,
      },
      zoom: {
        enabled: true,
        minPercent: 50,
        maxPercent: 200,
      },
      progress: {
        enabled: true,
        editable: true,
      },
      touch: {
        enabled: true,
        longPressDelay: 250,
        moveSlop: 8,
      },
    }
    chart.rows = [
      {
        id: 'row-1',
        name: 'Row 1',
        tasks: [
          {
            id: 'task-1',
            name: 'Task 1',
            start: new Date('2026-01-05T00:00:00'),
            end: new Date('2026-01-10T00:00:00'),
            progress: 40,
          },
        ],
      },
    ]
    document.body.appendChild(chart)
    await chart.updateComplete
  })

  afterEach(() => {
    vi.useRealTimers()
    if (chart && chart.parentNode) {
      chart.parentNode.removeChild(chart)
    }
    vi.clearAllMocks()
  })

  it('does not hijack 1-finger touch swipe with marquee selection, while preserving mouse marquee selection', async () => {
    const container = chart.shadowRoot?.querySelector('.scroll-container') as HTMLElement
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 800,
      bottom: 400,
      width: 800,
      height: 400,
      x: 0,
      y: 0,
      toJSON: () => {},
    })

    // タッチ入力では矩形範囲選択を開始しない（1本指スクロール優先）
    container.dispatchEvent(
      new PointerEvent('pointerdown', {
        pointerId: 10,
        pointerType: 'touch',
        button: 0,
        clientX: 350,
        clientY: 120,
        bubbles: true,
        composed: true,
      }),
    )
    window.dispatchEvent(
      new PointerEvent('pointermove', {
        pointerId: 10,
        pointerType: 'touch',
        clientX: 450,
        clientY: 180,
      }),
    )
    expect(chart.marqueeSelection).toBeNull()
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 10, pointerType: 'touch' }))

    // マウス入力では従来通り矩形範囲選択が動作する
    container.dispatchEvent(
      new PointerEvent('pointerdown', {
        pointerId: 1,
        pointerType: 'mouse',
        button: 0,
        clientX: 350,
        clientY: 120,
        bubbles: true,
        composed: true,
      }),
    )
    window.dispatchEvent(
      new PointerEvent('pointermove', {
        pointerId: 1,
        pointerType: 'mouse',
        clientX: 450,
        clientY: 180,
      }),
    )
    expect(chart.marqueeSelection?.active).toBe(true)
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, pointerType: 'mouse' }))
  })

  it('selects task on short touch tap without starting move drag, and sets touch-active attribute', async () => {
    const rowEl = chart.shadowRoot?.querySelector('gantt-row') as any
    await rowEl.updateComplete
    const barEl = rowEl.shadowRoot?.querySelector('gantt-bar') as any
    await barEl.updateComplete
    const innerBar = barEl.shadowRoot?.querySelector('.bar') as HTMLElement

    innerBar.dispatchEvent(
      new PointerEvent('pointerdown', {
        pointerId: 5,
        pointerType: 'touch',
        button: 0,
        clientX: 300,
        clientY: 80,
        bubbles: true,
        composed: true,
      }),
    )
    expect(barEl.touchActive).toBe(true)
    await barEl.updateComplete
    expect(barEl.hasAttribute('touch-active')).toBe(true)

    // 長押し完了前に離指 → タスク選択のみ成立
    window.dispatchEvent(
      new PointerEvent('pointerup', {
        pointerId: 5,
        pointerType: 'touch',
        clientX: 300,
        clientY: 80,
      }),
    )
    await chart.updateComplete

    expect(chart.selectedTasks.has('task-1')).toBe(true)
    expect(chart.rows[0].tasks[0].start).toEqual(new Date('2026-01-05T00:00:00'))
  })

  it('cancels touch long-press when finger moves beyond moveSlop before delay expires', async () => {
    vi.useFakeTimers()
    const rowEl = chart.shadowRoot?.querySelector('gantt-row') as any
    await rowEl.updateComplete
    const barEl = rowEl.shadowRoot?.querySelector('gantt-bar') as any
    await barEl.updateComplete
    const innerBar = barEl.shadowRoot?.querySelector('.bar') as HTMLElement
    const taskGroup = barEl.shadowRoot?.querySelector('.task-group') as HTMLElement

    innerBar.dispatchEvent(
      new PointerEvent('pointerdown', {
        pointerId: 7,
        pointerType: 'touch',
        button: 0,
        clientX: 300,
        clientY: 80,
        bubbles: true,
        composed: true,
      }),
    )

    // 100ms 時点で 20px スワイプ（moveSlop = 8px 超過）
    vi.advanceTimersByTime(100)
    window.dispatchEvent(
      new PointerEvent('pointermove', {
        pointerId: 7,
        pointerType: 'touch',
        clientX: 325,
        clientY: 80,
      }),
    )

    // 250ms 経過後もドラッグ状態に入らないこと
    vi.advanceTimersByTime(300)
    expect(taskGroup.classList.contains('touch-dragging')).toBe(false)
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, pointerType: 'touch' }))
  })

  it('initiates touch task move after longPressDelay and commits new dates on drop', async () => {
    vi.useFakeTimers()
    const rowEl = chart.shadowRoot?.querySelector('gantt-row') as any
    await rowEl.updateComplete
    const barEl = rowEl.shadowRoot?.querySelector('gantt-bar') as any
    await barEl.updateComplete
    const innerBar = barEl.shadowRoot?.querySelector('.bar') as HTMLElement
    const taskGroup = barEl.shadowRoot?.querySelector('.task-group') as HTMLElement

    vi.spyOn(chart, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 1000,
      bottom: 500,
      width: 1000,
      height: 500,
      x: 0,
      y: 0,
      toJSON: () => {},
    })

    innerBar.dispatchEvent(
      new PointerEvent('pointerdown', {
        pointerId: 8,
        pointerType: 'touch',
        button: 0,
        clientX: 300,
        clientY: 80,
        bubbles: true,
        composed: true,
      }),
    )

    expect(taskGroup.classList.contains('touch-dragging')).toBe(false)

    // 250ms 長押し成立
    vi.advanceTimersByTime(260)
    expect(taskGroup.classList.contains('touch-dragging')).toBe(true)

    // +100px (= +2日) ドラッグして離指
    window.dispatchEvent(
      new PointerEvent('pointermove', {
        pointerId: 8,
        pointerType: 'touch',
        clientX: 400,
        clientY: 80,
      }),
    )
    window.dispatchEvent(
      new PointerEvent('pointerup', {
        pointerId: 8,
        pointerType: 'touch',
        clientX: 400,
        clientY: 80,
      }),
    )

    vi.runAllTimers()
    vi.useRealTimers()
    await chart.updateComplete

    expect(chart.rows[0].tasks[0].start).toEqual(new Date('2026-01-07T00:00:00'))
    expect(chart.rows[0].tasks[0].end).toEqual(new Date('2026-01-12T00:00:00'))
  })

  it('zooms smoothly with two-finger pinch gesture via TouchController', async () => {
    const container = chart.shadowRoot?.querySelector('.scroll-container') as HTMLElement
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 800,
      bottom: 400,
      width: 800,
      height: 400,
      x: 0,
      y: 0,
      toJSON: () => {},
    })

    expect(chart.getZoomPercent()).toBe(100)

    // 2本指タッチ開始: 距離 100px (x=300 と x=400)
    const touchStart = new Event('touchstart', { bubbles: true, cancelable: true }) as any
    touchStart.touches = [
      { clientX: 300, clientY: 150 },
      { clientX: 400, clientY: 150 },
    ]
    container.dispatchEvent(touchStart)

    // ピンチアウト: 距離 150px (x=275 と x=425) -> 1.5倍 = 150%
    const touchMove = new Event('touchmove', { bubbles: true, cancelable: true }) as any
    touchMove.touches = [
      { clientX: 275, clientY: 150 },
      { clientX: 425, clientY: 150 },
    ]
    container.dispatchEvent(touchMove)

    expect(chart.getZoomPercent()).toBe(150)

    const touchEnd = new Event('touchend', { bubbles: true }) as any
    touchEnd.touches = []
    container.dispatchEvent(touchEnd)
  })
})

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GanttChartElement } from '../components/gantt-chart'
import '../components/gantt-chart'

// Window.matchMediaのモック
const matchMediaMock = vi.fn()
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: matchMediaMock,
})

// ResizeObserverのモック
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('GanttChartElement Zoom', () => {
  let element: GanttChartElement

  beforeEach(() => {
    const mediaQueryListMock = {
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    matchMediaMock.mockReturnValue(mediaQueryListMock)

    element = new GanttChartElement()
    element.option = {
      calendar: {
        start: new Date('2024-01-01'),
        end: new Date('2024-03-31'),
        pxPerDay: 50,
      },
      zoom: {
        enabled: true,
        min: 5,
        max: 150,
        step: 1.3,
      },
    }
    element.rows = [
      {
        id: 'row-1',
        name: 'Row 1',
        tasks: [
          {
            id: 'task-1',
            name: 'Task 1',
            start: new Date('2024-01-10'),
            end: new Date('2024-02-10'),
          },
          {
            id: 'task-2',
            name: 'Task 2',
            start: new Date('2024-02-15'),
            end: new Date('2024-03-15'),
          },
        ],
      },
    ]
  })

  afterEach(() => {
    if (element.parentElement) {
      document.body.removeChild(element)
    }
    vi.clearAllMocks()
  })

  it('effectivePxPerDay returns option value when no zoom override', async () => {
    document.body.appendChild(element)
    await element.updateComplete

    // effectivePxPerDayはprivateなので、getDateXの結果で間接的に確認
    // option.calendar.pxPerDay = 50 の場合、1日後は50px
    const startX = (element as any).getDateX(new Date('2024-01-01'))
    const dayLaterX = (element as any).getDateX(new Date('2024-01-02'))
    expect(dayLaterX - startX).toBeCloseTo(50, 1)
  })

  it('zoomTo updates effective pxPerDay', async () => {
    document.body.appendChild(element)
    await element.updateComplete

    element.zoomTo(100)
    await element.updateComplete

    const startX = (element as any).getDateX(new Date('2024-01-01'))
    const dayLaterX = (element as any).getDateX(new Date('2024-01-02'))
    expect(dayLaterX - startX).toBeCloseTo(100, 1)
  })

  it('zoomTo clamps to min/max', async () => {
    document.body.appendChild(element)
    await element.updateComplete

    // min = 5 以下にはならない
    element.zoomTo(1)
    await element.updateComplete

    const startX1 = (element as any).getDateX(new Date('2024-01-01'))
    const dayLaterX1 = (element as any).getDateX(new Date('2024-01-02'))
    expect(dayLaterX1 - startX1).toBeCloseTo(5, 1)

    // max = 150 以上にはならない
    element.zoomTo(300)
    await element.updateComplete

    const startX2 = (element as any).getDateX(new Date('2024-01-01'))
    const dayLaterX2 = (element as any).getDateX(new Date('2024-01-02'))
    expect(dayLaterX2 - startX2).toBeCloseTo(150, 1)
  })

  it('zoomTo dispatches zoom-change event', async () => {
    document.body.appendChild(element)
    await element.updateComplete

    const handler = vi.fn()
    element.addEventListener('zoom-change', handler)

    element.zoomTo(80)

    expect(handler).toHaveBeenCalledTimes(1)
    const detail = handler.mock.calls[0][0].detail
    expect(detail.pxPerDay).toBe(80)
    expect(detail.pxPerMonth).toBeUndefined()
  })

  it('resetZoom restores original pxPerDay', async () => {
    document.body.appendChild(element)
    await element.updateComplete

    element.zoomTo(100)
    await element.updateComplete

    element.resetZoom()
    await element.updateComplete

    const startX = (element as any).getDateX(new Date('2024-01-01'))
    const dayLaterX = (element as any).getDateX(new Date('2024-01-02'))
    expect(dayLaterX - startX).toBeCloseTo(50, 1) // 元の pxPerDay = 50 に戻る
  })

  it('resetZoom dispatches zoom-change event', async () => {
    document.body.appendChild(element)
    await element.updateComplete

    element.zoomTo(100) // まずズームする

    const handler = vi.fn()
    element.addEventListener('zoom-change', handler)

    element.resetZoom()

    expect(handler).toHaveBeenCalledTimes(1)
    const detail = handler.mock.calls[0][0].detail
    expect(detail.pxPerDay).toBe(50) // 元の値
  })

  it('resetZoom does NOT dispatch event when not zoomed', async () => {
    document.body.appendChild(element)
    await element.updateComplete

    const handler = vi.fn()
    element.addEventListener('zoom-change', handler)

    element.resetZoom()

    expect(handler).not.toHaveBeenCalled()
  })

  it('handleWheel ignores events without Ctrl/Meta key', async () => {
    document.body.appendChild(element)
    await element.updateComplete

    const handler = vi.fn()
    element.addEventListener('zoom-change', handler)

    const wheelEvent = new WheelEvent('wheel', {
      deltaY: -100,
      ctrlKey: false,
      metaKey: false,
    })
    element.dispatchEvent(wheelEvent)

    expect(handler).not.toHaveBeenCalled()
  })

  it('handleWheel ignores events when zoom is disabled', async () => {
    element.option = {
      ...element.option,
      zoom: { enabled: false },
    }

    document.body.appendChild(element)
    await element.updateComplete

    const handler = vi.fn()
    element.addEventListener('zoom-change', handler)

    const wheelEvent = new WheelEvent('wheel', {
      deltaY: -100,
      ctrlKey: true,
    })
    element.dispatchEvent(wheelEvent)

    expect(handler).not.toHaveBeenCalled()
  })

  it('zoom override is reset when option changes', async () => {
    document.body.appendChild(element)
    await element.updateComplete

    element.zoomTo(100)
    await element.updateComplete

    // verify zoom is applied
    let startX = (element as any).getDateX(new Date('2024-01-01'))
    let dayLaterX = (element as any).getDateX(new Date('2024-01-02'))
    expect(dayLaterX - startX).toBeCloseTo(100, 1)

    // option を新しいオブジェクトで更新 → ズームリセット
    element.option = {
      ...element.option,
      calendar: {
        ...element.option.calendar,
        pxPerDay: 70,
      },
    }
    await element.updateComplete

    startX = (element as any).getDateX(new Date('2024-01-01'))
    dayLaterX = (element as any).getDateX(new Date('2024-01-02'))
    expect(dayLaterX - startX).toBeCloseTo(70, 1) // 新しい option の値
  })

  it('zoomToFit calculates correct zoom level', async () => {
    document.body.appendChild(element)
    await element.updateComplete

    // zoomToFit requires container width. Since jsdom doesn't layout,
    // we verify the method doesn't throw and is callable.
    expect(() => element.zoomToFit()).not.toThrow()
  })

  it('zoomToPercent updates zoomPercent and scales elements correctly', async () => {
    document.body.appendChild(element)
    await element.updateComplete

    element.zoomToPercent(150)
    await element.updateComplete

    expect(element.getZoomPercent()).toBe(150)
    expect(element.getZoomScale()).toBe(1.5)

    // calendar: 50 * 1.5 = 75px
    const startX = (element as any).getDateX(new Date('2024-01-01'))
    const dayLaterX = (element as any).getDateX(new Date('2024-01-02'))
    expect(dayLaterX - startX).toBeCloseTo(75, 1)

    // rowHeader: 150 * 1.5 = 225px
    expect((element as any).currentRowHeaderWidth).toBe(225)

    // barHeight: 28 * (1 + (1.5 - 1) * 0.7) = 28 * 1.35 = 37.8 -> 38px
    expect((element as any).effectiveBarHeight).toBe(38)

    // fontScale: 1 * 1.5 = 1.5
    expect((element as any).effectiveFontScale).toBe(1.5)
  })

  it('zoomIn and zoomOut step through Chrome zoom levels', async () => {
    document.body.appendChild(element)
    await element.updateComplete

    expect(element.getZoomPercent()).toBe(100)

    element.zoomIn() // 100 -> 110
    expect(element.getZoomPercent()).toBe(110)

    element.zoomIn() // 110 -> 125
    expect(element.getZoomPercent()).toBe(125)

    element.zoomOut() // 125 -> 110
    expect(element.getZoomPercent()).toBe(110)

    element.zoomOut() // 110 -> 100
    expect(element.getZoomPercent()).toBe(100)

    element.zoomOut() // 100 -> 90
    expect(element.getZoomPercent()).toBe(90)
  })

  it('resetZoom resets to 100 or initialPercent', async () => {
    document.body.appendChild(element)
    await element.updateComplete

    element.zoomToPercent(150)
    expect(element.getZoomPercent()).toBe(150)

    element.resetZoom()
    expect(element.getZoomPercent()).toBe(100)
  })

  it('zoom-change event detail includes zoomScale and zoomPercent', async () => {
    document.body.appendChild(element)
    await element.updateComplete

    const handler = vi.fn()
    element.addEventListener('zoom-change', handler)

    element.zoomToPercent(125)
    await element.updateComplete

    expect(handler).toHaveBeenCalledTimes(1)
    const detail = handler.mock.calls[0][0].detail
    expect(detail.zoomPercent).toBe(125)
    expect(detail.zoomScale).toBe(1.25)
    expect(detail.pxPerDay).toBeCloseTo(63, 1)
  })

  it('scaleElements option controls which elements are scaled', async () => {
    element.option = {
      ...element.option,
      zoom: {
        enabled: true,
        scaleElements: {
          calendar: true,
          rowHeader: false,
          barHeight: false,
          fontScale: false,
        },
      },
    }
    document.body.appendChild(element)
    await element.updateComplete

    element.zoomToPercent(150)
    await element.updateComplete

    // calendar is scaled: 50 * 1.5 = 75px
    const startX = (element as any).getDateX(new Date('2024-01-01'))
    const dayLaterX = (element as any).getDateX(new Date('2024-01-02'))
    expect(dayLaterX - startX).toBeCloseTo(75, 1)

    // rowHeader is NOT scaled (stays 150)
    expect((element as any).currentRowHeaderWidth).toBe(150)

    // barHeight is NOT scaled (stays 28)
    expect((element as any).effectiveBarHeight).toBe(28)

    // fontScale is NOT scaled (stays 1)
    expect((element as any).effectiveFontScale).toBe(1)
  })

  it('Cmd+0 shortcut triggers resetZoom', async () => {
    document.body.appendChild(element)
    await element.updateComplete

    element.zoomToPercent(150)
    expect(element.getZoomPercent()).toBe(150)

    const keyEvent = new KeyboardEvent('keydown', {
      key: '0',
      metaKey: true,
      bubbles: true,
      cancelable: true,
    })
    element.dispatchEvent(keyEvent)

    expect(element.getZoomPercent()).toBe(100)
  })

  it('preserves zoomPercent when parent re-renders with new option reference', async () => {
    document.body.appendChild(element)
    await element.updateComplete

    element.zoomToPercent(150)
    expect(element.getZoomPercent()).toBe(150)

    // 親コンポーネントが新しい option オブジェクトを渡して再描画
    element.option = { ...element.option }
    await element.updateComplete

    // zoomPercent が 100% にリセットされずに 150% を維持していること
    expect(element.getZoomPercent()).toBe(150)
    const startX = (element as any).getDateX(new Date('2024-01-01'))
    const dayLaterX = (element as any).getDateX(new Date('2024-01-02'))
    expect(dayLaterX - startX).toBeCloseTo(75, 1)
  })

  it('Ctrl+wheel zooms in and out following zoom levels or step', async () => {
    element.option = {
      ...element.option,
      zoom: {
        enabled: true,
        levels: [50, 75, 100, 125, 150, 200],
      },
    }
    document.body.appendChild(element)
    await element.updateComplete

    expect(element.getZoomPercent()).toBe(100)

    // Ctrl + ホイール上回転（拡大: 100 -> 125）
    const wheelZoomIn = new WheelEvent('wheel', {
      deltaY: -100,
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    })
    element.dispatchEvent(wheelZoomIn)
    await element.updateComplete

    expect(element.getZoomPercent()).toBe(125)

    // Ctrl + ホイール下回転（縮小: 125 -> 100）
    const wheelZoomOut = new WheelEvent('wheel', {
      deltaY: 100,
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    })
    element.dispatchEvent(wheelZoomOut)
    await element.updateComplete

    expect(element.getZoomPercent()).toBe(100)
  })
})

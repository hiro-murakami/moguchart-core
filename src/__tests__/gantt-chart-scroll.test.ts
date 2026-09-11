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

describe('GanttChartElement Scroll Reset', () => {
  let element: GanttChartElement

  beforeEach(async () => {
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
    }
    element.rows = [
      {
        id: 'row-1',
        name: 'Row 1',
        tasks: [
          {
            id: 'task-1',
            name: 'Task 1',
            start: new Date('2024-01-05'),
            end: new Date('2024-01-15'),
          },
        ],
      },
      {
        id: 'row-2',
        name: 'Row 2',
        tasks: [
          {
            id: 'task-2',
            name: 'Task 2',
            start: new Date('2024-02-01'),
            end: new Date('2024-02-10'),
          },
        ],
      },
    ]
    document.body.appendChild(element)
    await element.updateComplete
  })

  afterEach(() => {
    if (element && element.parentNode) {
      element.parentNode.removeChild(element)
    }
    vi.clearAllMocks()
  })

  it('resetScroll resets scrollLeft and scrollTop to 0', async () => {
    const scrollContainer = element.shadowRoot?.querySelector('.scroll-container') as HTMLElement
    expect(scrollContainer).toBeDefined()

    // 模擬スクロール位置を設定
    scrollContainer.scrollLeft = 350
    scrollContainer.scrollTop = 120

    // resetScroll を呼び出し
    element.resetScroll()
    await element.updateComplete

    expect(scrollContainer.scrollLeft).toBe(0)
    expect(scrollContainer.scrollTop).toBe(0)
  })

  it('scrollToPosition moves scroll position to specified coordinates', async () => {
    const scrollContainer = element.shadowRoot?.querySelector('.scroll-container') as HTMLElement
    expect(scrollContainer).toBeDefined()

    // scrollTo メソッドのモック（jsdom環境での動作保証）
    scrollContainer.scrollTo = vi.fn().mockImplementation((options: any) => {
      if (options.left !== undefined) scrollContainer.scrollLeft = options.left
      if (options.top !== undefined) scrollContainer.scrollTop = options.top
    })

    element.scrollToPosition({ left: 200, top: 80 })
    await element.updateComplete

    expect(scrollContainer.scrollTo).toHaveBeenCalledWith({
      left: 200,
      top: 80,
      behavior: 'auto',
    })
    expect(scrollContainer.scrollLeft).toBe(200)
    expect(scrollContainer.scrollTop).toBe(80)
  })
})

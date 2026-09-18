import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GanttChartElement } from '@mogura/moguchart-core'
import { exportPlugin, exportChart } from '../index'

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

vi.mock('html2canvas-pro', () => {
  return {
    default: vi.fn().mockImplementation((_targetEl: HTMLElement, options: any) => {
      const canvas = document.createElement('canvas')
      canvas.width = options.width || 800
      canvas.height = options.height || 600
      canvas.toDataURL = vi.fn((type?: string) => `data:${type || 'image/png'};base64,mockData`)
      return Promise.resolve(canvas)
    }),
  }
})

describe('@mogura/moguchart-plugin-export', () => {
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
        end: new Date('2024-01-31'),
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

  it('exportPlugin registers exportImage method on GanttChartElement', async () => {
    element.use(exportPlugin())
    const result = await element.exportImage('png', { download: false })
    expect(result).toBeDefined()
    expect(typeof result).toBe('string')
    expect((result as string).startsWith('data:image/png')).toBe(true)
  })

  it('exportPlugin preserves and restores scrollLeft and scrollTop', async () => {
    element.use(exportPlugin())
    const scrollContainer = element.shadowRoot?.querySelector('.scroll-container') as HTMLElement
    if (scrollContainer) {
      scrollContainer.scrollLeft = 120
      scrollContainer.scrollTop = 45
    }

    await element.exportImage('png', { download: false })

    if (scrollContainer) {
      expect(scrollContainer.scrollLeft).toBe(120)
      expect(scrollContainer.scrollTop).toBe(45)
    }
  })

  it('exportChart standalone function exports chart successfully', async () => {
    const result = await exportChart(element, 'png', { download: false })
    expect(result).toBeDefined()
    expect(typeof result).toBe('string')
    expect((result as string).startsWith('data:image/png')).toBe(true)
  })
})

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GanttChartElement } from '../components/gantt-chart'
import '../components/gantt-chart'
import type { GanttPlugin } from '../core/plugin'

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

describe('Plugin Architecture & PluginManager', () => {
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

  it('throws helpful error when exportImage is called without export plugin', async () => {
    await expect(element.exportImage('png')).rejects.toThrow(
      '@mogura/moguchart-plugin-export',
    )
  })

  it('registers plugin via chart.use() and executes install hook', () => {
    const installMock = vi.fn()
    const testPlugin: GanttPlugin = {
      name: 'test-plugin',
      version: '1.0.0',
      install: installMock,
    }

    element.use(testPlugin, { custom: 'option' })
    expect(installMock).toHaveBeenCalledTimes(1)
    expect(installMock).toHaveBeenCalledWith(element, { custom: 'option' })
    expect(element.pluginManager.hasPlugin('test-plugin')).toBe(true)
  })

  it('prevents duplicate plugin registration with warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const testPlugin: GanttPlugin = {
      name: 'duplicate-plugin',
    }

    element.use(testPlugin)
    element.use(testPlugin)

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('already registered'),
    )
    warnSpy.mockRestore()
  })

  it('automatically registers plugins provided in option.plugins', async () => {
    const installMock = vi.fn()
    const pluginInOption: GanttPlugin = {
      name: 'option-plugin',
      install: installMock,
    }

    const newElement = new GanttChartElement()
    newElement.option = {
      calendar: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
        pxPerDay: 50,
      },
      plugins: [pluginInOption],
    }
    document.body.appendChild(newElement)
    await newElement.updateComplete

    expect(installMock).toHaveBeenCalledTimes(1)
    expect(newElement.pluginManager.hasPlugin('option-plugin')).toBe(true)
    document.body.removeChild(newElement)
  })

  it('calls destroy on plugins when chart is disconnected', () => {
    const destroyMock = vi.fn()
    const pluginWithDestroy: GanttPlugin = {
      name: 'destroyable-plugin',
      destroy: destroyMock,
    }

    element.use(pluginWithDestroy)
    element.disconnectedCallback()

    expect(destroyMock).toHaveBeenCalledTimes(1)
    expect(destroyMock).toHaveBeenCalledWith(element)
    expect(element.pluginManager.hasPlugin('destroyable-plugin')).toBe(false)
  })

  it('executes afterRender hook after updated lifecycle', async () => {
    const afterRenderMock = vi.fn()
    const renderPlugin: GanttPlugin = {
      name: 'render-plugin',
      hooks: {
        afterRender: afterRenderMock,
      },
    }

    element.use(renderPlugin)
    element.requestUpdate()
    await element.updateComplete

    expect(afterRenderMock).toHaveBeenCalled()
  })

  it('getRowPositions returns array of row positions', () => {
    const positions = element.getRowPositions()
    expect(Array.isArray(positions)).toBe(true)
    expect(positions.length).toBe(1)
    expect(positions[0].top).toBeDefined()
    expect(positions[0].height).toBeDefined()
    expect(positions[0].bottom).toBeDefined()
  })
})

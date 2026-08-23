import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GanttChartElement } from '../components/gantt-chart'
import { GanttMinimapElement } from '../components/gantt-minimap'
import '../components/gantt-chart'
import '../components/gantt-minimap'
import type { GanttRow } from '../core/types'

// ResizeObserverのモック
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Canvas 2D context のモック
const mockCtx = {
  save: vi.fn(),
  restore: vi.fn(),
  scale: vi.fn(),
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  rect: vi.fn(),
  roundRect: vi.fn(),
  beginPath: vi.fn(),
  stroke: vi.fn(),
  fill: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  setLineDash: vi.fn(),
}

HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation((contextId) => {
  if (contextId === '2d') {
    return mockCtx
  }
  return null
})

describe('GanttMinimap & GanttChart Integration', () => {
  let chart: GanttChartElement
  const sampleRows: GanttRow[] = [
    {
      id: 'row-1',
      name: 'Project 1',
      tasks: [
        {
          id: 't-1',
          name: 'Task 1',
          start: new Date('2024-01-01T00:00:00Z'),
          end: new Date('2024-01-05T00:00:00Z'),
          style: 'background-color: #ef4444',
        },
      ],
    },
    {
      id: 'row-2',
      name: 'Project 2',
      tasks: [
        {
          id: 't-2',
          name: 'Task 2',
          start: new Date('2024-01-06T00:00:00Z'),
          end: new Date('2024-01-10T00:00:00Z'),
          style: 'background: #10b981',
        },
      ],
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    chart = new GanttChartElement()
    chart.rows = sampleRows
    chart.option = {
      calendar: {
        start: new Date('2024-01-01T00:00:00Z'),
        end: new Date('2024-01-31T00:00:00Z'),
        pxPerDay: 40,
        showCurrentTime: true,
        milestones: [
          {
            id: 'm-1',
            name: 'Milestone 1',
            start: new Date('2024-01-15T00:00:00Z'),
            color: '#8b5cf6',
          },
        ],
      },
    }
  })

  afterEach(() => {
    chart.remove()
  })

  it('does not render minimap by default (minimap.enabled undefined or false)', async () => {
    document.body.appendChild(chart)
    await chart.updateComplete

    const minimapEl = chart.shadowRoot?.querySelector('gantt-minimap')
    expect(minimapEl).toBeNull()
  })

  it('renders gantt-minimap when option.minimap.enabled is true', async () => {
    chart.option = {
      ...chart.option,
      minimap: {
        enabled: true,
        width: 220,
        height: 140,
      },
    }
    document.body.appendChild(chart)
    await chart.updateComplete

    const minimapEl = chart.shadowRoot?.querySelector('gantt-minimap') as GanttMinimapElement | null
    expect(minimapEl).not.toBeNull()
    expect(minimapEl?.option?.minimap?.width).toBe(220)
    expect(minimapEl?.option?.minimap?.height).toBe(140)
  })

  it('renders canvas and viewport frame inside gantt-minimap', async () => {
    const minimap = new GanttMinimapElement()
    minimap.rows = sampleRows
    minimap.option = {
      calendar: {
        start: new Date('2024-01-01T00:00:00Z'),
        end: new Date('2024-01-31T00:00:00Z'),
        pxPerDay: 40,
      },
      minimap: {
        enabled: true,
        width: 200,
        height: 120,
      },
    }
    minimap.contentWidth = 1200
    minimap.contentHeight = 600
    minimap.viewportWidth = 400
    minimap.viewportHeight = 300
    minimap.scrollLeft = 100
    minimap.scrollTop = 50

    document.body.appendChild(minimap)
    await minimap.updateComplete

    const canvas = minimap.shadowRoot?.querySelector('canvas')
    const viewport = minimap.shadowRoot?.querySelector('.minimap-viewport') as HTMLElement | null

    expect(canvas).not.toBeNull()
    expect(viewport).not.toBeNull()
    expect(viewport?.style.left).toContain('px')
    expect(viewport?.style.top).toContain('px')

    minimap.remove()
  })

  it('toggles collapse state when clicking minimize / expand button', async () => {
    const minimap = new GanttMinimapElement()
    minimap.option = {
      calendar: {
        start: new Date('2024-01-01T00:00:00Z'),
        end: new Date('2024-01-31T00:00:00Z'),
        pxPerDay: 40,
      },
      minimap: {
        enabled: true,
        collapsible: true,
        collapsed: false,
      },
    }

    document.body.appendChild(minimap)
    await minimap.updateComplete

    // 最初は展開状態
    const toggleBtn = minimap.shadowRoot?.querySelector('.minimap-toggle-btn') as HTMLElement
    expect(toggleBtn).not.toBeNull()

    toggleBtn.click()
    await minimap.updateComplete

    // 折りたたみボタン（マップアイコン）が表示される
    const collapsedBtn = minimap.shadowRoot?.querySelector('.minimap-collapsed-btn') as HTMLElement
    expect(collapsedBtn).not.toBeNull()

    // 再度クリックで展開
    collapsedBtn.click()
    await minimap.updateComplete

    expect(minimap.shadowRoot?.querySelector('.minimap-toggle-btn')).not.toBeNull()

    minimap.remove()
  })

  it('dispatches minimap-scroll event when clicking on minimap body (click to jump)', async () => {
    const minimap = new GanttMinimapElement()
    minimap.option = {
      calendar: {
        start: new Date('2024-01-01T00:00:00Z'),
        end: new Date('2024-01-31T00:00:00Z'),
        pxPerDay: 40,
      },
      minimap: {
        enabled: true,
        width: 200,
        height: 100,
      },
    }
    minimap.contentWidth = 1000
    minimap.contentHeight = 500
    minimap.viewportWidth = 200
    minimap.viewportHeight = 100

    document.body.appendChild(minimap)
    await minimap.updateComplete

    const scrollListener = vi.fn()
    minimap.addEventListener('minimap-scroll', (e: any) => {
      scrollListener(e.detail)
    })

    const bodyEl = minimap.shadowRoot?.querySelector('.minimap-body') as HTMLElement
    const canvas = minimap.shadowRoot?.querySelector('canvas') as HTMLCanvasElement

    // getBoundingClientRect のモック
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 200,
      bottom: 100,
      width: 200,
      height: 100,
      x: 0,
      y: 0,
      toJSON: () => {},
    })

    // (100, 50)をクリック（中心位置）
    bodyEl.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 100,
        clientY: 50,
        bubbles: true,
      }),
    )

    expect(scrollListener).toHaveBeenCalled()
    const detail = scrollListener.mock.calls[0][0]
    expect(detail.scrollLeft).toBeGreaterThanOrEqual(0)
    expect(detail.scrollTop).toBeGreaterThanOrEqual(0)

    minimap.remove()
  })

  it('updates main chart scroll container when receiving minimap-scroll', async () => {
    chart.option = {
      ...chart.option,
      minimap: { enabled: true },
    }
    document.body.appendChild(chart)
    await chart.updateComplete

    const minimapEl = chart.shadowRoot?.querySelector('gantt-minimap') as GanttMinimapElement
    const container = chart.shadowRoot?.querySelector('.scroll-container') as HTMLElement

    expect(minimapEl).not.toBeNull()

    // minimap-scroll イベントを発火
    minimapEl.dispatchEvent(
      new CustomEvent('minimap-scroll', {
        detail: { scrollLeft: 150, scrollTop: 80 },
        bubbles: true,
        composed: true,
      }),
    )

    expect(container.scrollLeft).toBe(150)
    expect(container.scrollTop).toBe(80)
  })

  it('updates position when dragging the minimap header bar', async () => {
    const minimap = new GanttMinimapElement()
    minimap.option = {
      calendar: {
        start: new Date('2024-01-01T00:00:00Z'),
        end: new Date('2024-01-31T00:00:00Z'),
        pxPerDay: 40,
      },
      minimap: {
        enabled: true,
        width: 200,
        height: 120,
      },
    }
    minimap.viewportWidth = 800
    minimap.viewportHeight = 600

    document.body.appendChild(minimap)
    await minimap.updateComplete

    const header = minimap.shadowRoot?.querySelector('.minimap-header') as HTMLElement
    expect(header).not.toBeNull()

    // getBoundingClientRect モック
    vi.spyOn(minimap, 'getBoundingClientRect').mockReturnValue({
      left: 584,
      top: 464,
      right: 784,
      bottom: 584,
      width: 200,
      height: 120,
      x: 584,
      y: 464,
      toJSON: () => {},
    })

    // PointerCapture のモック
    header.setPointerCapture = vi.fn()
    header.releasePointerCapture = vi.fn()

    // 1. ドラッグ開始 (584, 464)
    header.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 590,
        clientY: 470,
        pointerId: 1,
        bubbles: true,
      }),
    )

    expect(header.setPointerCapture).toHaveBeenCalledWith(1)

    // 2. ドラッグ移動 (X: -100px, Y: -50px)
    header.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: 490,
        clientY: 420,
        pointerId: 1,
        bubbles: true,
      }),
    )

    await minimap.updateComplete

    expect(minimap.style.left).toContain('px')
    expect(minimap.style.top).toContain('px')
    expect(minimap.style.right).toBe('auto')
    expect(minimap.style.bottom).toBe('auto')

    // 3. ドラッグ終了
    header.dispatchEvent(
      new PointerEvent('pointerup', {
        pointerId: 1,
        bubbles: true,
      }),
    )

    expect(header.releasePointerCapture).toHaveBeenCalledWith(1)

    minimap.remove()
  })

  it('preserves aspect ratio matching the content width and height', async () => {
    const minimap = new GanttMinimapElement()
    minimap.option = {
      calendar: {
        start: new Date('2024-01-01T00:00:00Z'),
        end: new Date('2024-01-31T00:00:00Z'),
        pxPerDay: 40,
      },
      minimap: {
        enabled: true,
        width: 200,
        height: 120,
        preserveAspectRatio: true,
      },
    }
    // 2:1 のコンテンツ (幅2000px, 高さ1000px)
    minimap.contentWidth = 2000
    minimap.contentHeight = 1000
    minimap.viewportWidth = 800
    minimap.viewportHeight = 600

    document.body.appendChild(minimap)
    await minimap.updateComplete

    const container = minimap.shadowRoot?.querySelector('.minimap-container') as HTMLElement
    const bodyEl = minimap.shadowRoot?.querySelector('.minimap-body') as HTMLElement

    // 幅200pxに対して、高さは 200 / 2 = 100px になるはず
    expect(container.style.width).toBe('200px')
    expect(bodyEl.style.height).toBe('100px')

    minimap.remove()
  })

  it('resizes minimap when dragging the resize handle', async () => {
    const minimap = new GanttMinimapElement()
    minimap.option = {
      calendar: {
        start: new Date('2024-01-01T00:00:00Z'),
        end: new Date('2024-01-31T00:00:00Z'),
        pxPerDay: 40,
      },
      minimap: {
        enabled: true,
        width: 200,
        height: 120,
        preserveAspectRatio: false,
        resizable: true,
      },
    }
    minimap.contentWidth = 2000
    minimap.contentHeight = 1000
    minimap.viewportWidth = 800
    minimap.viewportHeight = 600

    document.body.appendChild(minimap)
    await minimap.updateComplete

    const resizeListener = vi.fn()
    minimap.addEventListener('minimap-resize', (e: any) => {
      resizeListener(e.detail)
    })

    const seHandle = minimap.shadowRoot?.querySelector('.minimap-resize-handle.se') as HTMLElement
    expect(seHandle).not.toBeNull()

    seHandle.setPointerCapture = vi.fn()
    seHandle.releasePointerCapture = vi.fn()

    // 1. ドラッグ開始
    seHandle.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 200,
        clientY: 120,
        pointerId: 1,
        bubbles: true,
      }),
    )

    expect(seHandle.setPointerCapture).toHaveBeenCalledWith(1)

    // 2. ドラッグ移動 (+50px, +30px)
    seHandle.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: 250,
        clientY: 150,
        pointerId: 1,
        bubbles: true,
      }),
    )

    await minimap.updateComplete

    const container = minimap.shadowRoot?.querySelector('.minimap-container') as HTMLElement
    expect(container.style.width).toBe('250px')

    // 3. ドラッグ終了
    seHandle.dispatchEvent(
      new PointerEvent('pointerup', {
        pointerId: 1,
        bubbles: true,
      }),
    )

    expect(seHandle.releasePointerCapture).toHaveBeenCalledWith(1)
    expect(resizeListener).toHaveBeenCalledWith({ width: 250, height: 150 })

    minimap.remove()
  })
})

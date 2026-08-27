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

  it('renders gantt-minimap when option.minimap.enabled is true with timeline bounds', async () => {
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

    // contentWidth が純粋なタイムライン幅 (30日 * 40px = 1200px) になり、行ヘッダー幅 (200px) を含まないこと
    expect(minimapEl?.contentWidth).toBe(1200)
    // viewportWidth が (ガントチャートのビューポート幅 850 - 行ヘッダー幅 200 = 650) になっていること
    expect(minimapEl?.viewportWidth).toBe(650)
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

  it('toggles collapse state when clicking minimize / expand button, dispatches minimap-collapse event and positions collapsed icon at bottom-right', async () => {
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
        position: { right: 100, bottom: 100 },
      },
    }

    const collapseEvents: Array<{ collapsed: boolean }> = []
    minimap.addEventListener('minimap-collapse', (e: Event) => {
      collapseEvents.push((e as CustomEvent).detail)
    })

    document.body.appendChild(minimap)
    await minimap.updateComplete

    // 最初は展開状態かつカスタム位置
    expect(minimap.style.right).toBe('100px')
    expect(minimap.style.bottom).toBe('100px')

    const toggleBtn = minimap.shadowRoot?.querySelector('.minimap-toggle-btn') as HTMLElement
    expect(toggleBtn).not.toBeNull()

    toggleBtn.click()
    await minimap.updateComplete

    // minimap-collapse イベントが発火（collapsed: true）
    expect(collapseEvents).toHaveLength(1)
    expect(collapseEvents[0]).toEqual({ collapsed: true })

    // 折りたたみ時はスタイルがクリアされ右下（CSSデフォルト）に配置される
    const collapsedBtn = minimap.shadowRoot?.querySelector('.minimap-collapsed-btn') as HTMLElement
    expect(collapsedBtn).not.toBeNull()
    expect(minimap.style.left).toBe('')
    expect(minimap.style.top).toBe('')
    expect(minimap.style.right).toBe('')
    expect(minimap.style.bottom).toBe('')

    // 再度クリックで展開すると、元のカスタム位置に復元される
    collapsedBtn.click()
    await minimap.updateComplete

    // minimap-collapse イベントが発火（collapsed: false）
    expect(collapseEvents).toHaveLength(2)
    expect(collapseEvents[1]).toEqual({ collapsed: false })

    expect(minimap.shadowRoot?.querySelector('.minimap-toggle-btn')).not.toBeNull()
    expect(minimap.style.right).toBe('100px')
    expect(minimap.style.bottom).toBe('100px')

    // option の変更によるリアクティブな collapsed 反映
    minimap.option = {
      ...minimap.option,
      minimap: {
        ...minimap.option.minimap,
        collapsed: true,
      },
    }
    await minimap.updateComplete
    expect(minimap.shadowRoot?.querySelector('.minimap-collapsed-btn')).not.toBeNull()

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

    // getBoundingClientRect モック (親 800x600, 右下余白 16px, 16px)
    // left: 800 - 16 - 200 = 584, top: 600 - 16 - 148 = 436, right: 784, bottom: 584
    vi.spyOn(minimap, 'getBoundingClientRect').mockReturnValue({
      left: 584,
      top: 436,
      right: 784,
      bottom: 584,
      width: 200,
      height: 148,
      x: 584,
      y: 436,
      toJSON: () => {},
    })

    // PointerCapture のモック
    header.setPointerCapture = vi.fn()
    header.releasePointerCapture = vi.fn()

    // 1. ドラッグ開始
    header.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 590,
        clientY: 470,
        pointerId: 1,
        bubbles: true,
      }),
    )

    expect(header.setPointerCapture).toHaveBeenCalledWith(1)

    // 2. ドラッグ移動 (左に100px: clientX 590 -> 490, 上に50px: clientY 470 -> 420)
    // 右端からの距離 right は 16 - (-100) = 116px
    // 下端からの距離 bottom は 16 - (-50) = 66px
    header.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: 490,
        clientY: 420,
        pointerId: 1,
        bubbles: true,
      }),
    )

    await minimap.updateComplete

    const moveListener = vi.fn()
    minimap.addEventListener('minimap-move', (e: any) => {
      moveListener(e.detail)
    })

    // 3. ドラッグ終了
    header.dispatchEvent(
      new PointerEvent('pointerup', {
        pointerId: 1,
        bubbles: true,
      }),
    )

    expect(header.releasePointerCapture).toHaveBeenCalledWith(1)
    expect(moveListener).toHaveBeenCalled()
    const moveDetail = moveListener.mock.calls[0][0]
    expect(moveDetail.right).toBe(116)
    expect(moveDetail.bottom).toBe(66)
    expect(minimap.style.right).toBe('116px')
    expect(minimap.style.bottom).toBe('66px')

    minimap.remove()
  })

  it('restores initial position when option.minimap.position is provided', async () => {
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
        position: { right: 150, bottom: 80 },
      },
    }
    document.body.appendChild(minimap)
    await minimap.updateComplete

    expect(minimap.style.right).toBe('150px')
    expect(minimap.style.bottom).toBe('80px')
    expect(minimap.style.left).toBe('auto')
    expect(minimap.style.top).toBe('auto')

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

  it('preserves specified width when option.minimap.height is omitted even with tall content', async () => {
    const minimap = new GanttMinimapElement()
    minimap.option = {
      calendar: {
        start: new Date('2024-01-01T00:00:00Z'),
        end: new Date('2024-01-31T00:00:00Z'),
        pxPerDay: 40,
      },
      minimap: {
        enabled: true,
        width: 300,
        // height 未指定
        preserveAspectRatio: true,
      },
    }
    // コンテンツ幅 1500px, コンテンツ高さ 2000px (縦長コンテンツ)
    minimap.contentWidth = 1500
    minimap.contentHeight = 2000
    minimap.viewportWidth = 800
    minimap.viewportHeight = 600

    document.body.appendChild(minimap)
    await minimap.updateComplete

    const container = minimap.shadowRoot?.querySelector('.minimap-container') as HTMLElement
    const bodyEl = minimap.shadowRoot?.querySelector('.minimap-body') as HTMLElement

    // width 300px が正しく維持されること (従来の120px上限で縮小されないこと)
    expect(container.style.width).toBe('300px')
    // 高さ = 300 * (2000 / 1500) = 400px
    expect(bodyEl.style.height).toBe('400px')

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
    expect(resizeListener).toHaveBeenCalledWith(
      expect.objectContaining({ width: 250, height: 150 }),
    )

    minimap.remove()
  })

  it('anchors vertical size to bottom edge when resizing width with preserveAspectRatio: true', async () => {
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
        preserveAspectRatio: true,
        resizable: true,
        position: { right: 100, bottom: 50 },
      },
    }
    minimap.contentWidth = 2000
    minimap.contentHeight = 1000
    minimap.viewportWidth = 800
    minimap.viewportHeight = 600

    document.body.appendChild(minimap)
    await minimap.updateComplete

    // 初期状態: 幅 200px, 高さ 100px (アスペクト比 2:1)
    // position: right = 100, bottom = 50
    expect(minimap.style.right).toBe('100px')
    expect(minimap.style.bottom).toBe('50px')

    const resizeListener = vi.fn()
    minimap.addEventListener('minimap-resize', (e: any) => {
      resizeListener(e.detail)
    })

    // 1. 右端 (e) ハンドルで幅を +100px 拡大 (200px -> 300px)
    // アスペクト比維持のため高さは 100px -> 150px (+50px) になる
    // 左端固定のため、右端が右に伸びて right は 100 - 100 = 0px に移動する
    // 下端固定のため、bottom は 50px のまま
    const eHandle = minimap.shadowRoot?.querySelector('.minimap-resize-handle.e') as HTMLElement
    expect(eHandle).not.toBeNull()

    eHandle.setPointerCapture = vi.fn()
    eHandle.releasePointerCapture = vi.fn()

    eHandle.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 700,
        clientY: 350,
        pointerId: 1,
        bubbles: true,
      }),
    )

    eHandle.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: 800, // +100px
        clientY: 350,
        pointerId: 1,
        bubbles: true,
      }),
    )

    await minimap.updateComplete

    const container = minimap.shadowRoot?.querySelector('.minimap-container') as HTMLElement
    expect(container.style.width).toBe('300px')
    expect(minimap.style.right).toBe('0px') // 左端固定で右端が移動 (100 - 100 = 0px)
    expect(minimap.style.bottom).toBe('50px') // 下端固定

    eHandle.dispatchEvent(
      new PointerEvent('pointerup', {
        pointerId: 1,
        bubbles: true,
      }),
    )

    expect(resizeListener).toHaveBeenCalledWith(
      expect.objectContaining({
        width: 300,
        height: 150,
        position: expect.objectContaining({ right: 0, bottom: 50 }),
      }),
    )

    // 2. 左端 (w) ハンドルで幅を -60px 縮小 (300px -> 240px)
    // 幅 300px -> 240px (-60px), 高さ 150px -> 120px (-30px)
    // wハンドルのため右端固定 (right は 0px のまま)
    // 下端固定のため bottom は 50px のまま
    const wHandle = minimap.shadowRoot?.querySelector('.minimap-resize-handle.w') as HTMLElement
    expect(wHandle).not.toBeNull()

    wHandle.setPointerCapture = vi.fn()
    wHandle.releasePointerCapture = vi.fn()

    wHandle.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 500,
        clientY: 260,
        pointerId: 2,
        bubbles: true,
      }),
    )

    wHandle.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: 560, // dx = +60 => deltaW = -60
        clientY: 260,
        pointerId: 2,
        bubbles: true,
      }),
    )

    await minimap.updateComplete

    expect(container.style.width).toBe('240px')
    expect(minimap.style.right).toBe('0px') // 右端固定
    expect(minimap.style.bottom).toBe('50px') // 下端固定

    wHandle.dispatchEvent(
      new PointerEvent('pointerup', {
        pointerId: 2,
        bubbles: true,
      }),
    )

    minimap.remove()
  })

  it('tracks container resize and maintains bottom-right relative position when position is set', async () => {
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
        preserveAspectRatio: false,
        position: { right: 50, bottom: 30 },
      },
    }
    minimap.contentWidth = 2000
    minimap.contentHeight = 1000
    minimap.viewportWidth = 1000
    minimap.viewportHeight = 600

    document.body.appendChild(minimap)
    await minimap.updateComplete

    expect(minimap.style.right).toBe('50px')
    expect(minimap.style.bottom).toBe('30px')

    const moveListener = vi.fn()
    minimap.addEventListener('minimap-move', (e: any) => {
      moveListener(e.detail)
    })

    // 1. 親領域（viewport）が 1000x600 -> 1200x800 に拡大 (+200px, +200px)
    // CSSの right/bottom により、右下からの距離は自動的に 50px, 30px が保たれる
    minimap.viewportWidth = 1200
    minimap.viewportHeight = 800
    await minimap.updateComplete

    expect(minimap.style.right).toBe('50px')
    expect(minimap.style.bottom).toBe('30px')

    // 2. 親領域（viewport）が 1200x800 -> 900x500 に縮小 (-300px, -300px)
    minimap.viewportWidth = 900
    minimap.viewportHeight = 500
    await minimap.updateComplete

    expect(minimap.style.right).toBe('50px')
    expect(minimap.style.bottom).toBe('30px')

    // 3. 親領域が極端に縮小（ミニマップサイズ＋余白より小さくなる）した場合にクランプされる
    // 幅 200px に対し親幅 220px -> maxRight = 20px (50pxから20pxにクランプ)
    minimap.viewportWidth = 220
    await minimap.updateComplete

    expect(minimap.style.right).toBe('20px')
    expect(moveListener).toHaveBeenCalledWith(expect.objectContaining({ right: 20 }))

    minimap.remove()
  })

  it('anchors to bottom edge when minimap height changes due to container resize (preserveAspectRatio: true)', async () => {
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
        preserveAspectRatio: true,
        position: { right: 50, bottom: 50 },
      },
    }
    minimap.contentWidth = 2000
    minimap.contentHeight = 200
    minimap.viewportWidth = 1000
    minimap.viewportHeight = 500

    document.body.appendChild(minimap)
    await minimap.updateComplete

    expect(minimap.style.bottom).toBe('50px')

    // 親領域の高さが 500 -> 1000 に拡大
    // 下端を基準（CSS bottom: 50px）としているため、下余白50pxが常に維持される
    minimap.viewportHeight = 1000
    await minimap.updateComplete

    expect(minimap.style.bottom).toBe('50px')

    minimap.remove()
  })

  it('anchors to right edge and bottom edge when container and minimap dimensions change', async () => {
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
        preserveAspectRatio: true,
        position: { right: 100, bottom: 50 },
      },
    }
    minimap.contentWidth = 2000
    minimap.contentHeight = 1000
    minimap.viewportWidth = 1000
    minimap.viewportHeight = 500

    document.body.appendChild(minimap)
    await minimap.updateComplete

    expect(minimap.style.right).toBe('100px')
    expect(minimap.style.bottom).toBe('50px')

    // 親領域が 1000x500 -> 1200x700 に拡大
    // CSSの right/bottom により右余白100px、下余白50pxが自動維持される
    minimap.viewportWidth = 1200
    minimap.viewportHeight = 700
    await minimap.updateComplete

    expect(minimap.style.right).toBe('100px')
    expect(minimap.style.bottom).toBe('50px')

    minimap.remove()
  })

  it('includes blank area in minimap when content height is smaller than viewport height (preserveAspectRatio: true)', async () => {
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
    // コンテンツ高さ200px < ビューポート高さ600px（下部に余白がある状態）
    minimap.contentWidth = 2000
    minimap.contentHeight = 200
    minimap.viewportWidth = 800
    minimap.viewportHeight = 600
    minimap.scrollLeft = 0
    minimap.scrollTop = 0

    document.body.appendChild(minimap)
    await minimap.updateComplete

    const container = minimap.shadowRoot?.querySelector('.minimap-container') as HTMLElement
    const bodyEl = minimap.shadowRoot?.querySelector('.minimap-body') as HTMLElement
    const viewport = minimap.shadowRoot?.querySelector('.minimap-viewport') as HTMLElement

    // effectiveContentHeight が 600px になり、アスペクト比 2000:600 (scale: 0.1)
    // 幅200px に対して ミニマップ全体の高さは 600 * 0.1 = 60px になる
    expect(container.style.width).toBe('200px')
    expect(bodyEl.style.height).toBe('60px')

    // ビューポート枠は縦全体 (60px) をカバーする
    expect(viewport.style.height).toBe('60px')
    expect(viewport.style.width).toBe('80px') // 800 * 0.1 = 80px

    minimap.remove()
  })

  it('includes blank area in minimap when content height is smaller than viewport height (preserveAspectRatio: false)', async () => {
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
      },
    }
    // コンテンツ高さ200px < ビューポート高さ600px
    minimap.contentWidth = 2000
    minimap.contentHeight = 200
    minimap.viewportWidth = 800
    minimap.viewportHeight = 600
    minimap.scrollLeft = 0
    minimap.scrollTop = 0

    document.body.appendChild(minimap)
    await minimap.updateComplete

    const bodyEl = minimap.shadowRoot?.querySelector('.minimap-body') as HTMLElement
    const viewport = minimap.shadowRoot?.querySelector('.minimap-viewport') as HTMLElement

    expect(bodyEl.style.height).toBe('120px')
    // scaleY = 120 / 600 = 0.2 なので、viewportHeight(600) * 0.2 = 120px
    expect(viewport.style.height).toBe('120px')

    minimap.remove()
  })

  it('applies custom opacity to minimap container style', async () => {
    const minimap = new GanttMinimapElement()
    minimap.option = {
      calendar: {
        start: new Date('2024-01-01T00:00:00Z'),
        end: new Date('2024-01-31T00:00:00Z'),
        pxPerDay: 40,
      },
      minimap: {
        enabled: true,
        opacity: 0.65,
      },
    }

    document.body.appendChild(minimap)
    await minimap.updateComplete

    const container = minimap.shadowRoot?.querySelector('.minimap-container') as HTMLElement
    expect(container).not.toBeNull()
    expect(container.getAttribute('style')).toContain('--minimap-opacity: 0.65')

    // 未指定時はデフォルト 1
    minimap.option = {
      ...minimap.option,
      minimap: { enabled: true },
    }
    await minimap.updateComplete
    expect(container.getAttribute('style')).toContain('--minimap-opacity: 1')

    // 範囲外の値のクランプ (0.05 -> 0.1, 1.5 -> 1)
    minimap.option = {
      ...minimap.option,
      minimap: { enabled: true, opacity: 0.05 },
    }
    await minimap.updateComplete
    expect(container.getAttribute('style')).toContain('--minimap-opacity: 0.1')

    minimap.option = {
      ...minimap.option,
      minimap: { enabled: true, opacity: 1.5 },
    }
    await minimap.updateComplete
    expect(container.getAttribute('style')).toContain('--minimap-opacity: 1')

    // 折りたたみ時にも適用されること
    minimap.option = {
      ...minimap.option,
      minimap: { enabled: true, opacity: 0.5, collapsed: true },
    }
    await minimap.updateComplete
    const collapsedWrapper = minimap.shadowRoot?.querySelector('div[style*="--minimap-opacity: 0.5"]')
    expect(collapsedWrapper).not.toBeNull()

    minimap.remove()
  })
})

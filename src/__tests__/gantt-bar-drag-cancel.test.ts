import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GanttChartElement } from '../components/gantt-chart'
import '../components/gantt-bar'
import type { GanttRow } from '../core/types'

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

describe('GanttBar Drag Cancel & Outside Behavior', () => {
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
            name: 'Task 1',
            start: new Date('2024-01-05T00:00:00'),
            end: new Date('2024-01-10T00:00:00'),
          },
        ],
      },
      {
        id: 'row2',
        name: 'Row 2',
        tasks: [
          {
            id: 'task2',
            name: 'Task 2',
            start: new Date('2024-01-12T00:00:00'),
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
    }

    // getBoundingClientRect のモック（ガントチャートの範囲: x: 100~900, y: 50~600）
    vi.spyOn(chart, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 50,
      right: 900,
      bottom: 600,
      width: 800,
      height: 550,
      x: 100,
      y: 50,
      toJSON: () => {},
    })

    document.body.appendChild(chart)
    await chart.updateComplete

    // 全てのgantt-rowのgetBoundingClientRectをモック
    const rowEls = chart.shadowRoot?.querySelectorAll('gantt-row')
    if (rowEls) {
      rowEls.forEach((row, i) => {
        vi.spyOn(row, 'getBoundingClientRect').mockReturnValue({
          left: 100,
          top: 100 + i * 50,
          right: 900,
          bottom: 150 + i * 50,
          width: 800,
          height: 50,
          x: 100,
          y: 100 + i * 50,
          toJSON: () => {},
        })
      })
    }
  })

  afterEach(() => {
    document.body.removeChild(chart)
  })

  it('resets task bar position and marks isOutside=true when pointer moves outside Gantt chart', async () => {
    const rowEl = chart.shadowRoot?.querySelector('gantt-row')
    await rowEl?.updateComplete
    const barEl = rowEl?.shadowRoot?.querySelector('gantt-bar')
    await barEl?.updateComplete
    expect(barEl).toBeTruthy()

    const taskGroup = barEl?.shadowRoot?.querySelector('.task-group') as HTMLElement
    const bar = barEl?.shadowRoot?.querySelector('.bar') as HTMLElement
    expect(taskGroup).toBeTruthy()
    expect(bar).toBeTruthy()

    // Element.setPointerCapture / releasePointerCapture のモック
    bar.setPointerCapture = vi.fn()
    bar.releasePointerCapture = vi.fn()

    const updateEvents: any[] = []
    chart.addEventListener('task-update', (e: any) => {
      updateEvents.push(e.detail)
    })

    // 1. ドラッグ開始（チャート内: x=200, y=100）
    bar.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 200,
        clientY: 100,
        pointerId: 1,
        bubbles: true,
        composed: true,
      }),
    )

    // 2. ドラッグ移動（チャート内: x=250, y=100）
    window.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: 250,
        clientY: 100,
        pointerId: 1,
        bubbles: true,
      }),
    )

    // requestAnimationFrame を待つ
    await new Promise((r) => requestAnimationFrame(r))

    // チャート内でのドラッグ中は transform が設定され、isOutside: false
    expect(taskGroup.style.transform).toContain('translate')
    expect(updateEvents.length).toBeGreaterThan(0)
    const lastInsideEvent = updateEvents[updateEvents.length - 1]
    expect(lastInsideEvent.isOutside).toBe(false)
    expect(lastInsideEvent.isDragging).toBe(true)

    // 3. チャート外へカーソル移動（x=50, y=100 -> left: 100 より外）
    window.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: 50,
        clientY: 100,
        pointerId: 1,
        bubbles: true,
      }),
    )

    await new Promise((r) => requestAnimationFrame(r))

    // 外に出た時は transform がリセットされ、isOutside: true, dx: 0, dy: 0 となる
    expect(taskGroup.style.transform).toBe('')
    const lastOutsideEvent = updateEvents[updateEvents.length - 1]
    expect(lastOutsideEvent.isOutside).toBe(true)
    expect(lastOutsideEvent.isDragging).toBe(true)
    expect(lastOutsideEvent.dx).toBe(0)
    expect(lastOutsideEvent.dy).toBe(0)

    // 4. 再びチャート内に戻る（x=260, y=100）
    window.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: 260,
        clientY: 100,
        pointerId: 1,
        bubbles: true,
      }),
    )

    await new Promise((r) => requestAnimationFrame(r))
    expect(taskGroup.style.transform).toContain('translate')
    const backInsideEvent = updateEvents[updateEvents.length - 1]
    expect(backInsideEvent.isOutside).toBe(false)
  })

  it('cancels drag and does not trigger rows-change when pointer is released outside Gantt chart', async () => {
    const rowEl = chart.shadowRoot?.querySelector('gantt-row')
    await rowEl?.updateComplete
    const barEl = rowEl?.shadowRoot?.querySelector('gantt-bar')
    await barEl?.updateComplete
    expect(barEl).toBeTruthy()

    const bar = barEl?.shadowRoot?.querySelector('.bar') as HTMLElement
    bar.setPointerCapture = vi.fn()
    bar.releasePointerCapture = vi.fn()

    const rowsChangeSpy = vi.fn()
    chart.addEventListener('rows-change', rowsChangeSpy)

    let finalUpdateDetail: any = null
    chart.addEventListener('task-update', (e: any) => {
      finalUpdateDetail = e.detail
    })

    // 1. ドラッグ開始（x=200, y=100）
    bar.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 200,
        clientY: 100,
        pointerId: 1,
        bubbles: true,
        composed: true,
      }),
    )

    // 2. ドラッグ移動（x=300, y=100）
    window.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: 300,
        clientY: 100,
        pointerId: 1,
        bubbles: true,
      }),
    )
    await new Promise((r) => requestAnimationFrame(r))

    // 3. チャート外でマウスアップ（x=950, y=100 -> right: 900 より外）
    window.dispatchEvent(
      new PointerEvent('pointerup', {
        clientX: 950,
        clientY: 100,
        pointerId: 1,
        bubbles: true,
      }),
    )

    await new Promise((r) => setTimeout(r, 50))

    // 移動がキャンセルされたため rows-change は呼ばれない
    expect(rowsChangeSpy).not.toHaveBeenCalled()

    // 最終イベントは isDragging: false, isCancel: true, isOutside: true
    expect(finalUpdateDetail).toBeTruthy()
    expect(finalUpdateDetail.isDragging).toBe(false)
    expect(finalUpdateDetail.isCancel).toBe(true)
    expect(finalUpdateDetail.isOutside).toBe(true)
    expect(finalUpdateDetail.dx).toBe(0)
    expect(finalUpdateDetail.dy).toBe(0)

    // タスクの開始日・終了日が変わっていないこと
    expect(chart.rows[0].tasks[0].start).toEqual(new Date('2024-01-05T00:00:00'))
  })

  it('handles multi-task drag when moving outside and inside', async () => {
    // 2つのタスクを選択状態にする
    ;(chart as any).selectedTasks = new Set(['task1', 'task2'])
    await chart.updateComplete

    const rows = chart.shadowRoot?.querySelectorAll('gantt-row')
    expect(rows?.length).toBe(2)
    const barEl1 = rows?.[0]?.shadowRoot?.querySelector('gantt-bar')
    const barEl2 = rows?.[1]?.shadowRoot?.querySelector('gantt-bar')
    await barEl1?.updateComplete
    await barEl2?.updateComplete

    const bar1 = barEl1?.shadowRoot?.querySelector('.bar') as HTMLElement
    bar1.setPointerCapture = vi.fn()
    bar1.releasePointerCapture = vi.fn()

    const rowsChangeSpy = vi.fn()
    chart.addEventListener('rows-change', rowsChangeSpy)

    // 1. task1 でドラッグ開始
    bar1.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 200,
        clientY: 100,
        pointerId: 1,
        bubbles: true,
        composed: true,
      }),
    )

    // 2. ドラッグ移動（チャート内: x=300, y=100）
    window.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: 300,
        clientY: 100,
        pointerId: 1,
        bubbles: true,
      }),
    )
    await new Promise((r) => requestAnimationFrame(r))
    expect((chart as any).multiDragDx).toBeGreaterThan(0)

    // 3. チャート外へ移動（x=950, y=100）
    window.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: 950,
        clientY: 100,
        pointerId: 1,
        bubbles: true,
      }),
    )
    await new Promise((r) => requestAnimationFrame(r))
    expect((chart as any).multiDragDx).toBe(0)
    expect((chart as any).multiDragDy).toBe(0)

    // 4. チャート外でドロップ
    window.dispatchEvent(
      new PointerEvent('pointerup', {
        clientX: 950,
        clientY: 100,
        pointerId: 1,
        bubbles: true,
      }),
    )
    await new Promise((r) => setTimeout(r, 50))

    // キャンセルされたので rows-change は発火しない
    expect(rowsChangeSpy).not.toHaveBeenCalled()
  })

  it('resets position and cancels drop when dragging to area where no rows exist (e.g. below all rows)', async () => {
    const rowEls = chart.shadowRoot?.querySelectorAll('gantt-row')
    expect(rowEls?.length).toBe(2)
    const barEl1 = rowEls?.[0]?.shadowRoot?.querySelector('gantt-bar')
    await barEl1?.updateComplete
    expect(barEl1).toBeTruthy()

    const taskGroup = barEl1?.shadowRoot?.querySelector('.task-group') as HTMLElement
    const bar1 = barEl1?.shadowRoot?.querySelector('.bar') as HTMLElement
    bar1.setPointerCapture = vi.fn()
    bar1.releasePointerCapture = vi.fn()

    // 2つの行の getBoundingClientRect をモック
    // row1: top=100, bottom=150
    // row2: top=150, bottom=200
    vi.spyOn(rowEls![0], 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 100,
      right: 900,
      bottom: 150,
      width: 800,
      height: 50,
      x: 100,
      y: 100,
      toJSON: () => {},
    })
    vi.spyOn(rowEls![1], 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 150,
      right: 900,
      bottom: 200,
      width: 800,
      height: 50,
      x: 100,
      y: 150,
      toJSON: () => {},
    })

    const rowsChangeSpy = vi.fn()
    chart.addEventListener('rows-change', rowsChangeSpy)

    const updateEvents: any[] = []
    chart.addEventListener('task-update', (e: any) => {
      updateEvents.push(e.detail)
    })

    // 1. ドラッグ開始（row1内: x=200, y=120）
    bar1.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 200,
        clientY: 120,
        pointerId: 1,
        bubbles: true,
        composed: true,
      }),
    )

    // 2. 有効な行（row2）へドラッグ（x=200, y=170）
    window.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: 200,
        clientY: 170,
        pointerId: 1,
        bubbles: true,
      }),
    )
    await new Promise((r) => requestAnimationFrame(r))
    expect(taskGroup.style.transform).toContain('translate')

    // 3. 行が存在しないエリア（最後の行より下: y=350、ただしチャート内）へドラッグ
    window.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: 200,
        clientY: 350,
        pointerId: 1,
        bubbles: true,
      }),
    )
    await new Promise((r) => requestAnimationFrame(r))

    // 行が存在しないエリアでは元の位置にリセットされる
    expect(taskGroup.style.transform).toBe('')
    const lastEvent = updateEvents[updateEvents.length - 1]
    expect(lastEvent.isOutside).toBe(true)

    // 4. そのままドロップ（y=350）
    window.dispatchEvent(
      new PointerEvent('pointerup', {
        clientX: 200,
        clientY: 350,
        pointerId: 1,
        bubbles: true,
      }),
    )
    await new Promise((r) => setTimeout(r, 50))

    // ドロップはキャンセルされ、rows-change は発火しない
    expect(rowsChangeSpy).not.toHaveBeenCalled()
    // タスクは移動していないこと
    expect(chart.rows[0].tasks.find((t) => t.id === 'task1')).toBeTruthy()
  })
})

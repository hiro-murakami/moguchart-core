import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GanttChartElement } from '../components/gantt-chart'
import '../components/gantt-chart'
import {
  DAYS_PER_MONTH,
  resolveSemanticScale,
  resolveSemanticZoomConfig,
} from '../components/controllers/zoom-controller'
import { xToDate } from '../core/utils'
import type { ZoomChangeEventDetail } from '../core/types'

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

describe('Semantic Zoom (A-3)', () => {
  let element: GanttChartElement

  beforeEach(() => {
    matchMediaMock.mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })

    element = new GanttChartElement()
    element.option = {
      calendar: {
        start: new Date(2026, 3, 1, 0, 0, 0),
        end: new Date(2026, 9, 1, 0, 0, 0),
        pxPerDay: 40,
      },
      rowHeader: {
        width: 120,
      },
      zoom: {
        enabled: true,
        semanticScale: true,
      },
    }
    element.rows = [
      {
        id: 'row-1',
        name: 'Development',
        tasks: [
          {
            id: 'task-1',
            name: 'Feature A',
            start: new Date(2026, 3, 10, 0, 0, 0),
            end: new Date(2026, 3, 25, 0, 0, 0),
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

  it('resolveSemanticZoomConfig と resolveSemanticScale が閾値と許可スケールに応じて適切にスケールを判定する', () => {
    expect(resolveSemanticZoomConfig(undefined)).toBeNull()
    expect(resolveSemanticZoomConfig({ semanticScale: false })).toBeNull()
    expect(resolveSemanticZoomConfig({ semanticScale: { enabled: false } })).toBeNull()

    const defaultCfg = resolveSemanticZoomConfig({ semanticScale: true })!
    expect(defaultCfg.enabled).toBe(true)
    expect(resolveSemanticScale(3, defaultCfg)).toBe('month')
    expect(resolveSemanticScale(12, defaultCfg)).toBe('week')
    expect(resolveSemanticScale(40, defaultCfg)).toBe('day')
    expect(resolveSemanticScale(240, defaultCfg)).toBe('hour')

    const restrictedCfg = resolveSemanticZoomConfig({
      semanticScale: {
        scales: ['week', 'day'],
        thresholds: {
          monthToWeekPxPerDay: 8,
          weekToDayPxPerDay: 25,
          dayToHourPxPerDay: 200,
        },
      },
    })!
    // month 域では最も近い week にフォールバック、hour 域では day にフォールバック
    expect(resolveSemanticScale(4, restrictedCfg)).toBe('week')
    expect(resolveSemanticScale(300, restrictedCfg)).toBe('day')
  })

  it('Day ⇄ Week ⇄ Month ⇄ Hour の連続遷移でヘッダー構造・autoSnapDuration・semanticScale イベントが切り替わる', async () => {
    document.body.appendChild(element)
    await element.updateComplete

    const events: ZoomChangeEventDetail[] = []
    element.addEventListener('zoom-change', (e: Event) => {
      events.push((e as CustomEvent<ZoomChangeEventDetail>).detail)
    })

    // 初期状態: pxPerDay = 40 -> 'day'
    expect(element.activeSemanticScale).toBe('day')
    expect(element.effectiveSnapDuration).toBe(1440)

    // Week スケールへ (eqPxPerDay = 12)
    element.zoomTo(12)
    await element.updateComplete
    expect(element.activeSemanticScale).toBe('week')
    expect(element.effectivePxPerDay).toBeCloseTo(12, 2)
    expect(element.effectivePxPerMonth).toBeUndefined()
    expect(events.at(-1)?.semanticScale).toBe('week')

    // Month スケールへ (eqPxPerDay = 4 -> pxPerMonth モードへ自動切替)
    element.zoomTo(4)
    await element.updateComplete
    expect(element.activeSemanticScale).toBe('month')
    expect(element.effectivePxPerMonth).toBeCloseTo(4 * DAYS_PER_MONTH, 2)
    expect(events.at(-1)?.semanticScale).toBe('month')
    expect(events.at(-1)?.pxPerMonth).toBeCloseTo(4 * DAYS_PER_MONTH, 2)

    const calendarEl = element.shadowRoot?.querySelector('gantt-calendar') as any
    expect(calendarEl?.option?.calendar?.showQuarters).toBe(true)
    expect(calendarEl?.option?.calendar?.showDays).toBe(false)

    // Hour スケールへ (eqPxPerDay = 360 -> showTime: true & snapDuration: 60)
    element.zoomTo(360)
    await element.updateComplete
    expect(element.activeSemanticScale).toBe('hour')
    expect(element.effectivePxPerMonth).toBeUndefined()
    expect(element.effectivePxPerDay).toBeCloseTo(360, 2)
    expect(element.effectiveSnapDuration).toBe(60)
    expect(calendarEl?.option?.calendar?.showTime).toBe(true)
    expect(events.at(-1)?.semanticScale).toBe('hour')

    // resetZoom() で初期 Day スケール (pxPerDay = 40, 100%) に復帰
    element.resetZoom()
    await element.updateComplete
    expect(element.activeSemanticScale).toBe('day')
    expect(element.effectivePxPerDay).toBeCloseTo(40, 2)
    expect(element.zoomPercent).toBe(100)
  })

  it('Ctrl + Wheel でスケール境界（Day ⇄ Month ⇄ Hour）を跨いでもカーソル直下の日時（anchorDate）を維持する', async () => {
    document.body.appendChild(element)
    await element.updateComplete

    const container = element.shadowRoot?.querySelector('.scroll-container') as HTMLElement
    Object.defineProperty(container, 'clientWidth', { value: 1000, configurable: true })
    container.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        right: 1000,
        bottom: 500,
        width: 1000,
        height: 500,
        x: 0,
        y: 0,
        toJSON: () => {},
      }) as DOMRect

    // 初期スクロール位置をタイムライン中盤（約105日先 = 7月中旬）に設定し、
    // 縮小後も newContentX > viewportOffsetX (scrollLeft > 0) となる状態でカーソル直下の日時を記録
    container.scrollLeft = 3900
    const clientX = 420
    const calStart = element.option.calendar.start
    const viewportOffsetX = clientX - element.currentRowHeaderWidth

    const initialAnchorDate = xToDate(
      container.scrollLeft + viewportOffsetX,
      calStart,
      element.effectivePxPerDay,
      element.effectivePxPerMonth,
    )

    // Day (40 px/day) -> Month (4 px/day) へ直接アンカー指定ズーム
    const zoomCtrl = (element as any)._zoomController
    zoomCtrl.zoomSemanticToAtPoint(4, clientX, container)
    await element.updateComplete

    expect(element.activeSemanticScale).toBe('month')
    expect(container.scrollLeft).toBeGreaterThan(0)
    const afterMonthAnchorDate = xToDate(
      container.scrollLeft + viewportOffsetX,
      calStart,
      element.effectivePxPerDay,
      element.effectivePxPerMonth,
    )
    // スケール方式が pxPerDay -> pxPerMonth に切り替わってもカーソル直下の日時が一致すること
    expect(Math.abs(afterMonthAnchorDate.getTime() - initialAnchorDate.getTime())).toBeLessThan(
      5 * 60 * 1000, // xToDate(pxPerMonth) の分単位丸め誤差以内（5分未満）
    )

    // さらに Month (4 px/day) -> Hour (480 px/day) へ拡大しても同じ日時を維持すること
    zoomCtrl.zoomSemanticToAtPoint(480, clientX, container)
    await element.updateComplete

    expect(element.activeSemanticScale).toBe('hour')
    const afterHourAnchorDate = xToDate(
      container.scrollLeft + viewportOffsetX,
      calStart,
      element.effectivePxPerDay,
      element.effectivePxPerMonth,
    )
    expect(Math.abs(afterHourAnchorDate.getTime() - initialAnchorDate.getTime())).toBeLessThan(
      5 * 60 * 1000, // 5分未満
    )

    // Ctrl + Wheel イベントでも連続ズームが発火すること
    const prevEq = element.effectivePxPerDay
    container.dispatchEvent(
      new WheelEvent('wheel', {
        deltaY: -100,
        ctrlKey: true,
        clientX,
        bubbles: true,
        cancelable: true,
      }),
    )
    await element.updateComplete
    expect(element.effectivePxPerDay).toBeGreaterThan(prevEq)
  })

  it('zoom-change 後に親コンポーネントが同一カレンダー設定の新規 option オブジェクトを再代入してもズーム状態がリセットされない', async () => {
    document.body.appendChild(element)
    await element.updateComplete

    element.zoomTo(240)
    await element.updateComplete
    expect(element.activeSemanticScale).toBe('hour')

    // React / Vue / Demo の再レンダリングを模倣して新しいオブジェクト参照を代入
    element.option = {
      ...element.option,
      calendar: { ...element.option.calendar },
      zoom: {
        enabled: true,
        semanticScale: true,
      },
    }
    await element.updateComplete

    expect(element.activeSemanticScale).toBe('hour')
    expect(element.effectivePxPerDay).toBeCloseTo(240, 2)
  })
})

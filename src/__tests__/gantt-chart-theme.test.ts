import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GanttChartElement } from '@/components/gantt-chart'
import '@/components/gantt-chart'

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

describe('GanttChartElement Theme', () => {
  let element: GanttChartElement
  let mediaQueryListMock: any
  let listener: (e: any) => void

  beforeEach(() => {
    // モックのリセット
    listener = () => {}
    mediaQueryListMock = {
      matches: false,
      addEventListener: vi.fn((event, callback) => {
        if (event === 'change') listener = callback
      }),
      removeEventListener: vi.fn(),
    }
    matchMediaMock.mockReturnValue(mediaQueryListMock)

    element = new GanttChartElement()
    // optionの初期化 (必須プロパティのみ)
    element.option = {
      calendar: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
        pxPerDay: 50,
      },
      // themeは未指定
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('uses system theme when option.theme is undefined (Dark mode)', async () => {
    // システムをダークモードに設定
    mediaQueryListMock.matches = true

    document.body.appendChild(element)
    await element.updateComplete

    expect(element.theme).toBe('dark')

    document.body.removeChild(element)
  })

  it('uses system theme when option.theme is undefined (Light mode)', async () => {
    // システムをライトモードに設定
    mediaQueryListMock.matches = false

    document.body.appendChild(element)
    await element.updateComplete

    expect(element.theme).toBe('light')

    document.body.removeChild(element)
  })

  it('respects option.theme if defined (Option: Light, System: Dark)', async () => {
    // システムはダーク
    mediaQueryListMock.matches = true
    // オプションはライト
    element.option = { ...element.option, theme: 'light' }

    document.body.appendChild(element)
    await element.updateComplete

    expect(element.theme).toBe('light')

    document.body.removeChild(element)
  })

  it('updates theme when system theme changes (if option.theme is undefined)', async () => {
    // 最初はライト
    mediaQueryListMock.matches = false

    document.body.appendChild(element)
    await element.updateComplete
    expect(element.theme).toBe('light')

    // システムがダークに変更
    listener({ matches: true } as any)

    await element.updateComplete
    expect(element.theme).toBe('dark')

    document.body.removeChild(element)
  })

  it('does NOT update theme when system theme changes (if option.theme is defined)', async () => {
    // オプションでライト指定
    element.option = { ...element.option, theme: 'light' }
    // システムはダーク
    mediaQueryListMock.matches = true

    document.body.appendChild(element)
    await element.updateComplete
    expect(element.theme).toBe('light')

    // システムがライトに変更（通知はくるが無視すべき）
    listener({ matches: false } as any)

    await element.updateComplete
    expect(element.theme).toBe('light')

    document.body.removeChild(element)
  })

  it('updates theme when option.theme is set dynamically', async () => {
    // システムはダーク
    mediaQueryListMock.matches = true

    document.body.appendChild(element)
    await element.updateComplete
    expect(element.theme).toBe('dark')

    // オプションでライトを指定
    element.option = { ...element.option, theme: 'light' }
    await element.updateComplete
    expect(element.theme).toBe('light') // ここでwillUpdateが走るはず

    document.body.removeChild(element)
  })

  it('reverts to system theme when option.theme becomes undefined', async () => {
    // システムはダーク
    mediaQueryListMock.matches = true

    // オプションでライト指定
    element.option = { ...element.option, theme: 'light' }
    document.body.appendChild(element)
    await element.updateComplete
    expect(element.theme).toBe('light')

    // オプションのthemeを削除 (undefinedにする)
    const newOption = { ...element.option }
    delete newOption.theme
    element.option = newOption

    await element.updateComplete
    expect(element.theme).toBe('dark') // システムテーマに戻るべき

    document.body.removeChild(element)
  })

  it('uses system theme when option.theme is "system"', async () => {
    // システムはダーク
    mediaQueryListMock.matches = true
    // オプションでsystem指定
    element.option = { ...element.option, theme: 'system' }

    document.body.appendChild(element)
    await element.updateComplete
    expect(element.theme).toBe('dark')

    // システムがライトに変更
    listener({ matches: false } as any)
    await element.updateComplete
    expect(element.theme).toBe('light')

    document.body.removeChild(element)
  })

  it('uses system theme when option.theme is invalid value (as any)', async () => {
    // システムはライト
    mediaQueryListMock.matches = false
    // オプションで無効な値指定
    element.option = { ...element.option, theme: 'invalid' as any }

    document.body.appendChild(element)
    await element.updateComplete
    expect(element.theme).toBe('light')

    document.body.removeChild(element)
  })
})

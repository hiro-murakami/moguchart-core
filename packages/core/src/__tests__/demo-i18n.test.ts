import { describe, expect, it } from 'vitest'
import { getInitialLang } from '../demo/i18n'

describe('getInitialLang (demo i18n)', () => {
  it('?lang=en の場合に en を返す', () => {
    expect(getInitialLang('?lang=en')).toBe('en')
    expect(getInitialLang('?foo=bar&lang=en&baz=1')).toBe('en')
  })

  it('?lang=ja の場合に ja を返す', () => {
    expect(getInitialLang('?lang=ja')).toBe('ja')
    expect(getInitialLang('?foo=bar&lang=ja')).toBe('ja')
  })

  it('lang パラメータが未指定の場合はデフォルト ja を返す', () => {
    expect(getInitialLang('')).toBe('ja')
    expect(getInitialLang('?')).toBe('ja')
    expect(getInitialLang('?mode=day')).toBe('ja')
  })

  it('未サポートの言語コードの場合はデフォルト ja を返す', () => {
    expect(getInitialLang('?lang=fr')).toBe('ja')
    expect(getInitialLang('?lang=zh')).toBe('ja')
    expect(getInitialLang('?lang=')).toBe('ja')
  })
})

describe('DemoTexts (collapse/expand)', () => {
  it('jaTexts と enTexts に折りたたみ・展開テキストが定義されている', async () => {
    const { jaTexts, enTexts } = await import('../demo/i18n')
    expect(jaTexts.collapseAll).toBe('折りたたみ')
    expect(jaTexts.collapseAllTitle).toBe('親行を一括折りたたみ')
    expect(jaTexts.expandAll).toBe('展開')
    expect(jaTexts.expandAllTitle).toBe('すべての行を展開')

    expect(enTexts.collapseAll).toBe('Collapse')
    expect(enTexts.collapseAllTitle).toBe('Collapse all parent rows')
    expect(enTexts.expandAll).toBe('Expand')
    expect(enTexts.expandAllTitle).toBe('Expand all rows')

    expect(jaTexts.showSummaryProgressLabel).toBe('サマリー進捗ラベル表示')
    expect(enTexts.showSummaryProgressLabel).toBe('Show Summary Progress Label')

    expect(jaTexts.zoomLevel).toBe('表示倍率:')
    expect(enTexts.zoomLevel).toBe('Zoom:')

    expect(jaTexts.resetZoom).toBe('100%に戻す')
    expect(enTexts.resetZoom).toBe('Reset 100%')
  })
})


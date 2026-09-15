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

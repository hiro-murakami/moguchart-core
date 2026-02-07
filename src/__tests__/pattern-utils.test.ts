import { describe, it, expect } from 'vitest'
import { getPatternStyle } from '../pattern-utils'

describe('getPatternStyle', () => {
  it('returns empty string when pattern is undefined', () => {
    expect(getPatternStyle(undefined)).toBe('')
  })

  it('returns empty string when pattern type is undefined', () => {
    // @ts-expect-error Testing invalid input
    expect(getPatternStyle({})).toBe('')
  })

  it('uses default color when not provided', () => {
    const result = getPatternStyle({ type: 'diagonal-stripe' })
    expect(result).toContain('rgba(255, 255, 255, 0.3)')
  })

  it('uses provided color', () => {
    const result = getPatternStyle({
      type: 'diagonal-stripe',
      color: '#ff0000',
    })
    expect(result).toContain('#ff0000')
  })

  it('uses specific default size for dots pattern', () => {
    const result = getPatternStyle({ type: 'dots' })
    expect(result).toContain('6px 6px')
  })

  describe('pattern types', () => {
    it('diagonal-stripe', () => {
      const result = getPatternStyle({ type: 'diagonal-stripe' })
      expect(result).toContain('linear-gradient(45deg')
    })

    it('diagonal-stripe-thin', () => {
      const result = getPatternStyle({ type: 'diagonal-stripe-thin' })
      expect(result).toContain('linear-gradient(45deg')
      expect(result).toContain('4px 4px')
    })
    it('diagonal-stripe-thick', () => {
      const result = getPatternStyle({ type: 'diagonal-stripe-thick' })
      expect(result).toContain('linear-gradient(45deg')
      expect(result).toContain('16px 16px')
    })
    it('dots-dense', () => {
      const result = getPatternStyle({ type: 'dots-dense' })
      expect(result).toContain('radial-gradient')
      expect(result).toContain('4px 4px')
    })

    it('diagonal-stripe-reverse', () => {
      const result = getPatternStyle({ type: 'diagonal-stripe-reverse' })
      expect(result).toContain('linear-gradient(135deg')
    })

    it('vertical-stripe', () => {
      const result = getPatternStyle({ type: 'vertical-stripe' })
      expect(result).toContain('linear-gradient(90deg')
    })

    it('horizontal-stripe', () => {
      const result = getPatternStyle({ type: 'horizontal-stripe' })
      expect(result).toContain('linear-gradient(0deg')
    })

    it('checkerboard', () => {
      const result = getPatternStyle({ type: 'checkerboard' })
      expect(result).toContain('linear-gradient(45deg')
      expect(result).toContain('background-position:')
    })

    it('dots', () => {
      const result = getPatternStyle({ type: 'dots' })
      expect(result).toContain('radial-gradient')
    })

    it('triangle', () => {
      const result = getPatternStyle({ type: 'triangle' })
      expect(result).toContain('conic-gradient')
    })

    it('circle', () => {
      const result = getPatternStyle({ type: 'circle' })
      expect(result).toContain('radial-gradient(circle')
    })

    it('grid', () => {
      const result = getPatternStyle({ type: 'grid' })
      expect(result).toContain('linear-gradient')
      expect(result).toContain('90deg')
    })

    it('diagonal-grid', () => {
      const result = getPatternStyle({ type: 'diagonal-grid' })
      expect(result).toContain('linear-gradient(45deg')
      expect(result).toContain('linear-gradient(135deg')
    })
  })
})

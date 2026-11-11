import { describe, it, expect } from 'vitest'
import {
  MAX_CALENDAR_DAYS,
  getTotalDays,
  getThemeColors,
  getCalendarColor,
  sanitizeCssValue,
  sanitizeInlineStyle,
} from '../core/utils'
import { THEME_COLORS } from '../core/theme'
import { getPatternStyle } from '../core/patterns'
import {
  isUnsafePropertyKey,
  getGridCellValue,
  applyGridCellEdit,
  sanitizeSpreadsheetFormula,
  formatGridRangeToTsv,
  parseTsvString,
  normalizeGridColumns,
} from '../core/grid'
import { jaLocale } from '../core/i18n'
import type { GanttColumn, GanttRow } from '../core/types'

describe('Security Hardening (CORE-M01 / M02 / M03 / L01)', () => {
  describe('[CORE-M03] CSS value & inline style sanitization', () => {
    it('allows valid CSS color values and gradients while blocking injection payloads', () => {
      expect(sanitizeCssValue('#3b82f6', '#000')).toBe('#3b82f6')
      expect(sanitizeCssValue('rgba(59, 130, 246, 0.8)', '#000')).toBe('rgba(59, 130, 246, 0.8)')
      expect(sanitizeCssValue('var(--brand-primary)', '#000')).toBe('var(--brand-primary)')

      expect(sanitizeCssValue('red; } :host { display: none', '#000')).toBe('#000')
      expect(sanitizeCssValue('url(https://evil.example/ping)', '#000')).toBe('#000')
      expect(sanitizeCssValue('expression(alert(1))', '#000')).toBe('#000')
      expect(sanitizeCssValue('red /* comment */', '#000')).toBe('#000')
      expect(sanitizeCssValue('red\nbackground: blue', '#000')).toBe('#000')
    })

    it('sanitizes inline style declarations and blocks fixed/sticky UI redressing', () => {
      expect(
        sanitizeInlineStyle('background-color: #ef5350; border-radius: 6px; opacity: 0.85;'),
      ).toBe('background-color: #ef5350; border-radius: 6px; opacity: 0.85')

      expect(
        sanitizeInlineStyle(
          'background-color: #10b981; background-image: url(https://evil.example/track); position: fixed; inset: 0;',
        ),
      ).toBe('background-color: #10b981; inset: 0')

      expect(sanitizeInlineStyle('color: red; } .bar { display: none')).toBe('')
    })

    it('sanitizes customTheme, holiday colors, and pattern colors', () => {
      const palette = getThemeColors('light', {
        bg: '#ffffff',
        border: 'red; } * { visibility: hidden',
      })
      expect(palette.bg).toBe('#ffffff')
      expect(palette.border).toBe(THEME_COLORS.light.border)

      const holidayColor = getCalendarColor(
        new Date(2026, 0, 1),
        THEME_COLORS.light,
        () => ({ isHoliday: true, color: 'url(https://evil.example/leak)' }),
      )
      expect(holidayColor).toBe(THEME_COLORS.light.holiday)

      const patternCss = getPatternStyle({
        type: 'diagonal-stripe',
        color: 'red); background-image: url(https://evil.example/x',
      })
      expect(patternCss).not.toContain('evil.example')
      expect(patternCss).toContain('rgba(255, 255, 255, 0.3)')
    })
  })

  describe('[CORE-M02] Extreme / invalid calendar date range bounds', () => {
    it('clamps extreme date spans and returns 0 on invalid or inverted dates', () => {
      expect(getTotalDays(new Date('invalid'), new Date(2026, 0, 10))).toBe(0)
      expect(getTotalDays(new Date(2026, 0, 10), new Date(2026, 0, 1))).toBe(0)
      expect(getTotalDays(new Date('0001-01-01T00:00:00Z'), new Date('9999-12-31T00:00:00Z'))).toBe(
        MAX_CALENDAR_DAYS,
      )
    })
  })

  describe('[CORE-L01] Prototype pollution guards in grid column fields & setters', () => {
    it('blocks __proto__, constructor, and prototype in column.field and valueSetter', () => {
      expect(isUnsafePropertyKey('__proto__')).toBe(true)
      expect(isUnsafePropertyKey('constructor')).toBe(true)
      expect(isUnsafePropertyKey('prototype')).toBe(true)
      expect(isUnsafePropertyKey('assignee')).toBe(false)

      const row: GanttRow = { id: 'r1', name: 'Row 1', tasks: [] }
      const protoCol: GanttColumn = { id: 'customProto', field: '__proto__', editable: true }

      expect(getGridCellValue(protoCol, row, [])).toBeUndefined()
      const res = applyGridCellEdit(protoCol, row, { polluted: 'yes' } as any)
      expect(res.changed).toBe(false)
      expect(({} as any).polluted).toBeUndefined()

      const setterCol: GanttColumn = {
        id: 'customSetter',
        editable: true,
        valueSetter: () => JSON.parse('{"__proto__":{"pollutedSetter":true},"safeField":"ok"}'),
      }
      applyGridCellEdit(setterCol, row, 'input')
      expect(({} as any).pollutedSetter).toBeUndefined()
      expect((row as any).safeField).toBe('ok')
    })
  })

  describe('[CORE-M01] TSV formula injection sanitization & lossless internal round-trip', () => {
    it('escapes formula triggers while preserving signed numbers and internal paste round-trips', () => {
      expect(sanitizeSpreadsheetFormula("=CMD|' /C calc'!A0")).toBe("'=CMD|' /C calc'!A0")
      expect(sanitizeSpreadsheetFormula('+SUM(A1:A2)')).toBe("'+SUM(A1:A2)")
      expect(sanitizeSpreadsheetFormula('-2+3')).toBe("'-2+3")
      expect(sanitizeSpreadsheetFormula('@SUM(A1)')).toBe("'@SUM(A1)")
      expect(sanitizeSpreadsheetFormula('  =HYPERLINK("https://evil.example")')).toBe(
        '\'  =HYPERLINK("https://evil.example")',
      )

      // Safe numeric values and standalone dash placeholder must remain untouched
      expect(sanitizeSpreadsheetFormula('-')).toBe('-')
      expect(sanitizeSpreadsheetFormula('-12.5')).toBe('-12.5')
      expect(sanitizeSpreadsheetFormula('+100%')).toBe('+100%')

      const cols = normalizeGridColumns([{ id: 'name' }], jaLocale)
      const rows: GanttRow[] = [
        { id: 'r1', name: '=SUM(1,2)', tasks: [] },
        { id: 'r2', name: '+Phase 1', tasks: [] },
      ]
      const { tsv } = formatGridRangeToTsv(rows, cols, {
        start: { rowId: 'r1', columnId: 'name' },
        end: { rowId: 'r2', columnId: 'name' },
      })
      expect(tsv).toBe("'=SUM(1,2)\n'+Phase 1")

      // Internal paste unescapes cleanly back to original task names
      expect(parseTsvString(tsv)).toEqual([['=SUM(1,2)'], ['+Phase 1']])
    })
  })
})

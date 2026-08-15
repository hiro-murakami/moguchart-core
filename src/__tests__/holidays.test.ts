import { describe, expect, it } from 'vitest'
import { isHoliday } from '../demo/holidays'

describe('isHoliday (demo)', () => {
  it('固定祝日を正しく判定できる', () => {
    expect(isHoliday(new Date(2026, 0, 1))).toBe(true) // 2026-01-01 元日
    expect(isHoliday(new Date(2026, 1, 11))).toBe(true) // 2026-02-11 建国記念の日
    expect(isHoliday(new Date(2026, 4, 3))).toBe(true) // 2026-05-03 憲法記念日
    expect(isHoliday(new Date(2026, 10, 3))).toBe(true) // 2026-11-03 文化の日
  })

  it('ハッピーマンデーを正しく判定できる', () => {
    expect(isHoliday(new Date(2026, 0, 12))).toBe(true) // 2026-01-12 成人の日 (第2月曜)
    expect(isHoliday(new Date(2026, 6, 20))).toBe(true) // 2026-07-20 海の日 (第3月曜)
    expect(isHoliday(new Date(2026, 8, 21))).toBe(true) // 2026-09-21 敬老の日 (第3月曜)
    expect(isHoliday(new Date(2026, 9, 12))).toBe(true) // 2026-10-12 スポーツの日 (第2月曜)
  })

  it('振替休日を正しく判定できる', () => {
    // 2026-05-03は日曜日(憲法記念日) -> 2026-05-06が振替休日
    expect(isHoliday(new Date(2026, 4, 6))).toBe(true)
  })

  it('国民の休日や9月の平日常判定でスタックオーバーフローが発生しない', () => {
    // 9月の平日すべてに対して呼んでもエラーが発生しないこと
    for (let day = 1; day <= 30; day++) {
      expect(() => isHoliday(new Date(2026, 8, day))).not.toThrow()
    }
  })

  it('平日を祝日と判定しない', () => {
    expect(isHoliday(new Date(2026, 0, 2))).toBe(false) // 2026-01-02
    expect(isHoliday(new Date(2026, 5, 10))).toBe(false) // 2026-06-10
  })
})

import { describe, it, expect, vi, afterEach } from 'vitest'
import { throttle, formatCalendarDate } from '../core/utils'

describe('zero-deps utilities', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  describe('throttle', () => {
    it('executes immediately on leading edge and batches trailing calls', () => {
      vi.useFakeTimers()
      const spy = vi.fn()
      const fn = throttle(spy, 100)

      fn('a')
      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy).toHaveBeenLastCalledWith('a')

      vi.advanceTimersByTime(30)
      fn('b')
      vi.advanceTimersByTime(30)
      fn('c')
      expect(spy).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(40)
      expect(spy).toHaveBeenCalledTimes(2)
      expect(spy).toHaveBeenLastCalledWith('c')
    })

    it('cancels pending trailing execution via .cancel()', () => {
      vi.useFakeTimers()
      const spy = vi.fn()
      const fn = throttle(spy, 100)

      fn(1)
      fn(2)
      expect(spy).toHaveBeenCalledTimes(1)

      fn.cancel()
      vi.advanceTimersByTime(200)
      expect(spy).toHaveBeenCalledTimes(1)

      // After cancel, next call runs immediately again
      fn(3)
      expect(spy).toHaveBeenCalledTimes(2)
      expect(spy).toHaveBeenLastCalledWith(3)
    })

    it('flushes pending trailing execution immediately via .flush()', () => {
      vi.useFakeTimers()
      const spy = vi.fn()
      const fn = throttle(spy, 100)

      fn('first')
      fn('second')
      expect(spy).toHaveBeenCalledTimes(1)

      fn.flush()
      expect(spy).toHaveBeenCalledTimes(2)
      expect(spy).toHaveBeenLastCalledWith('second')
    })
  })

  describe('formatCalendarDate', () => {
    it('formats Japanese and English month patterns identically to dayjs', () => {
      const jan = new Date(2026, 0, 5, 9, 4, 7)
      const nov = new Date(2026, 10, 14, 15, 30, 0)

      expect(formatCalendarDate(jan, 'YYYY年M月')).toBe('2026年1月')
      expect(formatCalendarDate(nov, 'YYYY年MM月')).toBe('2026年11月')
      expect(formatCalendarDate(jan, 'M月')).toBe('1月')
      expect(formatCalendarDate(jan, 'MMM YYYY')).toBe('Jan 2026')
      expect(formatCalendarDate(nov, 'MMMM YYYY')).toBe('November 2026')
      expect(formatCalendarDate(jan, 'MMM')).toBe('Jan')
      expect(formatCalendarDate(jan, 'YY/MM/DD HH:mm:ss')).toBe('26/01/05 09:04:07')
      expect(formatCalendarDate(nov, 'hh:mm A')).toBe('03:30 PM')
    })

    it('preserves escaped literal segments without replacing token letters inside brackets', () => {
      const may = new Date(2026, 4, 1) // May 2026
      expect(formatCalendarDate(may, 'MMMM [of Year] YYYY [M]')).toBe('May of Year 2026 M')
    })

    it('returns empty string for invalid Date', () => {
      expect(formatCalendarDate(new Date('invalid'), 'YYYY/MM')).toBe('')
    })
  })
})

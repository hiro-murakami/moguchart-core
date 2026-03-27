import { describe, it, expect } from 'vitest'
import { jaLocale, enLocale } from '@/i18n'
import { formatDuration } from '@/utils'

describe('i18n', () => {
  describe('jaLocale', () => {
    it('formats duration with days, hours, and minutes', () => {
      const start = new Date('2024-01-01T00:00:00')
      const end = new Date('2024-01-04T02:30:00') // 3日2時間30分
      expect(formatDuration(start, end, jaLocale)).toBe('3日2時間30分')
    })

    it('formats duration with only days', () => {
      const start = new Date('2024-01-01T00:00:00')
      const end = new Date('2024-01-06T00:00:00') // 5日
      expect(formatDuration(start, end, jaLocale)).toBe('5日')
    })

    it('formats zero duration', () => {
      const start = new Date('2024-01-01T00:00:00')
      expect(formatDuration(start, start, jaLocale)).toBe('0分')
    })

    it('tooltip.duration formats correctly', () => {
      expect(jaLocale.tooltip.duration(5)).toBe('所要日数: 5日')
    })

    it('dragOverlay.noTitle returns Japanese text', () => {
      expect(jaLocale.dragOverlay.noTitle).toBe('タイトルなし')
    })

    it('dragOverlay.moveTo formats correctly', () => {
      expect(jaLocale.dragOverlay.moveTo('Row1')).toBe('移動先: Row1')
    })

    it('dragOverlay.movingTasks formats correctly', () => {
      expect(jaLocale.dragOverlay.movingTasks(3)).toBe('3件のタスクを移動中')
    })

    it('monthFormat is Japanese format', () => {
      expect(jaLocale.monthFormat).toBe('YYYY年M月')
    })

    it('dateFormat formats date in YYYY/M/D', () => {
      expect(jaLocale.dateFormat(new Date(2024, 0, 15))).toBe('2024/1/15')
      expect(jaLocale.dateFormat(new Date(2024, 11, 3))).toBe('2024/12/3')
    })

    it('dateTimeFormat returns date only when time is 00:00', () => {
      expect(jaLocale.dateTimeFormat(new Date(2024, 0, 15, 0, 0))).toBe('2024/1/15')
    })

    it('dateTimeFormat includes time when not 00:00', () => {
      expect(jaLocale.dateTimeFormat(new Date(2024, 0, 15, 9, 5))).toBe('2024/1/15 09:05')
      expect(jaLocale.dateTimeFormat(new Date(2024, 0, 15, 14, 30))).toBe('2024/1/15 14:30')
    })
  })

  describe('enLocale', () => {
    it('formats duration with days, hours, and minutes', () => {
      const start = new Date('2024-01-01T00:00:00')
      const end = new Date('2024-01-04T02:30:00') // 3 days 2 hours 30 minutes
      expect(formatDuration(start, end, enLocale)).toBe('3 days2 hours30 minutes')
    })

    it('formats singular day, hour, minute', () => {
      const start = new Date('2024-01-01T00:00:00')
      const end = new Date('2024-01-02T01:01:00') // 1 day 1 hour 1 minute
      expect(formatDuration(start, end, enLocale)).toBe('1 day1 hour1 minute')
    })

    it('formats duration with only days', () => {
      const start = new Date('2024-01-01T00:00:00')
      const end = new Date('2024-01-06T00:00:00') // 5 days
      expect(formatDuration(start, end, enLocale)).toBe('5 days')
    })

    it('formats zero duration', () => {
      const start = new Date('2024-01-01T00:00:00')
      expect(formatDuration(start, start, enLocale)).toBe('0 minutes')
    })

    it('tooltip.duration formats correctly with plural', () => {
      expect(enLocale.tooltip.duration(5)).toBe('Duration: 5 days')
    })

    it('tooltip.duration formats correctly with singular', () => {
      expect(enLocale.tooltip.duration(1)).toBe('Duration: 1 day')
    })

    it('dragOverlay.noTitle returns English text', () => {
      expect(enLocale.dragOverlay.noTitle).toBe('No Title')
    })

    it('dragOverlay.moveTo formats correctly', () => {
      expect(enLocale.dragOverlay.moveTo('Row1')).toBe('Move to: Row1')
    })

    it('dragOverlay.movingTasks formats correctly with plural', () => {
      expect(enLocale.dragOverlay.movingTasks(3)).toBe('Moving 3 tasks')
    })

    it('dragOverlay.movingTasks formats correctly with singular', () => {
      expect(enLocale.dragOverlay.movingTasks(1)).toBe('Moving 1 task')
    })

    it('monthFormat is English format', () => {
      expect(enLocale.monthFormat).toBe('MMM YYYY')
    })

    it('dateFormat formats date in M/D/YYYY', () => {
      expect(enLocale.dateFormat(new Date(2024, 0, 15))).toBe('1/15/2024')
      expect(enLocale.dateFormat(new Date(2024, 11, 3))).toBe('12/3/2024')
    })

    it('dateTimeFormat returns date only when time is 00:00', () => {
      expect(enLocale.dateTimeFormat(new Date(2024, 0, 15, 0, 0))).toBe('1/15/2024')
    })

    it('dateTimeFormat includes time when not 00:00', () => {
      expect(enLocale.dateTimeFormat(new Date(2024, 0, 15, 9, 5))).toBe('1/15/2024 09:05')
      expect(enLocale.dateTimeFormat(new Date(2024, 0, 15, 14, 30))).toBe('1/15/2024 14:30')
    })
  })

  describe('formatDuration backward compatibility', () => {
    it('defaults to Japanese locale when no locale specified', () => {
      const start = new Date('2024-01-01T00:00:00')
      const end = new Date('2024-01-04T02:30:00')
      expect(formatDuration(start, end)).toBe('3日2時間30分')
    })
  })
})

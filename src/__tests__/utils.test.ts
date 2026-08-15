import { describe, it, expect } from 'vitest'
import {
  dateToX,
  calculateTaskLanes,
  getThemeColors,
  getCalendarColor,
} from '../core/utils'
import { THEME_COLORS } from '../core/theme'
import type { GanttTask } from '../core/types'

describe('utils', () => {
  describe('dateToX', () => {
    it('calculates x position correctly', () => {
      const start = new Date('2024-01-01T00:00:00')
      const target = new Date('2024-01-02T00:00:00')
      const pxPerDay = 50
      expect(dateToX(target, start, pxPerDay)).toBe(50)
    })

    it('returns 0 for same date', () => {
      const start = new Date('2024-01-01T00:00:00')
      const pxPerDay = 50
      expect(dateToX(start, start, pxPerDay)).toBe(0)
    })

    it('handles partial days', () => {
      const start = new Date('2024-01-01T00:00:00')
      const target = new Date('2024-01-01T12:00:00') // 0.5 days
      const pxPerDay = 50
      expect(dateToX(target, start, pxPerDay)).toBe(25)
    })
  })

  describe('calculateTaskLanes', () => {
    const createTask = (
      id: string,
      startStr: string,
      endStr: string,
    ): GanttTask => ({
      id,
      start: new Date(startStr),
      end: new Date(endStr),
      name: 'Task',
    })

    it('returns empty result for empty tasks', () => {
      const result = calculateTaskLanes([])
      expect(result.tasksWithLanes).toEqual([])
      expect(result.laneCount).toBe(1)
    })

    it('assigns lane 0 for non-overlapping tasks', () => {
      const tasks = [
        createTask('1', '2024-01-01', '2024-01-05'),
        createTask('2', '2024-01-06', '2024-01-10'),
      ]
      const result = calculateTaskLanes(tasks)
      expect(result.laneCount).toBe(1)
      expect(result.tasksWithLanes.find((t) => t.id === '1')?.lane).toBe(0)
      expect(result.tasksWithLanes.find((t) => t.id === '2')?.lane).toBe(0)
    })

    it('assigns new lane for overlapping tasks', () => {
      const tasks = [
        createTask('1', '2024-01-01', '2024-01-10'),
        createTask('2', '2024-01-05', '2024-01-15'), // Overlaps with 1
      ]
      const result = calculateTaskLanes(tasks)
      expect(result.laneCount).toBe(2)
      // Sorted by start date, so 1 is processed first (lane 0), then 2 (lane 1)
      expect(result.tasksWithLanes.find((t) => t.id === '1')?.lane).toBe(0)
      expect(result.tasksWithLanes.find((t) => t.id === '2')?.lane).toBe(1)
    })

    it('reuses freed lanes', () => {
      const tasks = [
        createTask('1', '2024-01-01', '2024-01-05'),
        createTask('2', '2024-01-01', '2024-01-10'), // Overlaps 1
        createTask('3', '2024-01-06', '2024-01-15'), // Can reuse lane of 1
      ]
      const result = calculateTaskLanes(tasks)
      expect(result.laneCount).toBe(2)

      // Task 1: lane 0 (ends 01-05)
      // Task 2: lane 1 (ends 01-10)
      // Task 3: starts 01-06, fits in lane 0
      expect(result.tasksWithLanes.find((t) => t.id === '1')?.lane).toBe(0)
      expect(result.tasksWithLanes.find((t) => t.id === '2')?.lane).toBe(1)
      expect(result.tasksWithLanes.find((t) => t.id === '3')?.lane).toBe(0)
    })
  })

  describe('getThemeColors', () => {
    it('returns light theme by default', () => {
      const colors = getThemeColors('light')
      expect(colors.bg).toBe(THEME_COLORS.light.bg)
    })

    it('returns dark theme', () => {
      const colors = getThemeColors('dark')
      expect(colors.bg).toBe(THEME_COLORS.dark.bg)
    })

    it('merges custom theme', () => {
      const custom = { bg: '#ff0000' }
      const colors = getThemeColors('light', custom)
      expect(colors.bg).toBe('#ff0000')
      expect(colors.text).toBe(THEME_COLORS.light.text) // Should keep other props
    })
  })

  describe('getCalendarColor', () => {
    const colors = THEME_COLORS.light

    it('returns saturday color', () => {
      const date = new Date('2024-01-06') // Saturday
      expect(getCalendarColor(date, colors)).toBe(colors.saturday)
    })

    it('returns sunday color', () => {
      const date = new Date('2024-01-07') // Sunday
      expect(getCalendarColor(date, colors)).toBe(colors.sunday)
    })

    it('returns holiday color', () => {
      const date = new Date('2024-01-01') // Holiday
      const isHoliday = (d: Date) =>
        d.getFullYear() === 2024 && d.getMonth() === 0 && d.getDate() === 1
      expect(getCalendarColor(date, colors, isHoliday)).toBe(colors.holiday)
    })

    it('prioritizes holiday over sunday', () => {
      const date = new Date('2024-05-05') // Sunday and Holiday
      const isHoliday = (d: Date) =>
        d.getFullYear() === 2024 && d.getMonth() === 4 && d.getDate() === 5
      expect(getCalendarColor(date, colors, isHoliday)).toBe(colors.holiday)
    })

    it('returns empty string for normal weekday', () => {
      const date = new Date('2024-01-04') // Thursday (Not holiday)
      expect(getCalendarColor(date, colors)).toBe('')
    })

    it('returns custom weekday color if defined', () => {
      const customColors = { ...colors, wednesday: '#abcdef' }
      const date = new Date('2024-01-03') // Wednesday
      expect(getCalendarColor(date, customColors)).toBe('#abcdef')
    })

    it('uses custom holiday logic', () => {
      const date = new Date('2024-01-04') // Thursday (Not holiday)
      const customIsHoliday = () => true
      expect(getCalendarColor(date, colors, customIsHoliday)).toBe(
        colors.holiday,
      )
    })
  })
})

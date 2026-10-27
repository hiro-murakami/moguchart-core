import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  countWorkingDays,
  addWorkingDays,
  createCustomHolidayResolver,
  propagateAutoSchedule,
} from '../core/auto-schedule'
import {
  calculateTaskLanes,
  getCalendarColor,
  getThemeColors,
  isMilestoneTask,
} from '../core/utils'
import {
  normalizeGridColumns,
  getGridCellValue,
  formatGridCellValue,
  calculateRowSummaryDates,
  isGridCellEditable,
  applyGridCellEdit,
} from '../core/grid'
import { jaLocale, enLocale } from '../core/i18n'
import type { GanttChartOption, GanttRow, GanttTask } from '../core/types'
import '../components/gantt-chart'
import '../components/gantt-bar'
import type { GanttChartElement } from '../components/gantt-chart'
import type { GanttBarElement } from '../components/gantt-bar'

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any
}

describe('v1.7.0 New Features', () => {
  // =========================================================================
  // Phase 1: Task-level Milestones (task.type === 'milestone')
  // =========================================================================
  describe('Phase 1: Task-level Milestones', () => {
    it('identifies milestone tasks via isMilestoneTask', () => {
      const milestone: GanttTask = {
        id: 'm1',
        name: 'Release v1.7',
        start: new Date(2025, 4, 10),
        end: new Date(2025, 4, 10),
        type: 'milestone',
      }
      const normal: GanttTask = {
        id: 't1',
        name: 'Dev',
        start: new Date(2025, 4, 1),
        end: new Date(2025, 4, 10),
      }
      expect(isMilestoneTask(milestone)).toBe(true)
      expect(isMilestoneTask(normal)).toBe(false)
      expect(isMilestoneTask(null)).toBe(false)
    })

    it('separates colliding milestones at the exact same timestamp into different lanes', () => {
      const m1: GanttTask = {
        id: 'm1',
        name: 'M1',
        start: new Date(2025, 4, 10),
        end: new Date(2025, 4, 10),
        type: 'milestone',
      }
      const m2: GanttTask = {
        id: 'm2',
        name: 'M2',
        start: new Date(2025, 4, 10),
        end: new Date(2025, 4, 10),
        type: 'milestone',
      }
      const m3: GanttTask = {
        id: 'm3',
        name: 'M3',
        start: new Date(2025, 4, 12),
        end: new Date(2025, 4, 12),
        type: 'milestone',
      }
      const { tasksWithLanes, laneCount } = calculateTaskLanes([m1, m2, m3])
      expect(laneCount).toBe(2)
      expect(tasksWithLanes.find((t) => t.id === 'm1')?.lane).toBe(0)
      expect(tasksWithLanes.find((t) => t.id === 'm2')?.lane).toBe(1)
      expect(tasksWithLanes.find((t) => t.id === 'm3')?.lane).toBe(0)
    })

    it('handles milestone tasks in multi-column grid (0 days duration, same start/end date, inline edit sync)', () => {
      const milestoneTask: GanttTask = {
        id: 'm1',
        name: 'Gate Review',
        start: new Date(2025, 4, 15),
        end: new Date(2025, 4, 15),
        type: 'milestone',
      }
      const row: GanttRow = {
        id: 'r-ms',
        name: 'Gate Review',
        tasks: [milestoneTask],
      }

      const summary = calculateRowSummaryDates(row.tasks)
      expect(summary.durationDays).toBe(0)
      expect(summary.durationMs).toBe(0)

      const durationCol = { id: 'duration' as const }
      const workingDaysCol = { id: 'workingDays' as const }
      const startCol = { id: 'startDate' as const }
      const endCol = { id: 'endDate' as const }
      const progressCol = { id: 'progress' as const }

      expect(getGridCellValue(durationCol, row, row.tasks)).toBe(0)
      expect(formatGridCellValue(durationCol, 0, row, row.tasks, jaLocale)).toBe('0日')
      expect(getGridCellValue(workingDaysCol, row, row.tasks)).toBe(0)
      expect(formatGridCellValue(workingDaysCol, 0, row, row.tasks, jaLocale)).toBe('0日')

      // startDate and endDate display the exact same date for milestone
      const startVal = getGridCellValue(startCol, row, row.tasks)
      const endVal = getGridCellValue(endCol, row, row.tasks)
      expect(formatGridCellValue(startCol, startVal, row, row.tasks, jaLocale)).toBe('2025/5/15')
      expect(formatGridCellValue(endCol, endVal, row, row.tasks, jaLocale)).toBe('2025/5/15')

      // duration, workingDays, progress are not editable for milestones
      expect(isGridCellEditable(durationCol, row, row.tasks, false, true)).toBe(false)
      expect(isGridCellEditable(workingDaysCol, row, row.tasks, false, true)).toBe(false)
      expect(isGridCellEditable(progressCol, row, row.tasks, false, true)).toBe(false)
      expect(isGridCellEditable(startCol, row, row.tasks, false, true)).toBe(true)
      expect(isGridCellEditable(endCol, row, row.tasks, false, true)).toBe(true)

      // Editing startDate updates both start and end to the same timestamp
      const res1 = applyGridCellEdit(startCol, row, '2025-05-20')
      expect(res1.changed).toBe(true)
      expect(row.tasks[0].start).toEqual(new Date(2025, 4, 20))
      expect(row.tasks[0].end).toEqual(new Date(2025, 4, 20))

      // Editing endDate also updates both start and end to the same timestamp without +1 day offset
      const res2 = applyGridCellEdit(endCol, row, '2025-05-22')
      expect(res2.changed).toBe(true)
      expect(row.tasks[0].start).toEqual(new Date(2025, 4, 22))
      expect(row.tasks[0].end).toEqual(new Date(2025, 4, 22))
    })

    it('renders diamond bar for milestone task in gantt-bar and calculates non-zero coords in gantt-chart', async () => {
      const chart = document.createElement('gantt-chart') as GanttChartElement
      chart.option = {
        calendar: {
          start: new Date(2025, 4, 1),
          end: new Date(2025, 4, 31),
          pxPerDay: 40,
        },
        bar: {
          height: 24,
          milestoneColor: '#ec4899',
        },
      }
      chart.rows = [
        {
          id: 'r1',
          name: 'Milestone Row',
          tasks: [
            {
              id: 'ms-1',
              name: 'Kickoff',
              start: new Date(2025, 4, 5),
              end: new Date(2025, 4, 5),
              type: 'milestone',
            },
          ],
        },
      ]
      document.body.appendChild(chart)
      await chart.updateComplete

      const { taskCoords } = chart.calculateLayout()
      const coord = taskCoords.get('ms-1')
      expect(coord).toBeDefined()
      expect(coord?.isMilestone).toBe(true)
      expect(coord?.width).toBeGreaterThan(0)

      const rowEl = chart.shadowRoot?.querySelector('gantt-row')
      await rowEl?.updateComplete
      const barEl = rowEl?.shadowRoot?.querySelector('gantt-bar') as GanttBarElement | null
      await barEl?.updateComplete

      const groupEl = barEl?.shadowRoot?.querySelector('.task-group') as HTMLElement | null
      const innerBarEl = barEl?.shadowRoot?.querySelector('.bar') as HTMLElement | null
      const labelEl = barEl?.shadowRoot?.querySelector('.bar-label') as HTMLElement | null

      expect(groupEl?.classList.contains('milestone-task-group')).toBe(true)
      expect(innerBarEl?.classList.contains('milestone-bar')).toBe(true)
      expect(innerBarEl?.style.backgroundColor).toBe('rgb(236, 72, 153)')
      expect(labelEl?.classList.contains('pos-right')).toBe(true)
      expect(barEl?.shadowRoot?.querySelector('.handle-left')).toBeNull()
      expect(barEl?.shadowRoot?.querySelector('.handle-right')).toBeNull()

      document.body.removeChild(chart)
    })
  })

  // =========================================================================
  // Phase 2: Working Days & Custom Holidays (nonWorkingDays & nonWorkingDates)
  // =========================================================================
  describe('Phase 2: Working Days & Custom Holidays', () => {
    it('counts and adds working days with default weekends, custom nonWorkingDays, and nonWorkingDates', () => {
      // 2025-05-01 (Thu) to 2025-05-08 (Thu) -> 7 calendar days
      // Default weekends (Sat May 3, Sun May 4) -> 5 working days
      const start = new Date(2025, 4, 1)
      const end = new Date(2025, 4, 8)
      expect(countWorkingDays(start, end)).toBe(5)

      // Custom nonWorkingDates: 2025-05-05 (Mon) and range 2025-05-06..2025-05-07 (Tue..Wed)
      const workingWithGoldenWeek = countWorkingDays(start, end, {
        nonWorkingDates: [
          '2025-05-05',
          { start: '2025-05-06', end: '2025-05-07', name: 'GW振替', color: '#fef08a' },
        ],
      })
      // Only May 1 (Thu) and May 2 (Fri) are working days -> 2 working days
      expect(workingWithGoldenWeek).toBe(2)

      // addWorkingDays with custom nonWorkingDates:
      // Starting May 1 (Thu), adding 3 working days should skip May 3-7 and end on May 9 00:00 (meaning May 1, May 2, May 8)
      const computedEnd = addWorkingDays(start, 3, {
        nonWorkingDates: [
          '2025-05-05',
          { start: '2025-05-06', end: '2025-05-07' },
        ],
      })
      expect(computedEnd).toEqual(new Date(2025, 4, 9))

      // Custom nonWorkingDays: Tuesday (2) and Wednesday (3) off, Saturday & Sunday working!
      // In [May 1 (Thu) .. May 8 (Thu)):
      // Thu(1), Fri(2), Sat(3), Sun(4), Mon(5), Tue(off), Wed(off) -> 5 working days
      expect(
        countWorkingDays(start, end, {
          nonWorkingDays: [2, 3],
        }),
      ).toBe(5)
      // And May 5 (Mon) to May 8 (Thu) with Tue/Wed off has only 1 working day (Mon)
      expect(
        countWorkingDays(new Date(2025, 4, 5), new Date(2025, 4, 8), {
          nonWorkingDays: [2, 3],
        }),
      ).toBe(1)
    })

    it('resolves custom holiday colors and weekday colors via getCalendarColor and createCustomHolidayResolver', () => {
      const colors = getThemeColors('light')
      const calendarOptions = {
        nonWorkingDays: [0, 3, 6], // Sun, Wed, Sat
        nonWorkingDates: [
          '2025-05-01', // single string date
          new Date(2025, 4, 2), // Date object
          { date: '2025/05/08', name: '創立記念日', color: '#fde047' },
          { start: '2025-05-12', end: '2025-05-13', name: '特別休業', color: '#fbcfe8' },
        ],
      }

      const resolver = createCustomHolidayResolver(calendarOptions)
      expect(resolver.isHolidayDate(new Date(2025, 4, 1))).toBe(true)
      expect(resolver.isHolidayDate(new Date(2025, 4, 2))).toBe(true)
      expect(resolver.isHolidayDate(new Date(2025, 4, 8))).toBe(true)
      expect(resolver.isHolidayDate(new Date(2025, 4, 12))).toBe(true)
      expect(resolver.isHolidayDate(new Date(2025, 4, 13))).toBe(true)
      expect(resolver.isHolidayDate(new Date(2025, 4, 14))).toBe(false)

      // Custom color on nonWorkingDates
      expect(getCalendarColor(new Date(2025, 4, 8), colors, undefined, calendarOptions)).toBe('#fde047')
      expect(getCalendarColor(new Date(2025, 4, 12), colors, undefined, calendarOptions)).toBe('#fbcfe8')
      // Fallback to theme.holiday when color is omitted on nonWorkingDates
      expect(getCalendarColor(new Date(2025, 4, 1), colors, undefined, calendarOptions)).toBe(colors.holiday)
      // Wednesday (2025-05-07 is Wednesday) in nonWorkingDays -> falls back to colors.holiday
      expect(getCalendarColor(new Date(2025, 4, 7), colors, undefined, calendarOptions)).toBe(colors.holiday)
      // Friday (2025-05-09 is Friday) -> normal weekday ('')
      expect(getCalendarColor(new Date(2025, 4, 9), colors, undefined, calendarOptions)).toBe('')
    })

    it('supports built-in workingDays column in grid (display & inline edit)', () => {
      const colsJa = normalizeGridColumns([{ id: 'name' }, { id: 'workingDays' }], jaLocale)
      const colsEn = normalizeGridColumns([{ id: 'name' }, { id: 'workingDays' }], enLocale)
      expect(colsJa[1].title).toBe('稼働日')
      expect(colsEn[1].title).toBe('Working Days')
      expect(colsJa[1].align).toBe('right')

      // Task from 2025-05-01 (Thu) to 2025-05-07 (Wed) -> 6 calendar days (Thu, Fri, Sat, Sun, Mon, Tue)
      // With 2025-05-05 (Mon) as custom holiday -> 3 working days (Thu, Fri, Tue)
      const row: GanttRow = {
        id: 'r1',
        name: 'Impl',
        tasks: [
          {
            id: 't1',
            name: 'Impl',
            start: new Date(2025, 4, 1),
            end: new Date(2025, 4, 7),
          },
        ],
      }
      const calOpts = {
        calendarMode: 'weekends-holidays' as const,
        nonWorkingDates: ['2025-05-05'],
      }
      const wdCol = colsJa[1]
      const val = getGridCellValue(wdCol, row, row.tasks, undefined, calOpts)
      expect(val).toBe(3)
      expect(formatGridCellValue(wdCol, val, row, row.tasks, jaLocale)).toBe('3日')

      // Inline edit workingDays from 3 to 4 -> end date advances by 1 working day to 2025-05-08 (Thu)
      const editRes = applyGridCellEdit(wdCol, row, '4', false, false, undefined, calOpts)
      expect(editRes.changed).toBe(true)
      expect(editRes.oldValue).toBe(3)
      expect(editRes.newValue).toBe(4)
      expect(row.tasks[0].end).toEqual(new Date(2025, 4, 8))
    })

    it('propagates auto-schedule respecting nonWorkingDays and nonWorkingDates', () => {
      const rows: GanttRow[] = [
        {
          id: 'r1',
          name: 'R1',
          tasks: [
            {
              id: 't1',
              name: 'T1',
              start: new Date(2025, 4, 1), // Thu
              end: new Date(2025, 4, 3), // Sat 00:00 (2 working days: Thu, Fri)
            },
          ],
        },
        {
          id: 'r2',
          name: 'R2',
          tasks: [
            {
              id: 't2',
              name: 'T2',
              start: new Date(2025, 4, 2), // Fri (violation against T1 FS)
              end: new Date(2025, 4, 3), // 1 working day
              dependencies: ['t1'],
            },
          ],
        },
      ]

      // Suppose Sat(3), Sun(4) are weekend and Mon(5) is in nonWorkingDates
      const result = propagateAutoSchedule(rows, ['t1'], {
        calendarMode: 'weekends',
        nonWorkingDates: ['2025-05-05'],
      })
      expect(result.hasChanges).toBe(true)
      const updatedT2 = result.rows[1].tasks[0]
      // T2 must start on Tuesday May 6 00:00 and end on Wednesday May 7 00:00
      expect(updatedT2.start).toEqual(new Date(2025, 4, 6))
      expect(updatedT2.end).toEqual(new Date(2025, 4, 7))
    })

    it('preserves working days when dragging a task across a weekend if preserveWorkingDaysOnDrag is enabled', async () => {
      const chart = document.createElement('gantt-chart') as GanttChartElement
      const pxPerDay = 40
      chart.option = {
        calendar: {
          start: new Date(2025, 4, 1), // Thu
          end: new Date(2025, 4, 31),
          pxPerDay,
          calendarMode: 'weekends-holidays',
          nonWorkingDates: ['2025-05-05'], // Mon is holiday
          preserveWorkingDaysOnDrag: true,
        },
      }
      // Task starts Thu May 1, ends Sat May 3 00:00 -> 2 working days (Thu May 1, Fri May 2)
      chart.rows = [
        {
          id: 'r1',
          name: 'Row 1',
          tasks: [
            {
              id: 't1',
              name: 'Task 1',
              start: new Date(2025, 4, 1),
              end: new Date(2025, 4, 3),
            },
          ],
        },
      ]
      document.body.appendChild(chart)
      await chart.updateComplete

      // Drag task +1 day to the right (dx = 40px -> newStart = Fri May 2)
      // Since Sat May 3, Sun May 4 are weekend and Mon May 5 is in nonWorkingDates,
      // 2 working days starting Fri May 2 must span Fri May 2 and Tue May 6 -> end = Wed May 7 00:00!
      chart.handleTaskUpdate(
        new CustomEvent('task-update', {
          detail: {
            id: 't1',
            name: 'Task 1',
            start: new Date(2025, 4, 1),
            end: new Date(2025, 4, 3),
            dx: pxPerDay,
            dy: 0,
            isDragging: true,
            mode: 'move',
          },
        }) as any,
      )

      expect(chart.dragOverlayInfo?.currentStart).toEqual(new Date(2025, 4, 2))
      expect(chart.dragOverlayInfo?.currentEnd).toEqual(new Date(2025, 4, 7))

      document.body.removeChild(chart)
    })
  })

  // =========================================================================
  // Phase 3: External Task Bar Label Positioning (bar.labelPosition)
  // =========================================================================
  describe('Phase 3: External Task Bar Label Positioning', () => {
    let container: HTMLElement

    beforeEach(() => {
      container = document.createElement('div')
      document.body.appendChild(container)
    })

    afterEach(() => {
      container.remove()
    })

    it('renders bar-label with pos-inside, pos-right, pos-left, and auto overflow detection', async () => {
      const baseOption: GanttChartOption = {
        calendar: {
          start: new Date(2025, 4, 1),
          end: new Date(2025, 4, 31),
          pxPerDay: 20, // 1 day = 20px
        },
        bar: {
          labelPosition: 'auto',
        },
      }

      // 1-day task (20px wide) with long name -> 'auto' resolves to 'pos-right'
      const barNarrow = document.createElement('gantt-bar') as GanttBarElement
      barNarrow.option = baseOption
      barNarrow.task = {
        id: 't-narrow',
        name: '長いタスク名ラベル',
        start: new Date(2025, 4, 2),
        end: new Date(2025, 4, 3),
      }
      container.appendChild(barNarrow)
      await barNarrow.updateComplete
      const narrowLabel = barNarrow.shadowRoot?.querySelector('.bar-label')
      expect(narrowLabel?.classList.contains('pos-right')).toBe(true)

      // 15-day task (300px wide) with short name -> 'auto' resolves to 'pos-inside'
      const barWide = document.createElement('gantt-bar') as GanttBarElement
      barWide.option = baseOption
      barWide.task = {
        id: 't-wide',
        name: 'Short',
        start: new Date(2025, 4, 2),
        end: new Date(2025, 4, 17),
      }
      container.appendChild(barWide)
      await barWide.updateComplete
      const wideLabel = barWide.shadowRoot?.querySelector('.bar-label')
      expect(wideLabel?.classList.contains('pos-inside')).toBe(true)

      // Task-level override: labelPosition: 'left'
      const barLeft = document.createElement('gantt-bar') as GanttBarElement
      barLeft.option = baseOption
      barLeft.task = {
        id: 't-left',
        name: 'Left Label',
        start: new Date(2025, 4, 5),
        end: new Date(2025, 4, 10),
        labelPosition: 'left',
      }
      container.appendChild(barLeft)
      await barLeft.updateComplete
      const leftLabel = barLeft.shadowRoot?.querySelector('.bar-label')
      expect(leftLabel?.classList.contains('pos-left')).toBe(true)
    })
  })
})

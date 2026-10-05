import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { GanttRow, GanttTask } from '../core/types'
import { calculateTaskDelay, calculateProjectBaselineSummary } from '../core/utils'
import { computeSummaryTask } from '../core/wbs'

describe('Baseline Calculation & Summary', () => {
  describe('calculateTaskDelay', () => {
    it('returns zeroes when task has no baseline', () => {
      const task: GanttTask = {
        id: 't1',
        name: 'Task without baseline',
        start: new Date('2026-04-01'),
        end: new Date('2026-04-10'),
      }
      const result = calculateTaskDelay(task)
      expect(result.isDelayed).toBe(false)
      expect(result.isAhead).toBe(false)
      expect(result.delayDays).toBe(0)
      expect(result.aheadDays).toBe(0)
    })

    it('detects delayed tasks accurately', () => {
      const task: GanttTask = {
        id: 't2',
        name: 'Delayed Task',
        start: new Date('2026-04-01'),
        end: new Date('2026-04-15'), // 5 days late
        baseline: {
          start: new Date('2026-04-01'),
          end: new Date('2026-04-10'),
        },
      }
      const result = calculateTaskDelay(task)
      expect(result.isDelayed).toBe(true)
      expect(result.isAhead).toBe(false)
      expect(result.delayDays).toBe(5)
      expect(result.delayMs).toBe(5 * 24 * 60 * 60 * 1000)
    })

    it('detects ahead-of-schedule tasks accurately', () => {
      const task: GanttTask = {
        id: 't3',
        name: 'Ahead Task',
        start: new Date('2026-04-01'),
        end: new Date('2026-04-08'), // 2 days ahead
        baseline: {
          start: new Date('2026-04-01'),
          end: new Date('2026-04-10'),
        },
      }
      const result = calculateTaskDelay(task)
      expect(result.isDelayed).toBe(false)
      expect(result.isAhead).toBe(true)
      expect(result.aheadDays).toBe(2)
      expect(result.aheadMs).toBe(2 * 24 * 60 * 60 * 1000)
    })

    it('detects on-schedule tasks accurately', () => {
      const task: GanttTask = {
        id: 't4',
        name: 'On Schedule Task',
        start: new Date('2026-04-01'),
        end: new Date('2026-04-10'),
        baseline: {
          start: new Date('2026-04-01'),
          end: new Date('2026-04-10'),
        },
      }
      const result = calculateTaskDelay(task)
      expect(result.isDelayed).toBe(false)
      expect(result.isAhead).toBe(false)
      expect(result.delayDays).toBe(0)
      expect(result.aheadDays).toBe(0)
    })
  })

  describe('calculateProjectBaselineSummary', () => {
    it('summarizes empty rows gracefully', () => {
      const summary = calculateProjectBaselineSummary([])
      expect(summary.totalBaselineTasks).toBe(0)
      expect(summary.delayedTasksCount).toBe(0)
      expect(summary.aheadTasksCount).toBe(0)
      expect(summary.onScheduleTasksCount).toBe(0)
      expect(summary.maxDelayDays).toBe(0)
    })

    it('computes correct statistics across multiple rows', () => {
      const rows: GanttRow[] = [
        {
          id: 'r1',
          name: 'Row 1',
          tasks: [
            {
              id: 't1',
              name: 'Delayed 4 days',
              start: new Date('2026-04-01'),
              end: new Date('2026-04-14'),
              baseline: { start: new Date('2026-04-01'), end: new Date('2026-04-10') },
            },
            {
              id: 't2',
              name: 'On schedule',
              start: new Date('2026-04-01'),
              end: new Date('2026-04-05'),
              baseline: { start: new Date('2026-04-01'), end: new Date('2026-04-05') },
            },
          ],
        },
        {
          id: 'r2',
          name: 'Row 2',
          tasks: [
            {
              id: 't3',
              name: 'Delayed 7 days',
              start: new Date('2026-04-01'),
              end: new Date('2026-04-17'),
              baseline: { start: new Date('2026-04-01'), end: new Date('2026-04-10') },
            },
            {
              id: 't4',
              name: 'Ahead 1 day',
              start: new Date('2026-04-01'),
              end: new Date('2026-04-04'),
              baseline: { start: new Date('2026-04-01'), end: new Date('2026-04-05') },
            },
            {
              id: 't5',
              name: 'No baseline',
              start: new Date('2026-04-01'),
              end: new Date('2026-04-05'),
            },
            {
              id: 't6-summary',
              name: 'Summary task to ignore',
              type: 'summary',
              start: new Date('2026-04-01'),
              end: new Date('2026-04-20'),
              baseline: { start: new Date('2026-04-01'), end: new Date('2026-04-10') },
            },
          ],
        },
      ]

      const summary = calculateProjectBaselineSummary(rows)
      expect(summary.totalBaselineTasks).toBe(4) // t1, t2, t3, t4 (t5 has no baseline, t6 is summary)
      expect(summary.delayedTasksCount).toBe(2) // t1 (+4), t3 (+7)
      expect(summary.aheadTasksCount).toBe(1) // t4 (-1)
      expect(summary.onScheduleTasksCount).toBe(1) // t2
      expect(summary.maxDelayDays).toBe(7)
    })
  })

  describe('computeSummaryTask with baseline', () => {
    it('aggregates baseline dates and progress across child tasks', () => {
      const childTasks: GanttTask[] = [
        {
          id: 'c1',
          name: 'Child 1',
          start: new Date('2026-04-05'),
          end: new Date('2026-04-15'),
          progress: 100,
          baseline: {
            start: new Date('2026-04-01'),
            end: new Date('2026-04-10'),
            progress: 100,
          },
        },
        {
          id: 'c2',
          name: 'Child 2',
          start: new Date('2026-04-15'),
          end: new Date('2026-04-25'),
          progress: 50,
          baseline: {
            start: new Date('2026-04-10'),
            end: new Date('2026-04-20'),
            progress: 50,
          },
        },
      ]

      const summary = computeSummaryTask(childTasks)
      expect(summary).not.toBeNull()
      expect(summary!.start).toEqual(new Date('2026-04-05'))
      expect(summary!.end).toEqual(new Date('2026-04-25'))
      expect(summary!.baseline).toBeDefined()
      expect(summary!.baseline!.start).toEqual(new Date('2026-04-01'))
      expect(summary!.baseline!.end).toEqual(new Date('2026-04-20'))
      // 100% * 9days + 50% * 10days / 19days => weighted progress
      expect(summary!.baseline!.progress).toBeCloseTo(73.7, 0)
    })

    it('leaves baseline undefined if no child tasks have baseline', () => {
      const childTasks: GanttTask[] = [
        {
          id: 'c1',
          name: 'Child 1',
          start: new Date('2026-04-01'),
          end: new Date('2026-04-10'),
        },
      ]
      const summary = computeSummaryTask(childTasks)
      expect(summary).not.toBeNull()
      expect(summary!.baseline).toBeUndefined()
    })
  })

  describe('GanttBar Baseline Rendering', () => {
    let container: HTMLDivElement

    beforeEach(() => {
      container = document.createElement('div')
      document.body.appendChild(container)
    })

    afterEach(() => {
      container.remove()
    })

    it('renders baseline bar when baseline.enabled is true and task has baseline', async () => {
      const { GanttBarElement } = await import('../components/gantt-bar')
      const bar = new GanttBarElement()
      bar.option = {
        calendar: {
          start: new Date('2026-04-01'),
          end: new Date('2026-04-30'),
          pxPerDay: 40,
        },
        bar: {
          height: 24,
          margin: 4,
        },
        baseline: {
          enabled: true,
          position: 'bottom',
          height: 6,
        },
      }
      bar.task = {
        id: 't-test',
        name: 'Task with Baseline',
        start: new Date('2026-04-05'),
        end: new Date('2026-04-15'),
        baseline: {
          start: new Date('2026-04-01'),
          end: new Date('2026-04-10'),
          progress: 50,
        },
      }

      container.appendChild(bar)
      await bar.updateComplete

      const baselineGroup = bar.shadowRoot?.querySelector('.baseline-group') as HTMLElement | null
      expect(baselineGroup).not.toBeNull()

      const baselineBar = bar.shadowRoot?.querySelector('.baseline-bar') as HTMLElement | null
      expect(baselineBar).not.toBeNull()

      const baselineProgress = bar.shadowRoot?.querySelector('.baseline-progress-bar') as HTMLElement | null
      expect(baselineProgress).not.toBeNull()
      expect(baselineProgress?.style.width).toBe('50%')

      // 遅延タスク判定 (4/15 > 4/10 なので遅延)
      const taskGroup = bar.shadowRoot?.querySelector('.task-group') as HTMLElement | null
      expect(taskGroup?.classList.contains('task-delayed')).toBe(true)
    })

    it('does not render baseline bar when baseline.enabled is false', async () => {
      const { GanttBarElement } = await import('../components/gantt-bar')
      const bar = new GanttBarElement()
      bar.option = {
        calendar: {
          start: new Date('2026-04-01'),
          end: new Date('2026-04-30'),
          pxPerDay: 40,
        },
        baseline: {
          enabled: false,
        },
      }
      bar.task = {
        id: 't-test-disabled',
        name: 'Task with Baseline disabled',
        start: new Date('2026-04-05'),
        end: new Date('2026-04-15'),
        baseline: {
          start: new Date('2026-04-01'),
          end: new Date('2026-04-10'),
        },
      }

      container.appendChild(bar)
      await bar.updateComplete

      const baselineGroup = bar.shadowRoot?.querySelector('.baseline-group')
      expect(baselineGroup).toBeNull()

      const taskGroup = bar.shadowRoot?.querySelector('.task-group') as HTMLElement | null
      expect(taskGroup?.classList.contains('task-delayed')).toBe(false)
    })
  })
})

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  clampProgress,
  calculateRowProgress,
  calculateWeightedRowProgress,
  calculateProjectProgress,
} from '../core/utils'
import { GanttBarElement } from '../components/gantt-bar'
import type { GanttRow, GanttTask, GanttChartOption, TaskProgressChangeEventDetail } from '../core/types'

describe('Task Progress Management', () => {
  describe('Progress Calculation Utilities', () => {
    describe('clampProgress', () => {
      it('clamps negative values to 0', () => {
        expect(clampProgress(-10)).toBe(0)
        expect(clampProgress(-0.1)).toBe(0)
      })

      it('clamps values above 100 to 100', () => {
        expect(clampProgress(120)).toBe(100)
        expect(clampProgress(100.5)).toBe(100)
      })

      it('handles NaN and non-number values gracefully', () => {
        expect(clampProgress(NaN)).toBe(0)
        expect(clampProgress(null as unknown as number)).toBe(0)
        expect(clampProgress(undefined as unknown as number)).toBe(0)
      })

      it('rounds to specified precision', () => {
        expect(clampProgress(50.456, 1)).toBe(50.5)
        expect(clampProgress(50.456, 0)).toBe(50)
        expect(clampProgress(50.456, 2)).toBe(50.46)
      })
    })

    describe('calculateRowProgress', () => {
      it('returns 0 for empty row or tasks array', () => {
        expect(calculateRowProgress([])).toBe(0)
        expect(calculateRowProgress({ id: 'r1', name: 'Row 1', tasks: [] })).toBe(0)
      })

      it('returns 0 when no tasks have progress defined', () => {
        const tasks: GanttTask[] = [
          { id: '1', start: new Date('2024-01-01'), end: new Date('2024-01-05') },
          { id: '2', start: new Date('2024-01-06'), end: new Date('2024-01-10') },
        ]
        expect(calculateRowProgress(tasks)).toBe(0)
      })

      it('calculates average progress for tasks with defined progress', () => {
        const tasks: GanttTask[] = [
          { id: '1', start: new Date('2024-01-01'), end: new Date('2024-01-05'), progress: 100 },
          { id: '2', start: new Date('2024-01-06'), end: new Date('2024-01-10'), progress: 50 },
          { id: '3', start: new Date('2024-01-11'), end: new Date('2024-01-15') }, // ignored in average
        ]
        expect(calculateRowProgress(tasks)).toBe(75)
      })

      it('accepts a GanttRow object directly', () => {
        const row: GanttRow = {
          id: 'r1',
          name: 'Row 1',
          tasks: [
            { id: '1', start: new Date('2024-01-01'), end: new Date('2024-01-05'), progress: 30 },
            { id: '2', start: new Date('2024-01-06'), end: new Date('2024-01-10'), progress: 70 },
          ],
        }
        expect(calculateRowProgress(row)).toBe(50)
      })
    })

    describe('calculateWeightedRowProgress', () => {
      it('calculates duration-weighted average progress', () => {
        // Task 1: 1 day, 100% progress
        // Task 2: 3 days, 0% progress
        // Total duration: 4 days -> (1 * 100 + 3 * 0) / 4 = 25%
        const tasks: GanttTask[] = [
          { id: '1', start: new Date('2024-01-01T00:00:00'), end: new Date('2024-01-02T00:00:00'), progress: 100 },
          { id: '2', start: new Date('2024-01-02T00:00:00'), end: new Date('2024-01-05T00:00:00'), progress: 0 },
        ]
        expect(calculateWeightedRowProgress(tasks)).toBe(25)
      })

      it('returns 0 for empty or undefined progress tasks', () => {
        expect(calculateWeightedRowProgress([])).toBe(0)
        const tasks: GanttTask[] = [
          { id: '1', start: new Date('2024-01-01'), end: new Date('2024-01-02') },
        ]
        expect(calculateWeightedRowProgress(tasks)).toBe(0)
      })
    })

    describe('calculateProjectProgress', () => {
      it('calculates weighted progress across all rows', () => {
        const rows: GanttRow[] = [
          {
            id: 'r1',
            name: 'Row 1',
            tasks: [
              { id: '1', start: new Date('2024-01-01T00:00:00'), end: new Date('2024-01-03T00:00:00'), progress: 100 }, // 2 days * 100
            ],
          },
          {
            id: 'r2',
            name: 'Row 2',
            tasks: [
              { id: '2', start: new Date('2024-01-01T00:00:00'), end: new Date('2024-01-03T00:00:00'), progress: 50 }, // 2 days * 50
            ],
          },
        ]
        // (2 * 100 + 2 * 50) / 4 = 75%
        expect(calculateProjectProgress(rows)).toBe(75)
      })

      it('returns 0 for empty project rows', () => {
        expect(calculateProjectProgress([])).toBe(0)
      })
    })
  })

  describe('GanttBar Component Progress Rendering', () => {
    let bar: GanttBarElement
    const defaultOption: GanttChartOption = {
      calendar: {
        start: new Date('2024-01-01T00:00:00'),
        end: new Date('2024-01-31T00:00:00'),
        pxPerDay: 50,
      },
      bar: {
        height: 30,
        margin: 5,
        cornerRadius: 4,
      },
      progress: {
        enabled: true,
        editable: true,
        showLabel: true,
      },
    }

    beforeEach(async () => {
      bar = new GanttBarElement()
      bar.option = defaultOption
      bar.task = {
        id: 'task-1',
        name: 'Feature Development',
        start: new Date('2024-01-02T00:00:00'),
        end: new Date('2024-01-06T00:00:00'),
        progress: 60,
      }
      document.body.appendChild(bar)
      await bar.updateComplete
    })

    afterEach(() => {
      bar.remove()
    })

    it('renders progress bar element with correct width', async () => {
      const progressBar = bar.shadowRoot?.querySelector('.progress-bar') as HTMLElement
      expect(progressBar).not.toBeNull()
      expect(progressBar.style.width).toBe('60%')
    })

    it('does not render progress bar when progress is undefined', async () => {
      bar.task = {
        id: 'task-2',
        name: 'No Progress Task',
        start: new Date('2024-01-02T00:00:00'),
        end: new Date('2024-01-06T00:00:00'),
      }
      await bar.updateComplete

      const progressBar = bar.shadowRoot?.querySelector('.progress-bar')
      expect(progressBar).toBeNull()
    })

    it('does not render progress bar when option.progress.enabled is false', async () => {
      bar.option = {
        ...defaultOption,
        progress: {
          ...defaultOption.progress,
          enabled: false,
        },
      }
      await bar.updateComplete

      const progressBar = bar.shadowRoot?.querySelector('.progress-bar')
      expect(progressBar).toBeNull()
    })

    it('renders progress label when showLabel is true', async () => {
      const progressLabel = bar.shadowRoot?.querySelector('.progress-label') as HTMLElement
      expect(progressLabel).not.toBeNull()
      expect(progressLabel.textContent).toBe('60%')
      expect(progressLabel.classList.contains('pos-inside')).toBe(true)
    })

    it('applies custom labelPosition class', async () => {
      bar.option = {
        ...defaultOption,
        progress: {
          ...defaultOption.progress,
          showLabel: true,
          labelPosition: 'right',
        },
      }
      await bar.updateComplete

      const progressLabel = bar.shadowRoot?.querySelector('.progress-label') as HTMLElement
      expect(progressLabel).not.toBeNull()
      expect(progressLabel.classList.contains('pos-right')).toBe(true)
    })

    it('uses custom labelFormatter when provided', async () => {
      bar.option = {
        ...defaultOption,
        progress: {
          ...defaultOption.progress,
          showLabel: true,
          labelFormatter: (p) => `Done: ${p}%`,
        },
      }
      await bar.updateComplete

      const progressLabel = bar.shadowRoot?.querySelector('.progress-label') as HTMLElement
      expect(progressLabel.textContent).toBe('Done: 60%')
    })

    it('does not render progress label for summary task by default', async () => {
      bar.task = {
        ...bar.task,
        type: 'summary',
      }
      bar.option = {
        ...defaultOption,
        progress: {
          ...defaultOption.progress,
          showLabel: true,
        },
      }
      await bar.updateComplete

      const progressLabel = bar.shadowRoot?.querySelector('.progress-label')
      expect(progressLabel).toBeNull()
    })

    it('renders progress label for summary task when showSummaryLabel is true', async () => {
      bar.task = {
        ...bar.task,
        type: 'summary',
      }
      bar.option = {
        ...defaultOption,
        progress: {
          ...defaultOption.progress,
          showLabel: true,
          showSummaryLabel: true,
        },
      }
      await bar.updateComplete

      const progressLabel = bar.shadowRoot?.querySelector('.progress-label') as HTMLElement
      expect(progressLabel).not.toBeNull()
      expect(progressLabel.textContent).toBe('60%')
    })

    it('does not render progress label element when labelFormatter returns empty string', async () => {
      bar.option = {
        ...defaultOption,
        progress: {
          ...defaultOption.progress,
          showLabel: true,
          labelFormatter: () => '',
        },
      }
      await bar.updateComplete

      const progressLabel = bar.shadowRoot?.querySelector('.progress-label')
      expect(progressLabel).toBeNull()
    })

    it('applies indicatorPosition bottom/top styles', async () => {
      bar.option = {
        ...defaultOption,
        progress: {
          ...defaultOption.progress,
          indicatorPosition: 'bottom',
        },
      }
      await bar.updateComplete

      let progressBar = bar.shadowRoot?.querySelector('.progress-bar') as HTMLElement
      expect(progressBar.classList.contains('indicator-bottom')).toBe(true)

      bar.option = {
        ...defaultOption,
        progress: {
          ...defaultOption.progress,
          indicatorPosition: 'top',
        },
      }
      await bar.updateComplete

      progressBar = bar.shadowRoot?.querySelector('.progress-bar') as HTMLElement
      expect(progressBar.classList.contains('indicator-top')).toBe(true)
    })

    it('renders editable progress handle when editable is true and not readOnly', async () => {
      const handle = bar.shadowRoot?.querySelector('.handle-progress') as HTMLElement
      expect(handle).not.toBeNull()
      expect(handle.style.left).toBe('60%')
    })

    it('does not render progress handle in readOnly mode', async () => {
      bar.option = {
        ...defaultOption,
        readOnly: true,
      }
      await bar.updateComplete

      const handle = bar.shadowRoot?.querySelector('.handle-progress')
      expect(handle).toBeNull()
    })
  })

  describe('Progress Drag Interaction & Events', () => {
    let bar: GanttBarElement

    beforeEach(async () => {
      bar = new GanttBarElement()
      bar.option = {
        calendar: {
          start: new Date('2024-01-01T00:00:00'),
          end: new Date('2024-01-31T00:00:00'),
          pxPerDay: 50,
        },
        progress: {
          enabled: true,
          editable: true,
          snapStep: 5,
        },
      }
      bar.task = {
        id: 'task-1',
        name: 'Task 1',
        start: new Date('2024-01-01T00:00:00'),
        end: new Date('2024-01-05T00:00:00'),
        progress: 50,
      }
      document.body.appendChild(bar)
      await bar.updateComplete

      // Mock getBoundingClientRect on .bar
      const barEl = bar.shadowRoot?.querySelector('.bar') as HTMLElement
      if (barEl) {
        vi.spyOn(barEl, 'getBoundingClientRect').mockReturnValue({
          left: 100,
          top: 50,
          right: 300,
          bottom: 80,
          width: 200,
          height: 30,
          x: 100,
          y: 50,
          toJSON: () => {},
        })
      }
    })

    afterEach(() => {
      bar.remove()
    })

    it('dispatches task-progress-change on drag completion with new progress value', async () => {
      const handle = bar.shadowRoot?.querySelector('.handle-progress') as HTMLElement
      expect(handle).not.toBeNull()

      handle.setPointerCapture = vi.fn()
      handle.releasePointerCapture = vi.fn()

      const progressEventPromise = new Promise<CustomEvent<TaskProgressChangeEventDetail>>((resolve) => {
        bar.addEventListener('task-progress-change', (e) => {
          resolve(e as CustomEvent<TaskProgressChangeEventDetail>)
        }, { once: true })
      })

      // pointerdown at clientX: 200 (which corresponds to 50% on 100..300 width 200)
      handle.dispatchEvent(
        new PointerEvent('pointerdown', {
          clientX: 200,
          pointerId: 1,
          bubbles: true,
        }),
      )

      // pointermove +40px -> width 100px + 40px = 140px / 200px = 70%
      window.dispatchEvent(
        new PointerEvent('pointermove', {
          clientX: 240,
          pointerId: 1,
          bubbles: true,
        }),
      )

      // pointerup to complete
      window.dispatchEvent(
        new PointerEvent('pointerup', {
          clientX: 240,
          pointerId: 1,
          bubbles: true,
        }),
      )

      const event = await progressEventPromise
      expect(event.detail.task.id).toBe('task-1')
      expect(event.detail.progress).toBe(70)
      expect(event.detail.originalProgress).toBe(50)
      expect(event.detail.cancelled).toBe(false)
    })

    it('dispatches task-progress-change with cancelled=true on Escape key', async () => {
      const handle = bar.shadowRoot?.querySelector('.handle-progress') as HTMLElement
      expect(handle).not.toBeNull()

      handle.setPointerCapture = vi.fn()
      handle.releasePointerCapture = vi.fn()

      const progressEventPromise = new Promise<CustomEvent<TaskProgressChangeEventDetail>>((resolve) => {
        bar.addEventListener('task-progress-change', (e) => {
          resolve(e as CustomEvent<TaskProgressChangeEventDetail>)
        }, { once: true })
      })

      handle.dispatchEvent(
        new PointerEvent('pointerdown', {
          clientX: 200,
          pointerId: 1,
          bubbles: true,
        }),
      )

      // Press Escape
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

      const event = await progressEventPromise
      expect(event.detail.cancelled).toBe(true)
      expect(event.detail.progress).toBe(50)
    })
  })
})

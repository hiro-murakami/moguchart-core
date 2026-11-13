import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GanttChartElement } from '../components/gantt-chart'
import '../components/gantt-bar'
import { createNonWorkingDayChecker } from '../core/auto-schedule'
import { enLocale, jaLocale } from '../core/i18n'
import type { GanttChartOption, GanttRow, GanttTask } from '../core/types'
import {
  buildConstraintBadgeText,
  clampMovedTaskDates,
  clampResizedTaskDates,
  extractTaskConstraint,
  formatConstraintDateLabel,
} from '../components/controllers/constraint-drag-guide'

;(globalThis as any).ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

const flushRaf = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve())
  })

describe('Schedule Constraint (SNET / FNLT) Helpers', () => {
  const baseOption: GanttChartOption = {
    calendar: {
      start: new Date(2024, 4, 1),
      end: new Date(2024, 4, 31),
      pxPerDay: 50,
    },
    locale: jaLocale,
  }

  it('extracts SNET/FNLT constraints and ignores summary tasks', () => {
    const snetTask: GanttTask = {
      id: 't1',
      name: '設計タスク',
      start: new Date(2024, 4, 10),
      end: new Date(2024, 4, 14),
      constraintType: 'SNET',
      constraintDate: new Date(2024, 4, 8),
    }
    const summaryTask: GanttTask = {
      ...snetTask,
      id: 'sum-1',
      type: 'summary',
    }

    const info = extractTaskConstraint(snetTask)
    expect(info).toEqual({
      type: 'SNET',
      date: new Date(2024, 4, 8),
      isMilestone: false,
      taskName: '設計タスク',
    })
    expect(extractTaskConstraint(summaryTask)).toBeNull()
  })

  it('formats FNLT exclusive midnight as inclusive previous day in day mode and previous month in monthly mode', () => {
    // Day mode: exclusive 2024/5/21 00:00 -> displayed as 2024/5/20
    expect(
      formatConstraintDateLabel(new Date(2024, 4, 21, 0, 0), 'FNLT', false, baseOption),
    ).toBe('2024/5/20')

    // Milestone FNLT: does not subtract 1 day
    expect(
      formatConstraintDateLabel(new Date(2024, 4, 21, 0, 0), 'FNLT', true, baseOption),
    ).toBe('2024/5/21')

    // Monthly mode: exclusive 2024/7/1 -> displayed as 2024/6
    const monthlyOption: GanttChartOption = {
      calendar: {
        start: new Date(2024, 0, 1),
        end: new Date(2024, 11, 31),
        pxPerDay: 2,
        pxPerMonth: 120,
      },
      locale: jaLocale,
    }
    expect(
      formatConstraintDateLabel(new Date(2024, 6, 1, 0, 0), 'FNLT', false, monthlyOption),
    ).toBe('2024/6')

    // Hourly mode: includes HH:mm
    const hourlyOption: GanttChartOption = {
      calendar: {
        start: new Date(2024, 4, 1),
        end: new Date(2024, 4, 3),
        pxPerDay: 480,
        showTime: true,
      },
      locale: jaLocale,
    }
    expect(
      formatConstraintDateLabel(new Date(2024, 4, 2, 15, 0), 'FNLT', false, hourlyOption),
    ).toBe('2024/5/2 15:00')
  })

  it('builds localized badge texts for Japanese and English locales', () => {
    const snetInfo = extractTaskConstraint({
      id: 't1',
      name: 'とても長いタスク名称のテスト用サンプル項目',
      start: new Date(2024, 4, 10),
      end: new Date(2024, 4, 14),
      constraintType: 'SNET',
      constraintDate: new Date(2024, 4, 8),
    })!

    expect(buildConstraintBadgeText(snetInfo, snetInfo.date, baseOption, false, false)).toBe(
      '⇥ 2024/5/8 以降に開始 (SNET)',
    )
    expect(buildConstraintBadgeText(snetInfo, snetInfo.date, baseOption, false, true)).toBe(
      '⚠ 2024/5/8 以降に開始 (SNET)',
    )
    expect(buildConstraintBadgeText(snetInfo, snetInfo.date, baseOption, true, false)).toContain(
      'とても長いタスク名称のテスト…: 2024/5/8 以降に開始 (SNET)',
    )

    const enOption: GanttChartOption = { ...baseOption, locale: enLocale }
    expect(buildConstraintBadgeText(snetInfo, snetInfo.date, enOption, false, false)).toBe(
      '⇥ Start no earlier than 5/8/2024 (SNET)',
    )
  })

  it('clamps moved task dates for calendar mode, working-days mode, milestones, and monthly mode', () => {
    const snetTask: GanttTask = {
      id: 't-snet',
      start: new Date(2024, 4, 10), // Fri
      end: new Date(2024, 4, 14), // 4 calendar days (2 working days: Fri 5/10, Mon 5/13)
      constraintType: 'SNET',
      constraintDate: new Date(2024, 4, 8), // Wed 5/8
    }

    const resCalendar = clampMovedTaskDates(
      snetTask,
      new Date(2024, 4, 5),
      new Date(2024, 4, 9),
    )
    expect(resCalendar.clamped).toBe(true)
    expect(resCalendar.start).toEqual(new Date(2024, 4, 8))
    expect(resCalendar.end).toEqual(new Date(2024, 4, 12))

    // Working-days preservation with weekend SNET (2024/5/11 is Saturday -> snaps to Mon 2024/5/13)
    const checker = createNonWorkingDayChecker('weekends')!
    const weekendSnetTask: GanttTask = {
      ...snetTask,
      start: new Date(2024, 4, 14), // Tue
      end: new Date(2024, 4, 16), // 2 working days
      constraintDate: new Date(2024, 4, 11), // Sat -> effective Mon 5/13
    }
    const resWorking = clampMovedTaskDates(
      weekendSnetTask,
      new Date(2024, 4, 9),
      new Date(2024, 4, 11),
      { checker },
    )
    expect(resWorking.clamped).toBe(true)
    expect(resWorking.start).toEqual(new Date(2024, 4, 13))
    expect(resWorking.end).toEqual(new Date(2024, 4, 15))

    // Milestone FNLT
    const msTask: GanttTask = {
      id: 'ms-1',
      type: 'milestone',
      start: new Date(2024, 4, 10),
      end: new Date(2024, 4, 10),
      constraintType: 'FNLT',
      constraintDate: new Date(2024, 4, 15),
    }
    const resMs = clampMovedTaskDates(msTask, new Date(2024, 4, 20), new Date(2024, 4, 20))
    expect(resMs.clamped).toBe(true)
    expect(resMs.start).toEqual(new Date(2024, 4, 15))
    expect(resMs.end).toEqual(new Date(2024, 4, 15))
  })

  it('clamps resized task dates while preserving minimum snap duration', () => {
    const fnltTask: GanttTask = {
      id: 't-fnlt',
      start: new Date(2024, 4, 18),
      end: new Date(2024, 4, 20),
      constraintType: 'FNLT',
      constraintDate: new Date(2024, 4, 21),
    }
    const resized = clampResizedTaskDates(
      fnltTask,
      new Date(2024, 4, 18),
      new Date(2024, 4, 25),
      { snapMinutes: 1440 },
    )
    expect(resized.clamped).toBe(true)
    expect(resized.start).toEqual(new Date(2024, 4, 18))
    expect(resized.end).toEqual(new Date(2024, 4, 21))
  })
})

describe('GanttChartElement SNET / FNLT Drag Shade & Drop Clamping Integration', () => {
  let chart: GanttChartElement
  let rows: GanttRow[]

  beforeEach(async () => {
    chart = new GanttChartElement()
    rows = [
      {
        id: 'row-1',
        name: 'Row 1',
        tasks: [
          {
            id: 'task-snet',
            name: 'SNET Task',
            start: new Date(2024, 4, 10), // day index 9 -> x = 450
            end: new Date(2024, 4, 14), // day index 13 -> x = 650
            constraintType: 'SNET',
            constraintDate: new Date(2024, 4, 8), // day index 7 -> x = 350
          },
          {
            id: 'task-fnlt',
            name: 'FNLT Task',
            start: new Date(2024, 4, 16), // day index 15 -> x = 750
            end: new Date(2024, 4, 19), // day index 18 -> x = 900
            constraintType: 'FNLT',
            constraintDate: new Date(2024, 4, 21), // day index 20 -> x = 1000
          },
        ],
      },
    ]
    chart.rows = rows
    chart.option = {
      calendar: {
        start: new Date(2024, 4, 1),
        end: new Date(2024, 4, 31),
        pxPerDay: 50,
      },
      dependency: {
        autoSchedule: false, // 自動スケジュールOFFでも単独でシェード表示・クランプが機能することを検証
      },
    }

    document.body.appendChild(chart)
    await chart.updateComplete
  })

  afterEach(() => {
    if (chart.parentNode) {
      chart.parentNode.removeChild(chart)
    }
  })

  it('displays SNET shade/line/badge during drag, highlights violation in red, and clears on drop', async () => {
    // 1. 制約内（右方向 +50px = +1日）へドラッグ中 -> 通常青ガイド (data-violating="false")
    chart.handleTaskUpdate(
      new CustomEvent('task-update', {
        detail: {
          id: 'task-snet',
          name: 'SNET Task',
          start: new Date(2024, 4, 10),
          end: new Date(2024, 4, 14),
          dx: 50,
          dy: 0,
          isDragging: true,
        },
      }) as any,
    )

    const snetShade = chart.shadowRoot?.querySelector(
      '.constraint-guide-shade[data-constraint="SNET"]',
    ) as HTMLElement | null
    const snetLine = chart.shadowRoot?.querySelector(
      '.constraint-guide-line[data-constraint="SNET"]',
    ) as HTMLElement | null
    const snetBadge = chart.shadowRoot?.querySelector(
      '.constraint-guide-badge[data-constraint="SNET"]',
    ) as HTMLElement | null

    expect(snetShade).toBeTruthy()
    expect(snetShade?.style.display).toBe('block')
    expect(snetShade?.dataset.violating).toBe('false')
    expect(snetLine?.style.display).toBe('block')
    expect(snetBadge?.textContent).toBe('⇥ 2024/5/8 以降に開始 (SNET)')

    // 2. SNET 境界より左（-200px = -4日 -> 5/6 < 5/8）へドラッグ中 -> 赤色警告状態 (data-violating="true")
    chart.handleTaskUpdate(
      new CustomEvent('task-update', {
        detail: {
          id: 'task-snet',
          name: 'SNET Task',
          start: new Date(2024, 4, 10),
          end: new Date(2024, 4, 14),
          dx: -200,
          dy: 0,
          isDragging: true,
        },
      }) as any,
    )

    expect(snetShade?.dataset.violating).toBe('true')
    expect(snetLine?.dataset.violating).toBe('true')
    expect(snetBadge?.dataset.violating).toBe('true')
    expect(snetBadge?.textContent).toBe('⚠ 2024/5/8 以降に開始 (SNET)')

    // 3. ドロップ確定時 -> シェードは即座に消去され、タスク期間は 5/8〜5/12 にクランプされる
    chart.handleTaskUpdate(
      new CustomEvent('task-update', {
        detail: {
          id: 'task-snet',
          name: 'SNET Task',
          start: new Date(2024, 4, 10),
          end: new Date(2024, 4, 14),
          dx: -200,
          dy: 0,
          isDragging: false,
        },
      }) as any,
    )

    expect(snetShade?.style.display).toBe('none')
    await flushRaf()
    await chart.updateComplete

    const updatedSnet = chart.rows[0].tasks.find((t) => t.id === 'task-snet')!
    expect(updatedSnet.start).toEqual(new Date(2024, 4, 8))
    expect(updatedSnet.end).toEqual(new Date(2024, 4, 12))
    expect(chart.canUndo).toBe(true)
  })

  it('clamps right-edge resize on FNLT task even when autoSchedule is false', async () => {
    // FNLT 境界 5/21 を超えて 5/25 まで右端リサイズしてドロップ
    chart.handleTaskUpdate(
      new CustomEvent('task-update', {
        detail: {
          id: 'task-fnlt',
          name: 'FNLT Task',
          start: new Date(2024, 4, 16),
          end: new Date(2024, 4, 25),
          dy: 0,
          isDragging: false,
        },
      }) as any,
    )

    await flushRaf()
    await chart.updateComplete

    const updatedFnlt = chart.rows[0].tasks.find((t) => t.id === 'task-fnlt')!
    expect(updatedFnlt.start).toEqual(new Date(2024, 4, 16))
    expect(updatedFnlt.end).toEqual(new Date(2024, 4, 21))
  })

  it('displays both SNET and FNLT guides simultaneously during multi-task drag and clamps group dx on drop', async () => {
    chart.viewportWidth = 1400
    chart.selectedTasks = new Set(['task-snet', 'task-fnlt'])
    await chart.updateComplete

    // SNET(許容 -100px = -2日) と FNLT(許容 +100px = +2日) を同時選択して +200px ドラッグ
    chart.handleTaskUpdate(
      new CustomEvent('task-update', {
        detail: {
          id: 'task-snet',
          name: 'SNET Task',
          start: new Date(2024, 4, 10),
          end: new Date(2024, 4, 14),
          dx: 200,
          dy: 0,
          isDragging: true,
        },
      }) as any,
    )

    const snetBadge = chart.shadowRoot?.querySelector(
      '.constraint-guide-badge[data-constraint="SNET"]',
    ) as HTMLElement | null
    const fnltBadge = chart.shadowRoot?.querySelector(
      '.constraint-guide-badge[data-constraint="FNLT"]',
    ) as HTMLElement | null

    expect(snetBadge?.style.display).toBe('block')
    expect(snetBadge?.dataset.violating).toBe('false')
    expect(fnltBadge?.style.display).toBe('block')
    expect(fnltBadge?.dataset.violating).toBe('true')
    expect(fnltBadge?.textContent).toContain('FNLT Task: 2024/5/20 までに終了 (FNLT)')

    // +200px (+4日) でドロップ -> FNLT の最大許容移動量 +100px (+2日) にグループ全体がクランプされる
    chart.handleTaskUpdate(
      new CustomEvent('task-update', {
        detail: {
          id: 'task-snet',
          name: 'SNET Task',
          start: new Date(2024, 4, 10),
          end: new Date(2024, 4, 14),
          dx: 200,
          dy: 0,
          isDragging: false,
        },
      }) as any,
    )

    await flushRaf()
    await chart.updateComplete

    const updatedSnet = chart.rows[0].tasks.find((t) => t.id === 'task-snet')!
    const updatedFnlt = chart.rows[0].tasks.find((t) => t.id === 'task-fnlt')!
    expect(updatedSnet.start).toEqual(new Date(2024, 4, 12))
    expect(updatedSnet.end).toEqual(new Date(2024, 4, 16))
    expect(updatedFnlt.start).toEqual(new Date(2024, 4, 18))
    expect(updatedFnlt.end).toEqual(new Date(2024, 4, 21))
  })

  it('does not record a no-op Undo command when a task already at SNET boundary is dragged further left', async () => {
    chart.rows = [
      {
        id: 'row-1',
        name: 'Row 1',
        tasks: [
          {
            id: 'task-at-wall',
            name: 'At SNET Wall',
            start: new Date(2024, 4, 8),
            end: new Date(2024, 4, 12),
            constraintType: 'SNET',
            constraintDate: new Date(2024, 4, 8),
          },
        ],
      },
    ]
    await chart.updateComplete
    expect(chart.canUndo).toBe(false)

    chart.handleTaskUpdate(
      new CustomEvent('task-update', {
        detail: {
          id: 'task-at-wall',
          name: 'At SNET Wall',
          start: new Date(2024, 4, 8),
          end: new Date(2024, 4, 12),
          dx: -150,
          dy: 0,
          isDragging: false,
        },
      }) as any,
    )

    await flushRaf()
    await chart.updateComplete

    expect(chart.rows[0].tasks[0].start).toEqual(new Date(2024, 4, 8))
    expect(chart.canUndo).toBe(false)
  })

  it('respects option.constraint.showDragGuide = false and option.constraint.clampOnDrop = false', async () => {
    chart.option = {
      ...chart.option,
      constraint: {
        enabled: true,
        showDragGuide: false,
        clampOnDrop: false,
      },
    }
    await chart.updateComplete

    expect(chart.shadowRoot?.querySelector('.constraint-drag-guide-layer')).toBeNull()

    chart.handleTaskUpdate(
      new CustomEvent('task-update', {
        detail: {
          id: 'task-snet',
          name: 'SNET Task',
          start: new Date(2024, 4, 10),
          end: new Date(2024, 4, 14),
          dx: -200, // 5/6 (< SNET 5/8)
          dy: 0,
          isDragging: false,
        },
      }) as any,
    )

    await flushRaf()
    await chart.updateComplete

    const updatedSnet = chart.rows[0].tasks.find((t) => t.id === 'task-snet')!
    expect(updatedSnet.start).toEqual(new Date(2024, 4, 6))
  })

  it('clamps Shift+ArrowLeft keyboard movement at SNET boundary', async () => {
    chart.selectedTasks = new Set(['task-snet'])
    await chart.updateComplete

    // 5/10 -> 5/9 (1st Shift+ArrowLeft) -> 5/8 (2nd Shift+ArrowLeft) -> stays 5/8 on 3rd Shift+ArrowLeft
    for (let i = 0; i < 3; i++) {
      chart.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowLeft', shiftKey: true, bubbles: true }),
      )
    }
    await chart.updateComplete

    const updatedSnet = chart.rows[0].tasks.find((t) => t.id === 'task-snet')!
    expect(updatedSnet.start).toEqual(new Date(2024, 4, 8))
    expect(updatedSnet.end).toEqual(new Date(2024, 4, 12))
  })
})

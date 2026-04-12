import type { GanttRow, GanttTask, GanttMarker } from '@/core/types'
import type { DemoTexts } from './i18n'

const chartStart = new Date()
chartStart.setHours(0, 0, 0, 0)

/**
 * 日単位モードのデモデータを生成します。
 */
export const generateDayModeData = (t: DemoTexts): GanttRow[] => {
  const start = new Date(chartStart)
  const rows: GanttRow[] = []
  for (let i = 1; i <= 50; i++) {
    const offset = (i - 1) % 10
    const markers: GanttMarker[] | undefined =
      i <= 3
        ? [
            {
              id: `marker-${i}-1`,
              date: new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset + 3),
              anchor: 'end',
              type: 'triangle-right',
              color: '#ef4444',
              name: t.reviewDeadline,
            },
            {
              id: `marker-${i}-2`,
              date: new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset + 20),
              anchor: 'start',
              type: 'triangle-left',
              color: '#ef4444',
              name: t.releaseScheduled,
            },
            {
              id: `marker-${i}-3`,
              date: new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset + 10),
              anchor: 'center',
              type: 'triangle-down',
              color: '#ef4444',
              name: '★',
            },
          ]
        : undefined
    rows.push({
      id: `row${i}`,
      name: t.project(i),
      tasks: [
        {
          id: `t${i}-1`,
          name: t.requirementsDefinition,
          start: new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset),
          end: new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset + 5),
          pattern: i % 3 === 0 ? { type: 'diagonal-stripe', color: '#3b82f6' } : undefined,
          labelStyle: i === 1 ? 'font-weight: bold; color: red;' : undefined,
        },
        {
          id: `t${i}-2`,
          name: t.design,
          start: new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset + 6),
          end: new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset + 15),
          dependencies: [`t${i}-1`],
        },
      ],
      markers,
      visible: i % 5 !== 0,
    })
  }
  return rows
}

/**
 * 週単位モードのデモデータを生成します。
 */
export const generateWeekModeData = (t: DemoTexts): GanttRow[] => {
  const start = new Date(chartStart)
  const rows: GanttRow[] = []
  for (let i = 1; i <= 30; i++) {
    const offset = ((i - 1) % 8) * 7 // 週単位でオフセット
    rows.push({
      id: `wrow${i}`,
      name: t.project(i),
      tasks: [
        {
          id: `w${i}-1`,
          name: t.requirementsDefinition,
          start: new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset),
          end: new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset + 7),
          pattern: i % 4 === 0 ? { type: 'diagonal-stripe', color: '#3b82f6' } : undefined,
        },
        {
          id: `w${i}-2`,
          name: t.design,
          start: new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset + 7),
          end: new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset + 21),
          dependencies: [`w${i}-1`],
        },
      ],
      visible: i % 5 !== 0,
    })
  }
  return rows
}

/**
 * 時間単位モードのデモデータを生成します。
 */
export const generateHourModeData = (t: DemoTexts): GanttRow[] => {
  const start = new Date(chartStart)
  const setTime = (d: Date, h: number, m: number) => {
    const newDate = new Date(d)
    newDate.setHours(h, m, 0, 0)
    return newDate
  }

  const rows: GanttRow[] = []
  for (let i = 1; i <= 30; i++) {
    const shift = (i - 1) % 3
    rows.push({
      id: `user${i}`,
      name: t.assignee(i),
      tasks: [
        {
          id: `h${i}-1`,
          name: t.morningMeeting,
          start: setTime(start, 9, 0),
          end: setTime(start, 10, 0),
          movable: 'none',
          style: 'background-color: #ef4444;',
        },
        {
          id: `h${i}-2`,
          name: t.taskA,
          start: setTime(start, 10 + shift, 0),
          end: setTime(start, 12 + shift, 0),
        },
        {
          id: `h${i}-3`,
          name: t.break_,
          start: setTime(start, 12, 0),
          end: setTime(start, 13, 0),
          pattern: { type: 'dots', color: '#aaa' },
        },
        {
          id: `h${i}-4`,
          name: t.taskB,
          start: setTime(start, 13, 0),
          end: setTime(start, 16 + shift, 30),
        },
      ],
    })
  }
  return rows
}

/**
 * 月単位モードのデモデータを生成します。
 */
export const generateMonthModeData = (t: DemoTexts): GanttRow[] => {
  const start = new Date(chartStart)
  const rows: GanttRow[] = []
  for (let i = 1; i <= 30; i++) {
    const offsetMonths = (i - 1) % 6
    const taskStart = new Date(start.getFullYear(), start.getMonth() + offsetMonths, start.getDate())
    const designStart = new Date(taskStart)
    designStart.setMonth(designStart.getMonth() + 1)
    const designEnd = new Date(designStart)
    designEnd.setMonth(designEnd.getMonth() + 2)
    rows.push({
      id: `mrow${i}`,
      name: t.project(i),
      tasks: [
        {
          id: `m${i}-1`,
          name: t.requirementsDefinition,
          start: taskStart,
          end: new Date(taskStart.getFullYear(), taskStart.getMonth() + 1, taskStart.getDate()),
          pattern: i % 4 === 0 ? { type: 'diagonal-stripe', color: '#3b82f6' } : undefined,
        },
        {
          id: `m${i}-2`,
          name: t.design,
          start: designStart,
          end: designEnd,
          dependencies: [`m${i}-1`],
        },
      ],
      visible: i % 5 !== 0,
    })
  }
  return rows
}

/**
 * 未割り当てタスク（追加候補）のリストを生成します。
 */
export const generateUnassignedTasks = (t: DemoTexts): GanttTask[] => [
  {
    id: 'new-1',
    name: t.newTaskA,
    start: new Date(),
    end: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    style: 'background-color: #8b5cf6;',
  },
  {
    id: 'new-2',
    name: t.newTaskB,
    start: new Date(),
    end: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    style: 'background-color: #ec4899;',
  },
  {
    id: 'new-3',
    name: t.meetingSetup,
    start: new Date(),
    end: new Date(Date.now() + 1 * 60 * 60 * 1000),
    style: 'background-color: #10b981;',
  },
  {
    id: 'new-4',
    name: t.patternTask,
    start: new Date(),
    end: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    style: 'background-color: #f59e0b;',
    pattern: { type: 'diagonal-stripe', color: 'rgba(255, 255, 255, 0.5)' },
  },
  {
    id: 'new-5',
    name: t.labelStyleTask,
    start: new Date(),
    end: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
    style: 'background-color: #3b82f6;',
    labelStyle: 'font-weight: bold; font-size: 14px; color: yellow;',
  },
]

export { chartStart }

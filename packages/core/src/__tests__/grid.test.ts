import { describe, it, expect } from 'vitest'
import {
  normalizeGridColumns,
  getGridCellValue,
  formatGridCellValue,
  calculateRowSummaryDates,
  resolveColumnEditorType,
  isGridCellEditable,
  formatGridCellEditValue,
  applyGridCellEdit,
} from '../core/grid'
import type { GanttColumn, GanttRow, GanttTask } from '../core/types'
import { jaLocale, enLocale } from '../core/i18n'

describe('grid calculation & formatting', () => {
  const sampleTasks: GanttTask[] = [
    {
      id: 'task-1',
      name: 'Task 1',
      start: new Date(2026, 9, 1), // 2026-10-01
      end: new Date(2026, 9, 5),   // 2026-10-05 (5 days)
      progress: 100,
    },
    {
      id: 'task-2',
      name: 'Task 2',
      start: new Date(2026, 9, 11), // 2026-10-11
      end: new Date(2026, 9, 20),  // 2026-10-20 (10 days)
      progress: 50,
    },
  ]

  const singleTaskRow: GanttRow = {
    id: 'row-1',
    name: 'Row 1',
    tasks: [sampleTasks[0]],
  }

  const multiTaskRow: GanttRow = {
    id: 'row-2',
    name: 'Row 2',
    tasks: sampleTasks,
  }

  const emptyTaskRow: GanttRow = {
    id: 'row-3',
    name: 'Row 3',
    tasks: [],
  }

  describe('calculateRowSummaryDates', () => {
    it('returns null/0 for empty tasks', () => {
      const summary = calculateRowSummaryDates([])
      expect(summary.start).toBeNull()
      expect(summary.end).toBeNull()
      expect(summary.durationDays).toBe(0)
      expect(summary.durationMs).toBe(0)
      expect(summary.progress).toBeUndefined()
    })

    it('returns exact values for single task', () => {
      const summary = calculateRowSummaryDates([sampleTasks[0]])
      expect(summary.start?.getTime()).toBe(sampleTasks[0].start.getTime())
      expect(summary.end?.getTime()).toBe(sampleTasks[0].end.getTime())
      expect(summary.durationDays).toBe(5)
      expect(summary.durationMs).toBe(sampleTasks[0].end.getTime() - sampleTasks[0].start.getTime())
      expect(summary.progress).toBe(100)
    })

    it('returns aggregate min/max and weighted progress for multiple tasks', () => {
      const summary = calculateRowSummaryDates(sampleTasks)
      expect(summary.start?.getTime()).toBe(new Date(2026, 9, 1).getTime())
      expect(summary.end?.getTime()).toBe(new Date(2026, 9, 20).getTime())
      // span is Oct 1 to Oct 20 => 20 days
      expect(summary.durationDays).toBe(20)
      expect(summary.durationMs).toBe(new Date(2026, 9, 20).getTime() - new Date(2026, 9, 1).getTime())
      // weighted progress: (100 * 4d + 50 * 9d) / 13d = 850 / 13 = 65.38... => 65.4
      expect(summary.progress).toBeCloseTo(65.4, 1)
    })
  })

  describe('normalizeGridColumns', () => {
    it('provides standard default columns when input is undefined or empty', () => {
      const cols = normalizeGridColumns(undefined, jaLocale)
      expect(cols.length).toBeGreaterThan(0)
      const nameCol = cols.find((c) => c.id === 'name')
      expect(nameCol).toBeDefined()
      expect(nameCol?.title).toBe('タスク名')
      expect(nameCol?.isTreeColumn).toBe(true)
    })

    it('uses English locale titles when enLocale is provided', () => {
      const cols = normalizeGridColumns(undefined, enLocale)
      const nameCol = cols.find((c) => c.id === 'name')
      expect(nameCol?.title).toBe('Task Name')
      const wbsCol = cols.find((c) => c.id === 'wbs')
      expect(wbsCol?.title).toBe('WBS')
    })

    it('ensures at least one tree column exists if not specified', () => {
      const customCols: GanttColumn[] = [
        { id: 'wbs', width: 50 },
        { id: 'name', width: 200 },
      ]
      const cols = normalizeGridColumns(customCols, jaLocale)
      expect(cols[1].isTreeColumn).toBe(true)
    })
    it('uses month mode column titles (開始月, 終了月) when isMonthMode is true', () => {
      const colsJa = normalizeGridColumns(undefined, jaLocale, true)
      expect(colsJa.find((c) => c.id === 'startDate')?.title).toBe('開始月')
      expect(colsJa.find((c) => c.id === 'endDate')?.title).toBe('終了月')

      const colsEn = normalizeGridColumns(undefined, enLocale, true)
      expect(colsEn.find((c) => c.id === 'startDate')?.title).toBe('Start Month')
      expect(colsEn.find((c) => c.id === 'endDate')?.title).toBe('End Month')
    })

    it('sets wider default widths and titles (開始日時, 終了日時) for startDate and endDate when isTimeMode is true', () => {
      const colsJa = normalizeGridColumns(undefined, jaLocale, false, true)
      const startColJa = colsJa.find((c) => c.id === 'startDate')
      const endColJa = colsJa.find((c) => c.id === 'endDate')
      const durColJa = colsJa.find((c) => c.id === 'duration')

      expect(startColJa?.title).toBe('開始日時')
      expect(startColJa?.width).toBe(130)
      expect(startColJa?.minWidth).toBe(80)
      expect(endColJa?.title).toBe('終了日時')
      expect(endColJa?.width).toBe(130)
      expect(endColJa?.minWidth).toBe(80)
      expect(durColJa?.width).toBe(90)
      expect(durColJa?.minWidth).toBe(60)

      const colsEn = normalizeGridColumns(undefined, enLocale, false, true)
      const startColEn = colsEn.find((c) => c.id === 'startDate')
      const endColEn = colsEn.find((c) => c.id === 'endDate')
      expect(startColEn?.title).toBe('Start Date/Time')
      expect(endColEn?.title).toBe('End Date/Time')
    })

    it('handles explicit startDateTime and endDateTime columns', () => {
      const customCols: GanttColumn[] = [{ id: 'startDateTime' }, { id: 'endDateTime' }]
      const cols = normalizeGridColumns(customCols, jaLocale)
      expect(cols[0].title).toBe('開始日時')
      expect(cols[0].width).toBe(130)
      expect(cols[1].title).toBe('終了日時')
      expect(cols[1].width).toBe(130)
    })
  })

  describe('getGridCellValue & formatGridCellValue', () => {
    it('handles WBS column with wbsCode parameter or fallback', () => {
      const col: GanttColumn = { id: 'wbs' }
      const val = getGridCellValue(col, singleTaskRow, singleTaskRow.tasks, '1.2.3')
      expect(val).toBe('1.2.3')
      expect(formatGridCellValue(col, val, singleTaskRow, singleTaskRow.tasks, jaLocale)).toBe('1.2.3')
    })

    it('handles name column', () => {
      const col: GanttColumn = { id: 'name' }
      const val = getGridCellValue(col, singleTaskRow, singleTaskRow.tasks)
      expect(val).toBe('Row 1')
      expect(formatGridCellValue(col, val, singleTaskRow, singleTaskRow.tasks, jaLocale)).toBe('Row 1')
    })

    it('handles startDate and endDate columns in day and month modes', () => {
      const startCol: GanttColumn = { id: 'startDate' }
      const endCol: GanttColumn = { id: 'endDate' }

      const startVal = getGridCellValue(startCol, singleTaskRow, singleTaskRow.tasks)
      const endVal = getGridCellValue(endCol, singleTaskRow, singleTaskRow.tasks)
      expect(startVal).toEqual(sampleTasks[0].start)
      expect(endVal).toEqual(sampleTasks[0].end)

      // Day mode (default)
      expect(formatGridCellValue(startCol, startVal, singleTaskRow, singleTaskRow.tasks, jaLocale)).toBe('2026/10/1')
      expect(formatGridCellValue(endCol, endVal, singleTaskRow, singleTaskRow.tasks, jaLocale)).toBe('2026/10/5')
      expect(formatGridCellValue(startCol, startVal, singleTaskRow, singleTaskRow.tasks, enLocale)).toBe('10/1/2026')

      // Month mode (end date displays previous month)
      expect(formatGridCellValue(startCol, startVal, singleTaskRow, singleTaskRow.tasks, jaLocale, true)).toBe('2026/10')
      expect(formatGridCellValue(endCol, endVal, singleTaskRow, singleTaskRow.tasks, jaLocale, true)).toBe('2026/9')

      // Time mode (displays YYYY/M/D HH:mm, including 00:00)
      const hourlyTaskRow: GanttRow = {
        id: 'r-hourly',
        name: 'Hourly Row',
        tasks: [{ id: 'ht1', start: new Date(2026, 9, 1, 9, 30), end: new Date(2026, 9, 1, 18, 0) }],
      }
      const hStartVal = getGridCellValue(startCol, hourlyTaskRow, hourlyTaskRow.tasks)
      const hEndVal = getGridCellValue(endCol, hourlyTaskRow, hourlyTaskRow.tasks)
      expect(formatGridCellValue(startCol, hStartVal, hourlyTaskRow, hourlyTaskRow.tasks, jaLocale, false, true)).toBe('2026/10/1 09:30')
      expect(formatGridCellValue(endCol, hEndVal, hourlyTaskRow, hourlyTaskRow.tasks, jaLocale, false, true)).toBe('2026/10/1 18:00')

      // Midnight check (00:00 is not omitted)
      const midnightTaskRow: GanttRow = {
        id: 'r-midnight',
        name: 'Midnight Row',
        tasks: [{ id: 'mt1', start: new Date(2026, 9, 1, 0, 0), end: new Date(2026, 9, 2, 0, 0) }],
      }
      const mStartVal = getGridCellValue(startCol, midnightTaskRow, midnightTaskRow.tasks)
      const mEndVal = getGridCellValue(endCol, midnightTaskRow, midnightTaskRow.tasks)
      expect(formatGridCellValue(startCol, mStartVal, midnightTaskRow, midnightTaskRow.tasks, jaLocale, false, true)).toBe('2026/10/1 00:00')
      expect(formatGridCellValue(endCol, mEndVal, midnightTaskRow, midnightTaskRow.tasks, jaLocale, false, true)).toBe('2026/10/2 00:00')
    })

    it('handles startMonth and endMonth column IDs, with endMonth displaying previous month', () => {
      const startCol: GanttColumn = { id: 'startMonth' }
      const endCol: GanttColumn = { id: 'endMonth' }

      const startVal = getGridCellValue(startCol, singleTaskRow, singleTaskRow.tasks)
      const endVal = getGridCellValue(endCol, singleTaskRow, singleTaskRow.tasks)
      expect(startVal).toEqual(sampleTasks[0].start)
      expect(endVal).toEqual(sampleTasks[0].end)

      expect(formatGridCellValue(startCol, startVal, singleTaskRow, singleTaskRow.tasks, jaLocale)).toBe('2026/10')
      expect(formatGridCellValue(endCol, endVal, singleTaskRow, singleTaskRow.tasks, jaLocale)).toBe('2026/9')

      // Year transition check (e.g. 2027/01 -> previous month is 2026/12)
      const yearTransitionRow: GanttRow = {
        id: 'r-yt',
        name: 'YT',
        tasks: [{ id: 'yt1', start: new Date(2026, 9, 1), end: new Date(2027, 0, 1) }],
      }
      const ytEndVal = getGridCellValue(endCol, yearTransitionRow, yearTransitionRow.tasks)
      expect(formatGridCellValue(endCol, ytEndVal, yearTransitionRow, yearTransitionRow.tasks, jaLocale)).toBe('2026/12')
    })

    it('handles startDateTime and endDateTime column IDs', () => {
      const startCol: GanttColumn = { id: 'startDateTime' }
      const endCol: GanttColumn = { id: 'endDateTime' }

      const hourlyRow: GanttRow = {
        id: 'r-dt',
        name: 'DT',
        tasks: [{ id: 'dt1', start: new Date(2026, 9, 1, 9, 15), end: new Date(2026, 9, 1, 18, 45) }],
      }
      const startVal = getGridCellValue(startCol, hourlyRow, hourlyRow.tasks)
      const endVal = getGridCellValue(endCol, hourlyRow, hourlyRow.tasks)
      expect(startVal).toEqual(hourlyRow.tasks[0].start)
      expect(endVal).toEqual(hourlyRow.tasks[0].end)

      expect(formatGridCellValue(startCol, startVal, hourlyRow, hourlyRow.tasks, jaLocale)).toBe('2026/10/1 09:15')
      expect(formatGridCellValue(endCol, endVal, hourlyRow, hourlyRow.tasks, jaLocale)).toBe('2026/10/1 18:45')
    })

    it('handles duration and progress columns', () => {
      const durCol: GanttColumn = { id: 'duration' }
      const progCol: GanttColumn = { id: 'progress' }

      const durVal = getGridCellValue(durCol, multiTaskRow, multiTaskRow.tasks)
      const progVal = getGridCellValue(progCol, multiTaskRow, multiTaskRow.tasks)
      expect(durVal).toBe(20)
      expect(progVal).toBeCloseTo(65.4, 1)

      expect(formatGridCellValue(durCol, durVal, multiTaskRow, multiTaskRow.tasks, jaLocale)).toBe('20日')
      expect(formatGridCellValue(durCol, durVal, multiTaskRow, multiTaskRow.tasks, enLocale)).toBe('20 days')
      expect(formatGridCellValue(progCol, progVal, multiTaskRow, multiTaskRow.tasks, jaLocale)).toBe('65%')

      // Empty task row
      const emptyDur = getGridCellValue(durCol, emptyTaskRow, emptyTaskRow.tasks)
      const emptyProg = getGridCellValue(progCol, emptyTaskRow, emptyTaskRow.tasks)
      expect(emptyDur).toBe(0)
      expect(emptyProg).toBeUndefined()
      expect(formatGridCellValue(durCol, emptyDur, emptyTaskRow, emptyTaskRow.tasks, jaLocale)).toBe('-')
      expect(formatGridCellValue(progCol, emptyProg, emptyTaskRow, emptyTaskRow.tasks, jaLocale)).toBe('')

      // Explicit 0% progress returns '0%'
      expect(formatGridCellValue(progCol, 0, emptyTaskRow, emptyTaskRow.tasks, jaLocale)).toBe('0%')

      // Time mode duration
      const hourlyRow: GanttRow = {
        id: 'r-h',
        name: 'H',
        tasks: [{ id: 'h1', start: new Date(2026, 9, 1, 9, 0), end: new Date(2026, 9, 1, 10, 30) }],
      }
      expect(formatGridCellValue(durCol, 1, hourlyRow, hourlyRow.tasks, jaLocale, false, true)).toBe('1時間30分')
      expect(formatGridCellValue(durCol, 1, hourlyRow, hourlyRow.tasks, enLocale, false, true)).toBe('1 hour30 minutes')

      // Time mode with empty tasks returns '-'
      expect(formatGridCellValue(durCol, 0, emptyTaskRow, emptyTaskRow.tasks, jaLocale, false, true)).toBe('-')
    })

    it('supports custom field and custom valueGetter / formatter', () => {
      interface CustomRow extends GanttRow {
        assignee?: string
      }
      const rowWithCustom: CustomRow = {
        ...singleTaskRow,
        assignee: 'Alice',
      }

      const customCol: GanttColumn<CustomRow> = {
        id: 'assignee',
        title: '担当者',
        field: 'assignee',
      }
      const val = getGridCellValue(customCol, rowWithCustom, rowWithCustom.tasks)
      expect(val).toBe('Alice')

      const customGetterCol: GanttColumn<CustomRow> = {
        id: 'assigneeUpper',
        valueGetter: (row) => (row.assignee ? row.assignee.toUpperCase() : 'NONE'),
        formatter: (v) => `[${v}]`,
      }
      const getterVal = getGridCellValue(customGetterCol, rowWithCustom, rowWithCustom.tasks)
      expect(getterVal).toBe('ALICE')
      expect(formatGridCellValue(customGetterCol, getterVal, rowWithCustom, rowWithCustom.tasks)).toBe('[ALICE]')
    })
  })

  describe('inline cell editing helpers', () => {
    it('resolveColumnEditorType resolves appropriate editor types based on column id and mode', () => {
      expect(resolveColumnEditorType({ id: 'name' })).toBe('text')
      expect(resolveColumnEditorType({ id: 'startDate' }, false, false)).toBe('date')
      expect(resolveColumnEditorType({ id: 'startDate' }, true, false)).toBe('month')
      expect(resolveColumnEditorType({ id: 'startDate' }, false, true)).toBe('datetime')
      expect(resolveColumnEditorType({ id: 'startMonth' })).toBe('month')
      expect(resolveColumnEditorType({ id: 'endDateTime' })).toBe('datetime')
      expect(resolveColumnEditorType({ id: 'duration' })).toBe('number')
      expect(resolveColumnEditorType({ id: 'progress' })).toBe('number')
      expect(
        resolveColumnEditorType({
          id: 'status',
          editorOptions: [{ label: 'Open', value: 'open' }],
        }),
      ).toBe('select')
      expect(resolveColumnEditorType({ id: 'custom', editor: 'number' })).toBe('number')
    })

    it('isGridCellEditable checks gridEditable, column.editable, summary/parent rows, and task counts', () => {
      const nameCol: GanttColumn = { id: 'name' }
      const startCol: GanttColumn = { id: 'startDate' }
      const wbsCol: GanttColumn = { id: 'wbs' }

      // Default gridEditable = false -> false unless column.editable is explicitly set
      expect(isGridCellEditable(nameCol, singleTaskRow, singleTaskRow.tasks, false, false)).toBe(false)
      expect(
        isGridCellEditable({ id: 'name', editable: true }, singleTaskRow, singleTaskRow.tasks, false, false),
      ).toBe(true)

      // When gridEditable = true:
      expect(isGridCellEditable(nameCol, singleTaskRow, singleTaskRow.tasks, false, true)).toBe(true)
      expect(isGridCellEditable(wbsCol, singleTaskRow, singleTaskRow.tasks, false, true)).toBe(false)
      expect(isGridCellEditable(startCol, singleTaskRow, singleTaskRow.tasks, false, true)).toBe(true)

      // Multi-task, empty-task, or summary/parent rows disable task-bound columns
      expect(isGridCellEditable(startCol, multiTaskRow, multiTaskRow.tasks, false, true)).toBe(false)
      expect(isGridCellEditable(startCol, emptyTaskRow, emptyTaskRow.tasks, false, true)).toBe(false)
      expect(isGridCellEditable(startCol, singleTaskRow, singleTaskRow.tasks, true, true)).toBe(false)
      expect(
        isGridCellEditable(startCol, { ...singleTaskRow, isSummary: true }, singleTaskRow.tasks, false, true),
      ).toBe(false)

      // Name column remains editable on summary/parent rows and multi-task rows
      expect(isGridCellEditable(nameCol, multiTaskRow, multiTaskRow.tasks, true, true)).toBe(true)

      // Custom predicate function
      const fnCol: GanttColumn = {
        id: 'name',
        editable: (row) => row.id === 'row-1',
      }
      expect(isGridCellEditable(fnCol, singleTaskRow, singleTaskRow.tasks, false, false)).toBe(true)
      expect(isGridCellEditable(fnCol, multiTaskRow, multiTaskRow.tasks, false, true)).toBe(false)
    })

    it('formatGridCellEditValue formats values for input controls across modes', () => {
      expect(
        formatGridCellEditValue({ id: 'name' }, 'Row 1', singleTaskRow, singleTaskRow.tasks),
      ).toBe('Row 1')
      expect(
        formatGridCellEditValue(
          { id: 'startDate' },
          new Date(2026, 9, 1),
          singleTaskRow,
          singleTaskRow.tasks,
          false,
          false,
        ),
      ).toBe('2026-10-01')
      // Month mode: endDate stores 1st of next month (e.g. 2026-11-01 displays/edits as 2026-10)
      expect(
        formatGridCellEditValue(
          { id: 'endDate' },
          new Date(2026, 10, 1),
          singleTaskRow,
          singleTaskRow.tasks,
          true,
          false,
        ),
      ).toBe('2026-10')
      expect(
        formatGridCellEditValue(
          { id: 'startDateTime' },
          new Date(2026, 9, 1, 9, 30),
          singleTaskRow,
          singleTaskRow.tasks,
          false,
          true,
        ),
      ).toBe('2026-10-01T09:30')
      expect(
        formatGridCellEditValue({ id: 'duration' }, 5, singleTaskRow, singleTaskRow.tasks, false, false),
      ).toBe('5')
      expect(
        formatGridCellEditValue({ id: 'progress' }, 75, singleTaskRow, singleTaskRow.tasks),
      ).toBe('75')
    })

    it('applyGridCellEdit updates row name, task dates, duration, progress, and custom fields', () => {
      const makeRow = (): GanttRow & { assignee?: string } => ({
        id: 'r1',
        name: 'Task 1',
        assignee: 'Alice',
        tasks: [
          {
            id: 't1',
            name: 'Task 1',
            start: new Date(2026, 9, 1),
            end: new Date(2026, 9, 5),
            progress: 40,
          },
        ],
      })

      // 1. Name edit (syncs single task name when matching)
      const rName = makeRow()
      const resName = applyGridCellEdit({ id: 'name' }, rName, 'Updated Name')
      expect(resName.changed).toBe(true)
      expect(rName.name).toBe('Updated Name')
      expect(rName.tasks[0].name).toBe('Updated Name')

      // 2. Start date edit
      const rStart = makeRow()
      const resStart = applyGridCellEdit({ id: 'startDate' }, rStart, '2026-10-02')
      expect(resStart.changed).toBe(true)
      expect(rStart.tasks[0].start).toEqual(new Date(2026, 9, 2))

      // 3. End date edit in month mode (stores 1st of next month)
      const rMonth = makeRow()
      const resMonth = applyGridCellEdit({ id: 'endDate' }, rMonth, '2026-11', true, false)
      expect(resMonth.changed).toBe(true)
      expect(rMonth.tasks[0].end).toEqual(new Date(2026, 11, 1))

      // 4. Duration edit recalculates end date
      const rDur = makeRow()
      const resDur = applyGridCellEdit({ id: 'duration' }, rDur, '10')
      expect(resDur.changed).toBe(true)
      expect(rDur.tasks[0].end).toEqual(new Date(2026, 9, 10))

      // 5. Progress edit clamps to 0..100
      const rProg = makeRow()
      const resProg = applyGridCellEdit({ id: 'progress' }, rProg, '85')
      expect(resProg.changed).toBe(true)
      expect(rProg.tasks[0].progress).toBe(85)

      const resClamp = applyGridCellEdit({ id: 'progress' }, rProg, '150')
      expect(resClamp.changed).toBe(true)
      expect(rProg.tasks[0].progress).toBe(100)

      // 6. Custom field & valueSetter
      const rCustom = makeRow()
      const resField = applyGridCellEdit({ id: 'assignee', field: 'assignee' }, rCustom, 'Bob')
      expect(resField.changed).toBe(true)
      expect(rCustom.assignee).toBe('Bob')

      const resSetter = applyGridCellEdit(
        {
          id: 'assignee',
          field: 'assignee',
          valueSetter: (row, val) => {
            ;(row as any).assignee = String(val).toUpperCase()
          },
        },
        rCustom,
        'charlie',
      )
      expect(resSetter.changed).toBe(true)
      expect(rCustom.assignee).toBe('CHARLIE')
    })
  })
})


import { describe, it, expect, vi } from 'vitest'
import ExcelJS from 'exceljs'
import {
  excelPlugin,
  ExcelPlugin,
  exportExcel,
  exportGanttToExcel,
} from '../index'
import {
  hexToArgb,
  sanitizeSheetName,
  calculateWbsHierarchy,
  getTimelineRange,
  generateDateList,
  generateTimelineList,
  detectTimelineScale,
  detectTimelineColumnWidth,
  pxToExcelColumnWidth,
  getDayOfWeekText,
} from '../utils'
import type { GanttRow } from '@mogura/moguchart-core'

describe('Utils', () => {
  it('sanitizeSheetName should strip illegal characters and enforce 31 chars limit', () => {
    expect(sanitizeSheetName('[日単位]サンプルプロジェクトのコピー')).toBe('日単位サンプルプロジェクトのコピー')
    expect(sanitizeSheetName('a*b?c:d\\e/f[g]h')).toBe('abcdefgh')
    expect(sanitizeSheetName('   ')).toBe('工程表')
    expect(sanitizeSheetName(undefined)).toBe('工程表')
    expect(sanitizeSheetName('12345678901234567890123456789012345')).toHaveLength(31)
    expect(sanitizeSheetName('12345678901234567890123456789012345', '工程表', 24)).toHaveLength(24)
  })

  it('hexToArgb should correctly convert hex colors to ARGB', () => {
    expect(hexToArgb('#3B82F6')).toBe('FF3B82F6')
    expect(hexToArgb('3B82F6')).toBe('FF3B82F6')
    expect(hexToArgb('#FFF')).toBe('FFFFFFFF')
    expect(hexToArgb(undefined, 'FF000000')).toBe('FF000000')
    expect(hexToArgb('invalid', 'FF000000')).toBe('FF000000')
  })

  it('calculateWbsHierarchy should generate correct WBS numbers and depths', () => {
    const rows: GanttRow[] = [
      { id: '1', name: '大工程1', tasks: [] },
      { id: '2', name: '中工程1-1', parentId: '1', tasks: [] },
      { id: '3', name: '詳細タスク1-1-1', parentId: '2', tasks: [] },
      { id: '4', name: '大工程2', tasks: [] },
    ]

    const flat = calculateWbsHierarchy(rows)
    expect(flat).toHaveLength(4)
    expect(flat[0].wbsNumber).toBe('1')
    expect(flat[0].depth).toBe(0)
    expect(flat[0].isParent).toBe(true)

    expect(flat[1].wbsNumber).toBe('1.1')
    expect(flat[1].depth).toBe(1)
    expect(flat[1].isParent).toBe(true)

    expect(flat[2].wbsNumber).toBe('1.1.1')
    expect(flat[2].depth).toBe(2)
    expect(flat[2].isParent).toBe(false)

    expect(flat[3].wbsNumber).toBe('2')
    expect(flat[3].depth).toBe(0)
    expect(flat[3].isParent).toBe(false)
  })

  it('getTimelineRange should calculate min start and max end dates', () => {
    const rows: GanttRow[] = [
      {
        id: '1',
        name: 'Row 1',
        tasks: [
          {
            id: 't1',
            name: 'Task 1',
            start: new Date(2026, 8, 1),
            end: new Date(2026, 8, 10),
          },
          {
            id: 't2',
            name: 'Task 2',
            start: new Date(2026, 8, 5),
            end: new Date(2026, 8, 20),
          },
        ],
      },
    ]

    const range = getTimelineRange(rows)
    expect(range.startDate.getFullYear()).toBe(2026)
    expect(range.startDate.getMonth()).toBe(8)
    expect(range.startDate.getDate()).toBe(1)

    expect(range.endDate.getFullYear()).toBe(2026)
    expect(range.endDate.getMonth()).toBe(8)
    expect(range.endDate.getDate()).toBe(20)
  })

  it('getTimelineRange should respect calendar start/end when options are not specified', () => {
    const rows: GanttRow[] = [
      {
        id: '1',
        name: 'Row 1',
        tasks: [
          {
            id: 't1',
            name: 'Task 1',
            start: new Date(2026, 8, 10),
            end: new Date(2026, 8, 15),
          },
        ],
      },
    ]

    const calendar = {
      start: new Date(2026, 8, 1),
      end: new Date(2026, 8, 30),
    }

    const range = getTimelineRange(rows, undefined, 'day', calendar)
    expect(range.startDate.getDate()).toBe(1)
    expect(range.endDate.getDate()).toBe(30)
  })

  it('getTimelineRange should prioritize explicit options over calendar dates', () => {
    const rows: GanttRow[] = []
    const calendar = {
      start: new Date(2026, 8, 1),
      end: new Date(2026, 8, 30),
    }
    const options = {
      startDate: new Date(2026, 8, 5),
      endDate: new Date(2026, 8, 25),
    }

    const range = getTimelineRange(rows, options, 'day', calendar)
    expect(range.startDate.getDate()).toBe(5)
    expect(range.endDate.getDate()).toBe(25)
  })

  it('generateDateList should produce list of dates with weekend info', () => {
    const start = new Date(2026, 8, 1) // 2026-09-01
    const end = new Date(2026, 8, 3) // 2026-09-03
    const dates = generateDateList(start, end, true)

    expect(dates).toHaveLength(3)
    expect(dates[0].day).toBe(1)
    expect(dates[1].day).toBe(2)
    expect(dates[2].day).toBe(3)
  })

  it('getDayOfWeekText should return proper Japanese day text', () => {
    expect(getDayOfWeekText(0)).toBe('日')
    expect(getDayOfWeekText(1)).toBe('月')
    expect(getDayOfWeekText(6)).toBe('土')
  })

  it('detectTimelineScale should detect scale based on options and calendar', () => {
    // 明示的指定が最優先
    expect(detectTimelineScale(undefined, 'month')).toBe('month')
    expect(detectTimelineScale({ option: { calendar: { showTime: true } } } as any, 'day')).toBe('day')

    // calendar からの自動検出
    expect(detectTimelineScale({ option: { calendar: { showTime: true } } } as any)).toBe('hour')
    expect(detectTimelineScale({ option: { calendar: { showMonthsRow: true } } } as any)).toBe('month')
    expect(detectTimelineScale({ option: { calendar: { pxPerMonth: 60, showDays: false } } } as any)).toBe('month')
    expect(detectTimelineScale({ option: { calendar: { showWeeks: true, showDays: false } } } as any)).toBe('week')
    expect(detectTimelineScale({ option: { calendar: { showDays: true } } } as any)).toBe('day')
    expect(detectTimelineScale(undefined)).toBe('day')
  })

  it('generateTimelineList should produce scale-specific timeline items', () => {
    // month
    const startMonth = new Date(2026, 0, 1)
    const endMonth = new Date(2026, 2, 31)
    const monthItems = generateTimelineList(startMonth, endMonth, 'month')
    expect(monthItems).toHaveLength(3)
    expect(monthItems[0].groupLabel).toBe('2026年')
    expect(monthItems[0].subLabel).toBe('1月')
    expect(monthItems[2].subLabel).toBe('3月')

    // week
    const startWeek = new Date(2026, 8, 1) // 2026-09-01
    const endWeek = new Date(2026, 8, 15) // 2026-09-15
    const weekItems = generateTimelineList(startWeek, endWeek, 'week')
    expect(weekItems.length).toBeGreaterThanOrEqual(2)
    expect(weekItems[0].subLabel).toContain('〜')

    // hour
    const startHour = new Date(2026, 8, 1, 9, 0, 0)
    const endHour = new Date(2026, 8, 1, 12, 0, 0)
    const hourItems = generateTimelineList(startHour, endHour, 'hour', true)
    expect(hourItems).toHaveLength(4) // 09:00, 10:00, 11:00, 12:00
    expect(hourItems[0].subLabel).toBe('09:00')
    expect(hourItems[3].subLabel).toBe('12:00')

    // custom columnWidth
    const customWidthItems = generateTimelineList(startMonth, endMonth, 'month', true, 12.5)
    expect(customWidthItems[0].width).toBe(12.5)
  })

  it('pxToExcelColumnWidth should convert pixels to character width with minWidth', () => {
    expect(pxToExcelColumnWidth(28, 3.5)).toBe(3.7) // 28 / 7.5 = 3.733 -> 3.7
    expect(pxToExcelColumnWidth(10, 3.5)).toBe(3.5) // minWidth guard
    expect(pxToExcelColumnWidth(60)).toBe(8) // 60 / 7.5 = 8
  })

  it('detectTimelineColumnWidth should prioritize explicit options, then calendar px, then defaults', () => {
    // 1. 明示的オプション最優先
    expect(detectTimelineColumnWidth(undefined, 10, 'day')).toBe(10)
    expect(detectTimelineColumnWidth({ option: { calendar: { pxPerDay: 50 } } } as any, 10, 'day')).toBe(10)

    // 2. chart.option.calendar からの自動換算
    const chartDay: any = { option: { calendar: { pxPerDay: 45 } } }
    expect(detectTimelineColumnWidth(chartDay, undefined, 'day')).toBe(6) // 45 / 7.5 = 6

    const chartMonth: any = { option: { calendar: { pxPerMonth: 75 } } }
    expect(detectTimelineColumnWidth(chartMonth, undefined, 'month')).toBe(10) // 75 / 7.5 = 10

    const chartHour: any = { option: { calendar: { pxPerDay: 24 * 60 } } } // 60px/hour
    expect(detectTimelineColumnWidth(chartHour, undefined, 'hour')).toBe(8) // 60 / 7.5 = 8

    // 3. デフォルトフォールバック
    expect(detectTimelineColumnWidth(undefined, undefined, 'day')).toBe(4.2)
    expect(detectTimelineColumnWidth(undefined, undefined, 'month')).toBe(8.0)
    expect(detectTimelineColumnWidth(undefined, undefined, 'week')).toBe(7.5)
    expect(detectTimelineColumnWidth(undefined, undefined, 'hour')).toBe(5.0)
  })
})

describe('Plugin Registration & Methods', () => {
  it('should install exportExcel method onto chart element', () => {
    const dummyChart: any = {
      rows: [],
      option: {},
    }

    const plugin = excelPlugin({
      defaultFilename: 'test.xlsx',
    })

    expect(plugin.name).toBe('excel')
    expect(plugin.version).toBe('1.2.0')

    plugin.install?.(dummyChart)
    expect(typeof dummyChart.exportExcel).toBe('function')
  })

  it('ExcelPlugin class should work identically', () => {
    const dummyChart: any = {
      rows: [],
      option: {},
    }

    const plugin = new ExcelPlugin({
      defaultFilename: 'class-test.xlsx',
    })

    plugin.install(dummyChart)
    expect(typeof dummyChart.exportExcel).toBe('function')
  })
})

describe('exportGanttToExcel', () => {
  const sampleRows: GanttRow[] = [
    {
      id: 'row-1',
      name: '要件定義',
      tasks: [
        {
          id: 'task-1',
          name: 'ヒアリング',
          start: new Date(2026, 8, 1),
          end: new Date(2026, 8, 5),
          progress: 100,
        },
        {
          id: 'task-2',
          name: '仕様書作成',
          start: new Date(2026, 8, 6),
          end: new Date(2026, 8, 12),
          progress: 50,
          dependencies: ['task-1'],
        },
      ],
    },
    {
      id: 'row-2',
      name: '開発フェーズ',
      parentId: 'row-1',
      tasks: [
        {
          id: 'task-3',
          name: '実装',
          start: new Date(2026, 8, 13),
          end: new Date(2026, 8, 25),
          progress: 20,
          progressColor: '#10B981',
        },
      ],
    },
  ]

  it('should generate valid Blob with with-timeline mode', async () => {
    const dummyChart: any = {
      rows: sampleRows,
      option: {},
    }

    const blob = await exportGanttToExcel(dummyChart, {
      mode: 'with-timeline',
      download: false,
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    expect(blob.size).toBeGreaterThan(0)
  })

  it('should generate valid Blob with table-only mode', async () => {
    const dummyChart: any = {
      rows: sampleRows,
      option: {},
    }

    const blob = await exportGanttToExcel(dummyChart, {
      mode: 'table-only',
      download: false,
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  it('should generate valid Blob with both mode', async () => {
    const dummyChart: any = {
      rows: sampleRows,
      option: {},
    }

    const blob = await exportExcel(dummyChart, {
      mode: 'both',
      download: false,
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  it('should handle empty rows gracefully', async () => {
    const dummyChart: any = {
      rows: [],
      option: {},
    }

    const blob = await exportGanttToExcel(dummyChart, {
      download: false,
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  it('should safely export when sheetName contains invalid characters like [ or ]', async () => {
    const dummyChart: any = {
      rows: sampleRows,
      option: {},
    }

    const blob = await exportGanttToExcel(dummyChart, {
      sheetName: '[日単位]サンプルプロジェクトのコピー',
      mode: 'both',
      download: false,
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  it('should export with month timelineScale', async () => {
    const dummyChart: any = {
      rows: sampleRows,
      option: {},
    }

    const blob = await exportGanttToExcel(dummyChart, {
      timelineScale: 'month',
      download: false,
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  it('should export with week timelineScale', async () => {
    const dummyChart: any = {
      rows: sampleRows,
      option: {},
    }

    const blob = await exportGanttToExcel(dummyChart, {
      timelineScale: 'week',
      download: false,
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  it('should export with hour timelineScale', async () => {
    const dummyChart: any = {
      rows: sampleRows,
      option: {},
    }

    const blob = await exportGanttToExcel(dummyChart, {
      timelineScale: 'hour',
      download: false,
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  it('should auto-detect hour scale from chart option showTime', async () => {
    const dummyChart: any = {
      rows: sampleRows,
      option: {
        calendar: {
          showTime: true,
        },
      },
    }

    const blob = await exportGanttToExcel(dummyChart, {
      download: false,
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  it('should honor chart.option.calendar start and end dates', async () => {
    const dummyChart: any = {
      rows: sampleRows,
      option: {
        calendar: {
          start: new Date(2026, 7, 1),
          end: new Date(2026, 9, 31),
        },
      },
    }

    const blob = await exportGanttToExcel(dummyChart, {
      download: false,
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  it('should apply timelineColumnWidth when exporting', async () => {
    const dummyChart: any = {
      rows: sampleRows,
      option: {},
    }

    const blob = await exportGanttToExcel(dummyChart, {
      timelineColumnWidth: 10,
      download: false,
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })
})

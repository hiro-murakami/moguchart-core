import { describe, it, expect, vi } from 'vitest'
import ExcelJS from 'exceljs'
import {
  excelPlugin,
  ExcelPlugin,
  exportExcel,
  exportGanttToExcel,
  getDefaultColumns,
  registerExcelLocale,
  getExcelLocale,
  getSupportedExcelLocales,
  resolveExcelLocale,
  zhLocale,
} from '../index'
import {
  hexToArgb,
  sanitizeSheetName,
  calculateWbsHierarchy,
  getTimelineRange,
  generateTimelineList,
  detectTimelineScale,
  detectTimelineColumnWidth,
  detectColumnsPerUnit,
  detectLocale,
  extractTaskBarColor,
  getContrastArgb,
  getTimelineCellBgColor,
  pxToExcelColumnWidth,
  getDayOfWeekText,
  toExcelDate,
} from '../utils'
import type { GanttRow } from '@mogura/moguchart-core'

describe('Utils', () => {
  it('toExcelDate should adjust date to match local time in UTC representation', () => {
    const localDate = new Date(2025, 0, 1, 0, 0, 0)
    const excelDate = toExcelDate(localDate)
    expect(excelDate.getUTCFullYear()).toBe(2025)
    expect(excelDate.getUTCMonth()).toBe(0)
    expect(excelDate.getUTCDate()).toBe(1)
  })

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
    // rgb / rgba
    expect(hexToArgb('rgb(239, 83, 80)')).toBe('FFEF5350')
    expect(hexToArgb('rgba(66, 165, 245, 1)')).toBe('FF42A5F5')
    // カラー名
    expect(hexToArgb('red')).toBe('FFFF0000')
    expect(hexToArgb('black')).toBe('FF000000')
  })

  it('getContrastArgb should return contrasting font color based on luminance', () => {
    // 明るい背景（黄色、白）には黒文字
    expect(getContrastArgb('FFFFEE58')).toBe('FF000000')
    expect(getContrastArgb('FFFFFFFF')).toBe('FF000000')
    // 暗い背景（青、濃いグレー）には白文字
    expect(getContrastArgb('FF3B82F6')).toBe('FFFFFFFF')
    expect(getContrastArgb('FF334155')).toBe('FFFFFFFF')
  })

  it('extractTaskBarColor should resolve task colors from style, colorPalette, progressColor or fallbacks', () => {
    // 1. task.style の background-color
    const taskWithStyle = {
      id: '1',
      start: new Date(),
      end: new Date(),
      style: 'background-color: #ef5350; box-shadow: none;',
    } as any
    expect(extractTaskBarColor(taskWithStyle)).toBe('FFEF5350')

    // 2. task.attribute.colorPalette.backgroundColor
    const taskWithPalette = {
      id: '2',
      start: new Date(),
      end: new Date(),
      attribute: { colorPalette: { backgroundColor: '#ab47bc' } },
    } as any
    expect(extractTaskBarColor(taskWithPalette)).toBe('FFAB47BC')

    // 3. task.progressColor
    const taskWithProgressColor = {
      id: '3',
      start: new Date(),
      end: new Date(),
      progressColor: '#10b981',
    } as any
    expect(extractTaskBarColor(taskWithProgressColor)).toBe('FF10B981')

    // 4. サマリータスク（未指定時は #334155）
    const summaryTask = {
      id: '4',
      start: new Date(),
      end: new Date(),
      type: 'summary',
    } as any
    expect(extractTaskBarColor(summaryTask)).toBe('FF334155')

    // サマリータスク（スタイル指定時はスタイル優先）
    const summaryWithStyle = {
      id: '5',
      start: new Date(),
      end: new Date(),
      type: 'summary',
      style: 'background-color: #42a5f5;',
    } as any
    expect(extractTaskBarColor(summaryWithStyle)).toBe('FF42A5F5')

    // 5. 通常タスク（未指定時は themeArgb）
    const defaultTask = {
      id: '6',
      start: new Date(),
      end: new Date(),
    } as any
    expect(extractTaskBarColor(defaultTask, false, 'FF3B82F6')).toBe('FF3B82F6')
  })

  it('getTimelineCellBgColor should return distinct background colors for holidays, weekends and weekdays', () => {
    // 1. 祝祭日
    const holidayItem: any = {
      isHoliday: true,
      isWeekend: false,
      startDate: new Date(2026, 8, 21), // 敬老の日（月曜）
    }
    expect(getTimelineCellBgColor(holidayItem)).toBe('FFFEE2E2')
    expect(getTimelineCellBgColor(holidayItem, 'FFFFE4E6')).toBe('FFFFE4E6')

    // 2. 土曜日
    const saturdayItem: any = {
      isHoliday: false,
      isWeekend: true,
      startDate: new Date(2026, 8, 5), // 土曜
    }
    expect(getTimelineCellBgColor(saturdayItem)).toBe('FFEFF6FF')

    // 3. 日曜日（祝祭日と同じ色）
    const sundayItem: any = {
      isHoliday: false,
      isWeekend: true,
      startDate: new Date(2026, 8, 6), // 日曜
    }
    expect(getTimelineCellBgColor(sundayItem)).toBe('FFFEE2E2')

    // 4. 平日
    const weekdayItem: any = {
      isHoliday: false,
      isWeekend: false,
      startDate: new Date(2026, 8, 7), // 月曜
    }
    expect(getTimelineCellBgColor(weekdayItem)).toBeNull()

    // 5. 日単位以外（hour, week, month）のスケールでは土日祝でも背景色を指定しない（null）
    expect(getTimelineCellBgColor(holidayItem, 'FFFEE2E2', 'hour')).toBeNull()
    expect(getTimelineCellBgColor(sundayItem, 'FFFEE2E2', 'week')).toBeNull()
    expect(getTimelineCellBgColor(saturdayItem, 'FFFEE2E2', 'month')).toBeNull()
    expect(getTimelineCellBgColor({ ...holidayItem, scale: 'hour' })).toBeNull()
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
    expect(hourItems).toHaveLength(4) // 9, 10, 11, 12
    expect(hourItems[0].subLabel).toBe('9')
    expect(hourItems[3].subLabel).toBe('12')
    expect(hourItems[0].groupLabel).toBe('2026年9月1日')

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

    // 4. columnsPerUnit による幅調整
    expect(detectTimelineColumnWidth(undefined, undefined, 'day', 2)).toBe(3.8)
    expect(detectTimelineColumnWidth(undefined, undefined, 'hour', 2)).toBe(3.8)
  })

  it('detectColumnsPerUnit should calculate column divisions correctly', () => {
    // 1. 月・週スケールは常に 1
    expect(detectColumnsPerUnit(undefined, { columnsPerUnit: 4 }, 'month')).toBe(1)
    expect(detectColumnsPerUnit(undefined, { columnsPerUnit: 4 }, 'week')).toBe(1)

    // 2. 明示的 columnsPerUnit 指定
    expect(detectColumnsPerUnit(undefined, { columnsPerUnit: 2 }, 'day')).toBe(2)
    expect(detectColumnsPerUnit(undefined, { columnsPerUnit: 4 }, 'hour')).toBe(4)

    // 3. options.snapDurationMinutes からの算出
    // 日単位 (1440分基準)
    expect(detectColumnsPerUnit(undefined, { snapDurationMinutes: 1440 }, 'day')).toBe(1)
    expect(detectColumnsPerUnit(undefined, { snapDurationMinutes: 720 }, 'day')).toBe(2)
    expect(detectColumnsPerUnit(undefined, { snapDurationMinutes: 360 }, 'day')).toBe(4)
    expect(detectColumnsPerUnit(undefined, { snapDurationMinutes: 180 }, 'day')).toBe(8)
    // 時間単位 (60分基準)
    expect(detectColumnsPerUnit(undefined, { snapDurationMinutes: 60 }, 'hour')).toBe(1)
    expect(detectColumnsPerUnit(undefined, { snapDurationMinutes: 30 }, 'hour')).toBe(2)
    expect(detectColumnsPerUnit(undefined, { snapDurationMinutes: 15 }, 'hour')).toBe(4)

    // 4. chart.option.snapDuration からの算出
    const chartDay: any = { option: { snapDuration: 720 } }
    expect(detectColumnsPerUnit(chartDay, undefined, 'day')).toBe(2)

    const chartHour: any = { option: { snapDuration: 15 } }
    expect(detectColumnsPerUnit(chartHour, undefined, 'hour')).toBe(4)

    // 5. デフォルト
    expect(detectColumnsPerUnit(undefined, undefined, 'day')).toBe(1)
    expect(detectColumnsPerUnit(undefined, undefined, 'hour')).toBe(1)
  })

  it('generateTimelineList should support multi-column per day/hour', () => {
    // 日単位で1日2列 (columnsPerUnit = 2)
    const startDay = new Date(2026, 8, 1)
    const endDay = new Date(2026, 8, 1)
    const dayItems = generateTimelineList(startDay, endDay, 'day', true, undefined, 2)
    expect(dayItems).toHaveLength(2)
    expect(dayItems[0].subLabel).toBe('00:00')
    expect(dayItems[1].subLabel).toBe('12:00')
    expect(dayItems[0].groupLabel).toBe(dayItems[1].groupLabel) // 同じ日グループ

    // 時間単位で1時間2列 (columnsPerUnit = 2)
    const startHour = new Date(2026, 8, 1, 9, 0, 0)
    const endHour = new Date(2026, 8, 1, 9, 0, 0)
    const hourItems = generateTimelineList(startHour, endHour, 'hour', true, undefined, 2)
    expect(hourItems).toHaveLength(2)
    expect(hourItems[0].subLabel).toBe('9')
    expect(hourItems[1].subLabel).toBe('')
    expect(hourItems[0].groupLabel).toBe('2026年9月1日') // 日付だけ
    expect(hourItems[1].groupLabel).toBe('2026年9月1日')

    // 祝祭日フラグの判定 (2026-09-21: 敬老の日)
    const isHolidayMock = (d: Date) => d.getDate() === 21
    const holidayItems = generateTimelineList(
      new Date(2026, 8, 20),
      new Date(2026, 8, 22),
      'day',
      true,
      undefined,
      1,
      isHolidayMock
    )
    expect(holidayItems).toHaveLength(3)
    expect(holidayItems[0].isHoliday).toBe(false) // 9/20 (日)
    expect(holidayItems[1].isHoliday).toBe(true) // 9/21 (敬老の日)
    expect(holidayItems[2].isHoliday).toBe(false) // 9/22 (火)
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

  it('should generate valid Blob with gantt chart export', async () => {
    const dummyChart: any = {
      rows: sampleRows,
      option: {},
    }

    const blob = await exportGanttToExcel(dummyChart, {
      download: false,
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
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

  it('should export with snapDurationMinutes and multi-column per day', async () => {
    const dummyChart: any = {
      rows: sampleRows,
      option: {},
    }

    const blob = await exportGanttToExcel(dummyChart, {
      snapDurationMinutes: 720, // 1日あたり2列 (12時間スナップ)
      download: false,
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  it('should export with columnsPerUnit in hour scale', async () => {
    const dummyChart: any = {
      rows: sampleRows,
      option: {},
    }

    const blob = await exportGanttToExcel(dummyChart, {
      timelineScale: 'hour',
      columnsPerUnit: 2, // 1時間あたり2列 (30分ごと)
      download: false,
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })

  it('should reflect task custom colors from style and colorPalette in Excel cells', async () => {
    const customColorRows: GanttRow[] = [
      {
        id: 'row-custom',
        name: 'デザイン',
        tasks: [
          {
            id: 'task-red',
            name: 'ワイヤーフレーム',
            start: new Date(2026, 8, 1),
            end: new Date(2026, 8, 3),
            style: 'background-color: #ef5350;',
            progress: 50,
          },
          {
            id: 'task-palette',
            name: 'モックアップ',
            start: new Date(2026, 8, 4),
            end: new Date(2026, 8, 6),
            attribute: {
              colorPalette: { backgroundColor: '#ffee58' }, // 明るい黄色
            },
            progress: 80,
          } as any,
        ],
      },
    ]

    const dummyChart: any = {
      rows: customColorRows,
      option: {},
    }

    const blob = await exportGanttToExcel(dummyChart, {
      download: false,
    })

    const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as ArrayBuffer)
      reader.onerror = reject
      reader.readAsArrayBuffer(blob)
    })
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(arrayBuffer)
    const ws = workbook.getWorksheet('工程表')
    expect(ws).toBeDefined()

    // 1行目タスク (row 3): 9/1〜9/3 は #ef5350 ('FFEF5350')
    const redCell = ws!.getCell(3, 10) // table cols (9) + 1st day (1) = 10
    expect((redCell.fill as any)?.fgColor?.argb).toBe('FFEF5350')
    // #ef5350 は暗い色なので進捗文字色は白
    expect(redCell.font?.color?.argb).toBe('FFFFFFFF')

    // 2行目タスク (row 4): 9/4〜9/6 は #ffee58 ('FFFFEE58')
    const yellowCell = ws!.getCell(4, 13) // table cols (9) + 4th day (4) = 13
    expect((yellowCell.fill as any)?.fgColor?.argb).toBe('FFFFEE58')
    // #ffee58 は明るい黄色なので進捗文字色は黒
    expect(yellowCell.font?.color?.argb).toBe('FF000000')
  })

  it('should render distinct background and text colors for holidays in Excel', async () => {
    // 2026年9月21日（月）が祝日（敬老の日）
    const holidayRows: GanttRow[] = [
      {
        id: 'row-1',
        name: '業務',
        tasks: [
          {
            id: 'task-1',
            name: '平日タスク',
            start: new Date(2026, 8, 22),
            end: new Date(2026, 8, 22),
          },
        ],
      },
    ]

    const dummyChart: any = {
      rows: holidayRows,
      option: {
        calendar: {
          start: new Date(2026, 8, 20), // 9/20(日)
          end: new Date(2026, 8, 23), // 9/23(水・祝)
          isHoliday: (d: Date) => d.getDate() === 21 || d.getDate() === 23,
        },
      },
    }

    const blob = await exportGanttToExcel(dummyChart, {
      download: false,
    })

    const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as ArrayBuffer)
      reader.onerror = reject
      reader.readAsArrayBuffer(blob)
    })
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(arrayBuffer)
    const ws = workbook.getWorksheet('工程表')
    expect(ws).toBeDefined()

    // カラム列: 8列 (WBS 〜 先行タスク)
    // タイムライン列:
    // col 9: 9/20 (日)
    // col 10: 9/21 (月・祝)
    // col 11: 9/22 (火・平日)
    // col 12: 9/23 (水・祝)

    // ヘッダー行2 (row 2)
    const sundayHeader = ws!.getCell(2, 10)
    expect((sundayHeader.fill as any)?.fgColor?.argb).toBe('FFFEE2E2') // 日曜も祝祭日と同じ淡いピンク/赤
    expect(sundayHeader.font?.color?.argb).toBe('FFDC2626') // 赤文字

    const holidayHeader = ws!.getCell(2, 11)
    expect((holidayHeader.fill as any)?.fgColor?.argb).toBe('FFFEE2E2') // 祝祭日淡いピンク/赤
    expect(holidayHeader.font?.color?.argb).toBe('FFDC2626') // 赤文字

    const weekdayHeader = ws!.getCell(2, 12)
    expect((weekdayHeader.fill as any)?.fgColor?.argb).toBe('FFF8FAFC') // 平日ヘッダー

    // データ行 (row 3): タスクがない 9/21(祝) のセルは祝日色
    const holidayDataCell = ws!.getCell(3, 11)
    expect((holidayDataCell.fill as any)?.fgColor?.argb).toBe('FFFEE2E2')

    // タスクがない 9/20(日) のセルも祝祭日と同じ色
    const sundayDataCell = ws!.getCell(3, 10)
    expect((sundayDataCell.fill as any)?.fgColor?.argb).toBe('FFFEE2E2')
  })

  it('should not apply holiday/weekend background colors when timelineScale is not day (e.g. hour scale)', async () => {
    const dummyChart: any = {
      rows: [
        {
          id: '1',
          name: 'タスク1',
          tasks: [],
        },
      ],
      option: {
        calendar: {
          start: new Date(2026, 8, 20, 0, 0, 0), // 日曜日
          end: new Date(2026, 8, 20, 3, 0, 0),
          isHoliday: (d: Date) => d.getDate() === 20,
        },
      },
    }

    const blob = await exportGanttToExcel(dummyChart, {
      timelineScale: 'hour',
      download: false,
    })

    const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as ArrayBuffer)
      reader.onerror = reject
      reader.readAsArrayBuffer(blob)
    })
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(arrayBuffer)
    const ws = workbook.getWorksheet('工程表')
    expect(ws).toBeDefined()

    // タイムラインのサブヘッダー（row 2, col 10 = 00:00）
    const hourHeader = ws!.getCell(2, 10)
    // 日単位ではないため、祝日・日曜背景色（FFFEE2E2）は適用されず通常のFFF8FAFC
    expect((hourHeader.fill as any)?.fgColor?.argb).toBe('FFF8FAFC')

    // データ行のセル（row 3, col 10）
    const hourDataCell = ws!.getCell(3, 10)
    // 日単位ではないため、背景色は設定されない（undefined / null）
    expect((hourDataCell.fill as any)?.fgColor?.argb).toBeUndefined()
  })

  it('should render exact task bar cells without overrunning by 1 cell on boundary', async () => {
    // 1. 日単位: 9/1 00:00 〜 9/5 00:00 (実質 9/1 〜 9/4 の4日間)
    const dayChart: any = {
      rows: [
        {
          id: '1',
          name: 'タスク1',
          tasks: [
            {
              id: 't1',
              name: 'ヒアリング',
              start: new Date(2026, 8, 1, 0, 0, 0),
              end: new Date(2026, 8, 5, 0, 0, 0),
              progress: 50,
            },
          ],
        },
      ],
      option: {
        calendar: {
          start: new Date(2026, 8, 1, 0, 0, 0),
          end: new Date(2026, 8, 10, 0, 0, 0),
        },
      },
    }

    const dayBlob = await exportGanttToExcel(dayChart, {
      timelineScale: 'day',
      download: false,
    })

    const readBlob = (blob: Blob) =>
      new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as ArrayBuffer)
        reader.onerror = reject
        reader.readAsArrayBuffer(blob)
      })

    const dayBuf = await readBlob(dayBlob)
    const dayWb = new ExcelJS.Workbook()
    await dayWb.xlsx.load(dayBuf)
    const dayWs = dayWb.getWorksheet('工程表')!

    // テーブル列: 8列 (WBS〜先行タスク)
    // タイムライン列:
    // col 10: 9/1
    // col 11: 9/2
    // col 12: 9/3
    // col 13: 9/4
    // col 14: 9/5
    const cell9_1 = dayWs.getCell(3, 10)
    const cell9_2 = dayWs.getCell(3, 11)
    const cell9_3 = dayWs.getCell(3, 12)
    const cell9_4 = dayWs.getCell(3, 13)
    const cell9_5 = dayWs.getCell(3, 14)

    // 9/1 〜 9/4 はタスクバー色（デフォルトテーマ色: FF3B82F6）
    expect((cell9_1.fill as any)?.fgColor?.argb).toBe('FF3B82F6')
    expect((cell9_2.fill as any)?.fgColor?.argb).toBe('FF3B82F6')
    expect((cell9_3.fill as any)?.fgColor?.argb).toBe('FF3B82F6')
    expect((cell9_4.fill as any)?.fgColor?.argb).toBe('FF3B82F6')

    // 9/5 はタスク範囲外（1セル分長くならず、タスク色で塗られない）
    expect((cell9_5.fill as any)?.fgColor?.argb).not.toBe('FF3B82F6')

    // 2. 時間単位: 09:00:00 〜 09:30:00 (スナップ30分 = 2列/時)
    const hourChart: any = {
      rows: [
        {
          id: '1',
          name: 'タスク1',
          tasks: [
            {
              id: 't1',
              name: '確認作業',
              start: new Date(2026, 8, 1, 9, 0, 0),
              end: new Date(2026, 8, 1, 9, 30, 0),
            },
          ],
        },
      ],
      option: {
        calendar: {
          start: new Date(2026, 8, 1, 9, 0, 0),
          end: new Date(2026, 8, 1, 12, 0, 0),
        },
      },
    }

    const hourBlob = await exportGanttToExcel(hourChart, {
      timelineScale: 'hour',
      columnsPerUnit: 2, // 30分刻み
      download: false,
    })

    const hourBuf = await readBlob(hourBlob)
    const hourWb = new ExcelJS.Workbook()
    await hourWb.xlsx.load(hourBuf)
    const hourWs = hourWb.getWorksheet('工程表')!

    // col 10: 09:00〜09:30
    // col 11: 09:30〜10:00
    const slot0900 = hourWs.getCell(3, 10)
    const slot0930 = hourWs.getCell(3, 11)

    // 09:00〜09:30 のみタスク色
    expect((slot0900.fill as any)?.fgColor?.argb).toBe('FF3B82F6')
    // 09:30 はタスク範囲外（1セル分長くならず、塗られない）
    expect((slot0930.fill as any)?.fgColor?.argb).toBeUndefined()
  })

  it('should display "開始月" and "終了月" with yyyy/mm format when exporting in month scale', async () => {
    const monthChart: any = {
      rows: [
        {
          id: '1',
          name: '要件定義',
          tasks: [
            {
              id: 't1',
              name: 'Q4施策',
              // 2025年10月1日 〜 2026年1月1日 (10月〜12月の3ヶ月)
              start: new Date(2025, 9, 1, 0, 0, 0),
              end: new Date(2026, 0, 1, 0, 0, 0),
            },
          ],
        },
      ],
      option: {
        calendar: {
          start: new Date(2025, 9, 1),
          end: new Date(2026, 2, 1),
        },
      },
    }

    // 1. with-timeline モード
    const blob = await exportGanttToExcel(monthChart, {
      timelineScale: 'month',
      download: false,
    })

    const readBlob = (b: Blob): Promise<Uint8Array> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          resolve(new Uint8Array(reader.result as ArrayBuffer))
        }
        reader.onerror = reject
        reader.readAsArrayBuffer(b)
      })
    }

    const buf = await readBlob(blob)
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf)
    const ws = wb.getWorksheet('工程表')!

    // ヘッダー（行1）の確認
    const noHeader = ws.getCell(1, 1) // 列1: No.
    const startHeader = ws.getCell(1, 5) // 列5: start
    const endHeader = ws.getCell(1, 6) // 列6: end
    expect(noHeader.value).toBe('No.')
    expect(startHeader.value).toBe('開始月')
    expect(endHeader.value).toBe('終了月')
    expect(ws.getColumn(1).width).toBe(6)
    expect(ws.getColumn(5).width).toBe(11)
    expect(ws.getColumn(6).width).toBe(11)

    // データ行（行3: ヘッダーが2行あるため行3がデータ1行目）
    const noCell = ws.getCell(3, 1)
    const startCell = ws.getCell(3, 5)
    const endCell = ws.getCell(3, 6)

    expect(noCell.value).toBe(1)
    expect(startCell.numFmt).toBe('yyyy/mm')
    expect(endCell.numFmt).toBe('yyyy/mm')

    // 開始月は 2025年10月1日 (Excelのシリアル値としてUTC 2025-10-01)
    const startDateVal = startCell.value as Date
    expect(startDateVal).toBeInstanceOf(Date)
    expect(startDateVal.getUTCFullYear()).toBe(2025)
    expect(startDateVal.getUTCMonth()).toBe(9) // 10月

    // 終了月は 2026年1月1日（排他境界）に対して前月（Excelのシリアル値としてUTC 2025-12-01）
    const endDateVal = endCell.value as Date
    expect(endDateVal).toBeInstanceOf(Date)
    expect(endDateVal.getUTCFullYear()).toBe(2025)
    expect(endDateVal.getUTCMonth()).toBe(11) // 12月

  })

  it('should display "開始日時" and "終了日時" with yyyy/mm/dd hh:mm format when exporting in hour scale', async () => {
    const hourChart: any = {
      rows: [
        {
          id: '1',
          name: '初動対応',
          tasks: [
            {
              id: 't1',
              name: 'ログ解析',
              start: new Date(2026, 4, 10, 9, 0, 0),
              end: new Date(2026, 4, 10, 10, 30, 0), // 1.5時間
            },
          ],
        },
      ],
      option: {
        calendar: {
          start: new Date(2026, 4, 10, 8, 0, 0),
          end: new Date(2026, 4, 10, 18, 0, 0),
          showTime: true,
        },
      },
    }

    const readBlob = (b: Blob): Promise<Uint8Array> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          resolve(new Uint8Array(reader.result as ArrayBuffer))
        }
        reader.onerror = reject
        reader.readAsArrayBuffer(b)
      })
    }

    // 1. with-timeline モード
    const blob = await exportGanttToExcel(hourChart, {
      timelineScale: 'hour',
      download: false,
    })

    const buf = await readBlob(blob)
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf)
    const ws = wb.getWorksheet('工程表')!

    // ヘッダー（行1）の確認
    const startHeader = ws.getCell(1, 5) // 列5: start
    const endHeader = ws.getCell(1, 6) // 列6: end
    expect(startHeader.value).toBe('開始日時')
    expect(endHeader.value).toBe('終了日時')
    expect(ws.getColumn(5).width).toBe(18)
    expect(ws.getColumn(6).width).toBe(18)

    // タイムラインヘッダーの確認（上部は日付だけ、下部は時間）
    const timelineDateHeader = ws.getCell(1, 10) // タイムライン開始列 (列10)
    const timelineHourHeader = ws.getCell(2, 10)
    expect(timelineDateHeader.value).toBe('2026年5月10日')
    expect(timelineHourHeader.value).toBe('8')

    // データ行（行3: ヘッダーが2行あるため行3がデータ1行目）
    const startCell = ws.getCell(3, 5)
    const endCell = ws.getCell(3, 6)
    const durationCell = ws.getCell(3, 7)

    expect(startCell.numFmt).toBe('yyyy/mm/dd hh:mm')
    expect(endCell.numFmt).toBe('yyyy/mm/dd hh:mm')
    expect(durationCell.numFmt).toBe('#,##0.#"時間"')
    expect(durationCell.value).toBe(1.5)

    // 開始日時 (2026-05-10 09:00)
    const startDateVal = startCell.value as Date
    expect(startDateVal).toBeInstanceOf(Date)
    expect(startDateVal.getUTCFullYear()).toBe(2026)
    expect(startDateVal.getUTCMonth()).toBe(4) // 5月
    expect(startDateVal.getUTCDate()).toBe(10)
    expect(startDateVal.getUTCHours()).toBe(9)
    expect(startDateVal.getUTCMinutes()).toBe(0)

    // 終了日時 (2026-05-10 10:30)
    const endDateVal = endCell.value as Date
    expect(endDateVal).toBeInstanceOf(Date)
    expect(endDateVal.getUTCFullYear()).toBe(2026)
    expect(endDateVal.getUTCMonth()).toBe(4) // 5月
    expect(endDateVal.getUTCDate()).toBe(10)
    expect(endDateVal.getUTCHours()).toBe(10)
    expect(endDateVal.getUTCMinutes()).toBe(30)

  })

  it('should display previous day as end date when task end time is 00:00 in day scale', async () => {
    const dayChart: any = {
      rows: [
        {
          id: 'row-1',
          name: '日単位テスト',
          tasks: [
            {
              id: 't1',
              name: '半開区間タスク (9/1 00:00 - 9/5 00:00)',
              start: new Date(2026, 8, 1, 0, 0, 0),
              end: new Date(2026, 8, 5, 0, 0, 0),
            },
            {
              id: 't2',
              name: '時刻付きタスク (9/6 00:00 - 9/8 12:00)',
              start: new Date(2026, 8, 6, 0, 0, 0),
              end: new Date(2026, 8, 8, 12, 0, 0),
            },
            {
              id: 't3',
              name: 'マイルストーン (9/10 00:00 - 9/10 00:00)',
              start: new Date(2026, 8, 10, 0, 0, 0),
              end: new Date(2026, 8, 10, 0, 0, 0),
            },
          ],
        },
      ],
      option: {},
    }

    const readBlob = (b: Blob): Promise<Uint8Array> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          resolve(new Uint8Array(reader.result as ArrayBuffer))
        }
        reader.onerror = reject
        reader.readAsArrayBuffer(b)
      })
    }

    // 1. with-timeline モード
    const blob = await exportGanttToExcel(dayChart, {
      timelineScale: 'day',
      download: false,
    })

    const buf = await readBlob(blob)
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf)
    const ws = wb.getWorksheet('工程表')!

    // 行3: タスク1 (t1: 9/1 00:00 - 9/5 00:00) -> 終了日は前日 9/4
    const startCell1 = ws.getCell(3, 5)
    const endCell1 = ws.getCell(3, 6)
    const durationCell1 = ws.getCell(3, 7)

    expect(startCell1.numFmt).toBe('yyyy/mm/dd')
    expect(endCell1.numFmt).toBe('yyyy/mm/dd')
    expect(durationCell1.value).toBe(4)

    const startDate1 = startCell1.value as Date
    expect(startDate1.getUTCFullYear()).toBe(2026)
    expect(startDate1.getUTCMonth()).toBe(8) // 9月
    expect(startDate1.getUTCDate()).toBe(1)

    const endDate1 = endCell1.value as Date
    expect(endDate1.getUTCFullYear()).toBe(2026)
    expect(endDate1.getUTCMonth()).toBe(8) // 9月
    expect(endDate1.getUTCDate()).toBe(4) // 00:00のため前日の9/4が表示される

    // 行4: タスク2 (t2: 9/6 00:00 - 9/8 12:00) -> 00:00ではないため当日 9/8
    const startCell2 = ws.getCell(4, 5)
    const endCell2 = ws.getCell(4, 6)
    const endDate2 = endCell2.value as Date
    expect(endDate2.getUTCFullYear()).toBe(2026)
    expect(endDate2.getUTCMonth()).toBe(8)
    expect(endDate2.getUTCDate()).toBe(8)

    // 行5: タスク3 (t3: 9/10 00:00 - 9/10 00:00) -> 開始=終了のため前日にならず当日 9/10
    const startCell3 = ws.getCell(5, 5)
    const endCell3 = ws.getCell(5, 6)
    const endDate3 = endCell3.value as Date
    expect(endDate3.getUTCFullYear()).toBe(2026)
    expect(endDate3.getUTCMonth()).toBe(8)
    expect(endDate3.getUTCDate()).toBe(10)

  })

  it('should support customizing columns via options.columns function to export assignees', async () => {
    const chartWithAssignees: any = {
      rows: [
        {
          id: 'row-1',
          name: '開発',
          tasks: [
            {
              id: 't1',
              name: 'フロントエンド開発',
              start: new Date(2026, 8, 1, 9, 0, 0),
              end: new Date(2026, 8, 3, 18, 0, 0),
              attribute: {
                assignees: ['alice@example.com', 'bob@example.com'],
              },
            },
            {
              id: 't2',
              name: 'バックエンド開発',
              start: new Date(2026, 8, 4, 9, 0, 0),
              end: new Date(2026, 8, 6, 18, 0, 0),
              dependencies: ['t1'],
              attribute: {
                assignees: ['charlie@example.com'],
              },
            },
            {
              id: 't3',
              name: '単体テスト',
              start: new Date(2026, 8, 7, 9, 0, 0),
              end: new Date(2026, 8, 8, 18, 0, 0),
              dependencies: ['t1', 't2'],
              // 単一文字列属性のケース
              attribute: {
                assignees: 'david@example.com',
              },
            },
          ],
        },
      ],
      option: {
        calendar: {
          start: new Date(2026, 8, 1),
          end: new Date(2026, 8, 10),
        },
      },
    }

    const blob = await exportGanttToExcel(chartWithAssignees, {
      download: false,
      columns: (defaultCols) => {
        const taskNameIdx = defaultCols.findIndex((col) => col.key === 'taskName')
        const assigneeCol = {
          key: 'assignees',
          header: '担当者',
          width: 20,
          align: 'left' as const,
        }
        const next = [...defaultCols]
        next.splice(taskNameIdx + 1, 0, assigneeCol)
        return next
      },
    })

    const readBlob = (b: Blob): Promise<Uint8Array> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
        reader.onerror = reject
        reader.readAsArrayBuffer(b)
      })
    }

    const buf = await readBlob(blob)
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf)

    // データ一覧シートは出力されず、工程表シート1枚のみであることを確認
    expect(wb.worksheets.length).toBe(1)
    expect(wb.getWorksheet('工程表_データ一覧')).toBeUndefined()

    // 工程表シート
    // 列1: No., 列2: WBS, 列3: 行名, 列4: タスク名, 列5: 担当者(挿入), 列6: 開始日, ..., 列10: 先行タスク
    const timelineWs = wb.getWorksheet('工程表')!
    expect(timelineWs).toBeDefined()
    expect(timelineWs.getCell(1, 1).value).toBe('No.')
    expect(timelineWs.getCell(1, 5).value).toBe('担当者')
    expect(timelineWs.getCell(1, 6).value).toBe('開始日')
    expect(timelineWs.getCell(1, 10).value).toBe('先行タスク')

    // row 3: t1 (No: 1, 先行タスクなし)
    expect(timelineWs.getCell(3, 1).value).toBe(1)
    expect(timelineWs.getCell(3, 5).value).toBe('alice@example.com, bob@example.com')
    expect(timelineWs.getCell(3, 10).value).toBe('')

    // row 4: t2 (No: 2, 先行タスク: t1 -> '1')
    expect(timelineWs.getCell(4, 1).value).toBe(2)
    expect(timelineWs.getCell(4, 5).value).toBe('charlie@example.com')
    expect(timelineWs.getCell(4, 10).value).toBe('1')

    // row 5: t3 (No: 3, 先行タスク: t1, t2 -> '1, 2')
    expect(timelineWs.getCell(5, 1).value).toBe(3)
    expect(timelineWs.getCell(5, 5).value).toBe('david@example.com')
    expect(timelineWs.getCell(5, 10).value).toBe('1, 2')
  })

  it('should support English locale export with English headers and sheet names', async () => {
    // 1. detectLocale
    expect(detectLocale(undefined, 'en')).toBe('en')
    expect(detectLocale(undefined, 'ja')).toBe('ja')
    expect(detectLocale({ option: { locale: { monthFormat: 'MMM YYYY' } } } as any)).toBe('en')
    expect(detectLocale({ option: {} } as any)).toBe('ja')

    // 2. getDayOfWeekText
    expect(getDayOfWeekText(0, 'en')).toBe('Sun')
    expect(getDayOfWeekText(1, 'en')).toBe('Mon')
    expect(getDayOfWeekText(6, 'en')).toBe('Sat')
    expect(getDayOfWeekText(1, 'ja')).toBe('月')

    // 3. getDefaultColumns
    const enCols = getDefaultColumns('day', 'en')
    expect(enCols.find((c) => c.key === 'rowName')?.header).toBe('Category / Row')
    expect(enCols.find((c) => c.key === 'taskName')?.header).toBe('Task Name')
    expect(enCols.find((c) => c.key === 'start')?.header).toBe('Start Date')
    expect(enCols.find((c) => c.key === 'end')?.header).toBe('End Date')
    expect(enCols.find((c) => c.key === 'duration')?.header).toBe('Duration')
    expect(enCols.find((c) => c.key === 'progress')?.header).toBe('Progress')
    expect(enCols.find((c) => c.key === 'dependencies')?.header).toBe('Dependencies')

    const enMonthCols = getDefaultColumns('month', 'en')
    expect(enMonthCols.find((c) => c.key === 'start')?.header).toBe('Start Month')
    expect(enMonthCols.find((c) => c.key === 'end')?.header).toBe('End Month')

    const enHourCols = getDefaultColumns('hour', 'en')
    expect(enHourCols.find((c) => c.key === 'start')?.header).toBe('Start Date & Time')
    expect(enHourCols.find((c) => c.key === 'end')?.header).toBe('End Date & Time')

    // 4. exportGanttToExcel with mode: 'both' and locale: 'en'
    const chart: any = {
      rows: sampleRows,
      option: {
        calendar: {
          start: new Date(2026, 8, 1),
          end: new Date(2026, 8, 30),
        },
      },
    }

    const blob = await exportGanttToExcel(chart, {
      locale: 'en',
      download: false,
    })

    const readBlob = (b: Blob): Promise<Uint8Array> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
        reader.onerror = reject
        reader.readAsArrayBuffer(b)
      })
    }

    const buf = await readBlob(blob)
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf)

    // データ一覧シートは出力されず、Gantt Chart シート1枚のみ
    expect(wb.worksheets.length).toBe(1)
    expect(wb.getWorksheet('Gantt Chart_Data')).toBeUndefined()

    // 英語のデフォルトシート名は "Gantt Chart"
    const timelineWs = wb.getWorksheet('Gantt Chart')!
    expect(timelineWs).toBeDefined()
    expect(timelineWs.getCell(1, 3).value).toBe('Category / Row')
    expect(timelineWs.getCell(1, 4).value).toBe('Task Name')
    expect(timelineWs.getCell(1, 5).value).toBe('Start Date')
    expect(timelineWs.getCell(1, 6).value).toBe('End Date')
    expect(timelineWs.getCell(1, 7).value).toBe('Duration')
    expect(timelineWs.getCell(1, 8).value).toBe('Progress')
    expect(timelineWs.getCell(1, 9).value).toBe('Dependencies')

    // タイムライン列の曜日サブヘッダーが英語（Sun, Mon, etc.）
    const cell10 = timelineWs.getCell(2, 10).value as string
    expect(cell10).toContain('Tue')
  })

  it('should support Chinese (zh) locale export with Chinese headers and sheet names', async () => {
    // 1. detectLocale
    expect(detectLocale(undefined, 'zh')).toBe('zh')

    // 2. getDayOfWeekText
    expect(getDayOfWeekText(0, 'zh')).toBe('日')
    expect(getDayOfWeekText(1, 'zh')).toBe('一')
    expect(getDayOfWeekText(6, 'zh')).toBe('六')

    // 3. getDefaultColumns
    const zhCols = getDefaultColumns('day', 'zh')
    expect(zhCols.find((c) => c.key === 'rowName')?.header).toBe('类别/行')
    expect(zhCols.find((c) => c.key === 'taskName')?.header).toBe('任务名称')
    expect(zhCols.find((c) => c.key === 'start')?.header).toBe('开始日期')
    expect(zhCols.find((c) => c.key === 'end')?.header).toBe('结束日期')
    expect(zhCols.find((c) => c.key === 'duration')?.header).toBe('工期')
    expect(zhCols.find((c) => c.key === 'progress')?.header).toBe('进度')
    expect(zhCols.find((c) => c.key === 'dependencies')?.header).toBe('前置任务')

    // 4. exportGanttToExcel with mode: 'both' and locale: 'zh'
    const chart: any = {
      rows: sampleRows,
      option: {
        calendar: {
          start: new Date(2026, 8, 1),
          end: new Date(2026, 8, 30),
        },
      },
    }

    const blob = await exportGanttToExcel(chart, {
      locale: 'zh',
      download: false,
    })

    const readBlob = (b: Blob): Promise<Uint8Array> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
        reader.onerror = reject
        reader.readAsArrayBuffer(b)
      })
    }

    const buf = await readBlob(blob)
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf)

    // データ一覧シートは出力されず、甘特图 シート1枚のみ
    expect(wb.worksheets.length).toBe(1)
    expect(wb.getWorksheet('甘特图_数据列表')).toBeUndefined()

    // 中国語のデフォルトシート名は "甘特图"
    const timelineWs = wb.getWorksheet('甘特图')!
    expect(timelineWs).toBeDefined()
    expect(timelineWs.getCell(1, 3).value).toBe('类别/行')
    expect(timelineWs.getCell(1, 4).value).toBe('任务名称')
    expect(timelineWs.getCell(1, 5).value).toBe('开始日期')
    expect(timelineWs.getCell(1, 6).value).toBe('结束日期')
    expect(timelineWs.getCell(1, 7).value).toBe('工期')

    // タイムラインの曜日表示
    const cell10 = timelineWs.getCell(2, 10).value as string
    expect(cell10).toContain('二') // 2026/9/1 は火曜 (周二)
  })

  it('should support registering custom locale via registerExcelLocale and exporting with it', async () => {
    // 独自のドイツ語ロケールを登録
    registerExcelLocale('de', {
      name: 'de',
      sheets: {
        gantt: 'Gantt-Diagramm',
      },
      columns: {
        rowName: 'Kategorie / Zeile',
        taskName: 'Aufgabenname',
        start: { day: 'Startdatum' },
        end: { day: 'Enddatum' },
        duration: { header: 'Dauer', dayNumFmt: '#,##0" Tage"' },
      },
      timeline: {
        dayNames: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
        monthNames: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
      },
    })

    expect(getSupportedExcelLocales()).toContain('de')
    expect(getExcelLocale('de')?.sheets?.gantt).toBe('Gantt-Diagramm')

    const deCols = getDefaultColumns('day', 'de')
    expect(deCols.find((c) => c.key === 'taskName')?.header).toBe('Aufgabenname')
    expect(deCols.find((c) => c.key === 'start')?.header).toBe('Startdatum')

    const chart: any = {
      rows: sampleRows,
      option: {
        calendar: {
          start: new Date(2026, 8, 1),
          end: new Date(2026, 8, 30),
        },
      },
    }

    const blob = await exportGanttToExcel(chart, {
      locale: 'de',
      download: false,
    })

    const readBlob = (b: Blob): Promise<Uint8Array> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
        reader.onerror = reject
        reader.readAsArrayBuffer(b)
      })
    }

    const buf = await readBlob(blob)
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf)

    // データ一覧シートは出力されず、Gantt-Diagramm シート1枚のみ
    expect(wb.worksheets.length).toBe(1)
    expect(wb.getWorksheet('Gantt-Diagramm_Daten')).toBeUndefined()

    const ws = wb.getWorksheet('Gantt-Diagramm')!
    expect(ws).toBeDefined()
    expect(ws.getCell(1, 4).value).toBe('Aufgabenname')
    expect(ws.getCell(1, 5).value).toBe('Startdatum')

    // タイムラインの曜日
    const cell10 = ws.getCell(2, 10).value as string
    expect(cell10).toContain('Di') // 2026/9/1 は火曜 (Di)
  })

  it('should support passing custom ExcelLocaleDefinition directly in options.locale', async () => {
    const chart: any = {
      rows: sampleRows,
      option: {
        calendar: {
          start: new Date(2026, 8, 1),
          end: new Date(2026, 8, 10),
        },
      },
    }

    // オブジェクトとして直接カスタム定義を渡し、未指定項目は日本語にフォールバック
    const blob = await exportGanttToExcel(chart, {
      locale: {
        sheets: {
          gantt: 'カスタム工程表',
        },
        columns: {
          taskName: 'カスタムタスク名',
        },
      },
      download: false,
    })

    const readBlob = (b: Blob): Promise<Uint8Array> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
        reader.onerror = reject
        reader.readAsArrayBuffer(b)
      })
    }

    const buf = await readBlob(blob)
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf)

    const ws = wb.getWorksheet('カスタム工程表')!
    expect(ws).toBeDefined()
    expect(ws.getCell(1, 4).value).toBe('カスタムタスク名') // カスタム指定した項目
    expect(ws.getCell(1, 3).value).toBe('カテゴリ/行') // 未指定で日本語デフォルトにフォールバックした項目
  })

  it('should register custom locales via excelPlugin config.locales', () => {
    const dummyChart: any = {}
    const plugin = excelPlugin({
      locales: {
        fr: {
          name: 'fr',
          sheets: {
            gantt: 'Diagramme de Gantt',
          },
          columns: {
            taskName: 'Nom de la tâche',
          },
        },
      },
    })

    plugin.install?.(dummyChart)

    const frDef = getExcelLocale('fr')
    expect(frDef).toBeDefined()
    expect(frDef?.sheets?.gantt).toBe('Diagramme de Gantt')
    expect(frDef?.columns?.taskName).toBe('Nom de la tâche')
  })
})




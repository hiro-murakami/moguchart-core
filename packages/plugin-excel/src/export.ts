import ExcelJS from 'exceljs'
import type { GanttChartElement, GanttTask } from '@mogura/moguchart-core'
import type { ExportExcelOptions, ExcelExportColumn, ExcelExportMode, ExcelTimelineScale } from './types'
import {
  hexToArgb,
  sanitizeSheetName,
  getTimelineRange,
  generateTimelineList,
  detectTimelineScale,
  detectTimelineColumnWidth,
  detectColumnsPerUnit,
  extractTaskBarColor,
  getContrastArgb,
  getTimelineCellBgColor,
  calculateWbsHierarchy,
  downloadBlob,
  toExcelDate,
  type FlatRowItem,
  type TimelineItem,
} from './utils'

/**
 * デフォルトの標準カラム定義
 */
function getDefaultColumns(scale: ExcelTimelineScale = 'day'): ExcelExportColumn[] {
  const isMonth = scale === 'month'
  const isHour = scale === 'hour'
  return [
    { key: 'wbs', header: 'WBS', width: 9, align: 'center' },
    { key: 'rowName', header: 'カテゴリ/行', width: 18, align: 'left' },
    { key: 'taskName', header: 'タスク名', width: 28, align: 'left' },
    {
      key: 'start',
      header: isMonth ? '開始月' : isHour ? '開始日時' : '開始日',
      width: isMonth ? 11 : isHour ? 18 : 13,
      align: 'center',
      numFmt: isMonth ? 'yyyy/mm' : isHour ? 'yyyy/mm/dd hh:mm' : 'yyyy/mm/dd',
    },
    {
      key: 'end',
      header: isMonth ? '終了月' : isHour ? '終了日時' : '終了日',
      width: isMonth ? 11 : isHour ? 18 : 13,
      align: 'center',
      numFmt: isMonth ? 'yyyy/mm' : isHour ? 'yyyy/mm/dd hh:mm' : 'yyyy/mm/dd',
    },
    {
      key: 'duration',
      header: '期間',
      width: 10,
      align: 'right',
      numFmt: isHour ? '#,##0.#"時間"' : '#,##0"日"',
    },
    { key: 'progress', header: '進捗', width: 10, align: 'right', numFmt: '0%' },
    { key: 'dependencies', header: '先行タスク', width: 14, align: 'left' },
  ]
}

/**
 * ガントチャートデータをExcel (.xlsx) 形式でエクスポートするメイン関数
 */
export async function exportGanttToExcel(
  chart: GanttChartElement,
  options: ExportExcelOptions = {}
): Promise<Blob> {
  const rows = chart.rows || []
  const mode: ExcelExportMode = options.mode || 'with-timeline'
  const filename = options.filename || 'gantt-chart.xlsx'
  const baseSheetName = sanitizeSheetName(options.sheetName || '工程表', '工程表', mode === 'both' ? 24 : 31)
  const timelineSheetName = baseSheetName
  const themeArgb = hexToArgb(options.themeColor, 'FF3B82F6')
  const scale = detectTimelineScale(chart, options.timelineScale)
  const columns = options.columns && options.columns.length > 0 ? options.columns : getDefaultColumns(scale)

  const flatItems = calculateWbsHierarchy(rows)
  const columnsPerUnit = detectColumnsPerUnit(chart, options, scale)
  const isHoliday = options.isHoliday ?? chart.option?.calendar?.isHoliday
  const holidayArgb = hexToArgb(options.holidayColor, 'FFFEE2E2')
  const { startDate, endDate } = getTimelineRange(rows, options, scale, chart.option?.calendar)
  const columnWidth = detectTimelineColumnWidth(chart, options.timelineColumnWidth, scale, columnsPerUnit)
  const timelineList = generateTimelineList(
    startDate,
    endDate,
    scale,
    options.includeWeekends ?? true,
    columnWidth,
    columnsPerUnit,
    isHoliday
  )

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Moguchart'
  workbook.created = new Date()

  if (mode === 'with-timeline' || mode === 'both') {
    buildTimelineSheet(
      workbook,
      timelineSheetName,
      flatItems,
      columns,
      timelineList,
      themeArgb,
      holidayArgb,
      options,
      scale
    )
  }

  if (mode === 'table-only' || mode === 'both') {
    const tableSheetName =
      mode === 'both'
        ? `${baseSheetName}_データ一覧`
        : sanitizeSheetName(options.sheetName || '工程表', '工程表', 31)
    buildTableSheet(workbook, tableSheetName, flatItems, columns, themeArgb, scale)
  }

  // ワークブックをバッファに書き出し
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  // 自動ダウンロード（ブラウザ環境）
  if (options.download !== false) {
    downloadBlob(blob, filename)
  }

  return blob
}

/**
 * タイムライン付きガントチャートシートを構築する
 */
function buildTimelineSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  flatItems: FlatRowItem[],
  columns: ExcelExportColumn[],
  timelineList: TimelineItem[],
  themeArgb: string,
  holidayArgb: string,
  options: ExportExcelOptions,
  scale: ExcelTimelineScale = 'day'
): void {
  const ws = workbook.addWorksheet(sheetName, {
    views: [{ state: 'frozen', xSplit: columns.length, ySplit: 2 }],
  })

  // 列設定（テーブル部分）
  columns.forEach((col, idx) => {
    ws.getColumn(idx + 1).width = col.width || 15
  })

  // 列設定（タイムライン部分）
  timelineList.forEach((item, idx) => {
    ws.getColumn(columns.length + idx + 1).width = item.width || 4.2
  })

  // --- ヘッダー行 1 (テーブルヘッダー & グループヘッダーマージ) ---
  const headerRow1 = ws.getRow(1)
  headerRow1.height = 22

  columns.forEach((col, idx) => {
    const cell = headerRow1.getCell(idx + 1)
    cell.value = col.header
    applyHeaderStyle(cell, themeArgb)
  })

  // 年月/年/日付ごとのグループマージ
  let currentGroup = ''
  let groupStartIndex = -1
  timelineList.forEach((d, idx) => {
    const group = d.groupLabel
    const colIndex = columns.length + idx + 1
    if (group !== currentGroup) {
      if (groupStartIndex !== -1 && colIndex - 1 > groupStartIndex) {
        ws.mergeCells(1, groupStartIndex, 1, colIndex - 1)
      }
      currentGroup = group
      groupStartIndex = colIndex
      const cell = headerRow1.getCell(colIndex)
      cell.value = group
      applyDateHeaderGroupStyle(cell, themeArgb)
    } else {
      const cell = headerRow1.getCell(colIndex)
      applyDateHeaderGroupStyle(cell, themeArgb)
    }
  })
  if (groupStartIndex !== -1 && columns.length + timelineList.length >= groupStartIndex) {
    ws.mergeCells(1, groupStartIndex, 1, columns.length + timelineList.length)
  }

  // --- ヘッダー行 2 (テーブルヘッダーマージ & サブヘッダー) ---
  const headerRow2 = ws.getRow(2)
  headerRow2.height = 24

  columns.forEach((_, idx) => {
    ws.mergeCells(1, idx + 1, 2, idx + 1)
  })

  timelineList.forEach((d, idx) => {
    const colIndex = columns.length + idx + 1
    const cell = headerRow2.getCell(colIndex)
    cell.value = d.subLabel
    applyTimelineSubHeaderStyle(cell, d, options.highlightToday ?? true, holidayArgb, scale)
  })

  // --- データ行の出力 ---
  let currentRowIndex = 3

  for (const item of flatItems) {
    const { row, depth, isParent } = item
    const tasks = Array.isArray(row.tasks) ? row.tasks : []

    // タスクが存在しない行の場合でも行情報を出力
    if (tasks.length === 0) {
      const excelRow = ws.getRow(currentRowIndex)
      excelRow.height = 20
      renderTableRowCells(excelRow, columns, item, null, depth, isParent, scale)
      applyTimelineEmptyCells(excelRow, columns.length, timelineList, holidayArgb, scale)
      currentRowIndex++
      continue
    }

    for (const task of tasks) {
      const excelRow = ws.getRow(currentRowIndex)
      excelRow.height = 22
      renderTableRowCells(excelRow, columns, item, task, depth, isParent, scale)

      // タイムラインのセル塗りつぶし描画
      renderTimelineTaskBar(excelRow, columns.length, timelineList, task, isParent, themeArgb, holidayArgb, scale)

      currentRowIndex++
    }
  }

  // テーブル全体の罫線補正
  applyThinBorders(ws, 1, currentRowIndex - 1, 1, columns.length + timelineList.length)
}

/**
 * データ一覧（テーブルのみ）シートを構築する
 */
function buildTableSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  flatItems: FlatRowItem[],
  columns: ExcelExportColumn[],
  themeArgb: string,
  scale: ExcelTimelineScale = 'day'
): void {
  const ws = workbook.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  // ヘッダー行
  const headerRow = ws.getRow(1)
  headerRow.height = 24

  columns.forEach((col, idx) => {
    const colIndex = idx + 1
    ws.getColumn(colIndex).width = col.width || 15
    const cell = headerRow.getCell(colIndex)
    cell.value = col.header
    applyHeaderStyle(cell, themeArgb)
  })

  let currentRowIndex = 2

  for (const item of flatItems) {
    const { row, depth, isParent } = item
    const tasks = Array.isArray(row.tasks) ? row.tasks : []

    if (tasks.length === 0) {
      const excelRow = ws.getRow(currentRowIndex)
      excelRow.height = 20
      renderTableRowCells(excelRow, columns, item, null, depth, isParent, scale)
      currentRowIndex++
      continue
    }

    for (const task of tasks) {
      const excelRow = ws.getRow(currentRowIndex)
      excelRow.height = 22
      renderTableRowCells(excelRow, columns, item, task, depth, isParent, scale)
      currentRowIndex++
    }
  }

  // オートフィルターの有効化
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(currentRowIndex - 1, 1), column: columns.length },
  }

  applyThinBorders(ws, 1, currentRowIndex - 1, 1, columns.length)
}

/**
 * テーブル列の各セルに値を設定する
 */
function renderTableRowCells(
  excelRow: ExcelJS.Row,
  columns: ExcelExportColumn[],
  item: FlatRowItem,
  task: GanttTask | null,
  depth: number,
  isParent: boolean,
  scale: ExcelTimelineScale = 'day'
): void {
  const { row, wbsNumber } = item

  columns.forEach((col, idx) => {
    const cell = excelRow.getCell(idx + 1)
    let value: any = ''

    if (col.getValue) {
      value = col.getValue(task || ({} as any), row, excelRow.number)
    } else {
      switch (col.key) {
        case 'wbs':
          value = wbsNumber
          break
        case 'rowName':
          value = row.name || ''
          break
        case 'taskName':
          if (task) {
            // WBS階層の深さに応じて全角スペースで字下げ
            const indentSpaces = '　'.repeat(depth)
            value = `${indentSpaces}${task.name || ''}`
          } else {
            value = ''
          }
          break
        case 'start':
          if (task?.start) {
            const startDate = new Date(task.start)
            if (scale === 'month') {
              const localMonthStart = new Date(startDate.getFullYear(), startDate.getMonth(), 1, 0, 0, 0)
              value = toExcelDate(localMonthStart)
            } else {
              value = toExcelDate(startDate)
            }
          } else {
            value = ''
          }
          break
        case 'end':
          if (task?.end) {
            const endDate = new Date(task.end)
            if (scale === 'month') {
              const taskStart = task.start ? new Date(task.start).getTime() : 0
              const taskEnd = endDate.getTime()
              let targetDate = endDate
              if (taskStart < taskEnd) {
                // 排他境界（例: 翌月1日0:00）の場合に前月の月を正しく反映する
                targetDate = new Date(taskEnd - 1)
              }
              const localMonthEnd = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1, 0, 0, 0)
              value = toExcelDate(localMonthEnd)
            } else if (scale === 'day') {
              const taskStart = task.start ? new Date(task.start).getTime() : 0
              const taskEnd = endDate.getTime()
              let targetDate = endDate
              // 日単位の場合、ガントバーの終了日時が0時0分の時は前日の日付で表示
              if (
                taskStart < taskEnd &&
                endDate.getHours() === 0 &&
                endDate.getMinutes() === 0
              ) {
                targetDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate() - 1)
              }
              value = toExcelDate(targetDate)
            } else {
              value = toExcelDate(endDate)
            }
          } else {
            value = ''
          }
          break
        case 'duration':
          if (task?.start && task?.end) {
            const diff = new Date(task.end).getTime() - new Date(task.start).getTime()
            if (scale === 'hour') {
              value = Math.max(0.1, Math.round((diff / (1000 * 60 * 60)) * 10) / 10)
            } else {
              value = Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)))
            }
          } else {
            value = ''
          }
          break
        case 'progress':
          if (task && typeof task.progress === 'number') {
            value = task.progress / 100
          } else {
            value = ''
          }
          break
        case 'dependencies':
          value = task?.dependencies?.join(', ') || ''
          break
        default:
          value = ''
      }
    }

    cell.value = value

    // 書式設定
    if (col.numFmt && typeof value !== 'string') {
      cell.numFmt = col.numFmt
    }

    // 配置
    cell.alignment = {
      vertical: 'middle',
      horizontal: col.align || 'left',
      wrapText: false,
    }

    // サマリータスク（親行）の強調スタイル
    if (isParent) {
      cell.font = { bold: true, color: { argb: 'FF1E293B' } }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF8FAFC' },
      }
    } else {
      cell.font = { color: { argb: 'FF334155' } }
    }
  })
}

/**
 * タイムライン上のタスク期間セルを着色する
 */
function renderTimelineTaskBar(
  excelRow: ExcelJS.Row,
  tableColCount: number,
  timelineList: TimelineItem[],
  task: GanttTask,
  isParent: boolean,
  themeArgb: string,
  holidayArgb = 'FFFEE2E2',
  scale: ExcelTimelineScale = 'day'
): void {
  const taskStart = task.start ? new Date(task.start).getTime() : 0
  const taskEnd = task.end ? new Date(task.end).getTime() : 0

  // ガントチャートの表示色に合わせてタスクバーの塗りつぶし色を決定
  const barArgb = extractTaskBarColor(task, isParent, themeArgb)
  const textArgb = getContrastArgb(barArgb)

  let progressRendered = false

  timelineList.forEach((item, idx) => {
    const colIndex = tableColCount + idx + 1
    const cell = excelRow.getCell(colIndex)
    const itemStart = item.startDate.getTime()
    const itemEnd = item.endDate.getTime()

    // タスク期間とタイムライン列期間の重複判定
    // タスクの end は半開区間の終端 [start, end) のため、期間を持つタスクでは taskEnd > itemStart で判定
    // （開始と終了が同時刻のタスクは該当日時が含まれるセルを判定）
    const isInTask =
      taskStart === taskEnd
        ? taskStart >= itemStart && taskStart <= itemEnd
        : taskStart <= itemEnd && taskEnd > itemStart

    if (isInTask) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: barArgb },
      }
      cell.alignment = { vertical: 'middle', horizontal: 'center' }

      // 該当タスクの最初の描画セルに進捗率をコントラスト文字色で記載（視認性向上）
      if (!progressRendered && typeof task.progress === 'number' && task.progress > 0) {
        cell.value = `${task.progress}%`
        cell.font = { size: 8, bold: true, color: { argb: textArgb } }
        progressRendered = true
      }
    } else {
      // タスク期間外のセル（日単位の場合のみ祝祭日、土日）
      const bgArgb = getTimelineCellBgColor(item, holidayArgb, scale)
      if (bgArgb) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: bgArgb },
        }
      }
    }
  })
}

/**
 * タスクがない空のタイムラインセルを描画
 */
function applyTimelineEmptyCells(
  excelRow: ExcelJS.Row,
  tableColCount: number,
  timelineList: TimelineItem[],
  holidayArgb = 'FFFEE2E2',
  scale: ExcelTimelineScale = 'day'
): void {
  timelineList.forEach((item, idx) => {
    const colIndex = tableColCount + idx + 1
    const cell = excelRow.getCell(colIndex)
    const bgArgb = getTimelineCellBgColor(item, holidayArgb, scale)
    if (bgArgb) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: bgArgb },
      }
    }
  })
}

/**
 * ヘッダーセルのスタイル
 */
function applyHeaderStyle(cell: ExcelJS.Cell, themeArgb: string): void {
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: themeArgb },
  }
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  cell.alignment = { vertical: 'middle', horizontal: 'center' }
}

/**
 * 年月グループヘッダーセルのスタイル
 */
function applyDateHeaderGroupStyle(cell: ExcelJS.Cell, themeArgb: string): void {
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: themeArgb },
  }
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
  cell.alignment = { vertical: 'middle', horizontal: 'center' }
}

/**
 * 日付・曜日・月・週・時刻サブヘッダーセルのスタイル
 */
function applyTimelineSubHeaderStyle(
  cell: ExcelJS.Cell,
  item: TimelineItem,
  highlightToday: boolean,
  holidayArgb = 'FFFEE2E2',
  scale?: ExcelTimelineScale
): void {
  let bgArgb = 'FFF8FAFC'
  let textArgb = 'FF475569'

  const currentScale = scale ?? item.scale ?? 'day'

  if (item.isToday && highlightToday) {
    bgArgb = 'FFFEF3C7' // 本日は黄色系ハイライト
    textArgb = 'FFB45309'
  } else if (currentScale === 'day') {
    // 日単位の場合のみ、土日・祝日の背景色・文字色分けを行う
    if (item.isHoliday || item.startDate.getDay() === 0) {
      bgArgb = holidayArgb // 祝祭日および日曜日は淡い赤/ピンク
      textArgb = 'FFDC2626' // 赤文字
    } else if (item.isWeekend) {
      bgArgb = 'FFEFF6FF' // 土曜は淡いブルー
      textArgb = 'FF2563EB' // 土曜は青文字
    }
  }

  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: bgArgb },
  }
  cell.font = { size: 8, bold: true, color: { argb: textArgb } }
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
}

/**
 * 全体に薄い罫線を適用する
 */
function applyThinBorders(
  ws: ExcelJS.Worksheet,
  startRow: number,
  endRow: number,
  startCol: number,
  endCol: number
): void {
  const thinBorder: ExcelJS.Border = {
    style: 'thin',
    color: { argb: 'FFE2E8F0' },
  }

  for (let r = startRow; r <= endRow; r++) {
    const row = ws.getRow(r)
    for (let c = startCol; c <= endCol; c++) {
      const cell = row.getCell(c)
      cell.border = {
        top: thinBorder,
        left: thinBorder,
        bottom: thinBorder,
        right: thinBorder,
      }
    }
  }
}

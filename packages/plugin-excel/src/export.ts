import ExcelJS from 'exceljs'
import type { GanttChartElement, GanttTask } from '@mogura/moguchart-core'
import type { ExportExcelOptions, ExcelExportColumn, ExcelExportMode } from './types'
import {
  hexToArgb,
  sanitizeSheetName,
  getTimelineRange,
  generateTimelineList,
  detectTimelineScale,
  detectTimelineColumnWidth,
  calculateWbsHierarchy,
  downloadBlob,
  type FlatRowItem,
  type TimelineItem,
} from './utils'

/**
 * デフォルトの標準カラム定義
 */
function getDefaultColumns(): ExcelExportColumn[] {
  return [
    { key: 'wbs', header: 'WBS', width: 9, align: 'center' },
    { key: 'rowName', header: 'カテゴリ/行', width: 18, align: 'left' },
    { key: 'taskName', header: 'タスク名', width: 28, align: 'left' },
    { key: 'start', header: '開始日', width: 13, align: 'center', numFmt: 'yyyy/mm/dd' },
    { key: 'end', header: '終了日', width: 13, align: 'center', numFmt: 'yyyy/mm/dd' },
    { key: 'duration', header: '期間', width: 10, align: 'right', numFmt: '#,##0"日"' },
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
  const columns = options.columns && options.columns.length > 0 ? options.columns : getDefaultColumns()

  const flatItems = calculateWbsHierarchy(rows)
  const scale = detectTimelineScale(chart, options.timelineScale)
  const { startDate, endDate } = getTimelineRange(rows, options, scale, chart.option?.calendar)
  const columnWidth = detectTimelineColumnWidth(chart, options.timelineColumnWidth, scale)
  const timelineList = generateTimelineList(startDate, endDate, scale, options.includeWeekends ?? true, columnWidth)

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Moguchart'
  workbook.created = new Date()

  if (mode === 'with-timeline' || mode === 'both') {
    buildTimelineSheet(workbook, timelineSheetName, flatItems, columns, timelineList, themeArgb, options)
  }

  if (mode === 'table-only' || mode === 'both') {
    const tableSheetName =
      mode === 'both'
        ? `${baseSheetName}_データ一覧`
        : sanitizeSheetName(options.sheetName || '工程表', '工程表', 31)
    buildTableSheet(workbook, tableSheetName, flatItems, columns, themeArgb)
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
  options: ExportExcelOptions
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
    applyTimelineSubHeaderStyle(cell, d, options.highlightToday ?? true)
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
      renderTableRowCells(excelRow, columns, item, null, depth, isParent)
      applyTimelineEmptyCells(excelRow, columns.length, timelineList)
      currentRowIndex++
      continue
    }

    for (const task of tasks) {
      const excelRow = ws.getRow(currentRowIndex)
      excelRow.height = 22
      renderTableRowCells(excelRow, columns, item, task, depth, isParent)

      // タイムラインのセル塗りつぶし描画
      renderTimelineTaskBar(excelRow, columns.length, timelineList, task, isParent, themeArgb)

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
  themeArgb: string
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
      renderTableRowCells(excelRow, columns, item, null, depth, isParent)
      currentRowIndex++
      continue
    }

    for (const task of tasks) {
      const excelRow = ws.getRow(currentRowIndex)
      excelRow.height = 22
      renderTableRowCells(excelRow, columns, item, task, depth, isParent)
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
  isParent: boolean
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
          value = task?.start ? new Date(task.start) : ''
          break
        case 'end':
          value = task?.end ? new Date(task.end) : ''
          break
        case 'duration':
          if (task?.start && task?.end) {
            const diff = new Date(task.end).getTime() - new Date(task.start).getTime()
            value = Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)) + 1)
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
  themeArgb: string
): void {
  const taskStart = task.start ? new Date(task.start).getTime() : 0
  const taskEnd = task.end ? new Date(task.end).getTime() : 0

  // タスクバーの塗りつぶし色を決定
  let barArgb = themeArgb
  if (isParent || task.type === 'summary') {
    barArgb = 'FF475569' // サマリータスクはスレートグレー
  } else if (task.progressColor) {
    barArgb = hexToArgb(task.progressColor, themeArgb)
  }

  let progressRendered = false

  timelineList.forEach((item, idx) => {
    const colIndex = tableColCount + idx + 1
    const cell = excelRow.getCell(colIndex)
    const itemStart = item.startDate.getTime()
    const itemEnd = item.endDate.getTime()

    // タスク期間とタイムライン列期間の重複判定
    const isInTask = taskStart <= itemEnd && taskEnd >= itemStart

    if (isInTask) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: barArgb },
      }
      cell.alignment = { vertical: 'middle', horizontal: 'center' }

      // 該当タスクの最初の描画セルに進捗率を白文字で記載（視認性向上）
      if (!progressRendered && typeof task.progress === 'number' && task.progress > 0) {
        cell.value = `${task.progress}%`
        cell.font = { size: 8, bold: true, color: { argb: 'FFFFFFFF' } }
        progressRendered = true
      }
    } else {
      // タスク期間外のセル（土日・週末は薄いグレー）
      if (item.isWeekend) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF1F5F9' },
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
  timelineList: TimelineItem[]
): void {
  timelineList.forEach((item, idx) => {
    const colIndex = tableColCount + idx + 1
    const cell = excelRow.getCell(colIndex)
    if (item.isWeekend) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF1F5F9' },
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
  highlightToday: boolean
): void {
  let bgArgb = 'FFF8FAFC'
  let textArgb = 'FF475569'

  if (item.isToday && highlightToday) {
    bgArgb = 'FFFEF3C7' // 本日は黄色系ハイライト
    textArgb = 'FFB45309'
  } else if (item.isWeekend) {
    bgArgb = 'FFE2E8F0' // 週末はグレー
    textArgb = item.startDate.getDay() === 0 ? 'FFDC2626' : 'FF2563EB' // 日曜赤、土曜青
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

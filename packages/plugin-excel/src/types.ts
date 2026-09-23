import type { GanttRow, GanttTask } from '@mogura/moguchart-core'

/**
 * Excelエクスポート時のカスタムカラム定義
 */
export interface ExcelExportColumn {
  /** カラム識別キー (例: 'wbs', 'taskName', 'start', 'end', 'progress', 'dependencies') */
  key?: string
  /** Excelシートのヘッダー行に表示するラベル */
  header: string
  /** 列幅 (文字数ベース。指定しない場合は自動計算) */
  width?: number
  /** Excelの数値・日付表示フォーマット (例: 'yyyy/mm/dd', '0%', '#,##0') */
  numFmt?: string
  /** テキストの水平配置 */
  align?: 'left' | 'center' | 'right'
  /** 値を独自取得・整形するためのカスタム関数 */
  getValue?: (task: GanttTask, row: GanttRow, rowIndex: number) => any
}

/**
 * Excelエクスポートの出力モード
 * - 'with-timeline': 左側にタスク表 + 右側に日付列（セル塗りつぶしガント）
 * - 'table-only': タスクデータ一覧のみ（集計・加工しやすいテーブル）
 * - 'both': 2つのシート（ガント表示 / 生データ）を両方出力
 */
export type ExcelExportMode = 'with-timeline' | 'table-only' | 'both'

/**
 * タイムライン列の刻み単位
 */
export type ExcelTimelineScale = 'hour' | 'day' | 'week' | 'month'

/**
 * Excelエクスポートの実行オプション
 */
export interface ExportExcelOptions {
  /** 出力ファイル名 (デフォルト: 'gantt-chart.xlsx') */
  filename?: string
  /** シート名 (デフォルト: '工程表') */
  sheetName?: string
  /** 出力モード (デフォルト: 'with-timeline') */
  mode?: ExcelExportMode
  /** 日付の表示形式 (デフォルト: 'YYYY/MM/DD') */
  dateFormat?: string
  /** タイムラインの単位 (デフォルト: 'day') */
  timelineScale?: ExcelTimelineScale
  /** タイムライン（カレンダー）列の幅 (文字数ベース。指定しない場合は画面表示幅またはスケール既定値から自動計算) */
  timelineColumnWidth?: number
  /** タイムラインに土日を含めるか (デフォルト: true。土日列は薄いグレー背景) */
  includeWeekends?: boolean
  /** 今日の日付列をハイライトするか (デフォルト: true) */
  highlightToday?: boolean
  /** ヘッダーやアクセントのテーマカラー (CSS HEXカラー。デフォルト: '#3B82F6') */
  themeColor?: string
  /** タイムラインの表示開始日 (指定しない場合は全タスクの最小開始日または現在日) */
  startDate?: Date
  /** タイムラインの表示終了日 (指定しない場合は全タスクの最大終了日または開始日から1ヶ月後) */
  endDate?: Date
  /** 出力カラムのカスタム定義配列 (指定しない場合は標準カラムが出力されます) */
  columns?: ExcelExportColumn[]
  /** 自動ダウンロードを実行するか (デフォルト: true。ブラウザ環境のみ有効) */
  download?: boolean
}

/**
 * プラグイン初期化時の設定オプション
 */
export interface ExcelPluginConfig {
  /** デフォルトのファイル名 */
  defaultFilename?: string
  /** デフォルトのシート名 */
  defaultSheetName?: string
  /** デフォルトの出力モード */
  defaultMode?: ExcelExportMode
  /** デフォルトの日付形式 */
  dateFormat?: string
  /** デフォルトのタイムライン単位 */
  timelineScale?: ExcelTimelineScale
  /** デフォルトのタイムライン列幅 */
  timelineColumnWidth?: number
  /** 土日を含めるか */
  includeWeekends?: boolean
  /** テーマカラー */
  themeColor?: string
}

declare module '@mogura/moguchart-core' {
  interface GanttChartElement {
    /**
     * ガントチャートのデータをExcel (.xlsx) 形式でエクスポートします
     */
    exportExcel?: (options?: ExportExcelOptions) => Promise<Blob>
  }
}

import type { GanttRow, GanttTask } from '@mogura/moguchart-core'
import type { ExcelLocaleDefinition } from './i18n'

export type { ExcelLocaleDefinition }

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
 * タイムライン列の刻み単位
 */
export type ExcelTimelineScale = 'hour' | 'day' | 'week' | 'month'

/**
 * Excelエクスポートの対応言語・ロケール指定
 * - 文字列: 'ja' | 'en' | 'zh' や登録済みのロケール識別名、任意の言語コード
 * - オブジェクト: 独自の ExcelLocaleDefinition 定義
 */
export type ExcelLocale = 'ja' | 'en' | 'zh' | (string & {}) | ExcelLocaleDefinition

/**
 * Excelエクスポートの実行オプション
 */
export interface ExportExcelOptions {
  /** 言語・ロケール ('ja' | 'en' | 'zh' 等の識別文字列、またはカスタム定義オブジェクト) */
  locale?: ExcelLocale
  /** 出力ファイル名 (デフォルト: 'gantt-chart.xlsx') */
  filename?: string
  /** シート名 (デフォルト: '工程表' / 英語時 'Gantt Chart') */
  sheetName?: string
  /** 日付の表示形式 (デフォルト: 'YYYY/MM/DD') */
  dateFormat?: string
  /** タイムラインの単位 (デフォルト: 'day') */
  timelineScale?: ExcelTimelineScale
  /** 1日または1時間あたりの列数・分割数 (デフォルト: 1。スナップ単位が指定されている場合は自動計算) */
  columnsPerUnit?: number
  /** スナップ単位（分）。日単位（1440, 720, 360, 180等）または時間単位（60, 30, 15等）に応じた分割列数を自動計算 */
  snapDurationMinutes?: number
  /** タイムライン（カレンダー）列の幅 (文字数ベース。指定しない場合は画面表示幅またはスケール既定値から自動計算) */
  timelineColumnWidth?: number
  /** タイムラインに土日を含めるか (デフォルト: true。土日列は薄いグレー背景) */
  includeWeekends?: boolean
  /** 今日の日付列をハイライトするか (デフォルト: true) */
  highlightToday?: boolean
  /** ヘッダーやアクセントのテーマカラー (CSS HEXカラー。デフォルト: '#3B82F6') */
  themeColor?: string
  /** 祝祭日判定関数 (trueを返すと祝祭日として扱われます。未指定時はchart.option.calendar.isHolidayを自動参照) */
  isHoliday?: (date: Date) => boolean
  /** 祝祭日列の背景色 (CSS HEXカラー。デフォルト: '#FEE2E2') */
  holidayColor?: string
  /** タイムラインの表示開始日 (指定しない場合は全タスクの最小開始日または現在日) */
  startDate?: Date
  /** タイムラインの表示終了日 (指定しない場合は全タスクの最大終了日または開始日から1ヶ月後) */
  endDate?: Date
  /** 出力カラムのカスタム定義配列、または標準カラム配列を受け取ってカスタマイズする関数 (指定しない場合は標準カラムが出力されます) */
  columns?: ExcelExportColumn[] | ((defaultColumns: ExcelExportColumn[]) => ExcelExportColumn[])
  /** 自動ダウンロードを実行するか (デフォルト: true。ブラウザ環境のみ有効) */
  download?: boolean
}

/**
 * プラグイン初期化時の設定オプション
 */
export interface ExcelPluginConfig {
  /** デフォルトの言語・ロケール */
  locale?: ExcelLocale
  /** プラグイン初期化時に追加登録するカスタムロケール辞書 */
  locales?: Record<string, ExcelLocaleDefinition>
  /** デフォルトのファイル名 */
  defaultFilename?: string
  /** デフォルトのシート名 */
  defaultSheetName?: string
  /** デフォルトの出力カラム定義、またはカスタマイズ関数 */
  defaultColumns?: ExcelExportColumn[] | ((defaultColumns: ExcelExportColumn[]) => ExcelExportColumn[])
  /** デフォルトの日付形式 */
  dateFormat?: string
  /** デフォルトのタイムライン単位 */
  timelineScale?: ExcelTimelineScale
  /** デフォルトの1日/1時間あたり列数 */
  columnsPerUnit?: number
  /** デフォルトのスナップ単位（分） */
  snapDurationMinutes?: number
  /** デフォルトのタイムライン列幅 */
  timelineColumnWidth?: number
  /** 土日を含めるか */
  includeWeekends?: boolean
  /** テーマカラー */
  themeColor?: string
  /** デフォルトの祝祭日判定関数 */
  isHoliday?: (date: Date) => boolean
  /** デフォルトの祝祭日背景色 */
  holidayColor?: string
}

declare module '@mogura/moguchart-core' {
  interface GanttChartElement {
    /**
     * ガントチャートのデータをExcel (.xlsx) 形式でエクスポートします
     */
    exportExcel?: (options?: ExportExcelOptions) => Promise<Blob>
  }
}

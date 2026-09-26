import type { GanttChartElement, GanttPlugin } from '@mogura/moguchart-core'
import { exportGanttToExcel, getDefaultColumns } from './export'
import { registerExcelLocale } from './i18n'
import type {
  ExcelPluginConfig,
  ExportExcelOptions,
  ExcelExportColumn,
  ExcelTimelineScale,
  ExcelLocale,
  ExcelLocaleDefinition,
} from './types'

/**
 * ガントチャートのExcel (.xlsx) エクスポートプラグイン
 */
export function excelPlugin(config?: ExcelPluginConfig): GanttPlugin<ExcelPluginConfig> {
  return {
    name: 'excel',
    version: '1.2.0',
    install(chart: GanttChartElement, options?: ExcelPluginConfig) {
      const mergedConfig = { ...config, ...options }

      // カスタムロケールの一括登録
      if (mergedConfig.locales) {
        for (const [key, def] of Object.entries(mergedConfig.locales)) {
          registerExcelLocale(key, def)
        }
      }

      // chart.exportExcel をバインド
      chart.exportExcel = async (opts: ExportExcelOptions = {}): Promise<Blob> => {
        const finalOptions: ExportExcelOptions = {
          locale: opts.locale ?? mergedConfig.locale,
          filename: opts.filename ?? mergedConfig.defaultFilename,
          sheetName: opts.sheetName ?? mergedConfig.defaultSheetName,
          dateFormat: opts.dateFormat ?? mergedConfig.dateFormat,
          timelineScale: opts.timelineScale ?? mergedConfig.timelineScale,
          columnsPerUnit: opts.columnsPerUnit ?? mergedConfig.columnsPerUnit,
          snapDurationMinutes: opts.snapDurationMinutes ?? mergedConfig.snapDurationMinutes,
          timelineColumnWidth: opts.timelineColumnWidth ?? mergedConfig.timelineColumnWidth,
          includeWeekends: opts.includeWeekends ?? mergedConfig.includeWeekends,
          themeColor: opts.themeColor ?? mergedConfig.themeColor,
          isHoliday: opts.isHoliday ?? mergedConfig.isHoliday,
          holidayColor: opts.holidayColor ?? mergedConfig.holidayColor,
          columns: opts.columns ?? mergedConfig.defaultColumns,
          ...opts,
        }

        return await exportGanttToExcel(chart, finalOptions)
      }
    },
  }
}

/**
 * クラス形式の ExcelPlugin
 */
export class ExcelPlugin implements GanttPlugin<ExcelPluginConfig> {
  name = 'excel'
  version = '1.2.0'
  config?: ExcelPluginConfig

  constructor(config?: ExcelPluginConfig) {
    this.config = config
  }

  install(chart: GanttChartElement, options?: ExcelPluginConfig) {
    return excelPlugin(this.config).install?.(chart, options)
  }
}

/**
 * スタンドアロン実行関数
 */
export async function exportExcel(
  chart: GanttChartElement,
  options: ExportExcelOptions = {}
): Promise<Blob> {
  return await exportGanttToExcel(chart, options)
}

export { exportGanttToExcel, getDefaultColumns }
export {
  registerExcelLocale,
  getExcelLocale,
  getSupportedExcelLocales,
  resolveExcelLocale,
  jaLocale,
  enLocale,
  zhLocale,
} from './i18n'
export type {
  ExcelPluginConfig,
  ExportExcelOptions,
  ExcelExportColumn,
  ExcelTimelineScale,
  ExcelLocale,
  ExcelLocaleDefinition,
}

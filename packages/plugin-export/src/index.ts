import type { GanttChartElement, GanttPlugin } from '@mogura/moguchart-core'
import { exportGanttWithHtml2Canvas, type ExportImageOptions } from './export'

export interface ExportPluginConfig {
  defaultScale?: number
  defaultFilename?: string
}

/**
 * ガントチャートのエクスポート（PNG/PDF）プラグイン
 */
export function exportPlugin(config?: ExportPluginConfig): GanttPlugin<ExportPluginConfig> {
  return {
    name: 'export',
    version: '1.0.0',
    install(chart: GanttChartElement, options?: ExportPluginConfig) {
      const mergedConfig = { ...config, ...options }

      // chart.exportImage をバインドして既存の呼び出しとの後方互換性を担保
      chart.exportImage = async (
        format: 'png' | 'pdf' = 'png',
        opts: ExportImageOptions = {}
      ): Promise<string | Blob> => {
        const scrollContainer =
          (chart as any)._scrollContainer ||
          (chart.shadowRoot?.querySelector('.scroll-container') as HTMLElement | null)
        const prevScrollLeft = scrollContainer ? scrollContainer.scrollLeft : 0
        const prevScrollTop = scrollContainer ? scrollContainer.scrollTop : 0

        ;(chart as any).isExporting = true
        await chart.updateComplete
        await new Promise((r) => requestAnimationFrame(r))
        try {
          const finalOptions: ExportImageOptions = {
            scale: mergedConfig.defaultScale ?? 2,
            filename: mergedConfig.defaultFilename,
            ...opts,
          }
          return await exportGanttWithHtml2Canvas(chart, format, finalOptions)
        } finally {
          ;(chart as any).isExporting = false
          await chart.updateComplete
          if (scrollContainer) {
            scrollContainer.scrollLeft = prevScrollLeft
            scrollContainer.scrollTop = prevScrollTop
          }
        }
      }
    },
  }
}

/**
 * クラス形式の ExportPlugin
 */
export class ExportPlugin implements GanttPlugin<ExportPluginConfig> {
  name = 'export'
  version = '1.0.0'
  config?: ExportPluginConfig

  constructor(config?: ExportPluginConfig) {
    this.config = config
  }

  install(chart: GanttChartElement, options?: ExportPluginConfig) {
    return exportPlugin(this.config).install?.(chart, options)
  }
}

/**
 * スタンドアロン実行関数
 */
export async function exportChart(
  chart: GanttChartElement,
  format: 'png' | 'pdf' = 'png',
  options: ExportImageOptions = {}
): Promise<string | Blob> {
  const scrollContainer =
    (chart as any)._scrollContainer ||
    (chart.shadowRoot?.querySelector('.scroll-container') as HTMLElement | null)
  const prevScrollLeft = scrollContainer ? scrollContainer.scrollLeft : 0
  const prevScrollTop = scrollContainer ? scrollContainer.scrollTop : 0

  ;(chart as any).isExporting = true
  await chart.updateComplete
  await new Promise((r) => requestAnimationFrame(r))
  try {
    return await exportGanttWithHtml2Canvas(chart, format, options)
  } finally {
    ;(chart as any).isExporting = false
    await chart.updateComplete
    if (scrollContainer) {
      scrollContainer.scrollLeft = prevScrollLeft
      scrollContainer.scrollTop = prevScrollTop
    }
  }
}

export { exportGanttWithHtml2Canvas }
export type { ExportImageOptions }

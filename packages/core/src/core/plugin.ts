import type { GanttChartElement } from '../components/gantt-chart'
import type { TaskUpdateEventDetail } from './types'

/**
 * ガントチャート拡張プラグインの共通インターフェース
 */
export interface GanttPlugin<TConfig = any, TChart = any> {
  /** プラグインの一意な識別名 (例: 'export', 'auto-schedule') */
  name: string
  /** プラグインのバージョン (任意) */
  version?: string
  /** チャートインスタンス初期化時またはuse()呼び出し時のインストール処理 */
  install?: (chart: TChart, config?: TConfig) => void
  /** チャート破棄時（disconnectedCallback）のクリーンアップ処理 */
  destroy?: (chart: TChart) => void
  /** ライフサイクルフック */
  hooks?: {
    /** タスク更新直前のフック（false を返すと更新処理をキャンセル） */
    beforeTaskUpdate?: (detail: TaskUpdateEventDetail) => boolean | void | Promise<boolean | void>
    /** タスク更新直後のフック */
    afterTaskUpdate?: (detail: TaskUpdateEventDetail) => void
    /** レンダリング後のフック */
    afterRender?: (chart: TChart) => void
  }
}

/**
 * プラグイン管理マネージャークラス
 */
export class PluginManager {
  private plugins = new Map<string, { plugin: GanttPlugin; config?: any }>()
  private chart: GanttChartElement

  constructor(chart: GanttChartElement) {
    this.chart = chart
  }

  /**
   * プラグインを登録・インストールする
   */
  public use<TConfig = any>(plugin: GanttPlugin<TConfig>, config?: TConfig): void {
    if (this.plugins.has(plugin.name)) {
      console.warn(`[Moguchart] Plugin "${plugin.name}" is already registered.`)
      return
    }

    this.plugins.set(plugin.name, { plugin, config })
    if (typeof plugin.install === 'function') {
      plugin.install(this.chart, config)
    }
  }

  /**
   * 登録済みプラグインの一覧を取得する
   */
  public getPlugin(name: string): GanttPlugin | undefined {
    return this.plugins.get(name)?.plugin
  }

  /**
   * プラグインが登録されているかどうかを確認する
   */
  public hasPlugin(name: string): boolean {
    return this.plugins.has(name)
  }

  /**
   * beforeTaskUpdate フックを一括実行する
   */
  public async executeBeforeTaskUpdate(detail: TaskUpdateEventDetail): Promise<boolean> {
    for (const { plugin } of this.plugins.values()) {
      if (plugin.hooks?.beforeTaskUpdate) {
        const result = await plugin.hooks.beforeTaskUpdate(detail)
        if (result === false) {
          return false
        }
      }
    }
    return true
  }

  /**
   * afterTaskUpdate フックを一括実行する
   */
  public executeAfterTaskUpdate(detail: TaskUpdateEventDetail): void {
    for (const { plugin } of this.plugins.values()) {
      plugin.hooks?.afterTaskUpdate?.(detail)
    }
  }

  /**
   * afterRender フックを一括実行する
   */
  public executeAfterRender(): void {
    for (const { plugin } of this.plugins.values()) {
      plugin.hooks?.afterRender?.(this.chart)
    }
  }

  /**
   * 全プラグインを破棄・クリーンアップする
   */
  public destroy(): void {
    for (const { plugin } of this.plugins.values()) {
      plugin.destroy?.(this.chart)
    }
    this.plugins.clear()
  }
}

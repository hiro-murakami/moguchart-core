import type { GanttChartElement } from '../components/gantt-chart'
import type {
  BeforeCellEditHookDetail,
  CellEditEventDetail,
  DependencyCreateEventDetail,
  DependencyDeleteEventDetail,
  GanttOverlayRenderContext,
  GanttViewportState,
  TaskUpdateEventDetail,
} from './types'

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
  /**
   * タイムライン上にカスタムオーバーレイ（プレゼンスカーソル、ヒートマップ、注釈SVG等）を描画するスロット関数。
   * Lit の TemplateResult、DOM ノード、文字列などを返すことができます。
   */
  renderOverlay?: (context: GanttOverlayRenderContext<TChart>) => unknown
  /** ライフサイクルフック */
  hooks?: {
    /** タスク更新直前のフック（false を返すと更新処理をキャンセル） */
    beforeTaskUpdate?: (detail: TaskUpdateEventDetail) => boolean | void | Promise<boolean | void>
    /** タスク更新直後のフック */
    afterTaskUpdate?: (detail: TaskUpdateEventDetail) => void
    /** 依存関係リンク作成直前のフック（false を返すと作成をキャンセル） */
    beforeDependencyCreate?: (detail: DependencyCreateEventDetail) => boolean | void | Promise<boolean | void>
    /** 依存関係リンク作成直後のフック */
    afterDependencyCreate?: (detail: DependencyCreateEventDetail) => void
    /** 依存関係リンク削除直前のフック（false を返すと削除をキャンセル） */
    beforeDependencyDelete?: (detail: DependencyDeleteEventDetail) => boolean | void | Promise<boolean | void>
    /** 依存関係リンク削除直後のフック */
    afterDependencyDelete?: (detail: DependencyDeleteEventDetail) => void
    /** グリッドセル編集確定直前のフック（false を返すと編集をキャンセル） */
    beforeCellEdit?: (detail: BeforeCellEditHookDetail) => boolean | void | Promise<boolean | void>
    /** グリッドセル編集確定直後のフック */
    afterCellEdit?: (detail: CellEditEventDetail) => void
    /** スクロールまたはズームによるビューポート状態変化時のフック */
    onViewportChange?: (viewport: GanttViewportState) => void
    /** レンダリング後のフック */
    afterRender?: (chart: TChart) => void
    /** オーバーレイ描画スロット（トップレベルの renderOverlay と同等） */
    renderOverlay?: (context: GanttOverlayRenderContext<TChart>) => unknown
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
    if (plugin.renderOverlay || plugin.hooks?.renderOverlay) {
      this.chart.requestUpdate()
    }
  }

  /**
   * 登録済みプラグインを取得する
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
   * オーバーレイ描画を持つプラグインが存在するかを確認する
   */
  public hasOverlayRenderers(): boolean {
    for (const { plugin } of this.plugins.values()) {
      if (typeof plugin.renderOverlay === 'function' || typeof plugin.hooks?.renderOverlay === 'function') {
        return true
      }
    }
    return false
  }

  /**
   * 全プラグインのオーバーレイ描画結果を取得する
   */
  public renderOverlays(context: GanttOverlayRenderContext): unknown[] {
    const results: unknown[] = []
    for (const { plugin } of this.plugins.values()) {
      const fn = plugin.renderOverlay ?? plugin.hooks?.renderOverlay
      if (typeof fn === 'function') {
        const res = fn(context)
        if (res !== undefined && res !== null) {
          results.push(res)
        }
      }
    }
    return results
  }

  /**
   * 同期フックのみの場合はマイクロタスク遅延なしで即座に実行し、
   * Promise を返す非同期フックが含まれる場合のみ非同期チェーンへフォールバックするヘルパー
   */
  public runBeforeHook<
    K extends
      | 'beforeTaskUpdate'
      | 'beforeDependencyCreate'
      | 'beforeDependencyDelete'
      | 'beforeCellEdit',
  >(
    hookKey: K,
    detail: Parameters<NonNullable<NonNullable<GanttPlugin['hooks']>[K]>>[0],
    onAllowed: () => void,
    onBlocked?: () => void,
  ): void {
    const entries = Array.from(this.plugins.values())
    for (let i = 0; i < entries.length; i++) {
      const fn = entries[i].plugin.hooks?.[hookKey] as
        | ((arg: any) => boolean | void | Promise<boolean | void>)
        | undefined
      if (typeof fn !== 'function') continue

      const res = fn(detail)
      if (res === false) {
        onBlocked?.()
        return
      }
      if (res && typeof (res as Promise<boolean | void>).then === 'function') {
        void (res as Promise<boolean | void>).then(async (resolved) => {
          if (resolved === false) {
            onBlocked?.()
            return
          }
          for (let j = i + 1; j < entries.length; j++) {
            const nextFn = entries[j].plugin.hooks?.[hookKey] as
              | ((arg: any) => boolean | void | Promise<boolean | void>)
              | undefined
            if (typeof nextFn !== 'function') continue
            const nextRes = await nextFn(detail)
            if (nextRes === false) {
              onBlocked?.()
              return
            }
          }
          onAllowed()
        })
        return
      }
    }
    onAllowed()
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
   * beforeDependencyCreate フックを一括実行する
   */
  public async executeBeforeDependencyCreate(detail: DependencyCreateEventDetail): Promise<boolean> {
    for (const { plugin } of this.plugins.values()) {
      if (plugin.hooks?.beforeDependencyCreate) {
        const result = await plugin.hooks.beforeDependencyCreate(detail)
        if (result === false) {
          return false
        }
      }
    }
    return true
  }

  /**
   * afterDependencyCreate フックを一括実行する
   */
  public executeAfterDependencyCreate(detail: DependencyCreateEventDetail): void {
    for (const { plugin } of this.plugins.values()) {
      plugin.hooks?.afterDependencyCreate?.(detail)
    }
  }

  /**
   * beforeDependencyDelete フックを一括実行する
   */
  public async executeBeforeDependencyDelete(detail: DependencyDeleteEventDetail): Promise<boolean> {
    for (const { plugin } of this.plugins.values()) {
      if (plugin.hooks?.beforeDependencyDelete) {
        const result = await plugin.hooks.beforeDependencyDelete(detail)
        if (result === false) {
          return false
        }
      }
    }
    return true
  }

  /**
   * afterDependencyDelete フックを一括実行する
   */
  public executeAfterDependencyDelete(detail: DependencyDeleteEventDetail): void {
    for (const { plugin } of this.plugins.values()) {
      plugin.hooks?.afterDependencyDelete?.(detail)
    }
  }

  /**
   * beforeCellEdit フックを一括実行する
   */
  public async executeBeforeCellEdit(detail: BeforeCellEditHookDetail): Promise<boolean> {
    for (const { plugin } of this.plugins.values()) {
      if (plugin.hooks?.beforeCellEdit) {
        const result = await plugin.hooks.beforeCellEdit(detail)
        if (result === false) {
          return false
        }
      }
    }
    return true
  }

  /**
   * afterCellEdit フックを一括実行する
   */
  public executeAfterCellEdit(detail: CellEditEventDetail): void {
    for (const { plugin } of this.plugins.values()) {
      plugin.hooks?.afterCellEdit?.(detail)
    }
  }

  /**
   * onViewportChange フックを一括実行する
   */
  public executeViewportChange(viewport: GanttViewportState): void {
    for (const { plugin } of this.plugins.values()) {
      plugin.hooks?.onViewportChange?.(viewport)
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

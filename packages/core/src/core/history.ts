/**
 * ガントチャートのUndo/Redo（操作履歴）管理
 */

export type GanttCommandType =
  | 'task-move'
  | 'task-resize'
  | 'task-progress'
  | 'task-delete'
  | 'row-reorder'
  | 'dependency-create'
  | 'dependency-delete'
  | 'custom'

/**
 * ガントチャートに対する単一の編集操作を表すコマンドインターフェース
 */
export interface GanttCommand<TBefore = any, TAfter = any> {
  /** コマンドの一意なID */
  id: string
  /** 操作種別 */
  type: GanttCommandType
  /** ユーザー向け操作説明（例: 'タスク移動', '行の並び替え'） */
  description: string
  /** 操作が行われたタイムスタンプ */
  timestamp: number
  /** 操作前のスナップショットまたは差分データ */
  before: TBefore
  /** 操作後のスナップショットまたは差分データ */
  after: TAfter
  /** 操作を元に戻す関数 */
  undo: () => void | Promise<void>
  /** 操作をやり直す関数 */
  redo: () => void | Promise<void>
}

/**
 * 履歴状態情報
 */
export interface HistoryState {
  canUndo: boolean
  canRedo: boolean
  undoCount: number
  redoCount: number
  lastCommand?: GanttCommand
}

/**
 * HistoryManagerの初期化オプション
 */
export interface HistoryManagerOptions {
  /** 履歴管理を有効にするかどうか (デフォルト: true) */
  enabled?: boolean
  /** 保持する最大履歴数 (デフォルト: 50) */
  maxDepth?: number
  /** Undo実行直前のフック。falseを返すとUndoをキャンセルできる */
  onUndo?: (command: GanttCommand) => Promise<boolean | void> | boolean | void
  /** Redo実行直前のフック。falseを返すとRedoをキャンセルできる */
  onRedo?: (command: GanttCommand) => Promise<boolean | void> | boolean | void
  /** 状態が変化した際の通知コールバック */
  onChange?: (state: HistoryState) => void
}

/**
 * 履歴マネージャーの公開インターフェース
 */
export interface IHistoryManager {
  readonly isExecuting: boolean
  enabled: boolean
  readonly canUndo: boolean
  readonly canRedo: boolean
  readonly state: HistoryState
  execute(command: GanttCommand): void
  undo(): Promise<boolean>
  redo(): Promise<boolean>
  clear(): void
  updateOptions(newOptions: Partial<HistoryManagerOptions>): void
}

/**
 * ガントチャート操作のUndo/Redo履歴を管理するマネージャークラス
 */
export class HistoryManager implements IHistoryManager {
  private undoStack: GanttCommand[] = []
  private redoStack: GanttCommand[] = []
  private options: HistoryManagerOptions
  private _isExecuting = false

  constructor(options: HistoryManagerOptions = {}) {
    this.options = {
      enabled: options.enabled ?? true,
      maxDepth: options.maxDepth ?? 50,
      onUndo: options.onUndo,
      onRedo: options.onRedo,
      onChange: options.onChange,
    }
  }

  /**
   * 現在Undo/Redo処理を実行中かどうか
   */
  public get isExecuting(): boolean {
    return this._isExecuting
  }

  /**
   * 履歴機能が有効かどうか
   */
  public get enabled(): boolean {
    return this.options.enabled !== false
  }

  public set enabled(val: boolean) {
    this.options.enabled = val
    if (!val) {
      this.clear()
    }
  }

  /**
   * Undo可能かどうか
   */
  public get canUndo(): boolean {
    return this.enabled && this.undoStack.length > 0
  }

  /**
   * Redo可能かどうか
   */
  public get canRedo(): boolean {
    return this.enabled && this.redoStack.length > 0
  }

  /**
   * 現在の履歴状態を取得
   */
  public get state(): HistoryState {
    return {
      canUndo: this.canUndo,
      canRedo: this.canRedo,
      undoCount: this.undoStack.length,
      redoCount: this.redoStack.length,
      lastCommand: this.undoStack[this.undoStack.length - 1],
    }
  }

  /**
   * 新しい操作コマンドを履歴に追加して実行（記録）する
   * ※Undo/Redo実行中の再帰的な追加は防止される
   */
  public execute(command: GanttCommand): void {
    if (!this.enabled || this._isExecuting) return

    const maxDepth = this.options.maxDepth ?? 50
    this.undoStack.push(command)

    if (this.undoStack.length > maxDepth) {
      this.undoStack.splice(0, this.undoStack.length - maxDepth)
    }

    // 新たな操作が行われたためRedoスタックはクリア
    this.redoStack = []
    this.notifyChange()
  }

  /**
   * 直前の操作を元に戻す
   * @returns 正常に戻せた場合は true
   */
  public async undo(): Promise<boolean> {
    if (!this.canUndo || this._isExecuting) return false

    const command = this.undoStack.pop()
    if (!command) return false

    this._isExecuting = true
    try {
      if (this.options.onUndo) {
        const hookResult = await this.options.onUndo(command)
        if (hookResult === false) {
          // キャンセルされた場合はスタックに戻す
          this.undoStack.push(command)
          return false
        }
      }

      await command.undo()
      this.redoStack.push(command)
      return true
    } catch (err) {
      console.error('[HistoryManager] Undo failed:', err)
      this.undoStack.push(command)
      return false
    } finally {
      this._isExecuting = false
      this.notifyChange()
    }
  }

  /**
   * 直前にUndoした操作をやり直す
   * @returns 正常にやり直せた場合は true
   */
  public async redo(): Promise<boolean> {
    if (!this.canRedo || this._isExecuting) return false

    const command = this.redoStack.pop()
    if (!command) return false

    this._isExecuting = true
    try {
      if (this.options.onRedo) {
        const hookResult = await this.options.onRedo(command)
        if (hookResult === false) {
          // キャンセルされた場合はスタックに戻す
          this.redoStack.push(command)
          return false
        }
      }

      await command.redo()
      this.undoStack.push(command)
      return true
    } catch (err) {
      console.error('[HistoryManager] Redo failed:', err)
      this.redoStack.push(command)
      return false
    } finally {
      this._isExecuting = false
      this.notifyChange()
    }
  }

  /**
   * 履歴スタックをすべてクリアする
   */
  public clear(): void {
    this.undoStack = []
    this.redoStack = []
    this.notifyChange()
  }

  /**
   * オプションを更新する
   */
  public updateOptions(newOptions: Partial<HistoryManagerOptions>): void {
    this.options = { ...this.options, ...newOptions }
  }

  private notifyChange(): void {
    if (this.options.onChange) {
      this.options.onChange(this.state)
    }
  }
}

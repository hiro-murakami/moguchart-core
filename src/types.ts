/**
 * ガントチャートのバーに適用できるパターンの種類
 */
export type BarPattern =
  | 'diagonal-stripe'
  | 'diagonal-stripe-thin'
  | 'diagonal-stripe-thick'
  | 'diagonal-stripe-reverse'
  | 'vertical-stripe'
  | 'horizontal-stripe'
  | 'checkerboard'
  | 'dots'
  | 'dots-dense'
  | 'triangle'
  | 'circle'
  | 'grid'
  | 'diagonal-grid'

/**
 * タスクのバーのパターン設定
 */
export interface GanttTaskPattern {
  /** パターンの種類 */
  type: BarPattern
  /** パターンの色 (CSS color string) */
  color?: string
}

/**
 * ガントチャート上の個々のタスクを表すインターフェース
 */
export interface GanttTask {
  /** タスクの一意なID */
  id: string
  /** タスクの表示名 */
  name?: string
  /** 開始日時 */
  start: Date
  /** 終了日時 */
  end: Date
  /** バーのカスタムスタイル (CSS文字列) */
  style?: string
  /** バーのラベルのカスタムスタイル (CSS文字列) */
  labelStyle?: string
  /** バーの塗りつぶしパターン */
  pattern?: GanttTaskPattern
  /** 依存関係にあるタスクのID配列 */
  dependencies?: string[]
  /**
   * ドラッグによる移動の許可設定
   * 'both': 縦横移動可能 (デフォルト)
   * 'x': 横移動のみ可能
   * 'y': 縦移動のみ可能
   * 'none': 移動不可
   */
  movable?: 'both' | 'x' | 'y' | 'none'
  /** リサイズ可否 (指定がない場合はmovableの設定に準ずる) */
  resizable?: boolean
}

/**
 * ガントチャートの行を表すインターフェース
 */
export interface GanttRow {
  /** 行の一意なID */
  id: string
  /** 行ヘッダーに表示するラベル */
  name: string
  /** この行に含まれるタスクの配列 */
  tasks: GanttTask[]
  /** 行を表示するかどうか (デフォルト: true) */
  visible?: boolean
}

/**
 * 内部計算用: レーン情報が付与されたタスク
 */
export interface TaskWithLane extends GanttTask {
  /** 表示されるレーン番号 (0始まり) */
  lane: number
}

/**
 * ガントチャートのバーに関するオプション
 */
export interface GanttChartOptionBar {
  /** バーの高さ (px) */
  height?: number
  /** バーの上下マージン (px) */
  margin?: number
  /** バーの角丸の半径 (px) */
  cornerRadius?: number
}

/**
 * 行ヘッダーに関するオプション
 */
export interface GanttChartOptionRowHeader {
  /** ヘッダーの幅 (px) */
  width?: number
  /** ヘッダーの背景色 */
  backgroundColor?: string
  /** ヘッダーのリサイズ可否 (デフォルト: true) */
  resizable?: boolean
  /** ヘッダーの最小幅 (px) */
  minWidth?: number
  /** ヘッダーの最大幅 (px) */
  maxWidth?: number
}

/**
 * カレンダー表示に関するオプション
 */
export interface GanttChartOptionCalendar {
  /** チャートの開始日時 */
  start: Date
  /** チャートの終了日時 */
  end: Date
  /** 1日あたりのピクセル幅 */
  pxPerDay: number
  /** 月の表示フォーマット (例: 'YYYY年M月') */
  monthFormat?: string
  /** 行の背景を表示するかどうか */
  showRowBackground?: boolean
  /** 祝日判定ロジック (trueを返すと祝日として扱われる) */
  isHoliday?: (date: Date) => boolean
  /** 時間単位のグリッドを表示するかどうか */
  showTime?: boolean
  /** 年月を表示するかどうか */
  showMonths?: boolean
  /** 日付を表示するかどうか */
  showDays?: boolean
  /** 現在時刻線を表示するかどうか */
  showCurrentTime?: boolean
  /** 現在時刻バッジを表示するかどうか */
  showCurrentTimeBadge?: boolean
  /** 現在時刻線を自動更新する間隔（ミリ秒）。0または未指定の場合は更新しない */
  currentTimeUpdateInterval?: number
}

export interface GanttChartOptionCustomRendering {
  /** バーのコンテンツをレンダリングする関数 */
  barContent?: (task: GanttTask) => string | unknown
  /** 行ヘッダーのコンテンツをレンダリングする関数 */
  rowHeaderContent?: (row: GanttRow) => string | unknown
  /** ツールチップのコンテンツをレンダリングする関数 */
  tooltip?: (task: GanttTask) => string | unknown
  /** ドラッグ中の情報オーバーレイのコンテンツをレンダリングする関数 */
  dragInfo?: (task: GanttTask, newStart: Date, newEnd: Date, targetRow?: GanttRow) => string | unknown
}

/**
 * ガントチャート全体のオプション設定
 */
export interface ChartContextMenuEventDetail {
  event: MouseEvent
  date: Date
  rowId: string
}

export interface GanttChartOption {
  /** バーの設定 */
  bar?: GanttChartOptionBar
  /** 行ヘッダーの設定 */
  rowHeader?: GanttChartOptionRowHeader
  /** カレンダーの設定 */
  calendar: GanttChartOptionCalendar
  /** 読み取り専用モードかどうか */
  readOnly?: boolean
  /** ツールチップを表示するまでの遅延時間 (ms) */
  tooltipDelay?: number
  /** ツールチップを表示するかどうか */
  showTooltip?: boolean
  /** ドラッグ中の情報オーバーレイを表示するかどうか */
  showDragInfoOverlay?: boolean
  /** テーマ ('light' | 'dark' | 'system') */
  theme?: 'light' | 'dark' | 'system'
  /** カスタムテーマカラー */
  customTheme?: Partial<ThemeColorPalette>
  /** 行の並び替えを有効にするかどうか */
  enableRowReordering?: boolean
  /** スナップする時間単位（分）。デフォルトは1440（1日） */
  snapDuration?: number
  /** 非表示に設定された行を表示するかどうか (デフォルト: false) */
  showHiddenRows?: boolean
  /** カスタムレンダリング設定 */
  customRendering?: GanttChartOptionCustomRendering
}

/**
 * タスク更新イベントの詳細データ
 */
export interface TaskUpdateEventDetail extends GanttTask {
  /** X方向の移動量 */
  dx?: number
  /** Y方向の移動量 */
  dy: number
  /** ドラッグ中かどうか */
  isDragging: boolean
  /** ドロップ先の行ID */
  targetRowId?: string
  /** マウスのX座標（ドラッグ中のみ） */
  x?: number
  /** マウスのY座標（ドラッグ中のみ） */
  y?: number
  /** タスク移動モード(move/copy) */
  mode: GanttTaskMoveMode
}

/**
 * バーのホバーイベント詳細
 */
export interface BarHoverEventDetail {
  /** 対象のタスク */
  task: GanttTask
  /** マウスのX座標 */
  x: number
  /** マウスのY座標 */
  y: number
}

/**
 * タスククリックイベントの詳細
 */
export interface TaskClickEventDetail {
  /** 対象のタスク */
  task: GanttTask
  /** 元のマウスイベント */
  event: MouseEvent
}

/**
 * タスクのコンテキストメニューイベントの詳細
 */
export interface TaskContextMenuEventDetail {
  /** 対象のタスク */
  task: GanttTask
  /** 元のマウスイベント */
  event: MouseEvent
}

/**
 * タスクドロップイベントの詳細
 */
export interface TaskDropEventDetail {
  /** ドロップされたタスク情報 */
  task: GanttTask
  /** ドロップ位置の日時 */
  dropDate: Date
  /** ドロップ先の行ID */
  targetRowId: string
}

/**
 * 行の並び替えイベント詳細
 */
export interface RowReorderEventDetail {
  /** 移動元の行ID */
  sourceId: string
  /** 移動先の行ID */
  targetId: string
  /** 移動先に対する位置 ('top' | 'bottom') */
  position?: 'top' | 'bottom'
  /** 並び替え後の行データ */
  rows: GanttRow[]
}

/**
 * 行ヘッダーのリサイズイベント詳細
 */
export interface RowHeaderResizeEventDetail {
  /** 新しい幅 (px) */
  width: number
}

/**
 * 行選択変更イベントの詳細
 */
export interface RowSelectionChangeEventDetail {
  /** 選択されている行IDの配列 */
  selectedIds: string[]
}

/**
 * バー選択変更イベントの詳細
 */
export interface BarSelectionChangeEventDetail {
  /** 選択されているタスクIDの配列 */
  selectedIds: string[]
}

/**
 * 行ヘッダークリックイベントの詳細
 */
export interface RowHeaderClickEventDetail {
  /** クリックされた行ID */
  rowId: string
  /** クリックされた行データ */
  row: GanttRow
  /** 元のクリックイベント */
  event: MouseEvent
  /** クリックされたヘッダー要素 */
  target: HTMLElement
}

/**
 * 行ヘッダーダブルクリックイベントの詳細
 */
export interface RowHeaderDblClickEventDetail {
  /** ダブルクリックされた行ID */
  rowId: string
  /** ダブルクリックされた行データ */
  row: GanttRow
  /** 元のダブルクリックイベント */
  event: MouseEvent
  /** ダブルクリックされたヘッダー要素 */
  target: HTMLElement
}

/**
 * 行ヘッダー右クリックイベントの詳細
 */
export interface RowHeaderContextMenuEventDetail {
  /** 右クリックされた行ID */
  rowId: string
  /** 右クリックされた行データ */
  row: GanttRow
  /** 元のコンテキストメニューイベント */
  event: MouseEvent
  /** 右クリックされたヘッダー要素 */
  target: HTMLElement
}

/**
 * テーマカラーパレット定義
 */
export interface ThemeColorPalette {
  /** 背景色 */
  bg: string
  /** テキスト色 */
  text: string
  /** ボーダー色 */
  border: string
  /** グリッド線色 */
  gridLine: string
  /** サブグリッド線色（スナップ単位など） */
  subGridLine: string
  /** ドラッグ対象の背景色 */
  dragTarget: string
  /** ツールチップの背景色 */
  tooltipBg: string
  /** ツールチップのテキスト色 */
  tooltipText: string
  /** ドラッグオーバーレイの背景色 */
  dragOverlayBg: string
  /** ドラッグオーバーレイのテキスト色 */
  dragOverlayText: string
  /** ドラッグオーバーレイのサブテキスト色 */
  dragOverlaySubText: string
  /** ドラッグオーバーレイの区切り線色 */
  dragOverlayDivider: string
  /** 依存関係線の色 */
  dependencyLine: string
  /** カレンダー領域の背景色 */
  calendarBg: string
  /** 土曜日の背景色 */
  saturday: string
  /** 日曜日の背景色 */
  sunday: string
  /** 祝日の背景色 */
  holiday: string
  /** 行ヘッダーの背景色 */
  rowHeaderBg: string
  /** 選択された行の背景色 */
  rowSelected: string
  /** 選択された行のヘッダーの背景色 */
  rowSelectedHeader: string
  /** 非表示設定されている行の背景色 */
  rowHiddenBg: string
  /** 現在時刻線の色 */
  currentTimeLine: string
  /** 現在時刻線のバッジテキスト色 */
  currentTimeLineText: string
  /** 月曜日の背景色 (オプション) */
  monday?: string
  /** 火曜日の背景色 (オプション) */
  tuesday?: string
  /** 水曜日の背景色 (オプション) */
  wednesday?: string
  /** 木曜日の背景色 (オプション) */
  thursday?: string
  /** 金曜日の背景色 (オプション) */
  friday?: string
}

/**
 * テーマセット (light/dark)
 */
export interface ThemeColors {
  light: ThemeColorPalette
  dark: ThemeColorPalette
}

export type GanttTaskMoveMode = 'copy' | 'move'

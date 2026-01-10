/**
 * ガントチャートのバーに適用できるパターンの種類
 */
export type BarPattern =
  | 'diagonal-stripe'
  | 'diagonal-stripe-reverse'
  | 'vertical-stripe'
  | 'horizontal-stripe'
  | 'checkerboard'
  | 'dots'
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
  /** パターンのサイズ (例: '4px') */
  size?: string
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
  label: string
  /** この行に含まれるタスクの配列 */
  tasks: GanttTask[]
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
}

/**
 * カレンダー表示に関するオプション
 */
export interface GanttChartOptionCalendar {
  /** チャートの開始日時 */
  start: Date
  /** 1日あたりのピクセル幅 */
  pxPerDay: number
  /** 表示する総日数 */
  totalDays: number
  /** 月の表示フォーマット (例: 'YYYY年M月') */
  monthFormat?: string
  /** 行の背景を表示するかどうか */
  showRowBackground?: boolean
  /** 祝日判定ロジック (trueを返すと祝日として扱われる) */
  isHoliday?: (date: Date) => boolean
}

/**
 * ガントチャート全体のオプション設定
 */
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
  /** テーマ ('light' | 'dark') */
  theme?: 'light' | 'dark'
  /** カスタムテーマカラー */
  customTheme?: Partial<ThemeColorPalette>
  /** 行の並び替えを有効にするかどうか */
  enableRowReordering?: boolean
  /** スナップする時間単位（分）。デフォルトは1440（1日） */
  snapDuration?: number
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
}

/**
 * バーの内容をレンダリングする際のイベント詳細
 */
export interface RenderBarContentEventDetail {
  /** コンテンツを描画するコンテナ要素 */
  container: HTMLElement
  /** 対象のタスク */
  task: GanttTask
}

/**
 * 行ヘッダーをレンダリングする際のイベント詳細
 */
export interface RenderRowHeaderEventDetail {
  /** ヘッダーを描画するコンテナ要素 */
  container: HTMLElement
  /** 対象の行 */
  row: GanttRow
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
 * ツールチップをレンダリングする際のイベント詳細
 */
export interface RenderTooltipEventDetail {
  /** ツールチップを描画するコンテナ要素 */
  container: HTMLElement
  /** 対象のタスク */
  task: GanttTask
  /** 表示位置のX座標 */
  x: number
  /** 表示位置のY座標 */
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
 * ドラッグ情報のレンダリングイベント詳細
 */
export interface RenderDragInfoEventDetail {
  /** 情報を描画するコンテナ要素 */
  container: HTMLElement
  /** 対象のタスク */
  task: GanttTask
  /** 新しい開始日時 */
  newStart: Date
  /** 新しい終了日時 */
  newEnd: Date
  /** 移動先の行（行移動がない場合はundefined） */
  targetRow?: GanttRow
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

import type { MoguchartLocale } from './i18n'

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
 * マーカーの種類
 */
export type MarkerType = 'triangle-up' | 'triangle-down' | 'triangle-left' | 'triangle-right' | 'diamond' | 'square'

/**
 * マーカーのアンカー位置
 */
export type AnchorType = 'start' | 'end' | 'center'

/**
 * マーカーのフォントサイズ
 */
export type MarkerFontSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

/**
 * マーカーの設定
 */
export interface GanttMarker {
  /** マーカーの一意なID */
  id: string
  /** マーカーの表示名 */
  name?: string
  /** マーカーの日時 */
  date: Date
  /** マーカーのアンカー位置 */
  anchor?: AnchorType
  /** マーカーの種類 */
  type: MarkerType
  /** マーカーの色 (CSS color string) */
  color?: string
  /** マーカーのラベルのフォントサイズ ('xs'=極小, 'sm'=小, 'md'=中, 'lg'=大, 'xl'=特大) */
  fontSize?: MarkerFontSize
  /** マーカーのカスタムスタイル (CSS文字列) */
  style?: string
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
  /** 進捗率 (0〜100 の数値) */
  progress?: number
  /** 進捗バーのカスタム色 (CSSカラー文字列) */
  progressColor?: string
  /** 進捗バーのカスタムスタイル (CSS文字列) */
  progressStyle?: string
  /** 進捗バーのドラッグ編集可否 (指定がない場合はoption.progress.editableに準ずる) */
  progressResizable?: boolean
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
  /** マーカーの配列 */
  markers?: GanttMarker[]
  /** 現在選択中（編集中）のマーカーID */
  selectedMarkerId?: string
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
 * マイルストーンに関するオプション
 */
export interface GanttChartMilestone {
  /** マイルストーンの一意なID */
  id: string
  /** マイルストーンの表示名 */
  name: string
  /** マイルストーンの日時 */
  start: Date
  /** マイルストーンの色 */
  color: string
  /** 線の幅 (px)。デフォルト: 2 */
  width?: number
  /** マイルストーンのカスタムスタイル (CSS文字列) */
  style?: string
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
  /** 月あたりのピクセル幅（指定された場合、月単位の等幅表示になる） */
  pxPerMonth?: number
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
  /** 週番号ヘッダーを表示するかどうか */
  showWeeks?: boolean
  /** 週の始まりの曜日 (0=日曜, 1=月曜, ..., 6=土曜)。デフォルト: 1 (月曜) */
  weekStartDay?: 0 | 1 | 2 | 3 | 4 | 5 | 6
  /** 週番号の表示フォーマット関数 (引数: 年の通算週番号、デフォルト: 'W1', 'W2'...) */
  weekFormat?: (weekNumber: number, startDate: Date) => string
  /** 週番号セルのテキスト配置 (デフォルト: 'center') */
  weekTextAlign?: 'left' | 'center' | 'right'
  /** 月単位表示（上段=年、下段=月）を有効にするかどうか */
  showMonthsRow?: boolean
  /** 月セルのテキスト配置 (デフォルト: 'center') */
  monthTextAlign?: 'left' | 'center' | 'right'
  /** マイルストーンの配列 */
  milestones?: GanttChartMilestone[]
  /** マウスカーソル位置の縦罫線を表示するかどうか */
  showCursorLine?: boolean
  /** カーソル縦罫線の色 (CSS color string)。デフォルト: 現在時刻線と同色 */
  cursorLineColor?: string
}

/**
 * カレンダー月セルのカスタムレンダリング用コンテキスト
 */
export interface CalendarMonthCellContext {
  /** 年 */
  year: number
  /** 月 (0-11) */
  month: number
  /** セルの幅 (px) */
  width: number
  /** デフォルトのラベルテキスト */
  defaultLabel: string
}

/**
 * カレンダー日セルのカスタムレンダリング用コンテキスト
 */
export interface CalendarDayCellContext {
  /** 日付 */
  date: Date
  /** セルの幅 (px) */
  width: number
  /** 土曜日かどうか */
  isSaturday: boolean
  /** 日曜日かどうか */
  isSunday: boolean
  /** 祝日かどうか */
  isHoliday: boolean
  /** デフォルトのラベルテキスト */
  defaultLabel: string
}

/**
 * カレンダー週セルのカスタムレンダリング用コンテキスト
 */
export interface CalendarWeekCellContext {
  /** 週番号 */
  weekNumber: number
  /** 週の開始日 */
  startDate: Date
  /** セルの幅 (px) */
  width: number
  /** デフォルトのラベルテキスト */
  defaultLabel: string
}

/**
 * カレンダー時間セルのカスタムレンダリング用コンテキスト
 */
export interface CalendarHourCellContext {
  /** 時間 (0-23) */
  hour: number
  /** セルの幅 (px) */
  width: number
  /** 対応する日付 */
  date: Date
}

/**
 * ガントチャート背景の各日セルのカスタムレンダリング用コンテキスト
 */
export interface ChartBackgroundCellContext {
  /** 日付 */
  date: Date
  /** セルの幅 (px) */
  width: number
  /** セルの高さ (px) */
  height: number
  /** 行のID */
  rowId: string
  /** 土曜日かどうか */
  isSaturday: boolean
  /** 日曜日かどうか */
  isSunday: boolean
  /** 祝日かどうか */
  isHoliday: boolean
  /** デフォルトの背景色 */
  defaultColor: string
  /** 列インデックス (0始まり) */
  index: number
}

/**
 * カスタムレンダリングに関するオプション
 */
export interface GanttChartOptionCustomRendering {
  /** バーのコンテンツをレンダリングする関数 */
  barContent?: (task: GanttTask) => string | unknown
  /** 行ヘッダーのコンテンツをレンダリングする関数 */
  rowHeaderContent?: (row: GanttRow) => string | unknown
  /** ツールチップのコンテンツをレンダリングする関数 */
  tooltip?: (task: GanttTask) => string | unknown
  /** ドラッグ中の情報オーバーレイのコンテンツをレンダリングする関数 */
  dragInfo?: (task: GanttTask, newStart: Date, newEnd: Date, targetRow?: GanttRow) => string | unknown
  /** 行ヘッダーの左上コーナーセルのコンテンツをレンダリングする関数 */
  cornerContent?: () => string | unknown
  /** カレンダーの月セルをレンダリングする関数 */
  calendarMonthContent?: (context: CalendarMonthCellContext) => string | unknown
  /** カレンダーの日セルをレンダリングする関数 */
  calendarDayContent?: (context: CalendarDayCellContext) => string | unknown
  /** カレンダーの週セルをレンダリングする関数 */
  calendarWeekContent?: (context: CalendarWeekCellContext) => string | unknown
  /** カレンダーの時間セルをレンダリングする関数 */
  calendarHourContent?: (context: CalendarHourCellContext) => string | unknown
  /** ガントチャート部の背景セルをレンダリングする関数。各日のセルごとに呼ばれ、HTML文字列またはTemplateResultを返す */
  chartBackground?: (context: ChartBackgroundCellContext) => string | unknown
  /** 行ヘッダーのツールチップコンテンツをレンダリングする関数。マウスホバー時に呼ばれる */
  rowHeaderTooltip?: (row: GanttRow) => string | HTMLElement | unknown
}

/**
 * チャート背景右クリックイベントの詳細データ
 */
export interface ChartContextMenuEventDetail {
  event: MouseEvent
  date: Date
  rowId: string
}

/**
 * 依存関係線のスタイル
 * - 'curve': ベジェ曲線
 * - 'orthogonal': 直角折れ線（角丸付き）（デフォルト）
 */
export type DependencyLineStyle = 'curve' | 'orthogonal'

/**
 * 依存関係線に関するオプション
 */
export interface GanttChartOptionDependency {
  /** 矢印を表示するかどうか (デフォルト: true) */
  showArrows?: boolean
  /** 矢印の大きさ (px)。デフォルト: 8 */
  arrowSize?: number
  /**
   * 接続線のスタイル (デフォルト: 'orthogonal')
   * - 'curve': ベジェ曲線
   * - 'orthogonal': 直角折れ線（角が丸くなる）
   */
  lineStyle?: DependencyLineStyle
  /** orthogonalスタイル時の角丸半径 (px)。デフォルト: 8 */
  cornerRadius?: number
  /** 接続ポイント（丸印）を表示するかどうか (デフォルト: true) */
  showConnectors?: boolean
  /** クリティカルパスを表示するかどうか (デフォルト: false) */
  showCriticalPath?: boolean
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
  /** テーマ ('light' | 'dark' | 'system') */
  theme?: 'light' | 'dark' | 'system'
  /** カスタムテーマカラー */
  customTheme?: Partial<ThemeColorPalette>
  /** 行の並び替えを有効にするかどうか */
  enableRowReordering?: boolean
  /** タスクの行間移動を有効にするかどうか (デフォルト: true) */
  enableCrossRowMove?: boolean
  /** スナップする時間単位（分）。デフォルトは1440（1日） */
  snapDuration?: number
  /** 非表示に設定された行を表示するかどうか (デフォルト: false) */
  showHiddenRows?: boolean
  /** カスタムレンダリング設定 */
  customRendering?: GanttChartOptionCustomRendering
  /** ロケール設定 (デフォルト: 日本語) */
  locale?: MoguchartLocale
  /** 依存関係線の設定 */
  dependency?: GanttChartOptionDependency
  /** キーボード操作の設定 */
  keyboard?: {
    /** キーボード操作を有効にするか (デフォルト: true) */
    enabled?: boolean
    /** Shift+矢印キーでのタスク移動量（分）。省略時は snapDuration を使用 */
    moveStep?: number
  }
  /** ズーム機能の設定 */
  zoom?: {
    /** ズーム機能を有効にするか (デフォルト: false) */
    enabled?: boolean
    /** 最小 pxPerDay (デフォルト: 2)。pxPerMonth モードの場合は最小 pxPerMonth */
    min?: number
    /** 最大 pxPerDay (デフォルト: 200)。pxPerMonth モードの場合は最大 pxPerMonth */
    max?: number
    /** ホイール1回あたりのズーム倍率 (デフォルト: 1.2) */
    step?: number
  }
  /** ミニマップ（Overview Minimap）機能の設定 */
  minimap?: GanttChartOptionMinimap
  /** 進捗管理機能の設定 */
  progress?: GanttChartOptionProgress
}

/**
 * タスク進捗管理に関するオプション
 */
export interface GanttChartOptionProgress {
  /** 進捗表示を有効にするかどうか (デフォルト: true) */
  enabled?: boolean
  /** 進捗バーをドラッグして進捗率を変更可能にするか (デフォルト: false) */
  editable?: boolean
  /** 進捗バーのデフォルト色 (CSSカラー文字列) */
  color?: string
  /** 進捗ラベル (例: '50%') を表示するかどうか (デフォルト: false) */
  showLabel?: boolean
  /** 進捗ラベルの表示位置 ('inside' | 'right' | 'left' | 'center') (デフォルト: 'inside') */
  labelPosition?: 'inside' | 'right' | 'left' | 'center'
  /** 進捗ラベルのカスタムフォーマット関数 */
  labelFormatter?: (progress: number, task: GanttTask) => string
  /** ドラッグ編集時の進捗率スナップ単位 (1, 5, 10 など。デフォルト: 1) */
  snapStep?: number
  /** 進捗インジケーターのスタイル ('full' | 'bottom' | 'top') (デフォルト: 'full') */
  indicatorPosition?: 'full' | 'bottom' | 'top'
}

/**
 * ミニマップ（Overview Minimap）に関するオプション
 */
export interface GanttChartOptionMinimap {
  /** ミニマップを表示するかどうか (デフォルト: false) */
  enabled?: boolean
  /** ミニマップの幅 (px)。デフォルト: 200 */
  width?: number
  /** ミニマップの高さ (px)。デフォルト: 120 */
  height?: number
  /** 縦横比維持時の最大高さ (px)。デフォルト: height または 120 */
  maxHeight?: number
  /** ガントチャートコンテンツの縦横比（アスペクト比）に合わせて描画するかどうか (デフォルト: true) */
  preserveAspectRatio?: boolean
  /** ユーザーによるドラッグリサイズ（サイズ変更）を許可するかどうか (デフォルト: true) */
  resizable?: boolean
  /** リサイズ時の最小幅 (px)。デフォルト: 120 */
  minWidth?: number
  /** リサイズ時の最大幅 (px)。デフォルト: 600 */
  maxWidth?: number
  /** リサイズ時の最小高さ (px)。デフォルト: 60 */
  minHeight?: number
  /** 折りたたみ（最小化）ボタンを表示するかどうか (デフォルト: true) */
  collapsible?: boolean
  /** 初期状態で折りたたまれているかどうか (デフォルト: false) */
  collapsed?: boolean
  /** マイルストーンを表示するかどうか (デフォルト: true) */
  showMilestones?: boolean
  /** 現在時刻線を表示するかどうか (デフォルト: true) */
  showCurrentTime?: boolean
  /** ミニマップの初期位置（親要素に対する右下基準の座標 px） */
  position?: MinimapPosition
  /** ミニマップの不透明度 (0.1 〜 1.0)。デフォルト: 1.0 */
  opacity?: number
}

/**
 * ミニマップの表示位置（親要素の右端・下端からのオフセット距離 px）
 */
export interface MinimapPosition {
  /** 親要素の右端からミニマップ右端までの距離 (px) */
  right: number
  /** 親要素の下端からミニマップ下端までの距離 (px) */
  bottom: number
}

/**
 * ミニマップの移動イベントの詳細データ
 */
export interface MinimapMoveEventDetail {
  /** 親要素の右端からミニマップ右端までの距離 (px) */
  right: number
  /** 親要素の下端からミニマップ下端までの距離 (px) */
  bottom: number
}

/**
 * ミニマップのリサイズイベントの詳細データ
 */
export interface MinimapResizeEventDetail {
  width: number
  height: number
  position?: MinimapPosition
}

/**
 * ミニマップの折りたたみ（最小化）イベントの詳細データ
 */
export interface MinimapCollapseEventDetail {
  /** 最小化されているかどうか */
  collapsed: boolean
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
  /** タスクバーの中心X座標（ドラッグ中のみ） */
  barX?: number
  /** タスクバーの上端Y座標（ドラッグ中のみ） */
  barTop?: number
  /** タスクバーの下端Y座標（ドラッグ中のみ） */
  barBottom?: number
  /** タスク移動モード(move/copy) */
  mode: GanttTaskMoveMode
  /** 複数選択移動時の対象タスクID配列 */
  selectedTaskIds?: string[]
  /** ガントチャート外にカーソルがあるかどうか */
  isOutside?: boolean
  /** ドラッグがキャンセルされたかどうか */
  isCancel?: boolean
}

/**
 * バーのホバーイベント詳細
 */
export interface BarHoverEventDetail {
  /** 対象のタスク */
  task: GanttTask
  /** マウスのX座標 */
  x: number
  /** マウスのY座標（バー上辺） */
  y: number
  /** バー下辺のY座標 */
  barBottom: number
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
  /** 移動元の行ID配列（複数選択時） */
  sourceIds?: string[]
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
  /** 月の区切りの縦罫線色 (オプション) */
  monthGridLine?: string
  /** 年の区切りの縦罫線色 (オプション) */
  yearGridLine?: string
  /** 時間単位モードの日付区切り縦罫線色 (オプション)。未指定時は monthGridLine → border にフォールバック */
  showTimeDateLine?: string
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
  /** クリティカルパスの色 (オプション) */
  criticalPath?: string
  /** ミニマップの背景色 (オプション) */
  minimapBg?: string
  /** ミニマップの枠線色 (オプション) */
  minimapBorder?: string
  /** ミニマップのビューポート枠背景色 (オプション) */
  minimapViewport?: string
  /** ミニマップのビューポート枠ボーダー色 (オプション) */
  minimapViewportBorder?: string
  /** ミニマップのタスク描画色 (オプション) */
  minimapTask?: string
  /** タスク進捗バーの描画色 (オプション) */
  taskProgress?: string
  /** タスク進捗変更ハンドルの描画色 (オプション) */
  taskProgressHandle?: string
}

/**
 * テーマセット (light/dark)
 */
export interface ThemeColors {
  light: ThemeColorPalette
  dark: ThemeColorPalette
}

/**
 * タスクの移動モード
 */
export type GanttTaskMoveMode = 'copy' | 'move'

/**
 * 依存関係の接続ポイント（バーのどちら側か）
 */
export type DependencyEndpoint = 'start' | 'end'

/**
 * 依存関係作成イベントの詳細データ
 */
export interface DependencyCreateEventDetail {
  /** 接続元のタスクID */
  sourceTaskId: string
  /** 接続元のエンドポイント（start=左端, end=右端） */
  sourceEndpoint: DependencyEndpoint
  /** 接続先のタスクID */
  targetTaskId: string
  /** 接続先のエンドポイント（start=左端, end=右端） */
  targetEndpoint: DependencyEndpoint
}

/**
 * 依存関係線クリックイベントの詳細データ
 */
export interface DependencyClickEventDetail {
  /** 接続元のタスクID */
  sourceTaskId: string
  /** 接続先のタスクID */
  targetTaskId: string
  /** 元のマウスイベント */
  event: MouseEvent
}

/**
 * マーカーダブルクリックイベントの詳細データ
 */
export interface MarkerDblClickEventDetail {
  /** 対象のマーカー */
  marker: GanttMarker
  /** マーカーが属する行ID */
  rowId: string
  /** 元のマウスイベント */
  event: MouseEvent
}

/**
 * マーカー右クリック（コンテキストメニュー）イベントの詳細データ
 */
export interface MarkerContextMenuEventDetail {
  /** 対象のマーカー */
  marker: GanttMarker
  /** マーカーが属する行ID */
  rowId: string
  /** 元のマウスイベント */
  event: MouseEvent
}

/**
 * タスク削除イベントの詳細データ
 */
export interface TaskDeleteEventDetail {
  /** 削除対象のタスクID配列 */
  taskIds: string[]
  /** 元のキーボードイベント */
  event: KeyboardEvent
}

/**
 * ズーム変更イベントの詳細データ
 */
export interface ZoomChangeEventDetail {
  /** ズーム後の pxPerDay */
  pxPerDay: number
  /** ズーム後の pxPerMonth（月単位モード時のみ） */
  pxPerMonth?: number
}

/**
 * タスク進捗変更イベントの詳細データ
 */
export interface TaskProgressChangeEventDetail {
  /** 対象のタスク */
  task: GanttTask
  /** 新しい進捗率 (0〜100) */
  progress: number
  /** 変更前の進捗率 */
  originalProgress?: number
  /** キャンセルされたかどうか */
  cancelled?: boolean
}

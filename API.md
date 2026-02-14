# MoguChart API Reference

MoguChart は、Lit で構築されたガントチャート Web Component です。

## コンポーネント

```html
<gantt-chart></gantt-chart>
```

## プロパティ (Properties)

コンポーネントに渡すことができるプロパティです。

| プロパティ名           | 型                  | 説明                                                                                                                                                                 |
| :--------------------- | :------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rows`                 | `GanttRow[]`        | ガントチャートに表示する行データの配列。各行にはタスクが含まれます。                                                                                                 |
| `option`               | `GanttChartOption`  | チャートの表示や動作を設定するオプションオブジェクト。                                                                                                               |
| `theme`                | `'light' \| 'dark'` | (属性) テーマを指定します。CSS変数によるスタイリングのベースとなります。`option.theme` が指定されている場合はそちらが優先されます。                                  |
| `selectedRowIds`       | `string[]`          | 選択状態にする行IDの配列。                                                                                                                                           |
| `selectedTaskIds`      | `string[]`          | 選択状態にするタスクIDの配列。                                                                                                                                       |
| `externalDraggingTask` | `GanttTask \| null` | コンポーネントの外部からタスクをドラッグしている場合に、そのタスク情報を渡します。これにより、チャート上にドラッグ中のタスクのプレビュー（ゴースト）を表示できます。 |

## オプション設定 (GanttChartOption)

`option` プロパティに渡すオブジェクトの構造です。

```typescript
interface GanttChartOption {
  /** バー（タスク）のスタイル設定 */
  bar?: {
    height?: number // バーの高さ (px)
    margin?: number // バーの上下マージン (px)
    cornerRadius?: number // バーの角丸 (px)
  }
  /** 行ヘッダーの設定 */
  rowHeader?: {
    width?: number // 行ヘッダーの幅 (px)
    backgroundColor?: string // 行ヘッダーの背景色
    resizable?: boolean // 幅のリサイズを有効にするか (デフォルト: true)
    minWidth?: number // リサイズ可能な最小幅 (デフォルト: 50)
    maxWidth?: number // リサイズ可能な最大幅 (デフォルト: 無制限)
  }
  /** カレンダー（タイムライン）の設定 */
  calendar: {
    start: Date // 表示開始日
    end: Date // 表示終了日
    pxPerDay: number // 1日あたりの幅 (px)
    monthFormat?: string // 月の表示フォーマット (例: 'YYYY年M月')
    showRowBackground?: boolean // 行の背景を表示するかどうか
    isHoliday?: (date: Date) => boolean // 祝日判定ロジック
    showTime?: boolean // 時間単位のグリッドを表示するかどうか
    showMonths?: boolean // 年月を表示するかどうか
    showDays?: boolean // 日付を表示するかどうか
    showCurrentTime?: boolean // 現在時刻を示すラインを表示するか (デフォルト: false)
    showCurrentTimeBadge?: boolean // 現在時刻バッジを表示するかどうか
    currentTimeUpdateInterval?: number // 現在時刻ラインの更新間隔 (ミリ秒、デフォルト: 0 = 更新しない)
  }
  /** 読み取り専用モードかどうか */
  readOnly?: boolean
  /** ツールチップを表示するかどうか */
  showTooltip?: boolean // (デフォルト: true)
  /** ツールチップが表示されるまでの遅延時間 (ms) */
  tooltipDelay?: number // (デフォルト: 0)
  /** ドラッグ中に情報オーバーレイを表示するかどうか */
  showDragInfoOverlay?: boolean // (デフォルト: true)
  /** テーマ設定 ('light', 'dark', 'system') */
  theme?: 'light' | 'dark' | 'system'
  /** カスタムテーマカラー（特定の色を上書きする場合に使用） */
  customTheme?: Partial<ThemeColorPalette>
  /** 行のドラッグ＆ドロップによる並び替えを有効にするか */
  enableRowReordering?: boolean // (デフォルト: false)
  /** タスクドラッグ時のスナップ間隔（分単位）。例えば60を指定すると1時間単位でスナップします。 */
  snapDuration?: number // (デフォルト: 1440 = 1日)
  /** 非表示に設定された行（visible: false）を表示するかどうか */
  showHiddenRows?: boolean // (デフォルト: false)
  customRendering?: {
    /** バーのコンテンツをレンダリングする関数。文字列または Lit の TemplateResult を返すことができます。 */
    barContent?: (task: GanttTask) => string | unknown
    /** 行ヘッダーのコンテンツをレンダリングする関数。文字列または Lit の TemplateResult を返すことができます。 */
    rowHeaderContent?: (row: GanttRow) => string | unknown
  }
}
```

## イベント (Events)

コンポーネントから発火されるカスタムイベントです。

| イベント名               | 詳細 (e.detail)                   | 説明                                                                                         |
| :----------------------- | :-------------------------------- | :------------------------------------------------------------------------------------------- |
| `rows-change`            | `GanttRow[]`                      | 行の並び替えやタスクの移動などにより、行データが変更されたときに発火します。                 |
| `row-reordered`          | `RowReorderEventDetail`           | 行がドラッグ＆ドロップによって並び替えられたときに発火します。                               |
| `row-selection-change`   | `RowSelectionChangeEventDetail`   | 行のチェックボックス（またはヘッダークリック）で行選択が変更されたときに発火します。         |
| `bar-selection-change`   | `BarSelectionChangeEventDetail`   | タスクバーの選択が変更されたときに発火します。                                               |
| `row-clicked`            | `RowClickedEventDetail`           | 行ヘッダーがクリックされたときに発火します。                                                 |
| `task-update`            | `TaskUpdateEventDetail`           | タスクがドラッグ＆ドロップやリサイズで更新されたときに発火します。                           |
| `task-drop`              | `TaskDropEventDetail`             | 外部から要素がドロップされたときに発火します。新しいタスクの作成などに使用できます。         |
| `row-header-resize`      | `RowHeaderResizeEventDetail`      | 行ヘッダーの幅がリサイズされたときに発火します。                                             |
| `row-header-dblclick`    | `RowHeaderDblClickEventDetail`    | 行ヘッダーをダブルクリックしたときに発火します。                                             |
| `row-header-contextmenu` | `RowHeaderContextMenuEventDetail` | 行ヘッダーを右クリックしたときに発火します。カスタムコンテキストメニューの実装に使用します。 |

| `render-tooltip` | `RenderTooltipEventDetail` | ツールチップを描画するタイミングで発火します。ツールチップの内容をカスタマイズできます。 |
| `task-dblclick` | `TaskClickEventDetail` | タスクバーをダブルクリックしたときに発火します。 |
| `task-contextmenu` | `TaskContextMenuEventDetail` | タスクバーを右クリックしたときに発火します。カスタムコンテキストメニューの実装に使用します。 |
| `render-drag-info` | `RenderDragInfoEventDetail` | タスクドラッグ中の情報表示を描画するタイミングで発火します。 |
| `chart-contextmenu` | `ChartContextMenuEventDetail` | ガントチャートの背景（タスクが無い部分）を右クリックしたときに発火します。 |

## 型定義 (Types)

イベント詳細などで使用される主要な型定義です。

### GanttRow

```typescript
interface GanttRow {
  id: string // 行の一意なID
  name: string // 行ヘッダーに表示するラベル
  tasks: GanttTask[] // この行に含まれるタスクの配列
  visible?: boolean // 行を表示するかどうか (デフォルト: true)
}
```

### GanttTask

```typescript
interface GanttTask {
  id: string // タスクの一意なID
  name?: string // タスクの表示名
  start: Date // 開始日時
  end: Date // 終了日時
  style?: string // バーのカスタムスタイル (CSS文字列)
  labelStyle?: string // バーのラベルのカスタムスタイル (CSS文字列)
  pattern?: GanttTaskPattern // バーの塗りつぶしパターン
  dependencies?: string[] // 依存関係にあるタスクのID配列
  movable?: 'both' | 'x' | 'y' | 'none' // 移動許可設定 ('both': 縦横, 'x': 横のみ, 'y': 縦のみ, 'none': 不可)
  resizable?: boolean // リサイズ可否 (未指定時はmovable設定に準拠)
}
```

### GanttTaskPattern

```typescript
interface GanttTaskPattern {
  // パターンの種類
  // 指定可能な値: 'diagonal-stripe' | 'diagonal-stripe-thin' | 'diagonal-stripe-thick' | 'diagonal-stripe-reverse' | 'vertical-stripe' | 'horizontal-stripe' | 'checkerboard' | 'dots' | 'dots-dense' | 'triangle' | 'circle' | 'grid' | 'diagonal-grid'
  type: BarPattern
  color?: string // パターンの色
}
```

### RowReorderEventDetail

```typescript
interface RowReorderEventDetail {
  sourceId: string // 移動元の行ID
  targetId: string // ドロップ先の行ID
  position: 'top' | 'bottom' // ドロップ先に対する位置
  rows: GanttRow[] // 並び替え後の新しい行データの配列
}
```

### TaskUpdateEventDetail

```typescript
interface TaskUpdateEventDetail extends GanttTask {
  dx?: number // X方向の移動量 (px)
  dy: number // Y方向の移動量 (px)
  isDragging: boolean // ドラッグ操作中かどうか
  targetRowId?: string // 移動先の行ID（行をまたぐ移動の場合）
  x?: number // マウスのX座標（ドラッグ中のみ）
  y?: number // マウスのY座標（ドラッグ中のみ）
  mode: GanttTaskMoveMode // 移動モード ('move' | 'copy')
}
```

### TaskDropEventDetail

```typescript
interface TaskDropEventDetail {
  task: GanttTask // ドロップされたタスクの元データ
  dropDate: Date // ドロップされた位置に対応する日時
  targetRowId: string // ドロップ先の行ID
}
```

### RowHeaderResizeEventDetail

```typescript
interface RowHeaderResizeEventDetail {
  width: number // リサイズ後の新しい幅
}
```

### RenderTooltipEventDetail

```typescript
interface RenderTooltipEventDetail {
  container: HTMLElement // ツールチップを描画するコンテナ要素
  task: GanttTask // 対象のタスクデータ
  x: number // ツールチップ表示位置のX座標
  y: number // ツールチップ表示位置のY座標
}
```

### TaskClickEventDetail

```typescript
interface TaskClickEventDetail {
  task: GanttTask // クリックされたタスクデータ
  event: MouseEvent // 元のクリックイベント
}
```

### TaskContextMenuEventDetail

```typescript
interface TaskContextMenuEventDetail {
  task: GanttTask // 対象のタスクデータ
  event: MouseEvent // 元のコンテキストメニューイベント（座標取得などに使用）
}
```

### RenderDragInfoEventDetail

```typescript
interface RenderDragInfoEventDetail {
  container: HTMLElement // 情報を描画するコンテナ要素
  task: GanttTask // ドラッグ中のタスク
  newStart: Date // 現在のドラッグ位置における開始日
  newEnd: Date // 現在のドラッグ位置における終了日
  targetRow?: GanttRow // 現在ドロップ対象となっている行
}
```

### RowSelectionChangeEventDetail

```typescript
interface RowSelectionChangeEventDetail {
  selectedIds: string[] // 現在選択されている全ての行IDの配列
}
```

### BarSelectionChangeEventDetail

```typescript
interface BarSelectionChangeEventDetail {
  selectedIds: string[] // 現在選択されている全てのタスクIDの配列
}
```

### RowClickedEventDetail

```typescript
// row-clicked イベントの詳細（gantt-row から発火）
interface RowClickedEventDetail {
  rowId: string // クリックされた行ID
  event: MouseEvent // 元のクリックイベント
}
```

### RowHeaderDblClickEventDetail

```typescript
interface RowHeaderDblClickEventDetail {
  rowId: string // ダブルクリックされた行ID
  row: GanttRow // ダブルクリックされた行データ
  event: MouseEvent // 元のダブルクリックイベント
  target: HTMLElement // ダブルクリックされたヘッダー要素
}
```

### RowHeaderContextMenuEventDetail

```typescript
interface RowHeaderContextMenuEventDetail {
  rowId: string // 右クリックされた行ID
  row: GanttRow // 右クリックされた行データ
  event: MouseEvent // 元のコンテキストメニューイベント
  target: HTMLElement // 右クリックされたヘッダー要素
}
```

### ChartContextMenuEventDetail

```typescript
interface ChartContextMenuEventDetail {
  event: MouseEvent // 元のコンテキストメニューイベント
  date: Date // クリックされた位置に対応する日時
  rowId: string // クリックされた行ID
}
```

### ThemeColorPalette

テーマカラーをカスタマイズする際に使用するキー定義です。

```typescript
interface ThemeColorPalette {
  bg: string // 背景色
  text: string // テキスト色
  border: string // ボーダー色
  gridLine: string // グリッド線色
  subGridLine: string // サブグリッド線色
  dragTarget: string // ドラッグ対象の背景色
  tooltipBg: string // ツールチップの背景色
  tooltipText: string // ツールチップのテキスト色
  dragOverlayBg: string // ドラッグオーバーレイの背景色
  dragOverlayText: string // ドラッグオーバーレイのテキスト色
  dragOverlaySubText: string // ドラッグオーバーレイのサブテキスト色
  dragOverlayDivider: string // ドラッグオーバーレイの区切り線色
  dependencyLine: string // 依存関係線の色
  calendarBg: string // カレンダー領域の背景色
  saturday: string // 土曜日の背景色
  sunday: string // 日曜日の背景色
  holiday: string // 祝日の背景色
  rowHeaderBg: string // 行ヘッダーの背景色
  rowSelected: string // 選択された行の背景色
  rowSelectedHeader: string // 選択された行のヘッダーの背景色
  rowHiddenBg: string // 非表示設定されている行の背景色
  currentTimeLine: string // 現在時刻線の色
  currentTimeLineText: string // 現在時刻線のバッジテキスト色
  monday?: string // 月曜日の背景色 (オプション)
  tuesday?: string // 火曜日の背景色 (オプション)
  wednesday?: string // 水曜日の背景色 (オプション)
  thursday?: string // 木曜日の背景色 (オプション)
  friday?: string // 金曜日の背景色 (オプション)
}
```

### GanttTaskMoveMode

```typescript
type GanttTaskMoveMode = 'copy' | 'move'
```

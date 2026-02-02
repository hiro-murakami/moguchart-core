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
| `selectedRowIds`       | `string[]`          | 選択状態にする行IDの配列。                                                                                                                                                 |
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
    resizable?: boolean // 幅のリサイズを有効にするか (デフォルト: true)
    minWidth?: number // リサイズ可能な最小幅 (デフォルト: 50)
    maxWidth?: number // リサイズ可能な最大幅 (デフォルト: 無制限)
  }
  /** カレンダー（タイムライン）の設定 */
  calendar: {
    start: Date // 表示開始日
    end: Date // 表示終了日
    pxPerDay: number // 1日あたりの幅 (px)
    isHoliday?: (date: Date) => boolean // 祝日判定ロジック
    showCurrentTime?: boolean // 現在時刻を示すラインを表示するか (デフォルト: false)
    currentTimeUpdateInterval?: number // 現在時刻ラインの更新間隔 (ミリ秒、デフォルト: 1分)
  }
  /** 読み取り専用モードかどうか */
  readOnly?: boolean
  /** ツールチップを表示するかどうか */
  showTooltip?: boolean // (デフォルト: true)
  /** ツールチップが表示されるまでの遅延時間 (ms) */
  tooltipDelay?: number // (デフォルト: 0)
  /** ドラッグ中に情報オーバーレイを表示するかどうか */
  showDragInfoOverlay?: boolean // (デフォルト: true)
  /** テーマ設定 ('light' または 'dark') */
  theme?: 'light' | 'dark'
  /** カスタムテーマカラー（特定の色を上書きする場合に使用） */
  customTheme?: Partial<ThemeColorPalette>
  /** 行のドラッグ＆ドロップによる並び替えを有効にするか */
  enableRowReordering?: boolean // (デフォルト: false)
  /** タスクドラッグ時のスナップ間隔（分単位）。例えば60を指定すると1時間単位でスナップします。 */
  snapDuration?: number // (デフォルト: 1440 = 1日)
  /** 行選択モードを有効にするか。有効にすると行ヘッダーにチェックボックスが表示されます。 */
  rowSelectionMode?: boolean // (デフォルト: false)
}
```

## イベント (Events)

コンポーネントから発火されるカスタムイベントです。

| イベント名           | 詳細 (e.detail)               | 説明                                                                                         |
| :------------------- | :---------------------------- | :------------------------------------------------------------------------------------------- |
| `rows-change`        | `GanttRow[]`                  | 行の並び替えやタスクの移動などにより、行データが変更されたときに発火します。                 |
| `row-reordered`      | `RowReorderEventDetail`       | 行がドラッグ＆ドロップによって並び替えられたときに発火します。                               |
| `row-selection-change` | `RowSelectionChangeEventDetail` | 行のチェックボックスが操作された（チェック/非チェック）ときに発火します。                  |
| `task-update`        | `TaskUpdateEventDetail`       | タスクがドラッグ＆ドロップやリサイズで更新されたときに発火します。                           |
| `task-drop`          | `TaskDropEventDetail`         | 外部から要素がドロップされたときに発火します。新しいタスクの作成などに使用できます。         |
| `row-header-resize`  | `RowHeaderResizeEventDetail`  | 行ヘッダーの幅がリサイズされたときに発火します。                                             |
| `render-bar-content` | `RenderBarContentEventDetail` | タスクバーの中身を描画するタイミングで発火します。バー内のコンテンツをカスタマイズできます。 |
| `render-row-header`  | `RenderRowHeaderEventDetail`  | 行ヘッダーを描画するタイミングで発火します。ヘッダーの内容をカスタマイズできます。           |
| `render-tooltip`     | `RenderTooltipEventDetail`    | ツールチップを描画するタイミングで発火します。ツールチップの内容をカスタマイズできます。     |
| `task-dblclick`      | `TaskClickEventDetail`        | タスクバーをダブルクリックしたときに発火します。                                             |
| `task-contextmenu`   | `TaskContextMenuEventDetail`  | タスクバーを右クリックしたときに発火します。カスタムコンテキストメニューの実装に使用します。 |
| `render-drag-info`   | `RenderDragInfoEventDetail`   | タスクドラッグ中の情報表示を描画するタイミングで発火します。                                 |

## 型定義 (Types)

イベント詳細などで使用される主要な型定義です。

### GanttRow

```typescript
interface GanttRow {
  id: string // 行の一意なID
  name: string // 行ヘッダーに表示するラベル
  tasks: GanttTask[] // この行に含まれるタスクの配列
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
  // 指定可能な値: 'diagonal-stripe' | 'diagonal-stripe-reverse' | 'vertical-stripe' | 'horizontal-stripe' | 'checkerboard' | 'dots' | 'triangle' | 'circle' | 'grid' | 'diagonal-grid'
  type: BarPattern
  color?: string // パターンの色
  size?: string // パターンのサイズ
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
interface TaskUpdateEventDetail {
  id: string // 更新されたタスクのID
  name: string // タスク名
  start: Date // 新しい開始日
  end: Date // 新しい終了日
  targetRowId: string | undefined // 移動先の行ID（行をまたぐ移動の場合）
  isDragging: boolean // ドラッグ操作中かどうか
  // dx, dy, modeなどの内部的なプロパティも含まれます
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

### RenderBarContentEventDetail

```typescript
interface RenderBarContentEventDetail {
  container: HTMLElement // コンテンツを描画するコンテナ要素
  task: GanttTask // 対象のタスクデータ
  width: number // バーの幅
  height: number // バーの高さ
}
```

### RenderRowHeaderEventDetail

```typescript
interface RenderRowHeaderEventDetail {
  container: HTMLElement // ヘッダーを描画するコンテナ要素
  row: GanttRow // 対象の行データ
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
  task: { id: string; name?: string; start: Date; end: Date } // ドラッグ中のタスク
  newStart: Date // 現在のドラッグ位置における開始日
  newEnd: Date // 現在のドラッグ位置における終了日
  targetRow: GanttRow | undefined // 現在ドロップ対象となっている行
}
```

### RowSelectionChangeEventDetail

```typescript
interface RowSelectionChangeEventDetail {
  selectedIds: string[] // 現在選択されている全ての行IDの配列
  target: {
    id: string // 今回操作された行のID
    checked: boolean // 今回操作された行の新しいチェック状態
  }
}
```

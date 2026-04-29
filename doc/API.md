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
    pxPerMonth?: number // 1ヶ月あたりの幅 (px)。指定した場合、月単位の等幅表示になる
    monthFormat?: string // 月の表示フォーマット (例: 'YYYY年M月')
    showRowBackground?: boolean // 行の背景を表示するかどうか
    isHoliday?: (date: Date) => boolean // 祝日判定ロジック
    showTime?: boolean // 時間単位のグリッドを表示するかどうか
    showMonths?: boolean // 年月を表示するかどうか
    showDays?: boolean // 日付を表示するかどうか
    showCurrentTime?: boolean // 現在時刻を示すラインを表示するか (デフォルト: false)
    showCurrentTimeBadge?: boolean // 現在時刻バッジを表示するかどうか
    currentTimeUpdateInterval?: number // 現在時刻ラインの更新間隔 (ミリ秒、デフォルト: 0 = 更新しない)
    showWeeks?: boolean // 週番号ヘッダーを表示するかどうか
    weekStartDay?: 0 | 1 | 2 | 3 | 4 | 5 | 6 // 週の始まりの曜日 (0=日曜〜6=土曜、デフォルト: 1=月曜)
    weekFormat?: (weekNumber: number, startDate: Date) => string // 週番号の表示フォーマット関数
    weekTextAlign?: 'left' | 'center' | 'right' // 週番号セルのテキスト配置 (デフォルト: 'center')
    showMonthsRow?: boolean // 月単位表示（上段=年、下段=月）を有効にするかどうか
    monthTextAlign?: 'left' | 'center' | 'right' // 月セルのテキスト配置 (デフォルト: 'center')
    milestones?: GanttChartMilestone[] // マイルストーンの配列
    showCursorLine?: boolean // マウスカーソル位置に追従する縦罫線を表示するか (デフォルト: false)
    cursorLineColor?: string // カーソル縦罫線の色 (CSS color string。省略時は currentTimeLine と同色)
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
  /** ロケール設定 (デフォルト: 日本語) */
  locale?: MoguchartLocale
  customRendering?: {
    /** バーのコンテンツをレンダリングする関数。文字列または Lit の TemplateResult を返すことができます。 */
    barContent?: (task: GanttTask) => string | unknown
    /** 行ヘッダーのコンテンツをレンダリングする関数。文字列または Lit の TemplateResult を返すことができます。 */
    rowHeaderContent?: (row: GanttRow) => string | unknown
    /** ツールチップのコンテンツをレンダリングする関数。文字列または Lit の TemplateResult を返すことができます。 */
    tooltip?: (task: GanttTask) => string | unknown
    /** ドラッグ中の情報オーバーレイのコンテンツをレンダリングする関数。文字列または Lit の TemplateResult を返すことができます。 */
    dragInfo?: (task: GanttTask, newStart: Date, newEnd: Date, targetRow?: GanttRow) => string | unknown
  }
  /** 依存関係線の設定 */
  dependency?: GanttChartOptionDependency
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
| `row-header-click`       | `RowHeaderClickEventDetail`       | 行ヘッダーをクリックしたときに発火します。                                                   |
| `row-header-dblclick`    | `RowHeaderDblClickEventDetail`    | 行ヘッダーをダブルクリックしたときに発火します。                                             |
| `row-header-contextmenu` | `RowHeaderContextMenuEventDetail` | 行ヘッダーを右クリックしたときに発火します。カスタムコンテキストメニューの実装に使用します。 |
| `task-dblclick`          | `TaskClickEventDetail`            | タスクバーをダブルクリックしたときに発火します。                                             |
| `task-contextmenu`       | `TaskContextMenuEventDetail`      | タスクバーを右クリックしたときに発火します。カスタムコンテキストメニューの実装に使用します。 |
| `chart-contextmenu`      | `ChartContextMenuEventDetail`     | ガントチャートの背景（タスクが無い部分）を右クリックしたときに発火します。                   |
| `dependency-create`      | `DependencyCreateEventDetail`     | タスクバーのコネクターからドラッグ＆ドロップで依存関係が作成されたときに発火します。         |
| `dependency-click`       | `DependencyClickEventDetail`      | 依存関係線をクリックしたときに発火します。                                                   |

## メソッド (Methods)

コンポーネントのインスタンスに対して呼び出すことができるパブリックメソッドです。

| メソッド名    | シグネチャ                                                              | 説明                                                                                                                                                                           |
| :------------ | :---------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `selectTask`  | `(taskId: string) => boolean`                                           | 指定したIDのタスクを選択状態にします。タスクが画面外にある場合は自動的にスクロールして表示します。タスクが見つかった場合は `true`、見つからなかった場合は `false` を返します。 |
| `hitTest`     | `(clientX: number, clientY: number) => { rowId: string; date: Date } \| null` | クライアント座標（画面上のピクセル位置）から、対応するガントチャートの行IDと日付を返します。座標がチャート領域外の場合は `null` を返します。 |
| `exportImage` | `(format: 'svg' \| 'png', options?: ExportImageOptions) => Promise<string>` | ガントチャート全体を画像データとしてエクスポートします。戻り値はデータURLです。`options.download: true` を指定すると自動的にファイルダウンロードを開始します。 |

### 使用例

#### selectTask

```javascript
const chart = document.querySelector('gantt-chart')

// タスクを選択して表示位置までスクロール
const success = chart.selectTask('task-1')

if (!success) {
  console.warn('指定したタスクが見つかりません')
}
```

> **Note:** `selectTask` を呼び出すと、`bar-selection-change` イベントも発火されます。

#### hitTest

```javascript
const chart = document.querySelector('gantt-chart')

// マウス座標からガントチャート上の行と日付を取得
document.addEventListener('mousemove', (e) => {
  const result = chart.hitTest(e.clientX, e.clientY)
  if (result) {
    console.log(`行: ${result.rowId}, 日付: ${result.date}`)
  }
})
```

> **Note:** `hitTest` はスクロール位置やカレンダー設定を考慮して正確な日付を計算します。キーボードショートカットによるペースト操作など、マウス位置に基づく操作の実装に便利です。

#### exportImage

```javascript
const chart = document.querySelector('gantt-chart')

// SVG形式でデータURLを取得
const svgDataUrl = await chart.exportImage('svg')

// PNG形式でダウンロード（高解像度 x2）
await chart.exportImage('png', {
  filename: 'my-gantt',  // 省略時: 'gantt-chart'
  download: true,        // trueでファイルダウンロード開始
  scale: 2,              // PNG出力倍率（デフォルト: 2）
})

// SVGをimgタグに埋め込む
const img = document.createElement('img')
img.src = await chart.exportImage('svg')
document.body.appendChild(img)
```

**ExportImageOptions**

```typescript
interface ExportImageOptions {
  /** ダウンロード時のファイル名（拡張子なし）。省略時は 'gantt-chart' */
  filename?: string
  /** trueの場合、自動的にファイルダウンロードを開始する。デフォルト: false */
  download?: boolean
  /** PNG出力時のスケール倍率（高解像度化）。デフォルト: 2 */
  scale?: number
}
```

> **Note:** `exportImage` はスクロール位置によらずチャート全体（スクロール領域すべて）をエクスポートします。Shadow DOM のスタイルも自動的に収集されます。ただし、外部フォントや画像がクロスオリジンの場合は正しく描画されないことがあります。

## 型定義 (Types)

イベント詳細などで使用される主要な型定義です。

### GanttRow

```typescript
interface GanttRow {
  id: string // 行の一意なID
  name: string // 行ヘッダーに表示するラベル
  tasks: GanttTask[] // この行に含まれるタスクの配列
  markers?: GanttMarker[] // この行に表示するマーカーの配列
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

### GanttChartMilestone

```typescript
interface GanttChartMilestone {
  id: string // マイルストーンの一意なID
  name: string // マイルストーンの表示名
  start: Date // マイルストーンの日時
  color: string // マイルストーンの色 (CSS color string)
  width?: number // 線の幅 (px、デフォルト: 2)
  style?: string // カスタムスタイル (CSS文字列)
}
```

### MarkerType

```typescript
type MarkerType = 'triangle-up' | 'triangle-down' | 'triangle-left' | 'triangle-right' | 'diamond' | 'square'
```

### AnchorType

```typescript
type AnchorType = 'start' | 'end' | 'center'
```

### GanttMarker

```typescript
interface GanttMarker {
  id: string // マーカーの一意なID
  name?: string // マーカーの表示名（アイコンの隣またはアイコン下部にテキスト表示）
  date: Date // マーカーの日時
  anchor?: AnchorType // アンカー位置 ('start': dateがマーカー左端, 'end': dateがマーカー右端, 'center': dateがマーカー中央＋ラベル下部表示, 未指定: 中央)
  type: MarkerType // マーカーの形状
  color?: string // マーカーの色 (CSS color string)
  style?: string // マーカーのカスタムスタイル (CSS文字列)
}
```

### RowReorderEventDetail

```typescript
interface RowReorderEventDetail {
  sourceId: string // 移動元の行ID（単一選択時）
  sourceIds?: string[] // 移動元の行ID配列（複数選択時）
  targetId: string // ドロップ先の行ID
  position?: 'top' | 'bottom' // ドロップ先に対する位置
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
  selectedTaskIds?: string[] // 複数選択移動時の対象タスクID配列
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

### RowHeaderClickEventDetail

```typescript
interface RowHeaderClickEventDetail {
  rowId: string // クリックされた行ID
  row: GanttRow // クリックされた行データ
  event: MouseEvent // 元のクリックイベント
  target: HTMLElement // クリックされたヘッダー要素
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

### DependencyEndpoint

```typescript
type DependencyEndpoint = 'start' | 'end'
```

### GanttChartOptionDependency

```typescript
interface GanttChartOptionDependency {
  /** 矢印を表示するかどうか (デフォルト: true) */
  showArrows?: boolean
  /** 矢印の大きさ (px)。デフォルト: 8 */
  arrowSize?: number
}
```

> **Note:** 右→左方向の依存関係では、自動的にS字カーブが適用され、タスクバーとの接触箇所は常に水平に接続されます。

### DependencyCreateEventDetail

```typescript
interface DependencyCreateEventDetail {
  sourceTaskId: string       // 接続元のタスクID
  sourceEndpoint: DependencyEndpoint  // 接続元のエンドポイント（start=左端, end=右端）
  targetTaskId: string       // 接続先のタスクID
  targetEndpoint: DependencyEndpoint  // 接続先のエンドポイント（start=左端, end=右端）
}
```

### DependencyClickEventDetail

```typescript
interface DependencyClickEventDetail {
  sourceTaskId: string  // 接続元（依存元）のタスクID
  targetTaskId: string  // 接続先（依存を持つ側）のタスクID
  event: MouseEvent     // 元のマウスイベント
}
```

### MoguchartLocale

ツールチップ・ドラッグオーバーレイの表示文字列や日付フォーマットをカスタマイズできます。`jaLocale`（日本語）と `enLocale`（英語）があらかじめ用意されています。

```typescript
interface MoguchartLocale {
  monthFormat: string // デフォルトの月表示フォーマット (dayjs互換)
  monthRowFormat: string // 月単位モードの月表示フォーマット (例: 'M月' / 'MMM')
  dateFormat: (date: Date) => string // 日付のフォーマット関数
  dateTimeFormat: (date: Date) => string // 日時のフォーマット関数
  duration: {
    days: (n: number) => string // 日数のフォーマット
    hours: (n: number) => string // 時間のフォーマット
    minutes: (n: number) => string // 分のフォーマット
    zero: string // 期間がゼロの場合の表示
  }
  tooltip: {
    duration: (days: number) => string // 所要日数の表示
  }
  dragOverlay: {
    noTitle: string // タイトル未設定時のフォールバック
    moveTo: (name: string) => string // 移動先の表示
    movingTasks: (count: number) => string // 複数タスク移動中の表示
  }
}
```

#### 使用例

```javascript
import { enLocale } from '@mogura/moguchart'

const option = {
  locale: enLocale,
  // ...
}
```

カスタムロケールを作成する場合:

```javascript
const myLocale = {
  monthFormat: 'YYYY/MM',
  monthRowFormat: 'MM月',
  dateFormat: (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`,
  dateTimeFormat: (d) => {
    const h = d.getHours(), m = d.getMinutes()
    const date = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
    return h === 0 && m === 0 ? date : `${date} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  },
  duration: {
    days: (n) => `${n}日`,
    hours: (n) => `${n}時間`,
    minutes: (n) => `${n}分`,
    zero: '0分',
  },
  tooltip: { duration: (days) => `所要: ${days}日` },
  dragOverlay: {
    noTitle: 'タイトルなし',
    moveTo: (name) => `→ ${name}`,
    movingTasks: (count) => `${count}件移動中`,
  },
}
```

## 複数タスクの選択とドラッグ

`Ctrl`（Mac: `Cmd`）キーを押しながらタスクバーをクリックすることで、複数のタスクを選択できます。選択状態は `bar-selection-change` イベントで通知されます。

### 複数選択時のドラッグ動作

複数のタスクバーが選択された状態で、いずれか1つのバーをドラッグすると、選択された全バーが連動して移動します。

- **水平方向のみ移動**: 複数選択時のドラッグは水平方向（日付方向）のみに制限されます。行間の移動（縦方向）はできません。
- **ゴースト表示**: ドラッグ中、直接ドラッグしているバー以外の選択されたバーは半透明のゴーストとして表示され、同じ水平移動量で連動して動きます。
- **`task-update` イベント**: ドロップ時に発火する `task-update` イベントの `selectedTaskIds` フィールドに、選択中の全タスクIDが含まれます。利用側はこのIDリストを参照して、全選択タスクに同じ `dx` を適用してください。

### 使用例

```javascript
const chart = document.querySelector('gantt-chart')

chart.addEventListener('task-update', (e) => {
  const detail = e.detail

  if (!detail.isDragging && detail.selectedTaskIds?.length > 1) {
    // 複数選択ドラッグのドロップ: 全選択タスクに同じdxを適用
    for (const taskId of detail.selectedTaskIds) {
      applyDxToTask(taskId, detail.dx)
    }
  }
})
```

## マイルストーン

`calendar.milestones` にマイルストーンの配列を渡すことで、チャート上に縦線とバッジを表示できます。

- 縦線はチャート本体に、名前バッジはカレンダーの年月行に表示されます。
- 通常時は半透明（opacity: 0.5）で表示され、バッジまたは線にマウスオーバーすると不透明になります。
- バッジと線のホバーエフェクトは連動します。

### 使用例

```javascript
const chart = document.querySelector('gantt-chart')

chart.option = {
  calendar: {
    start: new Date('2025-04-01'),
    end: new Date('2025-06-30'),
    pxPerDay: 30,
    milestones: [
      {
        id: 'ms-1',
        name: 'α版リリース',
        start: new Date('2025-04-08'),
        color: '#8b5cf6',
        width: 4, // 太い線
      },
      {
        id: 'ms-2',
        name: '正式リリース',
        start: new Date('2025-05-01'),
        color: '#10b981',
      },
    ],
  },
}
```

## マーカー

各行の `markers` にマーカーの配列を渡すことで、行のタイムライン上にアイコンとラベルを表示できます。

- マーカーは6種類の形状から選択できます: 三角形（上・下・左・右）、ひし形（`diamond`）、正方形（`square`）。
- `anchor` でマーカーの基準位置を制御できます。
  - `'start'`: dateがマーカー左端。ラベルはアイコンの右側に表示。
  - `'end'`: dateがマーカー右端。ラベルはアイコンの左側に表示。
  - `'center'`: dateがマーカー中央。ラベルはアイコンの下部に中央揃えで表示。マーカーの下端が行の垂直中心に配置されます。
  - 未指定: dateがマーカー中央。ラベルはアイコンの右側に表示。
- `name` を設定するとテキストラベルが表示されます。

### 使用例

```javascript
const rows = [
  {
    id: 'row-1',
    name: 'プロジェクトA',
    tasks: [/* ... */],
    markers: [
      {
        id: 'marker-1',
        name: 'レビュー期限',
        date: new Date('2025-04-10'),
        anchor: 'end',
        type: 'triangle-right',
        color: '#ef4444',
      },
      {
        id: 'marker-2',
        name: 'リリース予定',
        date: new Date('2025-04-20'),
        anchor: 'start',
        type: 'triangle-left',
        color: '#3b82f6',
      },
      {
        id: 'marker-3',
        name: '★',
        date: new Date('2025-04-15'),
        anchor: 'center',
        type: 'triangle-down',
        color: '#ef4444',
      },
    ],
  },
]
```

## 表示モード

### 週表示モード

`calendar.showWeeks: true` を設定すると、上段に年月、下段に週番号を表示する2段カレンダーになります。`pxPerDay` が20未満の場合は自動的に有効化されます。

```javascript
const option = {
  calendar: {
    start: new Date('2025-01-01'),
    end: new Date('2025-12-31'),
    pxPerDay: 15,
    showWeeks: true,
    weekStartDay: 1, // 月曜始まり (デフォルト)
    weekFormat: (weekNum, startDate) => `W${weekNum}`, // カスタムフォーマット
    weekTextAlign: 'center',
  },
}
```

### 月表示モード

`calendar.pxPerMonth` を設定すると、各月が等幅で表示される月単位ビューになります。`snapDuration` は自動的に月単位のスナップに切り替わります。

```javascript
const option = {
  calendar: {
    start: new Date('2025-01-01'),
    end: new Date('2027-12-31'),
    pxPerDay: 1, // pxPerMonth 利用時は参照されません
    pxPerMonth: 120, // 1ヶ月あたり120px
    showMonthsRow: true, // 上段=年、下段=月の2段ヘッダー
    monthTextAlign: 'left',
  },
  snapDuration: 0, // 月単位スナップ (pxPerMonth 指定時は無視されスナップは月単位になる)
}
```

## カーソル追従縦罫線

`calendar.showCursorLine: true` を設定すると、ガントチャート上にマウスカーソルが入った際、そのX座標に追従する縦罫線がリアルタイムで表示されます。

- チャート上にマウスが乗っている間のみ表示され、チャート外に出ると非表示になります。
- 行ヘッダー領域（行名が表示される左端の固定列）では非表示になります。
- 線の色は `cursorLineColor` で指定できます。省略した場合は `customTheme.currentTimeLine` と同じ色が使われます。

```javascript
const option = {
  calendar: {
    start: new Date('2025-01-01'),
    end: new Date('2025-12-31'),
    pxPerDay: 48,
    showCursorLine: true,
    cursorLineColor: 'rgba(99, 179, 237, 0.7)', // 省略可
  },
}
```

## 依存関係のドラッグ＆ドロップ作成

タスクバーにマウスをホバーすると、バーの左右の端にコネクターポイント（青い丸）が表示されます。このコネクターポイントからドラッグを開始し、別のタスクバー（またはその端）にドロップすることで、タスク間の依存関係を作成できます。

- ドラッグ中はベジェ曲線のプレビュー線が表示されます
- ターゲットタスクの近くに来ると、コネクターポイントに自動でスナップします
- ターゲットタスクは青いアウトラインでハイライトされます
- ドロップ成功時に `dependency-create` イベントが発火します
- `readOnly` モードではコネクターポイントは表示されません

### 使用例

```javascript
const chart = document.querySelector('gantt-chart')

chart.addEventListener('dependency-create', (e) => {
  const { sourceTaskId, targetTaskId, sourceEndpoint, targetEndpoint } = e.detail
  console.log(`${sourceTaskId} (${sourceEndpoint}) -> ${targetTaskId} (${targetEndpoint})`)

  // rows のデータを更新して依存関係を追加
  rows = rows.map((row) => ({
    ...row,
    tasks: row.tasks.map((task) => {
      if (task.id === targetTaskId) {
        const deps = task.dependencies ?? []
        if (!deps.includes(sourceTaskId)) {
          return { ...task, dependencies: [...deps, sourceTaskId] }
        }
      }
      return task
    }),
  }))
  chart.rows = rows
})
```

## 依存関係線のクリック

表示されている依存関係線（矢印付きベジェ曲線）をクリックすると `dependency-click` イベントが発火します。削除やその他の操作はイベントハンドラ側で実装してください。

- 依存関係線にマウスをホバーすると、線が太くなり光彩効果でハイライトされます
- クリックすると `dependency-click` イベントが発火します
- `readOnly` モードではクリックできません

### 使用例

```javascript
const chart = document.querySelector('gantt-chart')

chart.addEventListener('dependency-click', (e) => {
  const { sourceTaskId, targetTaskId } = e.detail
  console.log(`Dependency clicked: ${sourceTaskId} -> ${targetTaskId}`)

  // 例: 確認ダイアログを表示してから削除
  if (confirm('この依存関係を削除しますか？')) {
    rows = rows.map((row) => ({
      ...row,
      tasks: row.tasks.map((task) => {
        if (task.id === targetTaskId && task.dependencies) {
          const newDeps = task.dependencies.filter((d) => d !== sourceTaskId)
          return { ...task, dependencies: newDeps.length > 0 ? newDeps : undefined }
        }
        return task
      }),
    }))
    chart.rows = rows
  }
})
```

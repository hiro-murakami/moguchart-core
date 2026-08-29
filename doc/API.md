# moguchart-core API Reference

moguchart-core は、Lit で構築されたガントチャート Web Component です。

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
  tooltipDelay?: number // (デフォルト: 500)
  /** ドラッグ中に情報オーバーレイを表示するかどうか */
  showDragInfoOverlay?: boolean // (デフォルト: true)
  /** テーマ設定 ('light', 'dark', 'system') */
  theme?: 'light' | 'dark' | 'system'
  /** カスタムテーマカラー（特定の色を上書きする場合に使用） */
  customTheme?: Partial<ThemeColorPalette>
  /** 行のドラッグ＆ドロップによる並び替えを有効にするか */
  enableRowReordering?: boolean // (デフォルト: false)
  /** タスクの行間移動を有効にするかどうか (デフォルト: true) */
  enableCrossRowMove?: boolean // (デフォルト: true)
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
    /** 行ヘッダーの左上コーナーセルのコンテンツをレンダリングする関数。文字列または Lit の TemplateResult を返すことができます。 */
    cornerContent?: () => string | unknown
    /** カレンダーの月セルをレンダリングする関数。HTMLElement または HTML文字列を返します。 */
    calendarMonthContent?: (context: CalendarMonthCellContext) => string | unknown
    /** カレンダーの日セルをレンダリングする関数。HTMLElement または HTML文字列を返します。 */
    calendarDayContent?: (context: CalendarDayCellContext) => string | unknown
    /** カレンダーの週セルをレンダリングする関数。HTMLElement または HTML文字列を返します。 */
    calendarWeekContent?: (context: CalendarWeekCellContext) => string | unknown
    /** カレンダーの時間セルをレンダリングする関数。HTMLElement または HTML文字列を返します。 */
    calendarHourContent?: (context: CalendarHourCellContext) => string | unknown
    /** ガントチャート部の背景セルをレンダリングする関数。各日のセルごとに呼ばれ、HTML文字列またはTemplateResultを返します。 */
    chartBackground?: (context: ChartBackgroundCellContext) => string | unknown
    /** 行ヘッダーのツールチップコンテンツをレンダリングする関数。マウスホバー時に呼ばれ、文字列・HTMLElement・TemplateResult を返すことができます。 */
    rowHeaderTooltip?: (row: GanttRow) => string | HTMLElement | unknown
  }
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
  minimap?: {
    enabled?: boolean // ミニマップを表示するかどうか (デフォルト: false)
    width?: number // ミニマップの幅 (px、デフォルト: 200)
    height?: number // ミニマップの高さ (px、デフォルト: 120)
    maxHeight?: number // 縦横比維持時の最大高さ (px、デフォルト: height または 120)
    preserveAspectRatio?: boolean // ガントチャートコンテンツの縦横比（アスペクト比）に合わせて描画するかどうか (デフォルト: true)
    resizable?: boolean // ユーザーによるドラッグリサイズを許可するかどうか (デフォルト: true)
    minWidth?: number // リサイズ時の最小幅 (px、デフォルト: 120)
    maxWidth?: number // リサイズ時の最大幅 (px、デフォルト: 600)
    minHeight?: number // リサイズ時の最小高さ (px、デフォルト: 60)
    collapsible?: boolean // 折りたたみ（最小化）ボタンを表示するかどうか (デフォルト: true)
    collapsed?: boolean // 初期状態で折りたたまれているかどうか (デフォルト: false)
    showMilestones?: boolean // マイルストーンを表示するかどうか (デフォルト: true)
    showCurrentTime?: boolean // 現在時刻線を表示するかどうか (デフォルト: true)
    position?: MinimapPosition // ミニマップの初期位置（親要素に対する右下基準の座標 px）
    opacity?: number // ミニマップの不透明度 (0.1 〜 1.0、デフォルト: 1.0)
  }
  /** 進捗管理機能の設定 */
  progress?: {
    enabled?: boolean // 進捗表示を有効にするかどうか (デフォルト: true)
    editable?: boolean // 進捗バーをドラッグして進捗率を変更可能にするか (デフォルト: false)
    color?: string // 進捗バーのデフォルト色 (CSSカラー文字列)
    showLabel?: boolean // 進捗ラベル (例: '50%') を表示するかどうか (デフォルト: false)
    labelPosition?: 'inside' | 'right' | 'left' | 'center' // 進捗ラベルの表示位置 (デフォルト: 'inside')
    labelFormatter?: (progress: number, task: GanttTask) => string // 進捗ラベルのカスタムフォーマット関数
    snapStep?: number // ドラッグ編集時の進捗率スナップ単位 (デフォルト: 1)
    indicatorPosition?: 'full' | 'bottom' | 'top' // 進捗インジケーターのスタイル (デフォルト: 'full')
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
| `bar-hover`              | `BarHoverEventDetail`             | タスクバーにマウスがホバーしたときに発火します。                                             |
| `row-clicked`            | `RowClickedEventDetail`           | 行ヘッダーがクリックされたときに発火します。                                                 |
| `task-update`            | `TaskUpdateEventDetail`           | タスクがドラッグ＆ドロップやリサイズで更新されたときに発火します。                           |
| `task-progress-change`   | `TaskProgressChangeEventDetail`   | 進捗バーのドラッグ編集が完了した時（またはEscキーでキャンセルされた時）に発火します。       |
| `minimap-resize`         | `MinimapResizeEventDetail`        | ミニマップがユーザーによってドラッグリサイズされたときに発火します。                         |
| `minimap-move`           | `MinimapMoveEventDetail`          | ミニマップがユーザーによってドラッグ移動されたときに発火します。                             |
| `minimap-collapse`       | `MinimapCollapseEventDetail`      | ミニマップが最小化（折りたたみ）または展開されたときに発火します。                           |
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
| `task-delete`            | `TaskDeleteEventDetail`           | 選択中のタスクに対して Delete / Backspace キーが押されたときに発火します。                   |
| `zoom-change`            | `ZoomChangeEventDetail`           | ズームレベルが変更されたときに発火します（Ctrl+ホイール、`zoomTo()`、`resetZoom()` 時）。   |
| `marker-dblclick`        | `MarkerDblClickEventDetail`       | マーカーをダブルクリックしたときに発火します。                                               |
| `marker-contextmenu`     | `MarkerContextMenuEventDetail`    | マーカーを右クリックしたときに発火します。カスタムコンテキストメニューの実装に使用します。   |

## メソッド (Methods)

コンポーネントのインスタンスに対して呼び出すことができるパブリックメソッドです。

| メソッド名          | シグネチャ                                                                                  | 説明                                                                                                                                                                                                        |
| :------------------ | :------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `selectTask`        | `(taskId: string) => boolean`                                                               | 指定したIDのタスクを選択状態にします。タスクが画面外にある場合は自動的にスクロールして表示します。タスクが見つかった場合は `true`、見つからなかった場合は `false` を返します。                              |
| `hitTest`           | `(clientX: number, clientY: number) => { rowId: string; date: Date } \| null`               | クライアント座標（画面上のピクセル位置）から、対応するガントチャートの行IDと日付を返します。座標がチャート領域外の場合は `null` を返します。                                                                |
| `exportImage`       | `(format: 'png' \| 'pdf' = 'png', options?: ExportImageOptions) => Promise<string \| Blob>` | ガントチャート全体を画像データまたはPDFとしてエクスポートします。戻り値はPNGの場合はデータURL(文字列)、PDFの場合はBlobです。`options.download: true` を指定すると自動的にファイルダウンロードを開始します。 |
| `zoomTo`            | `(value: number) => void`                                                                   | 指定した pxPerDay（月単位モードの場合は pxPerMonth）にズームを設定します。zoom.min/max の範囲でクランプされます。                                                                                          |
| `zoomToFit`         | `() => void`                                                                                | 全タスクが表示領域に収まるようにズームレベルを自動調整します。タスクの開始位置にスクロールします。                                                                                                        |
| `resetZoom`         | `() => void`                                                                                | ズームをリセットし、`option.calendar.pxPerDay`（または `pxPerMonth`）で設定された元のスケールに戻します。                                                                                                 |
| `getRowPositions`   | `() => { top: number; height: number; bottom: number }[]`                                   | 各行のY座標レイアウト情報（カレンダーヘッダーを含まない行領域の上端からの相対位置）を取得します。エクスポート時の分割位置計算などに使用します。                                                          |

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

// PNG形式でデータURLを取得
const pngDataUrl = await chart.exportImage('png')

// PDF形式でダウンロード
await chart.exportImage('pdf', {
  filename: 'my-gantt', // 省略時: 'gantt-chart'
  download: true, // trueでファイルダウンロード開始
})

// PNGをimgタグに埋め込む
const img = document.createElement('img')
img.src = await chart.exportImage('png')
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
  /** 画像を指定したピクセル数で縦に分割し、分割位置にカレンダー（ヘッダー）を挿入する。未指定時は分割しない */
  splitHeight?: number
}
```

> **Note:** `exportImage` はスクロール位置によらずチャート全体（スクロール領域すべて）をエクスポートします。Shadow DOM のスタイルも自動的に収集されます。ただし、外部フォントや画像がクロスオリジンの場合は正しく描画されないことがあります。

#### zoomTo / zoomToFit / resetZoom

```javascript
const chart = document.querySelector('gantt-chart')

// ズームを有効にする（オプション設定が必要）
chart.option = {
  ...chart.option,
  zoom: { enabled: true, min: 5, max: 200, step: 1.2 }
}

// 指定した pxPerDay にズーム
chart.zoomTo(100)

// 全タスクが画面に収まるようにズーム
chart.zoomToFit()

// 元のスケールに戻す
chart.resetZoom()

// ズーム変更イベントをリッスン
chart.addEventListener('zoom-change', (e) => {
  console.log(`pxPerDay: ${e.detail.pxPerDay}`)
  // 必要に応じて option.calendar.pxPerDay を追従更新
})
```

> **Note:** ズームは `Ctrl+マウスホイール`（Mac: `Cmd+ホイール`）でも操作できます。ズーム時はカーソル位置を基準にスクロール位置が自動補正されます。`option` を新しいオブジェクトで更新するとズームはリセットされます。

## 型定義 (Types)

イベント詳細などで使用される主要な型定義です。

### GanttRow

```typescript
interface GanttRow {
  id: string // 行の一意なID
  name: string // 行ヘッダーに表示するラベル
  tasks: GanttTask[] // この行に含まれるタスクの配列
  markers?: GanttMarker[] // この行に表示するマーカーの配列
  selectedMarkerId?: string // 現在選択中（編集中）のマーカーID
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
  progress?: number // 進捗率 (0〜100 の数値)
  progressColor?: string // 進捗バーのカスタム色 (CSSカラー文字列)
  progressStyle?: string // 進捗バーのカスタムスタイル (CSS文字列)
  progressResizable?: boolean // 進捗バーのドラッグ編集可否 (未指定時はoption.progress.editableに準拠)
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

### GanttChartOptionCustomRendering

`option.customRendering` に渡すオブジェクトの型定義です。

```typescript
interface GanttChartOptionCustomRendering {
  /** バーのコンテンツをレンダリングする関数。文字列または Lit の TemplateResult を返すことができます。 */
  barContent?: (task: GanttTask) => string | unknown
  /** 行ヘッダーのコンテンツをレンダリングする関数。文字列または Lit の TemplateResult を返すことができます。 */
  rowHeaderContent?: (row: GanttRow) => string | unknown
  /** ツールチップのコンテンツをレンダリングする関数。文字列または Lit の TemplateResult を返すことができます。 */
  tooltip?: (task: GanttTask) => string | unknown
  /** ドラッグ中の情報オーバーレイのコンテンツをレンダリングする関数。文字列または Lit の TemplateResult を返すことができます。 */
  dragInfo?: (task: GanttTask, newStart: Date, newEnd: Date, targetRow?: GanttRow) => string | unknown
  /** 行ヘッダーの左上コーナーセルのコンテンツをレンダリングする関数。文字列または Lit の TemplateResult を返すことができます。 */
  cornerContent?: () => string | unknown
  /** カレンダーの月セルをレンダリングする関数。HTMLElement または HTML文字列を返します。 */
  calendarMonthContent?: (context: CalendarMonthCellContext) => string | unknown
  /** カレンダーの日セルをレンダリングする関数。HTMLElement または HTML文字列を返します。 */
  calendarDayContent?: (context: CalendarDayCellContext) => string | unknown
  /** カレンダーの週セルをレンダリングする関数。HTMLElement または HTML文字列を返します。 */
  calendarWeekContent?: (context: CalendarWeekCellContext) => string | unknown
  /** カレンダーの時間セルをレンダリングする関数。HTMLElement または HTML文字列を返します。 */
  calendarHourContent?: (context: CalendarHourCellContext) => string | unknown
  /** ガントチャート部の背景セルをレンダリングする関数。各日のセルごとに呼ばれ、HTML文字列またはTemplateResultを返します。 */
  chartBackground?: (context: ChartBackgroundCellContext) => string | unknown
  /** 行ヘッダーのツールチップコンテンツをレンダリングする関数。マウスホバー時に呼ばれ、文字列・HTMLElement・TemplateResult を返すことができます。 */
  rowHeaderTooltip?: (row: GanttRow) => string | HTMLElement | unknown
}
```

### CalendarMonthCellContext

カレンダー月セルのカスタムレンダリング時に渡されるコンテキストです。

```typescript
interface CalendarMonthCellContext {
  year: number // 年
  month: number // 月 (0-11)
  width: number // セルの幅 (px)
  defaultLabel: string // デフォルトのラベルテキスト
}
```

### CalendarDayCellContext

カレンダー日セルのカスタムレンダリング時に渡されるコンテキストです。

```typescript
interface CalendarDayCellContext {
  date: Date // 日付
  width: number // セルの幅 (px)
  isSaturday: boolean // 土曜日かどうか
  isSunday: boolean // 日曜日かどうか
  isHoliday: boolean // 祝日かどうか
  defaultLabel: string // デフォルトのラベルテキスト
}
```

### CalendarWeekCellContext

カレンダー週セルのカスタムレンダリング時に渡されるコンテキストです。

```typescript
interface CalendarWeekCellContext {
  weekNumber: number // 週番号
  startDate: Date // 週の開始日
  width: number // セルの幅 (px)
  defaultLabel: string // デフォルトのラベルテキスト
}
```

### CalendarHourCellContext

カレンダー時間セルのカスタムレンダリング時に渡されるコンテキストです。

```typescript
interface CalendarHourCellContext {
  hour: number // 時間 (0-23)
  width: number // セルの幅 (px)
  date: Date // 対応する日付
}
```

### ChartBackgroundCellContext

ガントチャート部の背景セルのカスタムレンダリング時に渡されるコンテキストです。各行の各日セルごとに呼び出されます。

```typescript
interface ChartBackgroundCellContext {
  date: Date // 日付
  width: number // セルの幅 (px)
  height: number // セルの高さ (px)
  rowId: string // 行のID
  isSaturday: boolean // 土曜日かどうか
  isSunday: boolean // 日曜日かどうか
  isHoliday: boolean // 祝日かどうか
  defaultColor: string // デフォルトの背景色
  index: number // 列インデックス (0始まり)
}
```

#### cornerContent の使用例

```javascript
const option = {
  customRendering: {
    // 行ヘッダー左上のコーナーセルにカスタムボタンを配置する例
    cornerContent: () => {
      const btn = document.createElement('button')
      btn.textContent = 'フィルター'
      btn.style.cssText = 'border: none; background: transparent; cursor: pointer; padding: 4px 8px;'
      btn.addEventListener('click', () => {
        console.log('フィルターボタンがクリックされました')
      })
      return btn
    },
    // バーのカスタム表示
    barContent: (task) => {
      const div = document.createElement('div')
      div.style.padding = '2px 8px'
      div.textContent = task.name || ''
      return div
    },
  },
}
```

#### カレンダーカスタムレンダリングの使用例

```javascript
const option = {
  customRendering: {
    // 月セルにアイコンを追加
    calendarMonthContent: (ctx) => {
      const el = document.createElement('div')
      el.style.display = 'flex'
      el.style.alignItems = 'center'
      el.style.gap = '4px'
      el.innerHTML = `<span>📅</span><span>${ctx.defaultLabel}</span>`
      return el
    },

    // 日セルで祝日・日曜を赤色にする
    calendarDayContent: (ctx) => {
      const el = document.createElement('div')
      if (ctx.isSunday || ctx.isHoliday) {
        el.style.color = 'red'
        el.style.fontWeight = 'bold'
      }
      el.textContent = ctx.defaultLabel
      return el
    },

    // 週セルのフォーマット変更
    calendarWeekContent: (ctx) => {
      return `<strong>第${ctx.weekNumber}週</strong>`
    },

    // 時間セルのフォーマット変更
    calendarHourContent: (ctx) => {
      return `${String(ctx.hour).padStart(2, '0')}:00`
    },
  },
}
```

#### chartBackground（チャート背景）の使用例

```javascript
const option = {
  customRendering: {
    // 偶数日にストライプパターン、週末にアイコンを表示
    chartBackground: (ctx) => {
      const isEvenDay = ctx.date.getDate() % 2 === 0
      const stripeStyle = isEvenDay
        ? 'background: repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(128,128,128,0.08) 3px, rgba(128,128,128,0.08) 6px);'
        : ''
      const icon = ctx.isSunday || ctx.isHoliday ? '🔴' : ctx.isSaturday ? '🔵' : ''
      return html`
        <div
          style="width: 100%; height: 100%; ${stripeStyle} display: flex; align-items: flex-end; justify-content: center; padding-bottom: 2px;"
        >
          ${icon ? html`<span style="font-size: 8px; opacity: 0.6;">${icon}</span>` : ''}
        </div>
      `
    },
  },
}
```

> **Note:** `chartBackground` はデフォルトの背景色（土日・祝日の色分け）の上にオーバーレイとしてレンダリングされます。デフォルト背景色は `defaultColor` プロパティで取得できます。`rowId` を使用して行ごとに異なる背景を表示することも可能です。

> **Note:** カスタムレンダリング関数は `HTMLElement` または HTML文字列を返すことができます。HTMLElement の場合は直接DOMに追加され、文字列の場合は `innerHTML` として設定されます。カスタムレンダリングを設定した場合、デフォルトのテキストは非表示になります。

#### rowHeaderTooltip の使用例

行ヘッダーにマウスをホバーした際にツールチップを表示できます。`customRendering.rowHeaderTooltip` に関数を設定すると、遅延表示（`tooltipDelay` を共有）でツールチップが表示されます。

```javascript
const option = {
  customRendering: {
    // 文字列を返す場合
    rowHeaderTooltip: (row) => {
      return `${row.name} (タスク数: ${row.tasks.length})`
    },
  },
}
```

```javascript
const option = {
  customRendering: {
    // HTMLElement を返す場合（リッチなツールチップ）
    rowHeaderTooltip: (row) => {
      const container = document.createElement('div')
      container.style.maxWidth = '300px'

      const title = document.createElement('div')
      title.style.fontWeight = 'bold'
      title.textContent = row.name
      container.appendChild(title)

      const info = document.createElement('div')
      info.style.fontSize = '11px'
      info.style.marginTop = '4px'
      info.textContent = `タスク数: ${row.tasks.length}`
      container.appendChild(info)

      return container
    },
  },
}
```

> **Note:** `rowHeaderTooltip` が `null` または `undefined` を返した場合、ツールチップは表示されません。ツールチップの表示遅延は `option.tooltipDelay`（デフォルト: 500ms）を共有します。ツールチップは行ヘッダーの右側に表示され、画面端での自動位置補正が行われます。

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

### MarkerFontSize

```typescript
type MarkerFontSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
```

| 値   | フォントサイズ |
| :--- | :------------- |
| `xs` | 8px (極小)     |
| `sm` | 10px (小)      |
| `md` | 12px (中)      |
| `lg` | 14px (大)      |
| `xl` | 18px (特大)    |

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
  fontSize?: MarkerFontSize // マーカーのラベルのフォントサイズ (デフォルト: 'sm' = 10px)
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
  barX?: number // タスクバーの中心X座標（ドラッグ中のみ）
  barTop?: number // タスクバーの上端Y座標（ドラッグ中のみ）
  barBottom?: number // タスクバーの下端Y座標（ドラッグ中のみ）
  mode: GanttTaskMoveMode // 移動モード ('move' | 'copy')
  selectedTaskIds?: string[] // 複数選択移動時の対象タスクID配列
  isOutside?: boolean // ガントチャート外にカーソルがあるかどうか
  isCancel?: boolean // ドラッグがキャンセルされたかどうか
}
```

### TaskProgressChangeEventDetail

進捗バーのドラッグ編集が完了した時（またはEscでキャンセルされた時）に `task-progress-change` イベントとして発火されます。

```typescript
interface TaskProgressChangeEventDetail {
  task: GanttTask // 対象のタスクデータ
  progress: number // 新しい進捗率 (0〜100)
  originalProgress?: number // 変更前の進捗率
  cancelled?: boolean // Escキー等でキャンセルされたかどうか
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

### BarHoverEventDetail

```typescript
interface BarHoverEventDetail {
  task: GanttTask // 対象のタスクデータ
  x: number // マウスのX座標
  y: number // マウスのY座標（バー上辺）
  barBottom: number // バー下辺のY座標
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
  subGridLine: string // サブグリッド線色（スナップ単位など）
  monthGridLine?: string // 月の区切りの縦罫線色 (オプション)
  yearGridLine?: string // 年の区切りの縦罫線色 (オプション)
  showTimeDateLine?: string // 時間単位モードの日付区切り縦罫線色 (オプション)。未指定時は monthGridLine → border にフォールバック
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
  criticalPath?: string // クリティカルパスのハイライト色 (オプション)
  minimapBg?: string // ミニマップの背景色 (オプション)
  minimapBorder?: string // ミニマップの枠線色 (オプション)
  minimapViewport?: string // ミニマップのビューポート枠背景色 (オプション)
  minimapViewportBorder?: string // ミニマップのビューポート枠ボーダー色 (オプション)
  minimapTask?: string // ミニマップのタスク描画色 (オプション)
  taskProgress?: string // タスク進捗バーの描画色 (オプション)
  taskProgressHandle?: string // タスク進捗変更ハンドルの描画色 (オプション)
}
```

### GanttTaskMoveMode

```typescript
type GanttTaskMoveMode = 'copy' | 'move'
```

### DependencyLineStyle

```typescript
type DependencyLineStyle = 'curve' | 'orthogonal'
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
  /** クリティカルパスを表示するかどうか (デフォルト: false)。依存関係グラフの最長チェーンを自動計算し、該当するタスクバーと接続線をハイライト表示する */
  showCriticalPath?: boolean
}
```

> **Note:** `lineStyle` のデフォルトは `'orthogonal'`（直角折れ線）です。右→左方向の依存関係の場合、自動的にコの字型の迂回ルートが計算されます。`'curve'` を指定した場合は従来通りベジェ曲線で描画されます。

### DependencyCreateEventDetail

```typescript
interface DependencyCreateEventDetail {
  sourceTaskId: string // 接続元のタスクID
  sourceEndpoint: DependencyEndpoint // 接続元のエンドポイント（start=左端, end=右端）
  targetTaskId: string // 接続先のタスクID
  targetEndpoint: DependencyEndpoint // 接続先のエンドポイント（start=左端, end=右端）
}
```

### TaskDeleteEventDetail

```typescript
interface TaskDeleteEventDetail {
  taskIds: string[] // 削除対象のタスクID配列
  event: KeyboardEvent // 元のキーボードイベント
}
```


### ZoomChangeEventDetail

```typescript
interface ZoomChangeEventDetail {
  pxPerDay: number // ズーム後の pxPerDay
  pxPerMonth?: number // ズーム後の pxPerMonth（月単位モード時のみ）
}
```

### DependencyClickEventDetail

```typescript
interface DependencyClickEventDetail {
  sourceTaskId: string // 接続元（依存元）のタスクID
  targetTaskId: string // 接続先（依存を持つ側）のタスクID
  event: MouseEvent // 元のマウスイベント
}
```

### MarkerDblClickEventDetail

```typescript
interface MarkerDblClickEventDetail {
  marker: GanttMarker // 対象のマーカー
  rowId: string // マーカーが属する行ID
  event: MouseEvent // 元のマウスイベント
}
```

### MarkerContextMenuEventDetail

```typescript
interface MarkerContextMenuEventDetail {
  marker: GanttMarker // 対象のマーカー
  rowId: string // マーカーが属する行ID
  event: MouseEvent // 元のマウスイベント
}
```

### GanttChartOptionMinimap

```typescript
interface GanttChartOptionMinimap {
  enabled?: boolean // ミニマップを表示するかどうか (デフォルト: false)
  width?: number // ミニマップの幅 (px、デフォルト: 200)
  height?: number // ミニマップの高さ (px、デフォルト: 120)
  maxHeight?: number // 縦横比維持時の最大高さ (px、デフォルト: height または 120)
  preserveAspectRatio?: boolean // ガントチャートコンテンツの縦横比（アスペクト比）に合わせて描画するかどうか (デフォルト: true)
  resizable?: boolean // ユーザーによるドラッグリサイズを許可するかどうか (デフォルト: true)
  minWidth?: number // リサイズ時の最小幅 (px、デフォルト: 120)
  maxWidth?: number // リサイズ時の最大幅 (px、デフォルト: 600)
  minHeight?: number // リサイズ時の最小高さ (px、デフォルト: 60)
  collapsible?: boolean // 折りたたみ（最小化）ボタンを表示するかどうか (デフォルト: true)
  collapsed?: boolean // 初期状態で折りたたまれているかどうか (デフォルト: false)
  showMilestones?: boolean // マイルストーンを表示するかどうか (デフォルト: true)
  showCurrentTime?: boolean // 現在時刻線を表示するかどうか (デフォルト: true)
  position?: MinimapPosition // ミニマップの初期位置（親要素に対する右下基準の座標 px）
  opacity?: number // ミニマップの不透明度 (0.1 〜 1.0、デフォルト: 1.0)
}
```

### MinimapPosition

```typescript
interface MinimapPosition {
  right: number // 親要素右端からの距離 (px)
  bottom: number // 親要素下端からの距離 (px)
}
```

### MinimapResizeEventDetail

```typescript
interface MinimapResizeEventDetail {
  width: number // リサイズ後の幅 (px)
  height: number // リサイズ後の高さ (px)
  position?: MinimapPosition // リサイズに伴う位置の変更 (px)
}
```

### MinimapMoveEventDetail

```typescript
interface MinimapMoveEventDetail {
  right: number // 親要素右端からの距離 (px)
  bottom: number // 親要素下端からの距離 (px)
}
```

### MinimapCollapseEventDetail

```typescript
interface MinimapCollapseEventDetail {
  collapsed: boolean // 最小化されているかどうか
}
```

### GanttChartOptionProgress

```typescript
interface GanttChartOptionProgress {
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
```

### MoguchartLocale

ツールチップ・ドラッグオーバーレイの表示文字列や日付フォーマットをカスタマイズできます。`jaLocale`（日本語）と `enLocale`（英語）があらかじめ用意されています。

```typescript
interface MoguchartLocale {
  monthFormat: string // デフォルトの月表示フォーマット (dayjs互換)
  monthRowFormat: string // 月単位モードの月表示フォーマット (例: 'M月' / 'MMM')
  dateFormat: (date: Date) => string // 日付のフォーマット関数
  timeUnitDateFormat: (date: Date) => string // 時間単位モードの日付フォーマット関数
  dateTimeFormat: (date: Date) => string // 日時のフォーマット関数
  yearMonthFormat: (date: Date) => string // 年月のみのフォーマット関数 (月単位モードのツールチップ・ドラッグオーバーレイで使用)
  duration: {
    days: (n: number) => string // 日数のフォーマット
    hours: (n: number) => string // 時間のフォーマット
    minutes: (n: number) => string // 分のフォーマット
    zero: string // 期間がゼロの場合の表示
  }
  tooltip: {
    duration: (days: number) => string // 所要日数の表示
    progress?: (percent: number) => string // 進捗率の表示 (例: 75 → "進捗: 75%") (オプション)
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
import { enLocale } from '@mogura/moguchart-core'

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
    const h = d.getHours(),
      m = d.getMinutes()
    const date = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
    return h === 0 && m === 0 ? date : `${date} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  },
  yearMonthFormat: (d) => `${d.getFullYear()}/${d.getMonth() + 1}`,
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
    tasks: [
      /* ... */
    ],
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
- `dependency.showConnectors: false` を設定するとコネクターポイントを非表示にできます（既存の依存関係線は引き続き表示されます）

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

## クリティカルパスの表示

`dependency.showCriticalPath: true` を設定すると、依存関係グラフの中で最長のタスクチェーン（クリティカルパス）を自動的に計算し、該当するタスクバーと接続線を赤色でハイライト表示します。

- 依存関係を持つタスクのみが計算対象です。独立タスク（依存関係に参加していないタスク）はクリティカルパスの計算から除外されます
- 手動スケジュール（タスク間にギャップがある場合）にも対応しています
- ハイライトの色は `customTheme.criticalPath` でカスタマイズできます

### 使用例

```javascript
const option = {
  dependency: {
    showCriticalPath: true, // クリティカルパスを表示
    showArrows: true,
  },
  customTheme: {
    criticalPath: 'rgba(220, 38, 38, 0.85)', // ハイライト色（省略可）
  },
  // ...
}
```

### computeCriticalPath 関数

依存関係グラフからクリティカルパス上のタスクIDの集合（`Set<string>`）を直接計算するユーティリティ関数もエクスポートされています。

```typescript
import { computeCriticalPath } from '@mogura/moguchart-core'

const criticalTaskIds: Set<string> = computeCriticalPath(rows)
console.log('クリティカルパス上のタスクID:', Array.from(criticalTaskIds))
```

## キーボード操作

ガントチャートにフォーカスがある状態で、キーボードによるタスクのナビゲーション・選択・移動・削除が可能です。

### サポートされるキー操作

| キー | 動作 |
| :--- | :--- |
| `←` `→` | フォーカスを同一行内のタスク間で移動（端を超えると次/前行に移動） |
| `↑` `↓` | フォーカスを別の行のタスクに移動 |
| `Enter` / `Space` | フォーカス中のタスクを選択 |
| `Ctrl/Cmd + Enter` | フォーカス中のタスクの選択をトグル（複数選択） |
| `Shift + ←` `→` | 選択中のタスクを左右に移動（`moveStep` 単位） |
| `Delete` / `Backspace` | 選択中のタスクに対して `task-delete` イベントを発火 |
| `Escape` | 選択とフォーカスをすべてクリア |
| `Home` | 現在の行の最初のタスクにフォーカス |
| `End` | 現在の行の最後のタスクにフォーカス |

### 設定

```javascript
const option = {
  keyboard: {
    enabled: true,    // キーボード操作を有効にするか (デフォルト: true)
    moveStep: 60,     // Shift+矢印キーでの移動量（分）。省略時は snapDuration を使用
  },
  // ...
}
```

### task-delete イベントの使用例

```javascript
chart.addEventListener('task-delete', (e) => {
  const { taskIds } = e.detail
  console.log('削除対象:', taskIds)

  // 例: 確認ダイアログを表示してから削除
  if (confirm(`${taskIds.length}件のタスクを削除しますか？`)) {
    rows = rows.map((row) => ({
      ...row,
      tasks: row.tasks.filter((t) => !taskIds.includes(t.id)),
    }))
    chart.rows = rows
  }
})
```

## ミニマップ（Overview Minimap）

`minimap` オプションを設定することで、ガントチャート全体のタスク配置やマイルストーン、現在時刻線を鳥瞰できるフローティング小窓型のミニマップを表示できます。

- **ビューポートナビゲーション**: ミニマップ内の半透明ファインダー枠をドラッグしてスクロール（パン）したり、クリックして目的の位置へジャンプ移動できます。
- **ドラッグ移動**: ミニマップのタイトルバーをドラッグして、チャート内の任意の位置へ自由に移動できます。移動完了時に `minimap-move` イベントが発火します。
- **ドラッグリサイズ**: ミニマップの四隅やエッジをドラッグして、サイズを自由に拡大・縮小できます。リサイズ完了時に `minimap-resize` イベントが発火します。
- **自動アンカーと配置追従**: チャートの表示領域（親要素）サイズ変更やコンテンツ更新時、右下アンカー基準でミニマップの表示位置が自動追従・クランプされ、表示領域外へのはみ出しを防ぎます。
- **不透明度（透過率）の調整**: `opacity` オプション（`0.1` 〜 `1.0`）でミニマップの不透明度を設定できます。ホバー時やドラッグ・リサイズ操作中は自動的に 1.0（不透明）になり視認性が保たれます。
- **折りたたみ**: 最小化ボタンでコンパクトに折りたたむことができます。
- **テーマ対応**: `customTheme` の `minimapBg` や `minimapViewport` などで色をカスタマイズできます。

### 使用例

```javascript
const chart = document.querySelector('gantt-chart')

chart.option = {
  // ...
  minimap: {
    enabled: true,
    width: 240,
    preserveAspectRatio: true,
    resizable: true,
    position: { right: 16, bottom: 16 }, // 初期表示位置（親要素右下基準 px）
    opacity: 0.85, // 不透明度 (0.1 〜 1.0)
  },
}

// リサイズイベントのハンドリング
chart.addEventListener('minimap-resize', (e) => {
  const { width, height, position } = e.detail
  console.log(`Minimap resized: ${width}x${height}`, position)
})

// ドラッグ移動イベントのハンドリング
chart.addEventListener('minimap-move', (e) => {
  const { right, bottom } = e.detail
  console.log(`Minimap moved to: right=${right}, bottom=${bottom}`)
})

// 折りたたみ（最小化）イベントのハンドリング
chart.addEventListener('minimap-collapse', (e) => {
  const { collapsed } = e.detail
  console.log(`Minimap collapsed: ${collapsed}`)
})
```

## 進捗管理（Progress Management）

各タスクの `progress` プロパティ（`0` 〜 `100`）を設定することで、タスクバー上に進捗状況を視覚的に表示できます。

- **進捗バー表示**: バー内に進捗率に応じたオーバーレイ（全面または下部/上部ライン）が描画されます。
- **ドラッグ編集**: `option.progress.editable: true`（またはタスクごとの `progressResizable: true`）を設定すると、進捗バー端のハンドルをドラッグして進捗率を直感的に変更できます（スナップ刻み `snapStep` に対応）。
- **進捗ラベル**: `option.progress.showLabel: true` で `50%` などの進捗ラベルを表示できます（位置: `inside` / `right` / `left` / `center`）。
- **イベント連携**: 進捗ドラッグ変更完了時に `task-progress-change` イベントが発火します。
- **ミニマップ反映**: ミニマップ上でもタスクの進捗が自動的に濃淡表示されます。

### 使用例

```javascript
import {
  clampProgress,
  calculateRowProgress,
  calculateWeightedRowProgress,
  calculateProjectProgress,
} from '@mogura/moguchart-core'

const chart = document.querySelector('gantt-chart')

chart.option = {
  // ...
  progress: {
    enabled: true,
    editable: true, // ドラッグによる進捗編集を有効化
    showLabel: true, // 進捗ラベルを表示
    labelPosition: 'inside', // 'inside' | 'right' | 'left' | 'center'
    snapStep: 5, // 5% 刻みでスナップ
    indicatorPosition: 'full', // 'full' | 'bottom' | 'top'
  },
}

// 進捗変更イベント
chart.addEventListener('task-progress-change', (e) => {
  const { task, progress, originalProgress, cancelled } = e.detail
  console.log(`Task ${task.id} progress changed: ${originalProgress}% -> ${progress}%`)
})

// 進捗計算ユーティリティ
const rowAvg = calculateRowProgress(row) // 行の単純平均進捗率
const rowWeighted = calculateWeightedRowProgress(row) // 期間加重平均進捗率
const projectProgress = calculateProjectProgress(rows) // プロジェクト全体の加重平均進捗率
```

## ユーティリティ関数 (Utility Functions)

パッケージからエクスポートされている補助関数です。

```typescript
import {
  clampProgress,
  calculateRowProgress,
  calculateWeightedRowProgress,
  calculateProjectProgress,
  computeCriticalPath,
} from '@mogura/moguchart-core'
```

### clampProgress

進捗率の数値を `0` 〜 `100` の範囲に正規化・丸め処理します。

```typescript
function clampProgress(value: number, precision?: number): number
```

- **`value`**: 入力値（`NaN` や非数値は `0` にフォールバック）
- **`precision`**: 小数点以下の丸め桁数（デフォルト: `1`）
- **戻り値**: `0` 〜 `100` の範囲にクランプされた数値

### calculateRowProgress

指定した行またはタスク配列に含まれるタスクの単純平均進捗率を計算します。進捗率が未指定（`undefined`）のタスクは除外して計算されます。

```typescript
function calculateRowProgress(rowOrTasks: GanttRow | GanttTask[]): number
```

- **`rowOrTasks`**: 対象の `GanttRow` オブジェクトまたは `GanttTask[]` 配列
- **戻り値**: 単純平均進捗率（`0` 〜 `100`）。有効な進捗を持つタスクが存在しない場合は `0`

### calculateWeightedRowProgress

指定した行またはタスク配列に含まれるタスクの期間（ミリ秒）に応じた加重平均進捗率を計算します。タスクの長さに応じて重み付けされた進捗率が得られます。

```typescript
function calculateWeightedRowProgress(rowOrTasks: GanttRow | GanttTask[]): number
```

- **`rowOrTasks`**: 対象の `GanttRow` オブジェクトまたは `GanttTask[]` 配列
- **戻り値**: 期間加重平均進捗率（`0` 〜 `100`）。有効な進捗を持つタスクが存在しない場合は `0`

### calculateProjectProgress

全行（プロジェクト全体）に含まれるすべてのタスクの期間加重平均進捗率を計算します。

```typescript
function calculateProjectProgress(rows: GanttRow[]): number
```

- **`rows`**: ガントチャートの全行データ配列 (`GanttRow[]`)
- **戻り値**: プロジェクト全体の加重平均進捗率（`0` 〜 `100`）

### computeCriticalPath

タスク配列およびその依存関係からクリティカルパス（最も長い所要時間を持つ経路）を計算します。

```typescript
function computeCriticalPath(rows: GanttRow[]): Set<string>
```

- **`rows`**: ガントチャートの全行データ配列 (`GanttRow[]`)
- **戻り値**: クリティカルパスを構成するタスクIDの `Set<string>`



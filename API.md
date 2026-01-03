# MoguChart 2 API Reference

MoguChart 2 は、Lit で構築されたガントチャート Web Component です。

## コンポーネント

```html
<gantt-chart></gantt-chart>
```

## プロパティ (Properties)

コンポーネントに渡すことができるプロパティです。

| プロパティ名 | 型                  | 説明                                                                     |
| :----------- | :------------------ | :----------------------------------------------------------------------- |
| `rows`       | `GanttRow[]`        | ガントチャートに表示する行データの配列。各行にはタスクが含まれます。     |
| `option`     | `GanttChartOption`  | チャートの表示や動作を設定するオプションオブジェクト。                   |
| `theme`      | `'light' \| 'dark'` | (属性) テーマを指定します。CSS変数によるスタイリングのベースとなります。 |

## オプション設定 (GanttChartOption)

`option` プロパティに渡すオブジェクトの構造です。

```typescript
interface GanttChartOption {
  /** バー（タスク）のスタイル設定 */
  bar: {
    height: number // バーの高さ (px)
    margin: number // バーの上下マージン (px)
    cornerRadius: number // バーの角丸 (px)
  }
  /** 行ヘッダーの設定 */
  rowHeader: {
    width: number // 行ヘッダーの幅 (px)
  }
  /** カレンダー（タイムライン）の設定 */
  calendar: {
    start: Date // 表示開始日
    pxPerDay: number // 1日あたりの幅 (px)
    totalDays: number // カレンダーに表示する総日数
    isHoliday?: (date: Date) => boolean // 祝日判定ロジック
  }
  /** 読み取り専用モードかどうか */
  readOnly: boolean
  /** ツールチップが表示されるまでの遅延時間 (ms) */
  tooltipDelay: number
  /** ドラッグ中に情報オーバーレイを表示するかどうか */
  showDragInfoOverlay: boolean
  /** テーマ設定 ('light' または 'dark') */
  theme: 'light' | 'dark'
  /** カスタムテーマカラー（特定の色を上書きする場合に使用） */
  customTheme?: Partial<ThemeColorPalette>
  /** 行のドラッグ＆ドロップによる並び替えを有効にするか */
  enableRowReordering: boolean
}
```

## イベント (Events)

コンポーネントから発火されるカスタムイベントです。

| イベント名           | 詳細 (e.detail)               | 説明                                                                                             |
| :------------------- | :---------------------------- | :----------------------------------------------------------------------------------------------- |
| `rows-change`        | `GanttRow[]`                  | 行の並び替えなどにより、行データが変更されたときに発火します。新しい行データの配列が渡されます。 |
| `task-update`        | `TaskUpdateEventDetail`       | タスクがドラッグ＆ドロップやリサイズで更新されたときに発火します。                               |
| `render-bar-content` | `RenderBarContentEventDetail` | タスクバーの中身を描画するタイミングで発火します。バー内のコンテンツをカスタマイズできます。     |
| `render-row-header`  | `RenderRowHeaderEventDetail`  | 行ヘッダーを描画するタイミングで発火します。ヘッダーの内容をカスタマイズできます。               |
| `render-tooltip`     | `RenderTooltipEventDetail`    | ツールチップを描画するタイミングで発火します。ツールチップの内容をカスタマイズできます。         |
| `task-dblclick`      | `TaskClickEventDetail`        | タスクバーをダブルクリックしたときに発火します。                                                 |
| `task-contextmenu`   | `TaskContextMenuEventDetail`  | タスクバーを右クリックしたときに発火します。カスタムコンテキストメニューの実装に使用します。     |
| `render-drag-info`   | `RenderDragInfoEventDetail`   | タスクドラッグ中の情報表示を描画するタイミングで発火します。                                     |

## 型定義 (Types)

イベント詳細などで使用される主要な型定義です。

### GanttRow

```typescript
interface GanttRow {
  id: string // 行の一意なID
  label: string // 行ヘッダーに表示するラベル
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

### TaskUpdateEventDetail

```typescript
interface TaskUpdateEventDetail {
  task: GanttTask // 更新されたタスク
  start: Date // 新しい開始日
  end: Date // 新しい終了日
  rowId: string // 所属する行のID
  isDragging: boolean // ドラッグ操作中かどうか
  // その他、実装に応じたプロパティ
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
  targetRow: GanttRow | null // 現在ドロップ対象となっている行
}
```

# @mogura/moguchart-core

![demo-light.png](https://raw.githubusercontent.com/hiro-murakami/qiita-content/main/images/moguchart-core-introduction/demo-light.png)

[English](./README.md) | [Demo](https://moguchart-core.vercel.app/)

Vue, React, Angular, Svelte など、どのフレームワークでも動作する、軽量で高機能な Web Components 製ガントチャートコンポーネントです。Lit で構築されています。

- **デモ**: [https://moguchart-core.vercel.app/](https://moguchart-core.vercel.app/)
- **npm パッケージ**: [@mogura/moguchart-core](https://www.npmjs.com/package/@mogura/moguchart-core)

## 特徴

- 🚀 **フレームワーク非依存**: Web Components (Custom Elements) として実装されており、あらゆる環境で動作します。
- ⚡ **仮想スクロール**: 大量のタスクや行があってもスムーズに動作します。
- ↩️ **操作履歴管理 (Undo / Redo)**: コマンドパターンによる直感的な履歴管理。タスクの移動・リサイズ・進捗変更・削除、行の並び替え、依存関係の作成・削除など主要な編集操作の取り消し・やり直しを完全サポート（`Ctrl+Z` / `Ctrl+Y` 対応）。
- 🔍 **包括的なズーム制御**: パーセンテージ（50%〜200%）やスケール倍率（0.5〜2.0）に基づく柔軟な拡大縮小。カレンダー列幅・行ヘッダー幅・タスクバー高さ・フォントサイズ（`--moguchart-font-scale`）の一括連動スケーリング。ショートカットキー（`Ctrl/Cmd + + / - / 0`）やホイール操作に対応。
- 🖱️ **インタラクティブ**:
  - ドラッグ＆ドロップによるタスク移動（行間移動対応）
  - ハンドル操作による期間リサイズ
  - ドラッグ＆ドロップによる行の並び替え
  - 列ヘッダーの幅リサイズ
  - 矩形範囲選択（ラバーバンドドラッグ選択）による複数タスク一括選択（Shift/Ctrl/Cmdキーでの追加選択対応）
  - 複数タスクの選択＆一括ドラッグ（Ctrl/Cmd + クリック、矩形選択）
  - ダブルクリックや右クリックイベントのハンドリング
- 🎨 **高度なカスタマイズ**:
  - タスクバー、行ヘッダー、ツールチップ、ドラッグ情報のコンテンツを自由にレンダリング可能
  - ライト/ダーク/システムテーマの切り替え＋カスタムカラーテーマ
  - タスクバーの塗りつぶしパターン（ストライプ、ドット、チェッカーボードなど13種類）
  - CSSによるスタイリング
- 🔗 **依存関係の対話的操作**:
  - タスク間の依存関係を矢印付き直線・曲線（直角折れ線/ベジェ曲線）で可視化
  - 依存関係線のクリック選択とハイライト表示
  - 選択中の線上の削除「×」ボタンまたは `Delete` / `Backspace` キーによるワンクリック削除
  - クリティカルパス（最長チェーン）の自動検出＋ハイライト表示
- 📅 **柔軟なカレンダー**:
  - 日単位 / 週単位 / 月単位の表示切り替え
  - ズームレベル（1日・1ヶ月あたりの幅）や表示期間の調整が可能
  - 現在時刻ラインの表示（バッジ付き、自動更新対応）
  - 祝日判定のカスタムロジック
  - 週の始まり曜日の設定
  - ロケール対応（日本語・英語、カスタムロケールも可能）
- 🔤 **フォントサイズ倍率 (`fontScale`)**: `fontScale` オプションや CSS 変数 `--moguchart-font-scale` でチャート全体のフォントサイズを一括スケーリング。表示倍率や画面解像度に合わせた文字サイズの最適化に対応
- 🏁 **マイルストーン**: チャート上にマイルストーン（縦線＋名前バッジ）を表示
- 📍 **マーカー**: 行のタイムライン上に三角形アイコンとラベルで目印を表示
- 🗺️ **ミニマップ（Overview Minimap）**: チャート全体の鳥瞰プレビュー表示、ドラッグによるスクロール同期・パン操作、クリックジャンプ、ドラッグ移動・リサイズ、折りたたみ対応
- 📊 **タスク進捗管理**:
  - タスクバー上への進捗バー（オーバーレイ/下部・上部インジケーター）描画
  - ハンドル操作による直感的な進捗率のドラッグ編集（スナップ対応）
  - 進捗ラベル表示（配置カスタマイズ・カスタムフォーマット対応）
  - サマリータスク（親集計バー）への進捗ラベル自動表示および専用カスタム色（`summaryColor`）対応
  - 進捗変更イベント（`task-progress-change`）の発火
  - 行・プロジェクト全体の進捗率計算ユーティリティ関数
- 🧩 **プラグインアーキテクチャ**: コア本体を超軽量（数十KB）に保ちつつ、画像・PDFエクスポート等の機能をプラグインとして柔軟に拡張可能
- 📷 **エクスポート（プラグイン）**: `@mogura/moguchart-plugin-export` による PNG画像およびPDF形式でのガントチャート全体エクスポート（自動ダウンロード対応、エクスポート時のズーム正規化 `normalizeZoom`、スクロール位置保持）
  - 外部からのドラッグ＆ドロップによるタスク作成
  - タスクの移動/コピーモード
  - スナップ機能（時間単位でのグリッドスナップ）
  - 座標から行・日時を取得する `hitTest` メソッド
  - プログラムによるタスク選択＋自動スクロール (`selectTask`)
- 🌳 **WBS（階層ツリー・展開/折りたたみ）**:
  - `parentId` による無制限の親子階層構造
  - インデント表示と開閉トグルボタン（▶/▼）
  - 配下の子タスクから自動計算されるサマリータスクバー（ブラケット形状）
  - サマリータスクバーの色設定（プロジェクト既定色および行単位の個別色指定）
  - 親行におけるサマリータスクと通常タスクの共存・同時描画
  - 仮想スクロールやミニマップと完全に連動する折りたたみ
  - 階層を壊さない安全なD&D並び替え（子タスクのブロック連動移動・循環参照防止）
  - プログラムからの開閉操作（`toggleRowCollapse`, `collapseAll`, `expandAll`）
- ⌨️ **キーボード操作**: 矢印キーでのナビゲーション・選択・Shift+矢印キーでのタスク移動・Deleteキーでのタスク/依存関係線削除・Undo/Redo・ズームショートカット

## パッケージ一覧（エコシステム）

Moguchart は柔軟なモノレポ構成となっており、用途やフレームワークに合わせてパッケージを選択できます：

| パッケージ | 説明 |
|---|---|
| **[@mogura/moguchart-core](https://www.npmjs.com/package/@mogura/moguchart-core)** | コア Web Component（Lit製）。フレームワーク非依存で単体動作します。 |
| **[@mogura/moguchart-react](https://www.npmjs.com/package/@mogura/moguchart-react)** | **公式 React ラッパー**。型安全な Props、イベント、ref を提供します。 |
| **[@mogura/moguchart-vue](https://www.npmjs.com/package/@mogura/moguchart-vue)** | **公式 Vue 3 ラッパー**。Composition API、リアクティブ Props、emits を提供します。 |
| **[@mogura/moguchart-plugin-export](https://www.npmjs.com/package/@mogura/moguchart-plugin-export)** | **公式エクスポートプラグイン**。高解像度 PNG および PDF 出力を提供します。 |
| **[@mogura/moguchart-plugin-excel](https://www.npmjs.com/package/@mogura/moguchart-plugin-excel)** | **公式 Excel プラグイン**。タイムライン付き工程表やタスク一覧の Excel (.xlsx) 出力を提供します。 |

---

## インストール

お使いの環境に合わせてインストールしてください：

```bash
# Core (Web Components / Vanilla JS)
pnpm add @mogura/moguchart-core

# React アプリケーションの場合
pnpm add @mogura/moguchart-react @mogura/moguchart-core

# Vue 3 アプリケーションの場合
pnpm add @mogura/moguchart-vue @mogura/moguchart-core
```

## APIリファレンス

詳細な API リファレンスは [API.ja.md](./doc/API.ja.md) または [英語版 (API.md)](./doc/API.md) を参照してください。

---

## React での使用例（公式ラッパー）

[`@mogura/moguchart-react`](./packages/react/README.ja.md) を使用すると、React の合成イベントや Props、`ref` を通じた命令的メソッド呼び出しが完全に型安全に動作します：

```tsx
import React, { useRef } from 'react'
import {
  GanttChart,
  type GanttChartElement,
  type GanttRow,
  type GanttChartOption,
  type TaskUpdateEventDetail,
} from '@mogura/moguchart-react'
import { ExportPlugin } from '@mogura/moguchart-plugin-export'

export default function App() {
  const chartRef = useRef<GanttChartElement>(null)

  const rows: GanttRow[] = [
    {
      id: 'row-1',
      name: '開発フェーズ',
      tasks: [
        {
          id: 'task-1',
          name: '要件定義',
          start: new Date('2026-04-01'),
          end: new Date('2026-04-10'),
          progress: 100,
        },
        {
          id: 'task-2',
          name: '実装',
          start: new Date('2026-04-11'),
          end: new Date('2026-04-25'),
          progress: 50,
        },
      ],
    },
  ]

  const option: GanttChartOption = {
    calendar: {
      start: new Date('2026-04-01'),
      end: new Date('2026-04-30'),
      pxPerDay: 40,
    },
    plugins: [new ExportPlugin()],
  }

  const handleTaskUpdate = (e: CustomEvent<TaskUpdateEventDetail>) => {
    console.log('タスクが更新されました:', e.detail)
  }

  const handleExportPng = async () => {
    await chartRef.current?.exportImage({ format: 'png', scale: 2 })
  }

  return (
    <div style={{ height: '600px' }}>
      <button onClick={handleExportPng}>PNGエクスポート</button>
      <GanttChart
        ref={chartRef}
        rows={rows}
        option={option}
        theme="light"
        onTaskUpdate={handleTaskUpdate}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  )
}
```

---

## Vue 3 での使用例（公式ラッパー）

[`@mogura/moguchart-vue`](./packages/vue/README.ja.md) を使用すると、Composition API（`<script setup>`）でリアクティブな Props や Vue 標準のイベントハンドリング（`@task-update` 等）を直感的に扱えます：

```vue
<script setup lang="ts">
import { ref } from 'vue'
import {
  GanttChart,
  type GanttChartInstance,
  type GanttRow,
  type GanttChartOption,
  type TaskUpdateEventDetail,
} from '@mogura/moguchart-vue'
import { ExportPlugin } from '@mogura/moguchart-plugin-export'

const chartRef = ref<GanttChartInstance | null>(null)

const rows = ref<GanttRow[]>([
  {
    id: 'row-1',
    name: '開発フェーズ',
    tasks: [
      {
        id: 'task-1',
        name: '要件定義',
        start: new Date('2026-04-01'),
        end: new Date('2026-04-10'),
        progress: 100,
      },
    ],
  },
])

const option: GanttChartOption = {
  calendar: {
    start: new Date('2026-04-01'),
    end: new Date('2026-04-30'),
    pxPerDay: 40,
  },
  plugins: [new ExportPlugin()],
}

const handleTaskUpdate = (detail: TaskUpdateEventDetail) => {
  console.log('タスクが更新されました:', detail)
}

const handleExportPng = async () => {
  await chartRef.value?.exportImage({ format: 'png', scale: 2 })
}
</script>

<template>
  <div style="height: 600px;">
    <button @click="handleExportPng">PNGエクスポート</button>
    <GanttChart
      ref="chartRef"
      :rows="rows"
      :option="option"
      theme="light"
      @task-update="handleTaskUpdate"
      style="width: 100%; height: 100%;"
    />
  </div>
</template>
```

---

## Web Components (Vanilla JS) での使用例

フレームワークを使わずにプレーンな HTML / JavaScript で使用する場合：

```html
<!DOCTYPE html>
<html>
<head>
  <script type="module">
    import '@mogura/moguchart-core'

    const chart = document.querySelector('gantt-chart')
    chart.rows = [
      {
        id: 'row-1',
        name: 'タスクグループ 1',
        tasks: [
          {
            id: 'task-1',
            name: 'タスク 1',
            start: new Date('2026-04-01'),
            end: new Date('2026-04-10'),
          },
        ],
      },
    ]
    chart.option = {
      calendar: {
        start: new Date('2026-04-01'),
        end: new Date('2026-04-30'),
        pxPerDay: 40,
      },
    }

    chart.addEventListener('task-update', (e) => {
      console.log('Updated:', e.detail)
    })
  </script>
</head>
<body>
  <gantt-chart style="width: 100%; height: 500px;"></gantt-chart>
</body>
</html>
```

## 主要機能

### テーマ

ライト/ダーク/システムの3つのテーマモードをサポートしています。`customTheme` で個別のカラーを上書きすることも可能です。

```javascript
const option = {
  theme: 'dark', // 'light' | 'dark' | 'system'
  customTheme: {
    bg: '#1a1a2e',
    text: '#e0e0e0',
    currentTimeLine: '#ff6b6b',
  },
  // ...
}
```

### マイルストーン

`calendar.milestones` にマイルストーンの配列を渡すことで、チャート上に縦線とバッジを表示できます。マウスオーバーで透明度が変化するホバーエフェクト付きです。

```javascript
option.calendar.milestones = [
  {
    id: 'ms-1',
    name: 'α版リリース',
    start: new Date('2025-04-08'),
    color: '#8b5cf6',
    width: 4,
  },
  {
    id: 'ms-2',
    name: '正式リリース',
    start: new Date('2025-05-01'),
    color: '#10b981',
  },
]
```

### マーカー

各行の `markers` プロパティにマーカーの配列を渡すことで、タイムライン上に三角形アイコンとラベルを表示できます。

```javascript
const rows = [
  {
    id: 'row-1',
    name: 'タスクA',
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
    ],
  },
]
```

### タスクバーのパターン

タスクバーに13種類の塗りつぶしパターンを適用できます。プリセット定数も用意されています。

```javascript
import { PATTERN_DIAGONAL_STRIPE } from '@mogura/moguchart-core'

const task = {
  id: 't-1',
  name: 'WIP',
  start: new Date('2024-01-01'),
  end: new Date('2024-01-05'),
  style: 'background-color: #60a5fa',
  pattern: PATTERN_DIAGONAL_STRIPE, // プリセット使用
  // または直接指定:
  // pattern: { type: 'checkerboard', color: '#ffffff80' }
}
```

利用可能なパターン: `diagonal-stripe` `diagonal-stripe-thin` `diagonal-stripe-thick` `diagonal-stripe-reverse` `vertical-stripe` `horizontal-stripe` `checkerboard` `dots` `dots-dense` `triangle` `circle` `grid` `diagonal-grid`

### 行の並び替え

`enableRowReordering: true` でドラッグ＆ドロップによる行の並び替えが有効になります。

```javascript
const option = {
  enableRowReordering: true,
  // ...
}

chart.addEventListener('row-reordered', (e) => {
  console.log('並び替え後の行データ:', e.detail.rows)
})
```

### 行を跨いだタスク移動の制御 (enableCrossRowMove)

デフォルトでは、タスクバーを上下にドラッグすることで別の行へ移動できます（`enableCrossRowMove: true`）。`false` に設定すると同一行内での日付移動のみに制限されます。

```javascript
const option = {
  enableCrossRowMove: false, // 行間移動を無効化（横方向の移動のみに限定）
  // ...
}
```

### 複数タスクの選択＆一括操作

`Ctrl`（Mac: `Cmd`）キーを押しながらタスクバーをクリックして複数選択し、一括でドラッグ移動できます。

```javascript
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

### スナップ機能

`snapDuration`（分単位）でタスクのドラッグ時のスナップ間隔を制御できます。月表示モード（`pxPerMonth` 指定時）では、スナップは自動的に月単位になります。

```javascript
const option = {
  snapDuration: 60, // 1時間ごとにスナップ (デフォルト: 1440 = 1日)
  // ...
}
```

### 表示モード

#### 週表示モード

`calendar.showWeeks: true` で週番号表示の2段カレンダーになります。`pxPerDay` が20未満の場合は自動的に有効化されます。

```javascript
const option = {
  calendar: {
    start: new Date('2025-01-01'),
    end: new Date('2025-12-31'),
    pxPerDay: 15,
    showWeeks: true,
    weekStartDay: 1, // 1=月曜始まり (デフォルト)
    weekFormat: (weekNum) => `W${weekNum}`,
  },
}
```

#### 月表示モード

`calendar.pxPerMonth` を設定すると、各月が等幅で表示される月単位ビューになります。

```javascript
const option = {
  calendar: {
    start: new Date('2025-01-01'),
    end: new Date('2027-12-31'),
    pxPerDay: 1,
    pxPerMonth: 120, // 1ヶ月あたり120px
    showMonthsRow: true, // 上段=年、下段=月の2段ヘッダー
  },
}
```

### フォントサイズ倍率 (`fontScale`)

`fontScale` オプション（または CSS カスタムプロパティ `--moguchart-font-scale`）を指定することで、ガントチャート全体のフォントサイズを一括で拡大・縮小できます。

チャートの表示倍率（ズーム）に合わせて文字の大きさを連動させたい場合や、高密度・コンパクトな一覧表示を作成したい場合に最適です。

```javascript
const option = {
  // フォントサイズを80%に縮小
  fontScale: 0.8,
  // ...
}
```

CSS 変数から制御することも可能です：

```css
gantt-chart {
  --moguchart-font-scale: 0.85;
}
```

フォント倍率はカレンダーヘッダー（年月・週・日・時・バッジ）、行ヘッダー、WBSコードバッジ、ツリー開閉トグル、タスクバーラベル、進捗率ラベル、マーカー、ツールチップ、ドラッグ情報オーバーレイに自動反映されます。

### 依存関係線の設定

`dependency` オプションで依存関係線の表示や操作をカスタマイズできます。
矢印の表示/非表示や大きさ、接続コネクター、最長チェーン（クリティカルパス）の自動検出ハイライトを制御できます。
線のクリックによる選択（ハイライト表示）、選択時の削除「×」ボタン、`Delete` / `Backspace` キーによる直感的な削除に対応しています。

```javascript
const option = {
  dependency: {
    lineStyle: 'orthogonal', // 接続線の形状 ('orthogonal': 角丸直角折れ線, 'curve': ベジェ曲線)
    cornerRadius: 8, // 直角折れ線時の角丸半径 (px)
    showArrows: true, // 矢印を表示するかどうか (デフォルト: true)
    arrowSize: 10, // 矢印の大きさ (px、デフォルト: 8)
    showConnectors: true, // コネクター接続ポイント（丸印）を表示するかどうか (デフォルト: true)
    showCriticalPath: true, // クリティカルパス（最長チェーン）を自動計算しハイライト表示
    creatable: true, // コネクタからのドラッグによる依存関係作成を許可 (デフォルト: true)
    deletable: true, // 依存関係の削除を許可 (デフォルト: true)
    showDeleteButton: true, // 選択時の削除「×」ボタンを表示 (デフォルト: true)
  },
  // ...
}

// 依存関係の選択・削除イベント
chart.addEventListener('dependency-select', (e) => {
  console.log('選択された依存関係:', e.detail.selected)
})
chart.addEventListener('dependency-delete', (e) => {
  console.log('削除された依存関係:', e.detail.sourceTaskId, '->', e.detail.targetTaskId)
})
```

### タスク進捗管理

各タスクの `progress` プロパティ（`0` 〜 `100`）を設定することで、タスクバー上に進捗状況を視覚的に表示できます。`editable: true` を設定すると、進捗ハンドルのドラッグによる直感的な進捗率変更が可能になります。また、`showLabel: true` の場合、サマリータスクにも自動的に進捗ラベルが表示されます。

```javascript
import {
  clampProgress,
  calculateRowProgress,
  calculateWeightedRowProgress,
  calculateProjectProgress,
} from '@mogura/moguchart-core'

const option = {
  progress: {
    enabled: true,
    editable: true, // ドラッグによる進捗編集を有効化
    color: '#3b82f6', // 通常タスクの進捗バー色
    summaryColor: 'rgba(255, 255, 255, 0.35)', // サマリータスク専用の進捗バー色
    showLabel: true, // 進捗ラベルを表示 (例: "50%")
    showSummaryLabel: true, // サマリータスクにも進捗ラベルを表示するかどうか (デフォルト: true)
    labelPosition: 'inside', // 'inside' | 'right' | 'left' | 'center'
    snapStep: 5, // 5%刻みでスナップ
    indicatorPosition: 'full', // 'full' | 'bottom' | 'top'
  },
}

// 進捗変更イベント
chart.addEventListener('task-progress-change', (e) => {
  const { task, progress, originalProgress, cancelled } = e.detail
  console.log(`Task ${task.id}: ${originalProgress}% -> ${progress}%`)
})

// 行・プロジェクト全体の進捗率計算
const rowSimpleAvg = calculateRowProgress(row)
const rowWeightedAvg = calculateWeightedRowProgress(row)
const projectWeightedAvg = calculateProjectProgress(rows)
```

### 矩形範囲選択（ラバーバンド選択）

チャートの空白背景領域をマウスでドラッグすることで、矩形に重なる複数のタスクバーを一括選択できます。
`Shift`、`Ctrl`、または `Cmd` キーを押しながらドラッグすると、既存の選択を保持したまま追加選択できます。

```javascript
const option = {
  selection: {
    marquee: true, // 矩形範囲選択を有効化 (デフォルト: true)
    borderColor: '#3b82f6', // 選択枠線の色 (オプション)
    backgroundColor: 'rgba(59, 130, 246, 0.15)', // 選択背景色 (オプション)
  },
}

// バー選択変更イベント
chart.addEventListener('bar-selection-change', (e) => {
  console.log('Selected task IDs:', e.detail.selectedIds)
})
```

### ミニマップ（Overview Minimap）

チャート全体のタスク配置やマイルストーンを鳥瞰できるフローティング小窓型のミニマップを表示できます。

```javascript
const option = {
  minimap: {
    enabled: true,
    width: 240,
    preserveAspectRatio: true,
    resizable: true,
    collapsible: true,
    collapsed: false,
    position: { right: 16, bottom: 16 }, // 右下基準の初期位置 (px)
    opacity: 0.85,
  },
}

// ミニマップの操作イベント
chart.addEventListener('minimap-move', (e) => console.log('位置変更:', e.detail.position))
chart.addEventListener('minimap-resize', (e) => console.log('サイズ変更:', e.detail.width, e.detail.height))
chart.addEventListener('minimap-collapse', (e) => console.log('折りたたみ変更:', e.detail.collapsed))
```

### ロケール

ツールチップやドラッグオーバーレイの表示文字列を変更できます。`jaLocale`（デフォルト）と `enLocale` が内蔵されています。`MoguchartLocale` インターフェースを実装することでカスタムロケールも作成可能です。

```javascript
import { enLocale } from '@mogura/moguchart-core'

const option = {
  locale: enLocale,
  // ...
}
```

カスタムロケールの実装例（フランス語の場合）:

```typescript
import type { MoguchartLocale } from '@mogura/moguchart-core'

const frLocale: MoguchartLocale = {
  monthFormat: 'MMM YYYY',
  monthRowFormat: 'MMM',
  dateFormat: (d) => `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`,
  timeUnitDateFormat: (d) =>
    `${d.getDate()} ${['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc'][d.getMonth()]} ${d.getFullYear()}`,
  dateTimeFormat: (d) => {
    const date = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
    const h = d.getHours()
    const m = d.getMinutes()
    if (h === 0 && m === 0) return date
    return `${date} ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
  },
  yearMonthFormat: (d) => `${d.getFullYear()}/${d.getMonth() + 1}`,
  duration: {
    days: (n) => `${n} jour${n > 1 ? 's' : ''}`,
    hours: (n) => `${n} heure${n > 1 ? 's' : ''}`,
    minutes: (n) => `${n} minute${n > 1 ? 's' : ''}`,
    zero: '0 minute',
  },
  tooltip: {
    duration: (d) => `Durée: ${d} jour${d > 1 ? 's' : ''}`,
    progress: (p) => `Progression: ${p}%`,
  },
  dragOverlay: {
    noTitle: 'Sans titre',
    moveTo: (name) => `Déplacer vers: ${name}`,
    movingTasks: (c) => `Déplacement de ${c} tâche${c > 1 ? 's' : ''}`,
  },
}
```

### WBS（階層ツリー・展開/折りたたみ・サマリータスク）

各行に `parentId` を指定するだけで、無制限の階層ツリー（大工程 ＞ 中工程 ＞ タスク）を構築できます。
親行には自動的に開閉トグルボタン（▼/▶）が表示され、配下の子タスクから自動計算されたサマリータスクバー（ブラケット形状）が描画されます。親行自身に通常タスクが存在する場合、上段にサマリータスク、下段に通常タスクが並んで表示されます。

```javascript
const rows = [
  {
    id: 'project-1',
    name: 'プロジェクト Alpha',
    parentId: null,
    tasks: [], // autoSummary: true により配下タスクから自動集計
  },
  {
    id: 'task-1-1',
    name: '要件定義',
    parentId: 'project-1',
    tasks: [
      {
        id: 't-1',
        name: 'ヒアリング',
        start: new Date('2025-04-01'),
        end: new Date('2025-04-10'),
        progress: 100,
      },
    ],
  },
  {
    id: 'task-1-2',
    name: '基本設計',
    parentId: 'project-1',
    tasks: [
      {
        id: 't-2',
        name: '設計書作成',
        start: new Date('2025-04-11'),
        end: new Date('2025-04-25'),
        dependencies: ['t-1'],
        progress: 50,
      },
    ],
  },
]

const option = {
  tree: {
    enabled: true, // ツリー表示を有効化 (デフォルト: true)
    indentWidth: 16, // レベルあたりのインデント幅 (px)
    showToggleIcon: true, // 開閉トグルアイコン (デフォルト: true)
    showWbsCode: true, // "1", "1.1" 等のWBS番号を表示
    autoSummary: true, // 子タスクから期間・進捗率を自動集計
    summaryColor: '#334155', // サマリータスクバーの既定色 (行側の summaryColor で個別上書き可能)
  },
}

// 折りたたみ切り替えイベント
chart.addEventListener('row-toggle-collapse', (e) => {
  const { rowId, collapsed } = e.detail
  console.log(`行 ${rowId} が ${collapsed ? '折りたたまれました' : '展開されました'}`)
})
```

### パブリックメソッド

#### selectTask

指定したIDのタスクを選択状態にし、画面外の場合は自動スクロールします。

```javascript
const chart = document.querySelector('gantt-chart')
const found = chart.selectTask('task-1')
```

#### hitTest

クライアント座標（画面上のピクセル位置）から、対応する行IDと日時を返します。

```javascript
document.addEventListener('mousemove', (e) => {
  const result = chart.hitTest(e.clientX, e.clientY)
  if (result) {
    console.log(`行: ${result.rowId}, 日付: ${result.date}`)
  }
})
```

#### エクスポートプラグイン (`@mogura/moguchart-plugin-export`)

ガントチャート全体を PNG 画像または PDF 形式でエクスポートします。エクスポート機能はプラグイン（`@mogura/moguchart-plugin-export`）として提供されており、必要な場合のみ導入することでコア本体を超軽量に保てます。

```bash
pnpm add @mogura/moguchart-plugin-export
```

```javascript
import '@mogura/moguchart-core'
import { exportPlugin } from '@mogura/moguchart-plugin-export'

// チャートにプラグインを登録（chart.use または option.plugins）
chart.use(exportPlugin())

// PNG画像として自動ダウンロード
await chart.exportImage('png', {
  filename: 'gantt-chart',
  download: true,
  scale: 2,
})

// PDFとしてBlobを取得
const pdfBlob = await chart.exportImage('pdf', {
  filename: 'gantt-chart',
  download: true,
})
```

または、エクスポートボタン押下時など必要なタイミングでのみ遅延ロード（Dynamic Import）してスタンドアロン関数を実行することも可能です：

```javascript
const { exportChart } = await import('@mogura/moguchart-plugin-export')
await exportChart(chart, 'png', { download: true })
```

#### Excel エクスポートプラグイン (`@mogura/moguchart-plugin-excel`)

ガントチャートのデータを美しくスタイリングされた Excel（`.xlsx`）ファイルとして出力します。カレンダー日付列にタスク期間が色塗りされた「タイムライン付き工程表」をブラウザ完結で出力できます。日本語・英語・中国語（簡体字）などの多言語切り替えやカスタムロケールにも対応しています。

```bash
pnpm add @mogura/moguchart-plugin-excel
```

```javascript
import '@mogura/moguchart-core'
import { excelPlugin } from '@mogura/moguchart-plugin-excel'

// チャートにプラグインを登録
chart.use(excelPlugin({
  defaultFilename: 'プロジェクト工程表.xlsx',
  themeColor: '#3B82F6',
}))

// タイムライン付き工程表としてエクスポート（自動ダウンロード）
await chart.exportExcel()

// 英語ロケールでエクスポート
await chart.exportExcel({
  locale: 'en',
  filename: 'project-schedule.xlsx',
})
```

または動的インポートでスタンドアロン関数を呼び出すことも可能です：

```javascript
const { exportExcel } = await import('@mogura/moguchart-plugin-excel')
await exportExcel(chart, { filename: '工程表.xlsx', locale: 'ja' })
```

#### ズーム操作 (zoomToPercent / zoomToScale / zoomIn / zoomOut / resetZoom)

`zoom` オプションを有効にすることで、Ctrl/Cmd + マウスホイール、ショートカットキー（`Ctrl/Cmd + + / - / 0`）、またはパブリックメソッドによる柔軟なズーム（50%〜200%）が可能になります。カレンダー列幅・行ヘッダー幅・バー高さ・フォントサイズ（`scaleElements`）が一括連動します。

```javascript
const option = {
  zoom: {
    enabled: true, // ズーム機能を有効化 (デフォルト: false)
    minPercent: 50, // 最小倍率 (50%)
    maxPercent: 200, // 最大倍率 (200%)
    initialPercent: 100, // 初期倍率 (100%)
    shortcuts: true, // キーボードショートカット有効化
    scaleElements: {
      calendar: true,
      rowHeader: true,
      barHeight: true,
      fontScale: true,
    },
  },
}

// プログラムによるズーム操作
chart.zoomIn() // 1段階拡大 (Chrome準拠レベル)
chart.zoomOut() // 1段階縮小
chart.zoomToPercent(125) // 125% にズーム
chart.zoomToScale(1.5) // 1.5倍 にズーム
chart.zoomToFit() // 全タスクが表示領域に収まるよう自動調整
chart.resetZoom() // 100%（標準スケール）にリセット

// ズーム変更イベント
chart.addEventListener('zoom-change', (e) => {
  console.log('ズーム変更:', e.detail.zoomPercent + '%', 'scale:', e.detail.zoomScale)
})
```

#### 操作履歴・Undo / Redo (undo / redo / clearHistory)

ユーザーによる各種操作（タスク移動・リサイズ・進捗変更・削除、行並び替え、依存関係作成/削除）を自動記録し、プログラムまたはキーボード（`Ctrl+Z` / `Ctrl+Y`）から取り消し・やり直しが可能です。

```javascript
const option = {
  history: {
    enabled: true, // 履歴管理を有効化 (デフォルト: true)
    maxDepth: 50, // 保持する最大履歴数
    keyboard: true, // ショートカットを有効化
  },
}

// Undo / Redo の実行
if (chart.canUndo) {
  await chart.undo()
}
if (chart.canRedo) {
  await chart.redo()
}

// 履歴クリア
chart.clearHistory()

// 履歴状態の変更検知
chart.addEventListener('history-change', (e) => {
  undoBtn.disabled = !e.detail.canUndo
  redoBtn.disabled = !e.detail.canRedo
})
```

#### 依存関係の削除 (triggerDependencyDelete)

プログラムから特定の依存関係線を削除できます。

```javascript
chart.triggerDependencyDelete('task-1', 'task-2')
```

#### WBS・折りたたみ操作 (toggleRowCollapse / collapseAll / expandAll)

```javascript
// 特定の行の折りたたみを切り替え
chart.toggleRowCollapse('row-1') // トグル
chart.toggleRowCollapse('row-1', true) // 折りたたみ
chart.toggleRowCollapse('row-1', false) // 展開

// 一括操作
chart.collapseAll() // 子行を持つ親行をすべて折りたたみ
chart.expandAll() // すべての行を展開
```

#### getRowPositions

仮想コンテナ内の各行のY座標レイアウト情報（`top`, `height`, `bottom`）の配列を取得します。

```javascript
const positions = chart.getRowPositions()
console.log('行レイアウト情報:', positions)
```

### ユーティリティ関数

`@mogura/moguchart-core` では、ガントチャートの計算や状態管理に役立つ各種ユーティリティ関数をエクスポートしています。

```typescript
import {
  // WBS・階層ツリー計算
  computeRowLevels,
  computeRowWbsCodes,
  computeChildRowIds,
  computeVisibleTreeRows,
  computeSummaryTask,
  canDropRow,
  // クリティカルパス計算
  computeCriticalPath,
  // 進捗率計算
  clampProgress,
  calculateRowProgress,
  calculateWeightedRowProgress,
  calculateProjectProgress,
} from '@mogura/moguchart-core'

// 1. 各行のツリー階層レベル（深さ）の計算
const levels = computeRowLevels(rows) // Map<string, number> (rowId -> level: 0, 1, 2...)

// 2. WBSコード（"1", "1.1", "1.2" 等）の自動採番
const wbsCodes = computeRowWbsCodes(rows) // Map<string, string> (rowId -> wbsCode)

// 3. 指定行の子孫行IDの一覧取得
const allDescendants = computeChildRowIds('project-1', rows, true) // 再帰的に全子孫を取得
const directChildren = computeChildRowIds('project-1', rows, false) // 直下の子行のみ取得

// 4. 折りたたみ状態を考慮した表示行配列の抽出
const visibleRows = computeVisibleTreeRows(rows)

// 5. 配下タスクからのサマリータスク算出
const summaryTask = computeSummaryTask(childTasks, 'project-1') // 開始日・終了日・加重平均進捗率

// 6. 循環参照を防ぐ安全なD&Dドロップ可否判定
const isSafe = canDropRow('source-row-id', 'target-row-id', rows) // boolean

// 7. クリティカルパス（最長依存関係チェーン）の計算
const criticalTaskIds = computeCriticalPath(allTasks) // Set<string>
```

### キーボード操作

ガントチャートにフォーカスがある状態で、キーボードによるタスクのナビゲーション・選択・移動・削除・Undo/Redo・ズームが可能です。

| キー                   | 動作                         |
| :--------------------- | :--------------------------- |
| `←` `→`                | フォーカスをタスク間で移動   |
| `↑` `↓`                | フォーカスを別の行に移動     |
| `Enter` / `Space`      | フォーカス中のタスクを選択   |
| `Ctrl/Cmd + Enter`     | 選択をトグル（複数選択）     |
| `Shift + ←` `→`        | 選択中のタスクを移動         |
| `Delete` / `Backspace` | 選択中のタスクまたは依存関係線を削除 |
| `Ctrl+Z` / `Cmd+Z`     | 直前の操作を取り消す (Undo)  |
| `Ctrl+Y` / `Cmd+Shift+Z` | 直前の操作をやり直す (Redo)  |
| `Ctrl/Cmd + +`         | ズームイン（拡大）           |
| `Ctrl/Cmd + -`         | ズームアウト（縮小）         |
| `Ctrl/Cmd + 0`         | ズーム倍率を100%にリセット   |
| `Ctrl/Cmd + ホイール`  | ズームイン / ズームアウト    |
| `Escape`               | 選択・フォーカスをクリア     |

```javascript
const option = {
  keyboard: {
    enabled: true, // デフォルト: true
    moveStep: 60, // Shift+矢印キーでの移動量（分）
  },
  history: {
    keyboard: true, // Undo/Redo ショートカット (デフォルト: true)
  },
  zoom: {
    shortcuts: true, // ズームショートカット (デフォルト: true)
  },
  // ...
}
```

## 更新履歴

変更履歴の詳細は [CHANGELOG.ja.md](CHANGELOG.ja.md)（[英語版: CHANGELOG.md](CHANGELOG.md)）をご覧ください。

## ライセンス

MIT


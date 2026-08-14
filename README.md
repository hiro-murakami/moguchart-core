# @mogura/moguchart-core

[English](./README.en.md) | [Demo](https://moguchart-core.vercel.app/)

Vue, React, Angular, Svelte など、どのフレームワークでも動作する、軽量で高機能な Web Components 製ガントチャートコンポーネントです。Lit で構築されています。

- **デモ**: [https://moguchart-core.vercel.app/](https://moguchart-core.vercel.app/)

## 特徴

- 🚀 **フレームワーク非依存**: Web Components (Custom Elements) として実装されており、あらゆる環境で動作します。
- ⚡ **仮想スクロール**: 大量のタスクや行があってもスムーズに動作します。
- 🖱️ **インタラクティブ**:
  - ドラッグ＆ドロップによるタスク移動（行間移動対応）
  - ハンドル操作による期間リサイズ
  - ドラッグ＆ドロップによる行の並び替え
  - 列ヘッダーの幅リサイズ
  - 複数タスクの選択＆一括ドラッグ（Ctrl/Cmd + クリック）
  - ダブルクリックや右クリックイベントのハンドリング
- 🎨 **高度なカスタマイズ**:
  - タスクバー、行ヘッダー、ツールチップ、ドラッグ情報のコンテンツを自由にレンダリング可能
  - ライト/ダーク/システムテーマの切り替え＋カスタムカラーテーマ
  - タスクバーの塗りつぶしパターン（ストライプ、ドット、チェッカーボードなど13種類）
  - CSSによるスタイリング
- 🔗 **依存関係の表示**: タスク間の依存関係を矢印付き曲線で可視化（S字カーブ対応）。クリティカルパス（最長チェーン）の自動検出＋ハイライト表示
- 📅 **柔軟なカレンダー**:
  - 日単位 / 週単位 / 月単位の表示切り替え
  - ズームレベル（1日・1ヶ月あたりの幅）や表示期間の調整が可能
  - 現在時刻ラインの表示（バッジ付き、自動更新対応）
  - 祝日判定のカスタムロジック
  - 週の始まり曜日の設定
  - ロケール対応（日本語・英語、カスタムロケールも可能）
- 🏁 **マイルストーン**: チャート上にマイルストーン（縦線＋名前バッジ）を表示
- 📍 **マーカー**: 行のタイムライン上に三角形アイコンとラベルで目印を表示
- ✨ **高度な連携**:
  - 外部からのドラッグ＆ドロップによるタスク作成
  - タスクの移動/コピーモード
  - スナップ機能（時間単位でのグリッドスナップ）
  - 座標から行・日時を取得する `hitTest` メソッド
  - プログラムによるタスク選択＋自動スクロール (`selectTask`)
- ⌨️ **キーボード操作**: 矢印キーでのナビゲーション・選択・Shift+矢印キーでのタスク移動・Deleteキーでの削除

## インストール

```bash
pnpm add @mogura/moguchart-core
# または
npm install @mogura/moguchart-core
```

## APIリファレンス

詳細な API リファレンスは [API.md](./doc/API.md) を参照してください。

## Vue.js での使用例

Vue.js (Vue 3) で使用する場合のサンプルです。
Web Components を使用するため、`vite.config.ts` などでカスタム要素として認識させる設定が必要な場合があります。

```html
<script setup lang="ts">
  import { ref } from 'vue'
  import '@mogura/moguchart-core'
  import type {
    GanttRow,
    GanttChartOption,
    TaskUpdateEventDetail,
  } from '@mogura/moguchart-core'

  const rows = ref<GanttRow[]>([
    {
      id: 'row-1',
      name: 'Project A',
      tasks: [
        {
          id: 't-1',
          name: 'Task 1',
          start: new Date('2024-01-01'),
          end: new Date('2024-01-05'),
          style: 'background-color: #60a5fa',
        },
      ],
      markers: [
        {
          id: 'marker-1',
          name: 'レビュー期限',
          date: new Date('2024-01-03'),
          type: 'triangle-down',
          color: '#ef4444',
        },
      ],
    },
  ])

  const option = ref<GanttChartOption>({
    calendar: {
      start: new Date('2024-01-01'),
      end: new Date('2024-03-31'),
      pxPerDay: 30,
      showCurrentTime: true,
      milestones: [
        {
          id: 'ms-1',
          name: 'リリース',
          start: new Date('2024-02-01'),
          color: '#8b5cf6',
        },
      ],
    },
    bar: { height: 28 },
    rowHeader: { width: 200 },
    theme: 'system',
  })

  const handleTaskUpdate = (e: Event) => {
    const detail = (e as CustomEvent<TaskUpdateEventDetail>).detail
    console.log('Task updated:', detail)
  }
</script>

<template>
  <div style="height: 500px;">
    <gantt-chart
      :rows="rows"
      :option="option"
      @task-update="handleTaskUpdate"
    ></gantt-chart>
  </div>
</template>
```

## React での使用例

React で使用する場合のサンプルです。
Web Components のプロパティやイベントを扱うため、`ref` を使用して実装します。

```tsx
import { useEffect, useRef, useState } from 'react'
import '@mogura/moguchart-core'
import type {
  GanttRow,
  GanttChartOption,
  TaskUpdateEventDetail,
} from '@mogura/moguchart-core'

// TypeScript で使用する場合の型定義
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'gantt-chart': any
    }
  }
}

export default function App() {
  const chartRef = useRef<any>(null)

  const [rows] = useState<GanttRow[]>([
    {
      id: 'row-1',
      name: 'Project A',
      tasks: [
        {
          id: 't-1',
          name: 'Task 1',
          start: new Date('2024-01-01'),
          end: new Date('2024-01-05'),
          style: 'background-color: #60a5fa',
        },
      ],
      markers: [
        {
          id: 'marker-1',
          name: 'レビュー期限',
          date: new Date('2024-01-03'),
          type: 'triangle-down',
          color: '#ef4444',
        },
      ],
    },
  ])

  const [option] = useState<GanttChartOption>({
    calendar: {
      start: new Date('2024-01-01'),
      end: new Date('2024-03-31'),
      pxPerDay: 30,
      showCurrentTime: true,
      milestones: [
        {
          id: 'ms-1',
          name: 'リリース',
          start: new Date('2024-02-01'),
          color: '#8b5cf6',
        },
      ],
    },
    bar: { height: 28 },
    rowHeader: { width: 200 },
    theme: 'system',
  })

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return

    // プロパティの設定
    chart.rows = rows
    chart.option = option

    // イベントリスナーの設定
    const handleTaskUpdate = (e: Event) => {
      const detail = (e as CustomEvent<TaskUpdateEventDetail>).detail
      console.log('Task updated:', detail)
    }

    chart.addEventListener('task-update', handleTaskUpdate)

    return () => {
      chart.removeEventListener('task-update', handleTaskUpdate)
    }
  }, [rows, option])

  return (
    <div style={{ height: '500px' }}>
      <gantt-chart ref={chartRef}></gantt-chart>
    </div>
  )
}
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
  pattern: PATTERN_DIAGONAL_STRIPE,    // プリセット使用
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
  snapDuration: 60,    // 1時間ごとにスナップ (デフォルト: 1440 = 1日)
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
    weekStartDay: 1,   // 1=月曜始まり (デフォルト)
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
    pxPerMonth: 120,    // 1ヶ月あたり120px
    showMonthsRow: true, // 上段=年、下段=月の2段ヘッダー
  },
}
```

### 依存関係線の設定

`dependency` オプションで依存関係線の表示をカスタマイズできます。矢印の表示/非表示や大きさを制御できます。
右→左方向の依存関係では自動的にS字カーブで描画され、接触箇所は常に水平に接続します。

```javascript
const option = {
  dependency: {
    showArrows: true,  // 矢印を表示するかどうか (デフォルト: true)
    arrowSize: 12,     // 矢印の大きさ (px、デフォルト: 8)
  },
  // ...
}
```

### ロケール

ツールチップやドラッグオーバーレイの表示文字列を変更できます。`jaLocale`（デフォルト）と `enLocale` が内蔵されています。

```javascript
import { enLocale } from '@mogura/moguchart-core'

const option = {
  locale: enLocale,
  // ...
}
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

### キーボード操作

ガントチャートにフォーカスがある状態で、キーボードによるタスクのナビゲーション・選択・移動・削除が可能です。

| キー | 動作 |
| :--- | :--- |
| `←` `→` | フォーカスをタスク間で移動 |
| `↑` `↓` | フォーカスを別の行に移動 |
| `Enter` / `Space` | フォーカス中のタスクを選択 |
| `Ctrl/Cmd + Enter` | 選択をトグル（複数選択） |
| `Shift + ←` `→` | 選択中のタスクを移動 |
| `Delete` / `Backspace` | `task-delete` イベントを発火 |
| `Escape` | 選択・フォーカスをクリア |

```javascript
const option = {
  keyboard: {
    enabled: true,    // デフォルト: true
    moveStep: 60,     // Shift+矢印キーでの移動量（分）
  },
  // ...
}
```

## ライセンス

MIT

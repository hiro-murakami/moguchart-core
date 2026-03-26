# @mogura/moguchart

Vue, React, Angular, Svelte など、どのフレームワークでも動作する、軽量で高機能な Web Components 製ガントチャートコンポーネントです。Lit で構築されています。

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
- 🔗 **依存関係の表示**: タスク間の依存関係を曲線で可視化
- 📅 **柔軟なカレンダー**:
  - ズームレベル（1日あたりの幅）や表示期間の調整が可能
  - 現在時刻ラインの表示（バッジ付き、自動更新対応）
  - 祝日判定のカスタムロジック
- 🏁 **マイルストーン**: チャート上にマイルストーン（縦線＋名前バッジ）を表示
- 📍 **マーカー**: 行のタイムライン上に三角形アイコンとラベルで目印を表示
- ✨ **高度な連携**:
  - 外部からのドラッグ＆ドロップによるタスク作成
  - タスクの移動/コピーモード
  - スナップ機能（時間単位でのグリッドスナップ）
  - 座標から行・日時を取得する `hitTest` メソッド
  - プログラムによるタスク選択＋自動スクロール (`selectTask`)

## インストール

```bash
pnpm add @mogura/moguchart
# または
npm install @mogura/moguchart
```

## APIリファレンス

詳細な API リファレンスは [API.md](./API.md) を参照してください。

## Vue.js での使用例

Vue.js (Vue 3) で使用する場合のサンプルです。
Web Components を使用するため、`vite.config.ts` などでカスタム要素として認識させる設定が必要な場合があります。

```html
<script setup lang="ts">
  import { ref } from 'vue'
  import '@mogura/moguchart'
  import type {
    GanttRow,
    GanttChartOption,
    TaskUpdateEventDetail,
  } from '@mogura/moguchart'

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
import '@mogura/moguchart'
import type {
  GanttRow,
  GanttChartOption,
  TaskUpdateEventDetail,
} from '@mogura/moguchart'

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
import { PATTERN_DIAGONAL_STRIPE } from '@mogura/moguchart'

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

`snapDuration`（分単位）でタスクのドラッグ時のスナップ間隔を制御できます。

```javascript
const option = {
  snapDuration: 60,    // 1時間ごとにスナップ (デフォルト: 1440 = 1日)
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

## ライセンス

MIT

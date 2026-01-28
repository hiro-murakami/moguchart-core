# @mogura/moguchart

Vue, React, Angular, Svelte など、どのフレームワークでも動作する、軽量で高機能な Web Components 製ガントチャートコンポーネントです。Lit で構築されています。

## 特徴

- 🚀 **フレームワーク非依存**: Web Components (Custom Elements) として実装されており、あらゆる環境で動作します。
- ⚡ **仮想スクロール**: 大量のタスクや行があってもスムーズに動作します。
- 🖱️ **インタラクティブ**:
  - ドラッグ＆ドロップによるタスク移動（行間移動対応）
  - ハンドル操作による期間リサイズ
  - ダブルクリックや右クリックイベントのハンドリング
- 🎨 **高度なカスタマイズ**:
  - タスクバー、行ヘッダー、ツールチップ、ドラッグ情報のコンテンツを自由にレンダリング可能
  - CSSによるスタイリング
- 🔗 **依存関係の表示**: タスク間の依存関係を曲線で可視化
- 📅 **柔軟なカレンダー**: ズームレベル（1日あたりの幅）や表示期間の調整が可能

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
    },
  ])

  const option = ref<GanttChartOption>({
    calendar: {
      start: new Date('2024-01-01'),
      pxPerDay: 30,
    },
    bar: { height: 28 },
    rowHeader: { width: 200 },
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
    },
  ])

  const [option] = useState<GanttChartOption>({
    calendar: {
      start: new Date('2024-01-01'),
      pxPerDay: 30,
    },
    bar: { height: 28 },
    rowHeader: { width: 200 },
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

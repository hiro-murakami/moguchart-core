# @mogura/moguchart-react

[`@mogura/moguchart-core`](https://github.com/hiro-murakami/moguchart-core) の公式 React ラッパーコンポーネントです。

Lit 公式の `@lit/react` をベースに設計されており、Web Components の高いパフォーマンスとフレームワーク非依存の柔軟性を保ちつつ、React アプリケーションで型安全かつ直感的にガントチャートを扱うことができます。

---

## 特徴

- ⚛️ **ネイティブな React 開発体験**: JSX で直感的にプロパティ・イベントハンドラーを記述可能
- 🎯 **完全な型補完**: TypeScript による強力な型推論と自動補完
- 🔄 **ライフサイクル同期**: React の状態変更（State / Props）と Web Components のレンダリングを自動同期
- ⚡ **命令的メソッドへのアクセス**: `ref` を介して `chart.use()`, `chart.exportImage()`, `chart.selectTask()` などを直接呼び出し可能
- 📦 **Re-export**: `@mogura/moguchart-core` の型定義や定数をすべて再エクスポートしているため、本パッケージのみのインストールで開発可能

---

## インストール

```bash
# pnpm
pnpm add @mogura/moguchart-react @mogura/moguchart-core react react-dom

# npm
npm install @mogura/moguchart-react @mogura/moguchart-core react react-dom

# yarn
yarn add @mogura/moguchart-react @mogura/moguchart-core react react-dom
```

---

## 基本的な使い方

```tsx
import React, { useState } from 'react'
import {
  GanttChart,
  type GanttRow,
  type GanttChartOption,
  type TaskUpdateEventDetail,
} from '@mogura/moguchart-react'

export function MyGanttView() {
  const [rows, setRows] = useState<GanttRow[]>([
    {
      id: 'row-1',
      name: '機能開発フェーズ',
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
          name: 'UI/UX 設計',
          start: new Date('2026-04-08'),
          end: new Date('2026-04-20'),
          progress: 50,
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
  }

  const handleTaskUpdate = (e: CustomEvent<TaskUpdateEventDetail>) => {
    console.log('Task updated:', e.detail)
  }

  return (
    <div style={{ width: '100%', height: '600px' }}>
      <GanttChart
        rows={rows}
        option={option}
        theme="light"
        onTaskUpdate={handleTaskUpdate}
        onTaskClick={(e) => console.log('Task clicked:', e.detail)}
      />
    </div>
  )
}
```

---

## 主な Props

| Prop 名 | 型 | 説明 |
|---|---|---|
| `rows` | `GanttRow[]` | ガントチャートの行・タスクデータ |
| `option` | `GanttChartOption` | カレンダー、ズーム、履歴、依存関係等の各種設定 |
| `theme` | `'light' \| 'dark'` | カラーテーマ |
| `selectedRowIds` | `string[]` | 選択中の行ID一覧 |
| `selectedTaskIds` | `string[]` | 選択中のタスクID一覧 |
| `selectedDependency` | `{ sourceTaskId: string; targetTaskId: string } \| null` | 選択中の依存関係線（ハイライト状態） |
| `externalDraggingTask` | `GanttTask \| null` | 外部からドラッグ中のタスクプレビュー |

---

## 命令的 API（ref を介した操作）

`ref` を介して `GanttChartElement` インスタンスを取得することで、Undo / Redo やズーム、エクスポートなどの命令的メソッドを呼び出せます。

```tsx
import React, { useRef } from 'react'
import { GanttChart, type GanttChartElement } from '@mogura/moguchart-react'

export function GanttToolbar() {
  const chartRef = useRef<GanttChartElement>(null)

  return (
    <div>
      <button onClick={() => chartRef.current?.undo()}>取り消し (Undo)</button>
      <button onClick={() => chartRef.current?.redo()}>やり直し (Redo)</button>
      <button onClick={() => chartRef.current?.zoomIn()}>ズームイン</button>
      <button onClick={() => chartRef.current?.zoomOut()}>ズームアウト</button>
      <button onClick={() => chartRef.current?.resetZoom()}>ズームリセット</button>
      <GanttChart ref={chartRef} rows={[]} />
    </div>
  )
}
```

---

## プラグイン（エクスポート機能）との連携

PNG や PDF のエクスポートを行う場合は、`@mogura/moguchart-plugin-export` を組み合わせます。

```tsx
import React, { useRef } from 'react'
import { GanttChart, type GanttChartElement, type GanttChartOption } from '@mogura/moguchart-react'
import { exportPlugin } from '@mogura/moguchart-plugin-export'

export function ExportableGantt() {
  const chartRef = useRef<GanttChartElement>(null)

  const option: GanttChartOption = {
    calendar: {
      start: new Date('2026-04-01'),
      end: new Date('2026-04-30'),
    },
    plugins: [exportPlugin()],
  }

  const handleExportPng = async () => {
    if (chartRef.current) {
      await chartRef.current.exportImage('png', {
        filename: 'my-schedule',
        download: true,
        normalizeZoom: true, // ズーム倍率に関わらず標準スケールで出力
      })
    }
  }

  return (
    <div>
      <button onClick={handleExportPng}>PNGダウンロード</button>
      <GanttChart ref={chartRef} rows={[]} option={option} />
    </div>
  )
}
```

---

## サポートされているイベント

| Prop 名 | 説明 |
|---|---|
| `onTaskUpdate` | タスクのドラッグ移動やリサイズ完了時 |
| `onTaskClick` | タスククリック時 |
| `onTaskDblClick` | タスクダブルクリック時 |
| `onTaskContextMenu` | タスク右クリック（コンテキストメニュー）時 |
| `onTaskDelete` | タスク削除時 |
| `onTaskDrop` | タスクを行間等にドロップした時 |
| `onTaskProgressChange` | 進捗率変更時 |
| `onBarHover` | タスクバーホバー時 |
| `onBarSelectionChange` | タスク選択状態の変更時 |
| `onRowHeaderClick` | 行ヘッダークリック時 |
| `onRowHeaderDblClick` | 行ヘッダーダブルクリック時 |
| `onRowHeaderContextMenu` | 行ヘッダー右クリック時 |
| `onRowHeaderResize` | 行ヘッダーリサイズ時 |
| `onRowReordered` | 行の並び順変更時 |
| `onRowSelectionChange` | 行選択状態の変更時 |
| `onRowToggleCollapse` | 行の開閉時（WBS） |
| `onDependencyCreate` | 依存関係（リンク）作成時 |
| `onDependencyClick` | 依存関係クリック時 |
| `onDependencySelect` | 依存関係の選択状態変更時（ハイライト・削除ボタン表示） |
| `onDependencyDelete` | 依存関係削除時 |
| `onMarkerDblClick` | マーカーダブルクリック時 |
| `onMarkerContextMenu` | マーカー右クリック時 |
| `onZoomChange` | ズーム倍率変更時 |
| `onCommand` | 操作コマンド実行時（Undo / Redo 対象の操作完了時） |
| `onHistoryChange` | 履歴スタック変更時（Undo / Redo 可否状態の更新時） |
| `onMinimapMove` | ミニマップスクロール時 |
| `onMinimapResize` | ミニマップリサイズ時 |
| `onMinimapCollapse` | ミニマップ折りたたみ時 |
| `onChartContextMenu` | チャート背景右クリック時 |

---

## ライセンス

[MIT](../../LICENSE) © Murakami Hiroyuki

# @mogura/moguchart-react

[`@mogura/moguchart-core`](https://github.com/hiro-murakami/moguchart-core) の公式 React ラッパーコンポーネントです。

Lit 公式の `@lit/react` をベースに設計されており、Web Components の高いパフォーマンスとフレームワーク非依存の柔軟性を保ちつつ、React アプリケーションで型安全かつ直感的にガントチャートを扱うことができます。

---

## 特徴

- ⚛️ **ネイティブな React 開発体験**: JSX で直感的にプロパティ・イベントハンドラーを記述可能
- 🎯 **完全な型補完**: TypeScript による強力な型推論と自動補完
- 🔄 **ライフサイクル同期**: React の状態変更（State / Props）と Web Components のレンダリングを自動同期
- ⚡ **命令的メソッドへのアクセス**: `ref` を介して `chart.use()`, `chart.exportImage()`, `chart.exportExcel()`, `chart.selectTask()` などを直接呼び出し可能
- 🔌 **プラグイン連携**: `@mogura/moguchart-plugin-export` (PNG/PDF) や `@mogura/moguchart-plugin-excel` (Excel) などの公式プラグインをシームレスに利用可能
- 📈 **予実管理 (Baseline) 対応**: `task.baseline` と `option.baseline` による計画 vs 実績の同時可視化と遅延検知に対応
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
      <button onClick={() => chartRef.current?.scrollToTask('task-1')}>タスクへ移動</button>
      <GanttChart ref={chartRef} rows={[]} />
    </div>
  )
}
```

### 利用可能な主なメソッド・プロパティ

`ref.current` 経由で以下のメソッドを直接呼び出すことができます：

- **操作履歴 (Undo / Redo)**: `undo()`, `redo()`, `clearHistory()`, `recordCommand(cmd)`, `canUndo`, `canRedo`
- **ズーム操作**: `zoomIn()`, `zoomOut()`, `zoomToPercent(percent)`, `zoomToScale(scale)`, `resetZoom()`, `zoomToFit()`, `getZoomPercent()`, `getZoomScale()`
- **スクロール・選択**: `scrollToTask(taskId)`, `scrollToPosition(pos)`, `resetScroll()`, `selectTask(taskId)`
- **WBS・折りたたみ**: `toggleRowCollapse(rowId, collapsed?)`, `collapseAll()`, `expandAll()`, `getRowPositions()`
- **依存関係操作**: `triggerDependencyDelete(sourceTaskId, targetTaskId)`, `selectDependency(...)`, `clearDependencySelection()`
- **画像・PDFエクスポート**: `exportImage(format, options)`（`@mogura/moguchart-plugin-export` 導入時）
- **Excelエクスポート**: `exportExcel(options)`（`@mogura/moguchart-plugin-excel` 導入時）

---

## 予実管理（Baseline / 計画 vs 実績の可視化）

タスクに当初計画（`baseline`）を定義し、`option.baseline` を設定することで、計画日程と現在の実績日程を同一レーン上に同時描画・比較できます。遅延タスク（`task.end > baseline.end`）は視覚的にハイライトされ、ツールチップに遅延日数などが自動表示されます。

```tsx
import React, { useState } from 'react'
import {
  GanttChart,
  type GanttRow,
  type GanttChartOption,
} from '@mogura/moguchart-react'

export function BaselineGanttView() {
  const [rows] = useState<GanttRow[]>([
    {
      id: 'row-1',
      name: '開発フェーズ',
      tasks: [
        {
          id: 'task-1',
          name: 'コア機能実装',
          start: new Date('2026-04-05'),
          end: new Date('2026-04-18'), // 当初予定より遅延
          progress: 60,
          baseline: {
            start: new Date('2026-04-01'),
            end: new Date('2026-04-12'),
            progress: 100,
          },
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
    baseline: {
      visible: true,          // ベースライン表示
      position: 'bottom',     // 'bottom' (下部) | 'top' (上部) | 'overlay' (重ねて表示)
      highlightDelay: true,   // 遅延タスクをハイライト強調
      delayColor: '#EF4444',  // 遅延強調アクセント色
    },
  }

  return (
    <div style={{ width: '100%', height: '500px' }}>
      <GanttChart rows={rows} option={option} />
    </div>
  )
}
```

---

## プラグイン（エクスポート機能）との連携

### PNG / PDF エクスポート (`@mogura/moguchart-plugin-export`)

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

  const handleExportPdf = async () => {
    if (chartRef.current) {
      await chartRef.current.exportImage('pdf', {
        filename: 'my-schedule',
        download: true,
      })
    }
  }

  return (
    <div>
      <button onClick={handleExportPng}>PNGダウンロード</button>
      <button onClick={handleExportPdf}>PDFダウンロード</button>
      <GanttChart ref={chartRef} rows={[]} option={option} />
    </div>
  )
}
```

### Excel (.xlsx) タイムライン工程表エクスポート (`@mogura/moguchart-plugin-excel`)

```tsx
import React, { useRef } from 'react'
import { GanttChart, type GanttChartElement, type GanttChartOption } from '@mogura/moguchart-react'
import { excelPlugin } from '@mogura/moguchart-plugin-excel'

export function ExcelExportGantt() {
  const chartRef = useRef<GanttChartElement>(null)

  const option: GanttChartOption = {
    calendar: {
      start: new Date('2026-04-01'),
      end: new Date('2026-04-30'),
    },
    plugins: [excelPlugin({
      defaultFilename: 'プロジェクト工程表.xlsx',
      defaultSheetName: '工程表',
      themeColor: '#3B82F6',
    })],
  }

  const handleExportExcel = async () => {
    if (chartRef.current) {
      await chartRef.current.exportExcel({
        filename: '工程表_最新.xlsx',
        locale: 'ja', // 'ja' | 'en' | 'zh'
        download: true,
      })
    }
  }

  return (
    <div>
      <button onClick={handleExportExcel}>Excel工程表ダウンロード</button>
      <GanttChart ref={chartRef} rows={[]} option={option} />
    </div>
  )
}
```

---

## サポートされているイベント

React では標準のイベント Props としてキャメルケース（`onTaskUpdate` 等）で購読できます：

| Prop 名 | 説明 | イベント引数型 |
|---|---|---|
| `onTaskUpdate` | タスクのドラッグ移動やリサイズ完了時 | `CustomEvent<TaskUpdateEventDetail>` |
| `onTaskClick` | タスククリック時 | `CustomEvent<TaskClickEventDetail>` |
| `onTaskDblClick` | タスクダブルクリック時 | `CustomEvent<TaskClickEventDetail>` |
| `onTaskContextMenu` | タスク右クリック（コンテキストメニュー）時 | `CustomEvent<TaskContextMenuEventDetail>` |
| `onTaskDelete` | タスク削除時 | `CustomEvent<TaskDeleteEventDetail>` |
| `onTaskDrop` | タスクを行間等にドロップした時 | `CustomEvent<TaskDropEventDetail>` |
| `onTaskProgressChange` | 進捗率変更時 | `CustomEvent<TaskProgressChangeEventDetail>` |
| `onBarHover` | タスクバーホバー時 | `CustomEvent<BarHoverEventDetail>` |
| `onBarSelectionChange` | タスク選択状態の変更時 | `CustomEvent<BarSelectionChangeEventDetail>` |
| `onRowHeaderClick` | 行ヘッダークリック時 | `CustomEvent<RowHeaderClickEventDetail>` |
| `onRowHeaderDblClick` | 行ヘッダーダブルクリック時（`contentTarget` で行名要素を参照可能） | `CustomEvent<RowHeaderDblClickEventDetail>` |
| `onRowHeaderContextMenu` | 行ヘッダー右クリック時 | `CustomEvent<RowHeaderContextMenuEventDetail>` |
| `onRowHeaderResize` | 行ヘッダーリサイズ時 | `CustomEvent<RowHeaderResizeEventDetail>` |
| `onRowReordered` | 行の並び順変更時 | `CustomEvent<RowReorderEventDetail>` |
| `onRowSelectionChange` | 行選択状態の変更時 | `CustomEvent<RowSelectionChangeEventDetail>` |
| `onRowToggleCollapse` | 行の開閉時（WBS） | `CustomEvent<RowToggleCollapseEventDetail>` |
| `onDependencyCreate` | 依存関係（リンク）作成時 | `CustomEvent<DependencyCreateEventDetail>` |
| `onDependencyClick` | 依存関係クリック時 | `CustomEvent<DependencyClickEventDetail>` |
| `onDependencySelect` | 依存関係の選択状態変更時（ハイライト・削除ボタン表示） | `CustomEvent<DependencySelectEventDetail>` |
| `onDependencyDelete` | 依存関係削除時 | `CustomEvent<DependencyDeleteEventDetail>` |
| `onMarkerDblClick` | マーカーダブルクリック時 | `CustomEvent<MarkerDblClickEventDetail>` |
| `onMarkerContextMenu` | マーカー右クリック時 | `CustomEvent<MarkerContextMenuEventDetail>` |
| `onZoomChange` | ズーム倍率変更時 | `CustomEvent<ZoomChangeEventDetail>` |
| `onCommand` | 操作コマンド実行時（Undo / Redo 対象の操作完了時） | `CustomEvent<CommandEventDetail>` |
| `onHistoryChange` | 履歴スタック変更時（Undo / Redo 可否状態の更新時） | `CustomEvent<HistoryChangeEventDetail>` |
| `onMinimapMove` | ミニマップスクロール時 | `CustomEvent<MinimapMoveEventDetail>` |
| `onMinimapResize` | ミニマップリサイズ時 | `CustomEvent<MinimapResizeEventDetail>` |
| `onMinimapCollapse` | ミニマップ折りたたみ時 | `CustomEvent<MinimapCollapseEventDetail>` |
| `onChartContextMenu` | チャート背景右クリック時 | `CustomEvent<ChartContextMenuEventDetail>` |

---

## ライセンス

[MIT](../../LICENSE) © Murakami Hiroyuki

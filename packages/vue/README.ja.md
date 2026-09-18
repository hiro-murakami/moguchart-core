# @mogura/moguchart-vue

軽量・高速なWeb Components製ガントチャート **[Moguchart](https://github.com/hiro-murakami/moguchart-core)**（`@mogura/moguchart-core`）の **公式 Vue 3 ラッパーコンポーネント** です。

Vue 3 のリアクティビティシステム（Composition API `<script setup>` および Options API）に完全準拠し、型安全な Props、テンプレート Ref、Vue カスタムイベント（`@task-update`, `@task-click` 等）を直感的に扱えます。

[English Documentation](./README.md)

---

## 主な特徴

- ⚡ **Vue 3 完全対応**: Composition API（`<script setup>`）および Options API の双方でスムーズに動作
- 🔒 **充実した TypeScript 型定義**: Props、Emits、コンポーネントインスタンスの型推論に対応
- 🔄 **リアクティブなプロパティ同期**: `rows`, `option`, `theme` などの変更を基底の Web Component に自動反映
- 🎯 **直感的なイベントバインディング**: Vue 標準のイベントハンドリング（`@task-update="onUpdate"` など）
- 🛠️ **命令的メソッドの呼び出し**: Template Ref 経由で `exportImage`, `use`, `zoomTo`, `resetScroll` などのメソッドにアクセス可能
- 🔌 **プラグイン連携**: `@mogura/moguchart-plugin-export` などの公式プラグインをシームレスに利用可能

---

## インストール

```bash
# npm
npm install @mogura/moguchart-vue @mogura/moguchart-core vue

# pnpm
pnpm add @mogura/moguchart-vue @mogura/moguchart-core vue

# yarn
yarn add @mogura/moguchart-vue @mogura/moguchart-core vue
```

---

## クイックスタート

### `<script setup>` での基本的な使い方

```vue
<script setup lang="ts">
import { ref } from 'vue'
import {
  GanttChart,
  type GanttRow,
  type GanttChartOption,
  type TaskUpdateEventDetail,
  type TaskClickEventDetail,
} from '@mogura/moguchart-vue'

const rows = ref<GanttRow[]>([
  {
    id: 'row-1',
    name: '要件定義フェーズ',
    tasks: [
      {
        id: 'task-1',
        name: 'ヒアリング',
        start: new Date('2026-04-01'),
        end: new Date('2026-04-10'),
        progress: 100,
      },
      {
        id: 'task-2',
        name: '基本設計',
        start: new Date('2026-04-11'),
        end: new Date('2026-04-20'),
        progress: 40,
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

const handleTaskUpdate = (detail: TaskUpdateEventDetail) => {
  console.log('タスクが更新されました:', detail)
}

const handleTaskClick = (detail: TaskClickEventDetail) => {
  console.log('タスクがクリックされました:', detail.task)
}
</script>

<template>
  <div style="width: 100%; height: 500px;">
    <GanttChart
      :rows="rows"
      :option="option"
      theme="light"
      @task-update="handleTaskUpdate"
      @task-click="handleTaskClick"
      style="width: 100%; height: 100%;"
    />
  </div>
</template>
```

---

## グローバル登録（Vue プラグイン）

アプリケーション全体で `<GanttChart />` を使いたい場合は、Vue プラグインとして登録できます：

```ts
import { createApp } from 'vue'
import App from './App.vue'
import MoguchartVue from '@mogura/moguchart-vue'

const app = createApp(App)
app.use(MoguchartVue)
app.mount('#app')
```

登録後は各 Vue コンポーネントで import せずに `<GanttChart />` を使用できます。

---

## プラグインの利用（エクスポート機能など）

`option.plugins` に渡す宣言的な登録と、`ref` を介した命令的呼び出しに対応しています：

```vue
<script setup lang="ts">
import { ref } from 'vue'
import {
  GanttChart,
  type GanttChartInstance,
  type GanttChartOption,
} from '@mogura/moguchart-vue'
import { ExportPlugin } from '@mogura/moguchart-plugin-export'

const chartRef = ref<GanttChartInstance | null>(null)

const option: GanttChartOption = {
  calendar: {
    start: new Date('2026-04-01'),
    end: new Date('2026-04-30'),
    pxPerDay: 40,
  },
  plugins: [new ExportPlugin()],
}

const handleExportPng = async () => {
  await chartRef.value?.exportImage({ format: 'png', scale: 2 })
}

const handleExportPdf = async () => {
  await chartRef.value?.exportImage({ format: 'pdf' })
}
</script>

<template>
  <div>
    <button @click="handleExportPng">PNG画像エクスポート</button>
    <button @click="handleExportPdf">PDFエクスポート</button>

    <GanttChart
      ref="chartRef"
      :rows="[]"
      :option="option"
      style="width: 100%; height: 600px;"
    />
  </div>
</template>
```

---

## サポートされているイベント

`@mogura/moguchart-core` が発行するすべてのカスタムイベントを Vue イベントとして購読できます：

| Vue イベント | 説明 | 引数型 |
|---|---|---|
| `@task-update` | タスクの期間移動・リサイズ完了時 | `TaskUpdateEventDetail` |
| `@task-click` | タスクバークリック時 | `TaskClickEventDetail` |
| `@task-dblclick` | タスクバーダブルクリック時 | `TaskClickEventDetail` |
| `@task-contextmenu` | タスクバー右クリック時 | `TaskContextMenuEventDetail` |
| `@task-drop` | タスクドロップ時 | `TaskDropEventDetail` |
| `@task-delete` | タスク削除キー（Delete/Backspace）押下時 | `TaskDeleteEventDetail` |
| `@task-progress-change` | タスク進捗率ハンドル操作完了時 | `TaskProgressChangeEventDetail` |
| `@bar-hover` | タスクバーホバー時 | `BarHoverEventDetail` |
| `@row-reordered` | 行のドラッグ＆ドロップ並び替え完了時 | `RowReorderEventDetail` |
| `@row-header-resize` | 行ヘッダー幅のリサイズ完了時 | `RowHeaderResizeEventDetail` |
| `@row-selection-change` | 行の選択状態変更時 | `RowSelectionChangeEventDetail` |
| `@bar-selection-change` | タスクの選択状態変更時 | `BarSelectionChangeEventDetail` |
| `@row-toggle-collapse` | ツリー行の展開・折りたたみ時 | `RowToggleCollapseEventDetail` |
| `@dependency-create` | 依存関係コネクタの接続完了時 | `DependencyCreateEventDetail` |
| `@dependency-click` | 依存関係線のクリック時 | `DependencyClickEventDetail` |
| `@zoom-change` | カレンダースケール変更時 | `ZoomChangeEventDetail` |
| `@chart-contextmenu` | チャート背景の右クリック時 | `ChartContextMenuEventDetail` |

---

## ライセンス

MIT © [Murakami Hiroyuki](https://github.com/hiro-murakami)

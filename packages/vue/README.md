# @mogura/moguchart-vue

The official Vue 3 wrapper component for **[Moguchart](https://github.com/hiro-murakami/moguchart-core)** (`@mogura/moguchart-core`).

Easily integrate a high-performance, responsive Gantt chart Web Component into your Vue 3 applications with full TypeScript support, reactive props, template refs, and Vue custom event bindings.

[日本語版ドキュメントはこちら (Japanese documentation)](./README.ja.md)

---

## Features

- ⚡ **Full Vue 3 Integration**: Works seamlessly with Vue 3 Composition API (`<script setup>`) and Options API.
- 🔒 **Type-Safe**: Full TypeScript definitions for props, emits, and instance methods.
- 🔄 **Reactive Sync**: Props (`rows`, `option`, `theme`, etc.) are automatically synced to the underlying Web Component.
- 🎯 **Vue Event Bindings**: Standard Vue event listening (`@task-update="onUpdate"`, `@task-click="onClick"`, etc.).
- 🛠️ **Imperative Methods**: Access Web Component methods (`exportImage`, `use`, `zoomTo`, `resetScroll`, etc.) via template refs.
- 🔌 **Plugin Support**: Re-exports all `@mogura/moguchart-core` types and integrates smoothly with `@mogura/moguchart-plugin-export`.

---

## Installation

```bash
# npm
npm install @mogura/moguchart-vue @mogura/moguchart-core vue

# pnpm
pnpm add @mogura/moguchart-vue @mogura/moguchart-core vue

# yarn
yarn add @mogura/moguchart-vue @mogura/moguchart-core vue
```

---

## Quick Start

### Basic Usage with `<script setup>`

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
    name: 'Planning Phase',
    tasks: [
      {
        id: 'task-1',
        name: 'Requirement Definition',
        start: new Date('2026-04-01'),
        end: new Date('2026-04-10'),
        progress: 100,
      },
      {
        id: 'task-2',
        name: 'Architecture Design',
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
  console.log('Task updated:', detail)
}

const handleTaskClick = (detail: TaskClickEventDetail) => {
  console.log('Task clicked:', detail.task)
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

## Global Registration (Vue Plugin)

You can also register `GanttChart` globally in your Vue app:

```ts
import { createApp } from 'vue'
import App from './App.vue'
import MoguchartVue from '@mogura/moguchart-vue'

const app = createApp(App)
app.use(MoguchartVue)
app.mount('#app')
```

Then use `<GanttChart />` directly in any template without importing it.

---

---

## Main Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `rows` | `GanttRow[]` | `[]` | Array of Gantt chart rows and tasks |
| `option` | `GanttChartOption` | **Required** | Options for calendar, zoom, history, dependencies, etc. |
| `theme` | `'light' \| 'dark'` | `'light'` | Color theme |
| `selectedRowIds` | `string[]` | `[]` | Array of selected row IDs |
| `selectedTaskIds` | `string[]` | `[]` | Array of selected task IDs |
| `selectedDependency` | `{ sourceTaskId: string; targetTaskId: string } \| null` | `null` | Currently selected dependency connection (highlighted) |
| `externalDraggingTask` | `GanttTask \| null` | `null` | Task currently dragged from an external source |

---

## Imperative Operations via Template Ref (Undo, Redo, Zoom, etc.)

Access the `GanttChartInstance` via Template Ref (`ref="chartRef"`) to call imperative methods such as undo/redo, zoom, collapsing, and exports:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { GanttChart, type GanttChartInstance } from '@mogura/moguchart-vue'

const chartRef = ref<GanttChartInstance | null>(null)

const handleUndo = async () => {
  if (chartRef.value?.canUndo) {
    await chartRef.value.undo()
  }
}

const handleRedo = async () => {
  if (chartRef.value?.canRedo) {
    await chartRef.value.redo()
  }
}

const handleZoomIn = () => chartRef.value?.zoomIn()
const handleZoomOut = () => chartRef.value?.zoomOut()
const handleResetZoom = () => chartRef.value?.resetZoom()
</script>

<template>
  <div>
    <div class="toolbar">
      <button :disabled="!chartRef?.canUndo" @click="handleUndo">Undo</button>
      <button :disabled="!chartRef?.canRedo" @click="handleRedo">Redo</button>
      <button @click="handleZoomIn">Zoom In</button>
      <button @click="handleZoomOut">Zoom Out</button>
      <button @click="handleResetZoom">Reset Zoom</button>
    </div>

    <GanttChart ref="chartRef" :rows="[]" :option="{}" />
  </div>
</template>
```

### Available Public Methods & Getters

- **Operation History (Undo / Redo)**: `undo()`, `redo()`, `clearHistory()`, `recordCommand(cmd)`, `canUndo`, `canRedo`
- **Zoom Operations**: `zoomIn()`, `zoomOut()`, `zoomToPercent(percent)`, `zoomToScale(scale)`, `resetZoom()`, `zoomToFit()`, `getZoomPercent()`, `getZoomScale()`
- **Dependency Operations**: `triggerDependencyDelete(sourceTaskId, targetTaskId)`
- **WBS & Collapse**: `toggleRowCollapse(rowId, collapsed?)`, `collapseAll()`, `expandAll()`, `getRowPositions()`
- **Scroll & Selection**: `scrollToPosition(pos)`, `resetScroll()`, `selectTask(taskId, multi?)`
- **Export**: `exportImage(format, options)` (when export plugin is installed)

---

## Using Plugins (e.g. Export Plugin)

You can register plugins declaratively via `option.plugins` or imperatively using `ref`:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import {
  GanttChart,
  type GanttChartInstance,
  type GanttChartOption,
} from '@mogura/moguchart-vue'
import { exportPlugin } from '@mogura/moguchart-plugin-export'

const chartRef = ref<GanttChartInstance | null>(null)

const option: GanttChartOption = {
  calendar: {
    start: new Date('2026-04-01'),
    end: new Date('2026-04-30'),
    pxPerDay: 40,
  },
  plugins: [exportPlugin()],
}

const handleExportPng = async () => {
  await chartRef.value?.exportImage('png', {
    filename: 'gantt-export',
    download: true,
    scale: 2,
    normalizeZoom: true, // Export at baseline 100% scale regardless of current zoom
  })
}

const handleExportPdf = async () => {
  await chartRef.value?.exportImage('pdf', {
    filename: 'gantt-export',
    download: true,
  })
}
</script>

<template>
  <div>
    <button @click="handleExportPng">Export PNG</button>
    <button @click="handleExportPdf">Export PDF</button>

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

## Supported Events

All events dispatched by `@mogura/moguchart-core` are forwarded as Vue events:

| Vue Event | Description | Argument Type |
|---|---|---|
| `@task-update` | Dispatched when a task is moved or resized | `TaskUpdateEventDetail` |
| `@task-click` | Dispatched when a task bar is clicked | `TaskClickEventDetail` |
| `@task-dblclick` | Dispatched on double clicking a task bar | `TaskClickEventDetail` |
| `@task-contextmenu` | Dispatched on right-clicking a task bar | `TaskContextMenuEventDetail` |
| `@task-drop` | Dispatched when a task is dropped | `TaskDropEventDetail` |
| `@task-delete` | Dispatched when a task is deleted | `TaskDeleteEventDetail` |
| `@task-progress-change` | Dispatched when task progress changes | `TaskProgressChangeEventDetail` |
| `@bar-hover` | Dispatched on hovering over a task bar | `BarHoverEventDetail` |
| `@row-reordered` | Dispatched when a row is reordered via drag-and-drop | `RowReorderEventDetail` |
| `@row-header-resize` | Dispatched when row header width is resized | `RowHeaderResizeEventDetail` |
| `@row-selection-change` | Dispatched when row selection changes | `RowSelectionChangeEventDetail` |
| `@bar-selection-change` | Dispatched when task bar selection changes | `BarSelectionChangeEventDetail` |
| `@row-toggle-collapse` | Dispatched when a tree row is collapsed/expanded | `RowToggleCollapseEventDetail` |
| `@dependency-create` | Dispatched when a dependency link is drawn | `DependencyCreateEventDetail` |
| `@dependency-click` | Dispatched when a dependency line is clicked | `DependencyClickEventDetail` |
| `@dependency-select` | Dispatched when a dependency line is selected (highlighted / delete button shown) | `DependencySelectEventDetail` |
| `@dependency-delete` | Dispatched when a dependency link is deleted | `DependencyDeleteEventDetail` |
| `@zoom-change` | Dispatched when zoom level changes | `ZoomChangeEventDetail` |
| `@command` | Dispatched when a command is executed (tracked for Undo/Redo) | `CommandEventDetail` |
| `@history-change` | Dispatched when history stack changes (`canUndo`/`canRedo` updated) | `HistoryChangeEventDetail` |
| `@marker-dblclick` | Dispatched on double clicking a marker | `MarkerDblClickEventDetail` |
| `@marker-contextmenu` | Dispatched on right clicking a marker | `MarkerContextMenuEventDetail` |
| `@minimap-move` | Dispatched when minimap viewport moves | `MinimapMoveEventDetail` |
| `@minimap-resize` | Dispatched when minimap is resized | `MinimapResizeEventDetail` |
| `@minimap-collapse` | Dispatched when minimap is collapsed or expanded | `MinimapCollapseEventDetail` |
| `@chart-contextmenu` | Dispatched on right-clicking empty chart area | `ChartContextMenuEventDetail` |

---

## License

MIT © [Murakami Hiroyuki](https://github.com/hiro-murakami)

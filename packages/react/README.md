# @mogura/moguchart-react

Official React wrapper component for [`@mogura/moguchart-core`](https://github.com/hiro-murakami/moguchart-core).

Built on top of Lit's official `@lit/react`, it combines the high performance and framework independence of Web Components with a type-safe, idiomatic React developer experience.

[日本語版ドキュメントはこちら (Japanese documentation)](./README.ja.md)

---

## Features

- ⚛️ **Native React Experience**: Declarative JSX props and event handlers
- 🎯 **Full Type Safety**: Complete TypeScript auto-completion for props and events
- 🔄 **Lifecycle Synchronization**: Automatic synchronization between React state/props and Web Component rendering
- ⚡ **Imperative API Access**: Directly access methods like `chart.use()`, `chart.exportImage()`, `chart.selectTask()` via `ref`
- 📦 **Re-exported Types**: Core types, constants, and utilities are all re-exported from this package

---

## Installation

```bash
# pnpm
pnpm add @mogura/moguchart-react @mogura/moguchart-core react react-dom

# npm
npm install @mogura/moguchart-react @mogura/moguchart-core react react-dom

# yarn
yarn add @mogura/moguchart-react @mogura/moguchart-core react react-dom
```

---

## Quick Start

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
      name: 'Development Phase',
      tasks: [
        {
          id: 'task-1',
          name: 'Requirements Analysis',
          start: new Date('2026-04-01'),
          end: new Date('2026-04-10'),
          progress: 100,
        },
        {
          id: 'task-2',
          name: 'UI/UX Design',
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

## Main Props

| Prop | Type | Description |
|---|---|---|
| `rows` | `GanttRow[]` | Gantt chart row and task data |
| `option` | `GanttChartOption` | Configuration for calendar, zoom, history, dependencies, etc. |
| `theme` | `'light' \| 'dark'` | Color theme |
| `selectedRowIds` | `string[]` | Array of selected row IDs |
| `selectedTaskIds` | `string[]` | Array of selected task IDs |
| `selectedDependency` | `{ sourceTaskId: string; targetTaskId: string } \| null` | Currently selected dependency connection (highlighted) |
| `externalDraggingTask` | `GanttTask \| null` | External task data currently being dragged over the chart |

---

## Imperative API (via `ref`)

Access the underlying `GanttChartElement` instance via `ref` to invoke methods such as Undo/Redo, zoom, and exports:

```tsx
import React, { useRef } from 'react'
import { GanttChart, type GanttChartElement } from '@mogura/moguchart-react'

export function GanttToolbar() {
  const chartRef = useRef<GanttChartElement>(null)

  return (
    <div>
      <button onClick={() => chartRef.current?.undo()}>Undo</button>
      <button onClick={() => chartRef.current?.redo()}>Redo</button>
      <button onClick={() => chartRef.current?.zoomIn()}>Zoom In</button>
      <button onClick={() => chartRef.current?.zoomOut()}>Zoom Out</button>
      <button onClick={() => chartRef.current?.resetZoom()}>Reset Zoom</button>
      <GanttChart ref={chartRef} rows={[]} />
    </div>
  )
}
```

---

## Using with Plugins (e.g. Export)

To export charts as PNG or PDF, pair with `@mogura/moguchart-plugin-export`:

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
        normalizeZoom: true, // Export at baseline 100% scale regardless of current zoom
      })
    }
  }

  return (
    <div>
      <button onClick={handleExportPng}>Download PNG</button>
      <GanttChart ref={chartRef} rows={[]} option={option} />
    </div>
  )
}
```

---

## Supported Events

| Prop | Description |
|---|---|
| `onTaskUpdate` | Fired when a task is moved or resized |
| `onTaskClick` | Fired when a task is clicked |
| `onTaskDblClick` | Fired when a task is double-clicked |
| `onTaskContextMenu` | Fired on task right-click |
| `onTaskDelete` | Fired when a task is deleted |
| `onTaskDrop` | Fired when a task is dropped |
| `onTaskProgressChange` | Fired when task progress percentage changes |
| `onBarHover` | Fired when a task bar is hovered |
| `onBarSelectionChange` | Fired when task bar selection changes |
| `onRowHeaderClick` | Fired when a row header is clicked |
| `onRowHeaderDblClick` | Fired when a row header is double-clicked |
| `onRowHeaderContextMenu` | Fired on row header right-click |
| `onRowHeaderResize` | Fired when a row header is resized |
| `onRowReordered` | Fired when rows are reordered |
| `onRowSelectionChange` | Fired when row selection changes |
| `onRowToggleCollapse` | Fired when a row is expanded or collapsed (WBS) |
| `onDependencyCreate` | Fired when a dependency link is created |
| `onDependencyClick` | Fired when a dependency link is clicked |
| `onDependencySelect` | Fired when dependency selection changes (highlight / delete button shown) |
| `onDependencyDelete` | Fired when a dependency link is deleted |
| `onMarkerDblClick` | Fired when a marker is double-clicked |
| `onMarkerContextMenu` | Fired on marker right-click |
| `onZoomChange` | Fired when zoom scale changes |
| `onCommand` | Fired when a command is executed (tracked for Undo/Redo) |
| `onHistoryChange` | Fired when history stack changes (`canUndo`/`canRedo` updated) |
| `onMinimapMove` | Fired when minimap viewport scrolls |
| `onMinimapResize` | Minimap is resized |
| `onMinimapCollapse` | Minimap is collapsed or expanded |
| `onChartContextMenu` | Fired on chart background right-click |

---

## License

[MIT](../../LICENSE) © Murakami Hiroyuki

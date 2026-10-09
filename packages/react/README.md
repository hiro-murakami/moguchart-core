# @mogura/moguchart-react

Official React wrapper component for [`@mogura/moguchart-core`](https://github.com/hiro-murakami/moguchart-core).

Built on top of Lit's official `@lit/react`, it combines the high performance and framework independence of Web Components with a type-safe, idiomatic React developer experience.

[日本語版ドキュメントはこちら (Japanese documentation)](./README.ja.md)

---

## Features

- ⚛️ **Native React Experience**: Declarative JSX props and event handlers
- 🎯 **Full Type Safety**: Complete TypeScript auto-completion for props and events
- 🔄 **Lifecycle Synchronization**: Automatic synchronization between React state/props and Web Component rendering
- ⚡ **Imperative API Access**: Directly access methods like `chart.use()`, `chart.exportImage()`, `chart.exportExcel()`, `chart.selectTask()` via `ref`
- 🔌 **Plugin Support**: Seamless integration with `@mogura/moguchart-plugin-export` (PNG/PDF) and `@mogura/moguchart-plugin-excel` (Excel)
- 📈 **Baseline & Delay Tracking**: Compare planned schedules (`task.baseline`) against actual timelines with automatic delay highlighting and variance tooltips
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

## Baseline & Schedule Variance Tracking (Plan vs. Actual)

Provide a baseline schedule on tasks (`task.baseline`) and configure `option.baseline` to visually compare planned timelines against current actual progress. Delayed tasks (`task.end > baseline.end`) are automatically highlighted with accent indicator lines and detailed variance tooltips.

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
      name: 'Development Phase',
      tasks: [
        {
          id: 'task-1',
          name: 'Core Features',
          start: new Date('2026-04-05'),
          end: new Date('2026-04-18'), // Delayed beyond original plan
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
      visible: true,          // Enable baseline rendering
      position: 'bottom',     // 'bottom' | 'top' | 'overlay'
      highlightDelay: true,   // Visually highlight delayed tasks
      delayColor: '#EF4444',  // Custom accent color for delay indicators
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

## Using with Plugins (Export, Excel, etc.)

### PNG / PDF Export (`@mogura/moguchart-plugin-export`)

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
      <button onClick={handleExportPng}>Download PNG</button>
      <button onClick={handleExportPdf}>Download PDF</button>
      <GanttChart ref={chartRef} rows={[]} option={option} />
    </div>
  )
}
```

### Excel (.xlsx) Timeline Spreadsheet Export (`@mogura/moguchart-plugin-excel`)

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
      defaultFilename: 'project-schedule.xlsx',
      defaultSheetName: 'Schedule',
      themeColor: '#3B82F6',
    })],
  }

  const handleExportExcel = async () => {
    if (chartRef.current) {
      await chartRef.current.exportExcel({
        filename: 'schedule-latest.xlsx',
        locale: 'en', // 'en' | 'ja' | 'zh'
        download: true,
      })
    }
  }

  return (
    <div>
      <button onClick={handleExportExcel}>Download Excel Schedule</button>
      <GanttChart ref={chartRef} rows={[]} option={option} />
    </div>
  )
}
```

---

## Supported Events

Events dispatched by `@mogura/moguchart-core` can be listened to via standard camelCase React props:

| Prop | Description | Event Argument Type |
|---|---|---|
| `onTaskUpdate` | Fired when a task is moved or resized | `CustomEvent<TaskUpdateEventDetail>` |
| `onTaskClick` | Fired when a task is clicked | `CustomEvent<TaskClickEventDetail>` |
| `onTaskDblClick` | Fired when a task is double-clicked | `CustomEvent<TaskClickEventDetail>` |
| `onTaskContextMenu` | Fired on task right-click | `CustomEvent<TaskContextMenuEventDetail>` |
| `onTaskDelete` | Fired when a task is deleted | `CustomEvent<TaskDeleteEventDetail>` |
| `onTaskDrop` | Fired when a task is dropped | `CustomEvent<TaskDropEventDetail>` |
| `onTaskProgressChange` | Fired when task progress percentage changes | `CustomEvent<TaskProgressChangeEventDetail>` |
| `onBarHover` | Fired when a task bar is hovered | `CustomEvent<BarHoverEventDetail>` |
| `onBarSelectionChange` | Fired when task bar selection changes | `CustomEvent<BarSelectionChangeEventDetail>` |
| `onRowHeaderClick` | Fired when a row header is clicked | `CustomEvent<RowHeaderClickEventDetail>` |
| `onRowHeaderDblClick` | Fired when a row header is double-clicked (`contentTarget` exposes row name container) | `CustomEvent<RowHeaderDblClickEventDetail>` |
| `onRowHeaderContextMenu` | Fired on row header right-click | `CustomEvent<RowHeaderContextMenuEventDetail>` |
| `onRowHeaderResize` | Fired when a row header is resized | `CustomEvent<RowHeaderResizeEventDetail>` |
| `onRowReordered` | Fired when rows are reordered | `CustomEvent<RowReorderEventDetail>` |
| `onRowSelectionChange` | Fired when row selection changes | `CustomEvent<RowSelectionChangeEventDetail>` |
| `onRowToggleCollapse` | Fired when a row is expanded or collapsed (WBS) | `CustomEvent<RowToggleCollapseEventDetail>` |
| `onDependencyCreate` | Fired when a dependency link is created | `CustomEvent<DependencyCreateEventDetail>` |
| `onDependencyClick` | Fired when a dependency link is clicked | `CustomEvent<DependencyClickEventDetail>` |
| `onDependencySelect` | Fired when dependency selection changes (highlight / delete button shown) | `CustomEvent<DependencySelectEventDetail>` |
| `onDependencyDelete` | Fired when a dependency link is deleted | `CustomEvent<DependencyDeleteEventDetail>` |
| `onMarkerDblClick` | Fired when a marker is double-clicked | `CustomEvent<MarkerDblClickEventDetail>` |
| `onMarkerContextMenu` | Fired on marker right-click | `CustomEvent<MarkerContextMenuEventDetail>` |
| `onZoomChange` | Fired when zoom scale changes | `CustomEvent<ZoomChangeEventDetail>` |
| `onCommand` | Fired when a command is executed (tracked for Undo/Redo) | `CustomEvent<CommandEventDetail>` |
| `onHistoryChange` | Fired when history stack changes (`canUndo`/`canRedo` updated) | `CustomEvent<HistoryChangeEventDetail>` |
| `onMinimapMove` | Fired when minimap viewport scrolls | `CustomEvent<MinimapMoveEventDetail>` |
| `onMinimapResize` | Minimap is resized | `CustomEvent<MinimapResizeEventDetail>` |
| `onMinimapCollapse` | Minimap is collapsed or expanded | `CustomEvent<MinimapCollapseEventDetail>` |
| `onChartContextMenu` | Fired on chart background right-click | `CustomEvent<ChartContextMenuEventDetail>` |

---

## License

[MIT](../../LICENSE) © Murakami Hiroyuki

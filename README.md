# @mogura/moguchart-core

![demo-light.png](https://raw.githubusercontent.com/hiro-murakami/qiita-content/main/images/moguchart-core-introduction/demo-light.png)

[日本語](./README.ja.md) | [Demo](https://moguchart-core.vercel.app/?lang=en)

A lightweight yet feature-rich Gantt chart Web Component built with Lit. Works seamlessly with Vue, React, Angular, Svelte, and any other modern web framework.

- **Online Demo**: [https://moguchart-core.vercel.app/?lang=en](https://moguchart-core.vercel.app/?lang=en)
- **npm Package**: [@mogura/moguchart-core](https://www.npmjs.com/package/@mogura/moguchart-core)

## Features

- 🚀 **Framework-agnostic**: Built as standard Web Components (Custom Elements), easily integrated into any frontend framework.
- ⚡ **Virtual Scrolling**: Smooth 60fps rendering even with extensive tasks and rows.
- ↩️ **Operation History (Undo / Redo)**: Command pattern-based history manager. Complete undo/redo support for task movement, duration resizing, progress adjustments, deletion, row reordering, and dependency editing (`Ctrl+Z` / `Ctrl+Y`).
- 🔍 **Comprehensive Zoom Controls**: Smooth magnification adjustments based on percentage (50% to 200%) and scale factors (0.5 to 2.0). Coordinated synchronization across calendar width, row header width, bar height, and font scale (`--moguchart-font-scale`). Keyboard shortcuts (`Ctrl/Cmd + + / - / 0`) and mouse wheel zoom.
- 🖱️ **Rich Interactive Controls**:
  - Drag & drop task movement (with optional cross-row vertical movement)
  - Handle-based task duration resizing
  - Drag & drop row reordering
  - Column header width resizing
  - Marquee selection (rubberband drag selection) for batch task selection (with Shift / Ctrl / Cmd additive selection support)
  - Multi-task selection and synchronized batch dragging (Ctrl / Cmd + click, marquee selection)
  - Safe drag cancellation and snapback when cursor exits chart boundaries
  - Double-click and right-click event handling
- 🎨 **Highly Customizable**:
  - Custom rendering for task bars, row headers, row header tooltips, tooltips, and drag info overlays
  - Light / Dark / System theme switching + custom color palettes
  - 13 built-in task bar fill patterns (stripes, dots, checkerboard, grid, etc.)
  - Native CSS variable-driven styling
- 🔗 **Interactive Dependencies**:
  - Direct task dependencies visualised with orthogonal segmented lines or Bezier curves
  - Click-to-select dependency lines with dedicated highlight styling
  - One-click deletion via on-line "×" button or `Delete` / `Backspace` key
  - Proximity connector toggle (`showConnectors`)
  - Automatic critical path detection and highlighted visualization (`showCriticalPath`)
- 📅 **Flexible Calendar & Timeline**:
  - Day / Week / Month view switching
  - Dynamic zoom levels (`pxPerDay` or `pxPerMonth`) with smooth mouse-wheel zoom support
  - Current time indicator line with date badge (auto-refresh support)
  - Custom holiday detection logic
  - Configurable week start day
  - Built-in internationalization (Japanese, English, and custom locale extensibility)
- 🔤 **Font Scaling (`fontScale`)**: Scale all text font sizes throughout the Gantt chart uniformly via `fontScale` option or `--moguchart-font-scale` CSS variable, ideal for responsive zooming and high-density views.
- 🏁 **Milestones**: Display key milestones with vertical markers and customizable badges.
- 📍 **Markers**: Place labeled triangle marker indicators on individual row timelines.
- 🗺️ **Overview Minimap**: Floating bird's-eye canvas preview of the entire chart, interactive pan & scroll synchronization, click-to-jump, drag-to-move, edge drag-resizing, opacity slider, and collapsible window state.
- 📊 **Task Progress Management**:
  - Task bar progress overlay (full, bottom, or top indicator styles)
  - Interactive drag-adjust handle for quick progress modification (with snap increments)
  - Configurable progress labels (custom positioning & formatters)
  - Automatic progress label display for summary tasks and customizable summary progress bar color (`summaryColor`)
  - `task-progress-change` custom event
  - Progress calculation utility functions (simple & duration-weighted row/project averages)
  - Automatic progress visualization on the overview minimap
- 🧩 **Plugin Architecture**: Modular architecture keeping the core bundle ultra-lightweight (tens of KBs) while allowing rich extensions like PNG/PDF exports.
- 📷 **Export Plugin**: Full Gantt chart PNG image and multi-page PDF export powered by `@mogura/moguchart-plugin-export` (with automatic zoom normalization `normalizeZoom`, scroll position preservation, and auto-download support).
- ✨ **Advanced Integration**:
  - External drag & drop for task creation
  - Task move / copy modes
  - Snap feature (time unit grid snapping, automatic monthly boundary snap in month view)
  - `hitTest` method for calculating row ID and datetime from screen coordinates
  - Programmatic task selection + auto-scroll (`selectTask`)
  - Row layout coordinates inspection (`getRowPositions`)
- 🌳 **WBS (Hierarchical Tree & Collapsible Rows)**:
  - Unlimited parent-child hierarchy via `parentId`
  - Indented display with expand/collapse toggle buttons (▶/▼)
  - Automatically calculated summary task bars (bracket style) from child tasks
  - Configurable summary task bar colors (chart default `summaryColor` and row-level `summaryColor` overrides)
  - Coexistence of summary task bars and normal tasks within parent rows (two-lane rendering)
  - Configurable progress label display on summary task bars (`showSummaryLabel`)
  - Collapsing seamlessly integrated with virtual scrolling and overview minimap
  - Safe drag & drop reordering preserving hierarchy (prevents circular nesting, moves subtrees together)
  - Programmatic expand/collapse methods (`toggleRowCollapse`, `collapseAll`, `expandAll`)
- ⌨️ **Keyboard Navigation & Shortcuts**: Arrow key navigation & selection, Shift + Arrow task movement, Delete / Backspace task & dependency deletion, Undo / Redo (`Ctrl+Z` / `Ctrl+Y`), and zoom controls.

## Packages (Ecosystem)

Moguchart is structured as a modular monorepo, allowing you to choose the exact package tailored to your stack:

| Package | Description |
|---|---|
| **[@mogura/moguchart-core](https://www.npmjs.com/package/@mogura/moguchart-core)** | Core Web Component (built with Lit). Lightweight and framework-agnostic. |
| **[@mogura/moguchart-react](https://www.npmjs.com/package/@mogura/moguchart-react)** | **Official React wrapper**. Provides type-safe props, camelCase events, and ref support. |
| **[@mogura/moguchart-vue](https://www.npmjs.com/package/@mogura/moguchart-vue)** | **Official Vue 3 wrapper**. Supports `<script setup>`, reactive props, and native emits. |
| **[@mogura/moguchart-plugin-export](https://www.npmjs.com/package/@mogura/moguchart-plugin-export)** | **Official export plugin**. Provides high-resolution PNG and PDF export. |

---

## Installation

Install the package suited for your application:

```bash
# Core (Web Components / Vanilla JS)
pnpm add @mogura/moguchart-core

# For React applications
pnpm add @mogura/moguchart-react @mogura/moguchart-core

# For Vue 3 applications
pnpm add @mogura/moguchart-vue @mogura/moguchart-core
```

## API Reference

For exhaustive configuration properties, methods, and event signatures, refer to the [API Reference (API.md)](./doc/API.md) or the [Japanese API Reference (API.ja.md)](./doc/API.ja.md).

---

## Usage with React (Official Wrapper)

Use [`@mogura/moguchart-react`](./packages/react/README.md) for first-class React support with full TypeScript typing, React synthetic events, and imperative `ref` calls:

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
      name: 'Development Phase',
      tasks: [
        {
          id: 'task-1',
          name: 'Requirements',
          start: new Date('2026-04-01'),
          end: new Date('2026-04-10'),
          progress: 100,
        },
        {
          id: 'task-2',
          name: 'Implementation',
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
    console.log('Task updated:', e.detail)
  }

  const handleExportPng = async () => {
    await chartRef.current?.exportImage({ format: 'png', scale: 2 })
  }

  return (
    <div style={{ height: '600px' }}>
      <button onClick={handleExportPng}>Export PNG</button>
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

## Usage with Vue 3 (Official Wrapper)

Use [`@mogura/moguchart-vue`](./packages/vue/README.md) for seamless Vue 3 reactivity, Composition API (`<script setup>`), and native event listeners (`@task-update`):

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
    name: 'Development Phase',
    tasks: [
      {
        id: 'task-1',
        name: 'Requirements',
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
  console.log('Task updated:', detail)
}

const handleExportPng = async () => {
  await chartRef.value?.exportImage({ format: 'png', scale: 2 })
}
</script>

<template>
  <div style="height: 600px;">
    <button @click="handleExportPng">Export PNG</button>
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

## Usage with Plain HTML / Vanilla JS (Web Components)

To use Moguchart directly in standard HTML without any framework:

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
        name: 'Task Group 1',
        tasks: [
          {
            id: 'task-1',
            name: 'Task 1',
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

## Key Features

### Themes

Three theme modes are supported: `light`, `dark`, and `system` (automatic OS preference). Individual color tokens can be overridden using `customTheme`.

```javascript
const option = {
  theme: 'dark', // 'light' | 'dark' | 'system'
  customTheme: {
    bg: '#1a1a2e',
    text: '#e0e0e0',
    currentTimeLine: '#ff6b6b',
    criticalPath: '#ef4444',
  },
  // ...
}
```

### Milestones

Pass an array of milestone definitions to `calendar.milestones` to render vertical milestone lines with name badges across the chart. Hover effects provide smooth visual feedback.

```javascript
option.calendar.milestones = [
  {
    id: 'ms-1',
    name: 'Alpha Release',
    start: new Date('2025-04-08'),
    color: '#8b5cf6',
    width: 4,
  },
  {
    id: 'ms-2',
    name: 'Production Release',
    start: new Date('2025-05-01'),
    color: '#10b981',
  },
]
```

### Markers

Add markers to any row's `markers` property to display triangle icons with text labels along the timeline.

```javascript
const rows = [
  {
    id: 'row-1',
    name: 'Task A',
    tasks: [/* ... */],
    markers: [
      {
        id: 'marker-1',
        name: 'Review Deadline',
        date: new Date('2025-04-10'),
        anchor: 'end',
        type: 'triangle-right',
        fontSize: 'sm', // 'xs' | 'sm' | 'md' | 'lg' | 'xl'
        color: '#ef4444',
      },
    ],
  },
]
```

### Task Bar Patterns

Apply any of the 13 built-in SVG patterns to task bars. Preset constants are exported for type safety.

```javascript
import { PATTERN_DIAGONAL_STRIPE } from '@mogura/moguchart-core'

const task = {
  id: 't-1',
  name: 'WIP',
  start: new Date('2025-01-01'),
  end: new Date('2025-01-05'),
  style: 'background-color: #60a5fa',
  pattern: PATTERN_DIAGONAL_STRIPE, // Using preset
  // or specify custom pattern:
  // pattern: { type: 'checkerboard', color: '#ffffff80' }
}
```

Available pattern types:
`diagonal-stripe`, `diagonal-stripe-thin`, `diagonal-stripe-thick`, `diagonal-stripe-reverse`, `vertical-stripe`, `horizontal-stripe`, `checkerboard`, `dots`, `dots-dense`, `triangle`, `circle`, `grid`, `diagonal-grid`.

### Row Reordering

Set `enableRowReordering: true` to allow users to reorder rows via drag & drop.

```javascript
const option = {
  enableRowReordering: true,
  // ...
}

chart.addEventListener('row-reordered', (e) => {
  console.log('Reordered rows:', e.detail.rows)
})
```

### Cross-Row Task Movement (`enableCrossRowMove`)

By default, dragging a task bar permits moving it vertically across different rows (`enableCrossRowMove: true`). Set this option to `false` to restrict movement strictly to the horizontal timeline of its original row.

```javascript
const option = {
  enableCrossRowMove: false, // Restrict task drag movement to the same row
  // ...
}
```

### Multi-Task Selection & Batch Operations

Hold `Ctrl` (macOS: `Cmd`) and click task bars, or use **Marquee Selection** to select multiple tasks. Once selected, dragging any selected task moves all of them collectively while preserving their relative dates.

```javascript
chart.addEventListener('task-update', (e) => {
  const detail = e.detail
  if (!detail.isDragging && detail.selectedTaskIds?.length > 1) {
    // Drop event for multi-task selection
    for (const taskId of detail.selectedTaskIds) {
      applyDxToTask(taskId, detail.dx)
    }
  }
})
```

### Snap Feature

Control the time-snapping interval during drag movement and resizing via `snapDuration` (in minutes). When using monthly view mode (`pxPerMonth`), snapping automatically aligns to month boundaries.

```javascript
const option = {
  snapDuration: 60, // Snap to 1-hour increments (default: 1440 = 1 day)
  // ...
}
```

### View Modes

#### Week View Mode

Set `calendar.showWeeks: true` to display a two-tiered calendar header with week numbers. Automatically activates when `pxPerDay` is under 20.

```javascript
const option = {
  calendar: {
    start: new Date('2025-01-01'),
    end: new Date('2025-12-31'),
    pxPerDay: 15,
    showWeeks: true,
    weekStartDay: 1, // 1 = Monday (default)
    weekFormat: (weekNum) => `W${weekNum}`,
  },
}
```

#### Monthly View Mode

Set `calendar.pxPerMonth` to render months with equal pixel widths, suitable for long-term project planning.

```javascript
const option = {
  calendar: {
    start: new Date('2025-01-01'),
    end: new Date('2027-12-31'),
    pxPerDay: 1,
    pxPerMonth: 120, // 120px per month
    showMonthsRow: true, // Two-row header: year on top, month below
  },
}
```

### Font Scaling (`fontScale`)

Use the `fontScale` option (or the CSS custom property `--moguchart-font-scale`) to scale all text font sizes throughout the Gantt chart uniformly.

This is ideal for synchronizing font sizes when adjusting overall chart zoom or resolution, or for creating compact high-density views.

```javascript
const option = {
  // Scale font sizes down to 80%
  fontScale: 0.8,
  // ...
}
```

You can also control it via CSS custom properties:

```css
gantt-chart {
  --moguchart-font-scale: 0.85;
}
```

Font scaling is automatically applied to calendar headers (year/month, weeks, days, hours, badges), row headers, WBS code badges, tree toggle icons, task bar labels, progress labels, markers, tooltips, and drag info overlays.

### Dependency Line Settings

Configure task dependency curves and interactive operations with the `dependency` option:

- `lineStyle`: `'orthogonal'` (rounded segmented lines, default) or `'curve'` (Bezier curves).
- `showArrows`: Toggle directional arrow heads (default: `true`).
- `arrowSize`: Arrow dimensions in pixels (default: `8`).
- `showConnectors`: Control whether circular connection handles appear on hover (default: `true`).
- `showCriticalPath`: Automatically detect the longest chain (critical path) and highlight connected tasks and lines.
- `creatable`: Allow creating links via connector drag (default: `true`).
- `deletable`: Allow deleting links via keyboard or button (default: `true`).
- `showDeleteButton`: Display "×" delete button on selected link (default: `true`).

Lines can be clicked to select (highlighted with distinct stroke & shadow), and deleted by clicking the "×" button or pressing `Delete` / `Backspace`.

```javascript
const option = {
  dependency: {
    lineStyle: 'orthogonal',
    cornerRadius: 8,
    showArrows: true,
    arrowSize: 10,
    showConnectors: true,
    showCriticalPath: true,
    creatable: true,
    deletable: true,
    showDeleteButton: true,
  },
  // ...
}

// Dependency selection and deletion events
chart.addEventListener('dependency-select', (e) => {
  console.log('Selected dependency:', e.detail.selected)
})
chart.addEventListener('dependency-delete', (e) => {
  console.log('Deleted dependency:', e.detail.sourceTaskId, '->', e.detail.targetTaskId)
})
```

### Task Progress Management

Visualize and interactively edit progress on task bars by specifying `progress` (`0` to `100`). Set `editable: true` to enable dragging the progress adjustment handle on the task bar. When `showLabel: true` is enabled, summary tasks also display their aggregated progress labels automatically.

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
    editable: true, // Allow interactive handle dragging
    color: '#3b82f6', // Progress bar color for normal tasks
    summaryColor: 'rgba(255, 255, 255, 0.35)', // Progress bar color for summary tasks
    showLabel: true, // Display progress text (e.g. "50%")
    showSummaryLabel: true, // Show progress label on summary tasks (default: true)
    labelPosition: 'inside', // 'inside' | 'right' | 'left' | 'center'
    snapStep: 5, // Snap in 5% increments
    indicatorPosition: 'full', // 'full' | 'bottom' | 'top'
  },
}

// Progress change event listener
chart.addEventListener('task-progress-change', (e) => {
  const { task, progress, originalProgress, cancelled } = e.detail
  console.log(`Task ${task.id}: ${originalProgress}% -> ${progress}%`)
})

// Progress calculation helper functions
const rowSimpleAvg = calculateRowProgress(row)
const rowWeightedAvg = calculateWeightedRowProgress(row)
const projectWeightedAvg = calculateProjectProgress(rows)
```

### Marquee Range Selection (Rubberband Selection)

Click and drag on empty calendar background space to select multiple task bars enclosed or intersected by the selection rectangle.
Hold `Shift`, `Ctrl`, or `Cmd` while dragging to accumulate selections additively.

```javascript
const option = {
  selection: {
    marquee: true, // Enable marquee selection (default: true)
    borderColor: '#3b82f6', // Selection border color
    backgroundColor: 'rgba(59, 130, 246, 0.15)', // Box fill color
  },
}

// Selection change event listener
chart.addEventListener('bar-selection-change', (e) => {
  console.log('Selected task IDs:', e.detail.selectedIds)
})
```

### Overview Minimap

Display a floating bird's-eye preview window that renders the entire project's tasks, milestones, and current viewport finder.
The minimap supports drag-panning, edge-resizing, opacity adjustment, and collapsing.

```javascript
const option = {
  minimap: {
    enabled: true,
    width: 240,
    preserveAspectRatio: true,
    resizable: true,
    collapsible: true,
    collapsed: false,
    opacity: 0.85,
    position: { right: 16, bottom: 16 }, // Anchor offset from bottom-right (px)
  },
}

// Minimap interaction events
chart.addEventListener('minimap-move', (e) => console.log('Position:', e.detail.position))
chart.addEventListener('minimap-resize', (e) => console.log('Size:', e.detail.width, e.detail.height))
chart.addEventListener('minimap-collapse', (e) => console.log('Collapsed:', e.detail.collapsed))
```

### Internationalization (i18n) & Locales

moguchart-core comes with built-in Japanese (`jaLocale`, default) and English (`enLocale`) support. You can also define custom locales implementing the `MoguchartLocale` interface.

```javascript
import { enLocale } from '@mogura/moguchart-core'

const option = {
  locale: enLocale,
  // ...
}
```

Custom locale implementation example:

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

### WBS (Hierarchical Tree, Collapse / Expand & Summary Tasks)

By specifying `parentId` on rows, you can build an unlimited hierarchical structure (e.g. Project > Phase > Task).
Parent rows automatically display expand/collapse toggle buttons (▼/▶) and render summary task bars (bracket style) calculated from child tasks. If a parent row also contains its own tasks, both summary and normal tasks are rendered together (summary task on the top lane, normal tasks below).

```javascript
const rows = [
  {
    id: 'project-1',
    name: 'Project Alpha',
    parentId: null,
    tasks: [], // autoSummary: true will aggregate from child tasks
  },
  {
    id: 'task-1-1',
    name: 'Requirements',
    parentId: 'project-1',
    tasks: [
      {
        id: 't-1',
        name: 'Interviews',
        start: new Date('2025-04-01'),
        end: new Date('2025-04-10'),
        progress: 100,
      },
    ],
  },
  {
    id: 'task-1-2',
    name: 'Architecture',
    parentId: 'project-1',
    tasks: [
      {
        id: 't-2',
        name: 'Design Spec',
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
    enabled: true, // Enable tree view (default: true)
    indentWidth: 16, // Indent width per level in px (default: 16)
    showToggleIcon: true, // Show expand/collapse toggle icon (default: true)
    showWbsCode: true, // Display WBS numbering like "1", "1.1"
    autoSummary: true, // Automatically calculate dates & progress from child tasks
    summaryColor: '#334155', // Default summary task bar color (can be overridden by row.summaryColor)
  },
}

// Row collapse/expand toggle event
chart.addEventListener('row-toggle-collapse', (e) => {
  const { rowId, collapsed } = e.detail
  console.log(`Row ${rowId} was ${collapsed ? 'collapsed' : 'expanded'}`)
})
```

### Public Methods

#### selectTask

Selects a task by ID and automatically scrolls the chart to bring it into view.

```javascript
const chart = document.querySelector('gantt-chart')
const found = chart.selectTask('task-1')
```

#### hitTest

Determines the row ID and calendar date corresponding to a given screen coordinate (e.g. from mouse events).

```javascript
document.addEventListener('mousemove', (e) => {
  const result = chart.hitTest(e.clientX, e.clientY)
  if (result) {
    console.log(`Row: ${result.rowId}, Date: ${result.date}`)
  }
})
```

#### Export Plugin (`@mogura/moguchart-plugin-export`)

Export the entire Gantt chart to a PNG image or PDF document. The export feature is packaged as a dedicated modular plugin (`@mogura/moguchart-plugin-export`) to keep the core bundle ultra-lightweight.

```bash
pnpm add @mogura/moguchart-plugin-export
```

```javascript
import '@mogura/moguchart-core'
import { exportPlugin } from '@mogura/moguchart-plugin-export'

// Register plugin to chart instance (chart.use or option.plugins)
chart.use(exportPlugin())

// Automatically download as PNG image
await chart.exportImage('png', {
  filename: 'gantt-chart',
  download: true,
  scale: 2,
})

// Retrieve or download as PDF
const pdfBlob = await chart.exportImage('pdf', {
  filename: 'gantt-chart',
  download: true,
})
```

You can also dynamically load the plugin on-demand (e.g. only when clicking the export button):

```javascript
const { exportChart } = await import('@mogura/moguchart-plugin-export')
await exportChart(chart, 'png', { download: true })
```

#### Zoom Operations (`zoomIn`, `zoomOut`, `zoomToPercent`, `zoomToScale`, `zoomToFit`, `resetZoom`)

Enable zoom via `option.zoom` (wheel zoom with Ctrl / Cmd key, keyboard shortcuts `Ctrl/Cmd + + / - / 0`) and control zoom level programmatically:

```javascript
const option = {
  zoom: {
    enabled: true, // Enable zoom features (default: false)
    minPercent: 50, // Minimum zoom percentage (default: 50)
    maxPercent: 200, // Maximum zoom percentage (default: 200)
    initialPercent: 100, // Initial zoom percentage (default: 100)
    shortcuts: true, // Enable keyboard shortcuts (default: true)
    scaleElements: {
      calendar: true,
      rowHeader: true,
      barHeight: true,
      fontScale: true,
    },
  },
}

// Programmatic zoom control
chart.zoomIn() // Zoom in by one step (Chrome-compliant preset)
chart.zoomOut() // Zoom out by one step
chart.zoomToPercent(125) // Zoom to 125%
chart.zoomToScale(1.5) // Zoom to 1.5x
chart.zoomToFit() // Auto-fit all tasks into the visible container width
chart.resetZoom() // Reset to 100% (default scale)

// Listen to zoom level changes
chart.addEventListener('zoom-change', (e) => {
  console.log('Zoom changed:', e.detail.zoomPercent + '%', 'scale:', e.detail.zoomScale)
})
```

#### Operation History / Undo & Redo (`undo`, `redo`, `clearHistory`)

User actions (task moving, resizing, progress editing, deleting, row reordering, dependency creation and deletion) are automatically recorded. You can undo and redo them programmatically or via keyboard shortcuts (`Ctrl+Z` / `Ctrl+Y` / `Cmd+Shift+Z`).

```javascript
const option = {
  history: {
    enabled: true, // Enable history tracking (default: true)
    maxDepth: 50, // Maximum history steps to retain (default: 50)
    keyboard: true, // Enable undo/redo keyboard shortcuts (default: true)
  },
}

// Perform Undo / Redo
if (chart.canUndo) {
  await chart.undo()
}
if (chart.canRedo) {
  await chart.redo()
}

// Clear history
chart.clearHistory()

// Listen to history state changes
chart.addEventListener('history-change', (e) => {
  undoBtn.disabled = !e.detail.canUndo
  redoBtn.disabled = !e.detail.canRedo
})
```

#### Dependency Deletion (`triggerDependencyDelete`)

Programmatically remove a dependency connection between two tasks:

```javascript
chart.triggerDependencyDelete('task-1', 'task-2')
```

#### WBS & Collapse Operations (`toggleRowCollapse`, `collapseAll`, `expandAll`)

```javascript
// Toggle collapse state for a specific row
chart.toggleRowCollapse('row-1') // Toggle
chart.toggleRowCollapse('row-1', true) // Collapse
chart.toggleRowCollapse('row-1', false) // Expand

// Batch operations
chart.collapseAll() // Collapse all parent rows with children
chart.expandAll() // Expand all rows
```

#### getRowPositions

Returns layout metrics (`top`, `height`, `bottom`) for all rows within the virtual container.

```javascript
const rowPositions = chart.getRowPositions()
console.log('Row positions:', rowPositions)
```

### Utility Functions

`@mogura/moguchart-core` exports various helper utilities for hierarchical WBS calculations, critical path detection, and progress aggregations:

```typescript
import {
  // WBS & Tree calculations
  computeRowLevels,
  computeRowWbsCodes,
  computeChildRowIds,
  computeVisibleTreeRows,
  computeSummaryTask,
  canDropRow,
  // Critical path computation
  computeCriticalPath,
  // Progress calculations
  clampProgress,
  calculateRowProgress,
  calculateWeightedRowProgress,
  calculateProjectProgress,
} from '@mogura/moguchart-core'

// 1. Calculate depth level for all rows
const levels = computeRowLevels(rows) // Map<string, number> (rowId -> level: 0, 1, 2...)
// 2. Generate WBS hierarchical numbering codes ("1", "1.1", "1.2", etc.)
const wbsCodes = computeRowWbsCodes(rows) // Map<string, string> (rowId -> wbsCode)
// 3. Get child / descendant row IDs for a row
const allDescendants = computeChildRowIds('project-1', rows, true) // Recursively get all descendants
const directChildren = computeChildRowIds('project-1', rows, false) // Direct children only
// 4. Extract rows currently visible based on collapse states
const visibleRows = computeVisibleTreeRows(rows)
// 5. Aggregate child tasks into a summary task
const summaryTask = computeSummaryTask(childTasks, 'project-1') // Min start, max end, weighted average progress
// 6. Safe D&D check to prevent circular parent-child nesting
const isDropAllowed = canDropRow('source-row-id', 'target-row-id', rows) // boolean
// 7. Find longest task dependency chains (critical path)
const criticalTaskIds = computeCriticalPath(allTasks) // Set<string>
```

### Keyboard Operations

When the Gantt chart element is focused, keyboard shortcuts allow fast navigation, task manipulation, undo/redo, and zooming:

| Key                    | Action                                      |
| :--------------------- | :------------------------------------------ |
| `←` `→`                | Move focus between tasks                    |
| `↑` `↓`                | Move focus to another row                   |
| `Enter` / `Space`      | Select the focused task                     |
| `Ctrl/Cmd + Enter`     | Toggle selection state (multi-select)       |
| `Shift + ←` `→`        | Move selected tasks backward / forward      |
| `Delete` / `Backspace` | Delete selected task or selected dependency |
| `Ctrl+Z` / `Cmd+Z`     | Undo last operation                        |
| `Ctrl+Y` / `Cmd+Shift+Z` | Redo last undone operation                |
| `Ctrl/Cmd + +`         | Zoom in                                     |
| `Ctrl/Cmd + -`         | Zoom out                                    |
| `Ctrl/Cmd + 0`         | Reset zoom to 100%                          |
| `Ctrl/Cmd + Wheel`     | Zoom in / Zoom out                          |
| `Escape`               | Clear current selection and focus           |

```javascript
const option = {
  keyboard: {
    enabled: true, // Default: true
    moveStep: 60, // Move distance per Shift+Arrow key press (minutes)
  },
  history: {
    keyboard: true, // Enable Undo/Redo shortcuts (default: true)
  },
  zoom: {
    shortcuts: true, // Enable Zoom shortcuts (default: true)
  },
}
```

## Changelog

See [CHANGELOG.md](CHANGELOG.md) ([日本語版: CHANGELOG.ja.md](CHANGELOG.ja.md)) for release history and migration details.

## License

[MIT License](LICENSE)

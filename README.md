# @mogura/moguchart-core

![demo-light.png](https://raw.githubusercontent.com/hiro-murakami/qiita-content/main/images/moguchart-core-introduction/demo-light.png)

[日本語](./README.ja.md) | [Demo](https://moguchart-core.vercel.app/)

A lightweight yet feature-rich Gantt chart Web Component built with Lit. Works seamlessly with Vue, React, Angular, Svelte, and any other modern web framework.

- **Online Demo**: [https://moguchart-core.vercel.app/](https://moguchart-core.vercel.app/)
- **npm Package**: [@mogura/moguchart-core](https://www.npmjs.com/package/@mogura/moguchart-core)

## Features

- 🚀 **Framework-agnostic**: Built as standard Web Components (Custom Elements), easily integrated into any frontend framework.
- ⚡ **Virtual Scrolling**: Smooth 60fps rendering even with extensive tasks and rows.
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
- 🔗 **Dependency Visualization**:
  - Smooth curved lines with directional arrows showing task dependencies
  - Automatic S-curve calculation for reverse-direction dependencies
  - Proximity connector toggle (`showConnectors`)
  - Automatic critical path detection and highlighted visualization (`showCriticalPath`)
- 📅 **Flexible Calendar & Timeline**:
  - Day / Week / Month view switching
  - Dynamic zoom levels (`pxPerDay` or `pxPerMonth`) with smooth mouse-wheel zoom support
  - Current time indicator line with date badge (auto-refresh support)
  - Custom holiday detection logic
  - Configurable week start day
  - Built-in internationalization (Japanese, English, and custom locale extensibility)
- 🏁 **Milestones**: Display key milestones with vertical markers and customizable badges.
- 📍 **Markers**: Place labeled triangle marker indicators on individual row timelines.
- 🗺️ **Overview Minimap**: Floating bird's-eye canvas preview of the entire chart, interactive pan & scroll synchronization, click-to-jump, drag-to-move, edge drag-resizing, opacity slider, and collapsible window state.
- 📊 **Task Progress Management**:
  - Task bar progress overlay (full, bottom, or top indicator styles)
  - Interactive drag-adjust handle for quick progress modification (with snap increments)
  - Configurable progress labels (custom positioning & formatters)
  - `task-progress-change` custom event
  - Progress calculation utility functions (simple & duration-weighted row/project averages)
  - Automatic progress visualization on the overview minimap
- 📷 **High-Fidelity Export**: Export the full Gantt chart to PNG image or multi-page PDF documents (with scroll position preservation and auto-download support).
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
  - Collapsing seamlessly integrated with virtual scrolling and overview minimap
  - Safe drag & drop reordering preserving hierarchy (prevents circular nesting, moves subtrees together)
  - Programmatic expand/collapse methods (`toggleRowCollapse`, `collapseAll`, `expandAll`)
- ⌨️ **Keyboard Navigation**: Arrow key navigation & selection, Shift + Arrow task movement, Delete / Backspace deletion.

## Installation

```bash
pnpm add @mogura/moguchart-core
# or
npm install @mogura/moguchart-core
# or
yarn add @mogura/moguchart-core
```

## API Reference

For exhaustive configuration properties, methods, and event signatures, refer to the [API Reference (API.md)](./doc/API.md) or the [Japanese API Reference (API.ja.md)](./doc/API.ja.md).

## Usage with Vue.js

Example using Vue 3 (Composition API / `<script setup>`).
When using Web Components in Vue, configure `compilerOptions.isCustomElement` in `vite.config.ts` to recognize `gantt-chart`.

```html
<script setup lang="ts">
  import { ref } from 'vue'
  import '@mogura/moguchart-core'
  import type { GanttRow, GanttChartOption, TaskUpdateEventDetail } from '@mogura/moguchart-core'

  const rows = ref<GanttRow[]>([
    {
      id: 'row-1',
      name: 'Project A',
      tasks: [
        {
          id: 't-1',
          name: 'Task 1',
          start: new Date('2025-01-01'),
          end: new Date('2025-01-05'),
          progress: 60,
          style: 'background-color: #60a5fa',
        },
      ],
      markers: [
        {
          id: 'marker-1',
          name: 'Review Deadline',
          date: new Date('2025-01-03'),
          type: 'triangle-down',
          color: '#ef4444',
        },
      ],
    },
  ])

  const option = ref<GanttChartOption>({
    calendar: {
      start: new Date('2025-01-01'),
      end: new Date('2025-03-31'),
      pxPerDay: 30,
      showCurrentTime: true,
      milestones: [
        {
          id: 'ms-1',
          name: 'Release',
          start: new Date('2025-02-01'),
          color: '#8b5cf6',
        },
      ],
    },
    bar: { height: 28 },
    rowHeader: { width: 200 },
    theme: 'system',
    enableCrossRowMove: true,
    progress: {
      enabled: true,
      editable: true,
      showLabel: true,
    },
    selection: {
      marquee: true,
    },
    minimap: {
      enabled: true,
    },
  })

  const handleTaskUpdate = (e: Event) => {
    const detail = (e as CustomEvent<TaskUpdateEventDetail>).detail
    console.log('Task updated:', detail)
  }
</script>

<template>
  <div style="height: 600px;">
    <gantt-chart :rows="rows" :option="option" @task-update="handleTaskUpdate"></gantt-chart>
  </div>
</template>
```

## Usage with React

Example using React (TypeScript).
Since Web Components interact via DOM properties and native event listeners, use a `ref` to bind complex objects and events.

```tsx
import { useEffect, useRef, useState } from 'react'
import '@mogura/moguchart-core'
import type { GanttRow, GanttChartOption, TaskUpdateEventDetail } from '@mogura/moguchart-core'

// Type definition for JSX Custom Element
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
          start: new Date('2025-01-01'),
          end: new Date('2025-01-05'),
          progress: 50,
          style: 'background-color: #60a5fa',
        },
      ],
      markers: [
        {
          id: 'marker-1',
          name: 'Review Deadline',
          date: new Date('2025-01-03'),
          type: 'triangle-down',
          color: '#ef4444',
        },
      ],
    },
  ])

  const [option] = useState<GanttChartOption>({
    calendar: {
      start: new Date('2025-01-01'),
      end: new Date('2025-03-31'),
      pxPerDay: 30,
      showCurrentTime: true,
      milestones: [
        {
          id: 'ms-1',
          name: 'Release',
          start: new Date('2025-02-01'),
          color: '#8b5cf6',
        },
      ],
    },
    bar: { height: 28 },
    rowHeader: { width: 200 },
    theme: 'system',
    enableCrossRowMove: true,
    progress: {
      enabled: true,
      editable: true,
    },
    selection: {
      marquee: true,
    },
    minimap: {
      enabled: true,
    },
  })

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return

    // Bind properties
    chart.rows = rows
    chart.option = option

    // Bind event listeners
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
    <div style={{ height: '600px' }}>
      <gantt-chart ref={chartRef}></gantt-chart>
    </div>
  )
}
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

### Dependency Line Settings

Configure task dependency curves with the `dependency` option:

- `showArrows`: Toggle directional arrow heads (default: `true`).
- `arrowSize`: Arrow dimensions in pixels (default: `8`).
- `showConnectors`: Control whether circular connection handles appear on hover (default: `true`). Set to `false` to prevent creating new dependencies.
- `showCriticalPath`: Automatically detect the longest chain (critical path) and highlight connected tasks and lines in a distinct color (configurable via `theme.criticalPath`).

Reverse dependencies (right-to-left) automatically render smooth S-curves with perpendicular contact alignment.

```javascript
const option = {
  dependency: {
    showArrows: true,
    arrowSize: 10,
    showConnectors: true,
    showCriticalPath: true, // Highlight critical path tasks and links
  },
  // ...
}
```

### Task Progress Management

Visualize and interactively edit progress on task bars by specifying `progress` (`0` to `100`). Set `editable: true` to enable dragging the progress adjustment handle on the task bar.

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
    showLabel: true, // Display progress text (e.g. "50%")
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

#### exportImage

Exports the entire Gantt chart to a PNG image or PDF document. Preserves the user's scroll offset during export.

```javascript
// Automatically download as PNG image
await chart.exportImage('png', {
  fileName: 'gantt-chart.png',
  download: true,
})

// Retrieve as PDF Blob
const pdfBlob = await chart.exportImage('pdf')
```

#### Zoom Operations (`zoomTo`, `zoomToFit`, `resetZoom`)

Enable zoom via `option.zoom` (wheel zoom with Ctrl / Cmd key) and control zoom level programmatically:

```javascript
const option = {
  zoom: {
    enabled: true,
    min: 5,
    max: 150,
    step: 1.2,
  },
}

// Programmatic zoom control
chart.zoomTo(50) // Set zoom level to 50px per day (or month)
chart.zoomToFit() // Auto-fit all tasks into the visible container width
chart.resetZoom() // Reset to original configuration scale

// Listen to zoom level changes
chart.addEventListener('zoom-change', (e) => {
  console.log('New zoom level:', e.detail.pxPerDay || e.detail.pxPerMonth)
})
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

### Keyboard Operations

When the Gantt chart element is focused, keyboard shortcuts allow fast navigation, selection, movement, and deletion:

| Key                    | Action                                 |
| :--------------------- | :------------------------------------- |
| `←` `→`                | Move focus between tasks               |
| `↑` `↓`                | Move focus to another row              |
| `Enter` / `Space`      | Select the focused task                |
| `Ctrl/Cmd + Enter`     | Toggle selection state (multi-select)  |
| `Shift + ←` `→`        | Move selected tasks backward / forward |
| `Delete` / `Backspace` | Trigger `task-delete` event            |
| `Escape`               | Clear current selection and focus      |

```javascript
const option = {
  keyboard: {
    enabled: true, // Default: true
    moveStep: 60, // Move distance per Shift+Arrow key press (minutes)
  },
  // ...
}
```

## License

[MIT License](LICENSE)

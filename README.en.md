# @mogura/moguchart

A lightweight yet feature-rich Gantt chart Web Component built with Lit. Works with Vue, React, Angular, Svelte, and any other framework.

## Features

- 🚀 **Framework-agnostic**: Built as Web Components (Custom Elements), works in any environment.
- ⚡ **Virtual Scrolling**: Smooth performance even with large numbers of tasks and rows.
- 🖱️ **Interactive**:
  - Drag & drop task movement (including cross-row moves)
  - Handle-based duration resizing
  - Drag & drop row reordering
  - Column header width resizing
  - Multi-task selection & batch drag (Ctrl/Cmd + click)
  - Double-click and right-click event handling
- 🎨 **Highly Customizable**:
  - Custom rendering for task bars, row headers, tooltips, and drag info
  - Light/Dark/System theme switching + custom color themes
  - Task bar fill patterns (13 types including stripes, dots, checkerboard, etc.)
  - CSS styling
- 🔗 **Dependency Visualization**: Curved lines showing task dependencies
- 📅 **Flexible Calendar**:
  - Day / Week / Month view switching
  - Adjustable zoom level (pixels per day or per month) and display period
  - Current time line with badge (auto-refresh support)
  - Custom holiday detection logic
  - Configurable week start day
  - Locale support (Japanese, English, and custom locales)
- 🏁 **Milestones**: Display milestones (vertical line + name badge) on the chart
- 📍 **Markers**: Show triangle icons with labels on row timelines
- ✨ **Advanced Integration**:
  - External drag & drop for task creation
  - Task move/copy mode
  - Snap feature (grid snap by time unit, automatic monthly snap in month view)
  - `hitTest` method for getting row/date from coordinates
  - Programmatic task selection + auto-scroll (`selectTask`)

## Installation

```bash
pnpm add @mogura/moguchart
# or
npm install @mogura/moguchart
```

## API Reference

See [API.en.md](./doc/API.en.md) for a detailed API reference.

## Usage with Vue.js

Example using Vue.js (Vue 3).
When using Web Components, you may need to configure your build tool (e.g., `vite.config.ts`) to recognize custom elements.

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
          name: 'Review Deadline',
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
          name: 'Release',
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

## Usage with React

Example using React.
Since Web Components require direct property and event handling, use `ref` for implementation.

```tsx
import { useEffect, useRef, useState } from 'react'
import '@mogura/moguchart'
import type {
  GanttRow,
  GanttChartOption,
  TaskUpdateEventDetail,
} from '@mogura/moguchart'

// Type definition for TypeScript
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
          name: 'Review Deadline',
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
          name: 'Release',
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

    // Set properties
    chart.rows = rows
    chart.option = option

    // Set up event listeners
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

## Key Features

### Themes

Three theme modes are supported: light, dark, and system. Individual colors can be overridden using `customTheme`.

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

### Internationalization (i18n)

MoguChart provides built-in locale support. Japanese is the default locale for backward compatibility. Switch to English or create custom locales.

```javascript
import { enLocale } from '@mogura/moguchart'

const option = {
  locale: enLocale,
  // ...
}
```

To create a custom locale, implement the `MoguchartLocale` interface:

```typescript
import type { MoguchartLocale } from '@mogura/moguchart'

const frLocale: MoguchartLocale = {
  monthFormat: 'MMM YYYY',
  monthRowFormat: 'MMM',
  dateFormat: (d) => `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`,
  dateTimeFormat: (d) => {
    const date = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
    const h = d.getHours()
    const m = d.getMinutes()
    if (h === 0 && m === 0) return date
    return `${date} ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
  },
  duration: {
    days: (n) => `${n} jour${n > 1 ? 's' : ''}`,
    hours: (n) => `${n} heure${n > 1 ? 's' : ''}`,
    minutes: (n) => `${n} minute${n > 1 ? 's' : ''}`,
    zero: '0 minute',
  },
  tooltip: { duration: (d) => `Durée: ${d} jour${d > 1 ? 's' : ''}` },
  dragOverlay: {
    noTitle: 'Sans titre',
    moveTo: (name) => `Déplacer vers: ${name}`,
    movingTasks: (c) => `Déplacement de ${c} tâche${c > 1 ? 's' : ''}`,
  },
}
```

### Milestones

Pass an array of milestones to `calendar.milestones` to display vertical lines and badges on the chart. Hover effects transition opacity on mouseover.

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

Pass an array of markers to each row's `markers` property to display triangle icons with labels on the timeline.

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
        color: '#ef4444',
      },
    ],
  },
]
```

### Task Bar Patterns

Apply 13 types of fill patterns to task bars. Preset constants are also available.

```javascript
import { PATTERN_DIAGONAL_STRIPE } from '@mogura/moguchart'

const task = {
  id: 't-1',
  name: 'WIP',
  start: new Date('2024-01-01'),
  end: new Date('2024-01-05'),
  style: 'background-color: #60a5fa',
  pattern: PATTERN_DIAGONAL_STRIPE,    // Use preset
  // or specify directly:
  // pattern: { type: 'checkerboard', color: '#ffffff80' }
}
```

Available patterns: `diagonal-stripe` `diagonal-stripe-thin` `diagonal-stripe-thick` `diagonal-stripe-reverse` `vertical-stripe` `horizontal-stripe` `checkerboard` `dots` `dots-dense` `triangle` `circle` `grid` `diagonal-grid`

### Row Reordering

Set `enableRowReordering: true` to enable drag & drop row reordering.

```javascript
const option = {
  enableRowReordering: true,
  // ...
}

chart.addEventListener('row-reordered', (e) => {
  console.log('Reordered rows:', e.detail.rows)
})
```

### Multi-Task Selection & Batch Operations

Hold `Ctrl` (Mac: `Cmd`) and click task bars to select multiple tasks, then drag them together.

```javascript
chart.addEventListener('task-update', (e) => {
  const detail = e.detail
  if (!detail.isDragging && detail.selectedTaskIds?.length > 1) {
    // Multi-selection drag drop: apply same dx to all selected tasks
    for (const taskId of detail.selectedTaskIds) {
      applyDxToTask(taskId, detail.dx)
    }
  }
})
```

### Snap Feature

Control the snap interval when dragging tasks with `snapDuration` (in minutes). When using monthly view mode (`pxPerMonth`), snapping is automatically enforced at monthly boundaries.

```javascript
const option = {
  snapDuration: 60,    // Snap every hour (default: 1440 = 1 day)
  // ...
}
```

### View Modes

#### Week View Mode

Set `calendar.showWeeks: true` for a two-row calendar header with week numbers. This mode is enabled automatically when `pxPerDay` is less than 20.

```javascript
const option = {
  calendar: {
    start: new Date('2025-01-01'),
    end: new Date('2025-12-31'),
    pxPerDay: 15,
    showWeeks: true,
    weekStartDay: 1,   // 1 = Monday (default)
    weekFormat: (weekNum) => `W${weekNum}`,
  },
}
```

#### Monthly View Mode

Set `calendar.pxPerMonth` to render each month at a fixed equal width. Snapping is automatically enforced at monthly boundaries.

```javascript
const option = {
  calendar: {
    start: new Date('2025-01-01'),
    end: new Date('2027-12-31'),
    pxPerDay: 1,
    pxPerMonth: 120,    // 120px per month
    showMonthsRow: true, // Two-row header: top=year, bottom=month
  },
}
```

### Public Methods

#### selectTask

Selects the task with the specified ID and auto-scrolls if it's off-screen.

```javascript
const chart = document.querySelector('gantt-chart')
const found = chart.selectTask('task-1')
```

#### hitTest

Returns the corresponding row ID and date from client coordinates (pixel position on screen).

```javascript
document.addEventListener('mousemove', (e) => {
  const result = chart.hitTest(e.clientX, e.clientY)
  if (result) {
    console.log(`Row: ${result.rowId}, Date: ${result.date}`)
  }
})
```

## License

MIT

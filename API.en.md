# MoguChart API Reference

MoguChart is a Gantt chart Web Component built with Lit.

## Component

```html
<gantt-chart></gantt-chart>
```

## Properties

Properties that can be passed to the component.

| Property               | Type                | Description                                                                                                                                                               |
| :--------------------- | :------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `rows`                 | `GanttRow[]`        | Array of row data to display in the Gantt chart. Each row contains tasks.                                                                                                 |
| `option`               | `GanttChartOption`  | Options object for configuring chart appearance and behavior.                                                                                                             |
| `theme`                | `'light' \| 'dark'` | (Attribute) Specifies the theme. Serves as the base for CSS variable styling. If `option.theme` is specified, it takes precedence.                                        |
| `selectedRowIds`       | `string[]`          | Array of row IDs to set as selected.                                                                                                                                      |
| `selectedTaskIds`      | `string[]`          | Array of task IDs to set as selected.                                                                                                                                     |
| `externalDraggingTask` | `GanttTask \| null` | When dragging a task from outside the component, pass the task information here. This displays a preview (ghost) of the dragged task on the chart.                        |

## Options (GanttChartOption)

Structure of the object passed to the `option` property.

```typescript
interface GanttChartOption {
  /** Bar (task) style settings */
  bar?: {
    height?: number // Bar height (px)
    margin?: number // Bar top/bottom margin (px)
    cornerRadius?: number // Bar corner radius (px)
  }
  /** Row header settings */
  rowHeader?: {
    width?: number // Row header width (px)
    backgroundColor?: string // Row header background color
    resizable?: boolean // Enable width resizing (default: true)
    minWidth?: number // Minimum resizable width (default: 50)
    maxWidth?: number // Maximum resizable width (default: unlimited)
  }
  /** Calendar (timeline) settings */
  calendar: {
    start: Date // Display start date
    end: Date // Display end date
    pxPerDay: number // Width per day (px)
    monthFormat?: string // Month display format (e.g., 'MMM YYYY')
    showRowBackground?: boolean // Whether to show row backgrounds
    isHoliday?: (date: Date) => boolean // Custom holiday detection logic
    showTime?: boolean // Whether to show time-unit grid
    showMonths?: boolean // Whether to show year/month headers
    showDays?: boolean // Whether to show date headers
    showCurrentTime?: boolean // Whether to show the current time line (default: false)
    showCurrentTimeBadge?: boolean // Whether to show the current time badge
    currentTimeUpdateInterval?: number // Current time line update interval (ms, default: 0 = no update)
    milestones?: GanttChartMilestone[] // Array of milestones
  }
  /** Whether the chart is read-only */
  readOnly?: boolean
  /** Whether to show tooltips */
  showTooltip?: boolean // (default: true)
  /** Delay before showing tooltips (ms) */
  tooltipDelay?: number // (default: 0)
  /** Whether to show the drag info overlay */
  showDragInfoOverlay?: boolean // (default: true)
  /** Theme setting ('light', 'dark', 'system') */
  theme?: 'light' | 'dark' | 'system'
  /** Custom theme colors (for overriding specific colors) */
  customTheme?: Partial<ThemeColorPalette>
  /** Enable drag & drop row reordering */
  enableRowReordering?: boolean // (default: false)
  /** Snap interval for task dragging (in minutes). E.g., 60 snaps to 1-hour intervals. */
  snapDuration?: number // (default: 1440 = 1 day)
  /** Whether to show rows with visible: false */
  showHiddenRows?: boolean // (default: false)
  /** Locale settings for internationalization */
  locale?: MoguchartLocale
  customRendering?: {
    /** Function to render bar content. Can return a string or Lit TemplateResult. */
    barContent?: (task: GanttTask) => string | unknown
    /** Function to render row header content. Can return a string or Lit TemplateResult. */
    rowHeaderContent?: (row: GanttRow) => string | unknown
    /** Function to render tooltip content. Can return a string or Lit TemplateResult. */
    tooltip?: (task: GanttTask) => string | unknown
    /** Function to render drag info overlay content. Can return a string or Lit TemplateResult. */
    dragInfo?: (task: GanttTask, newStart: Date, newEnd: Date, targetRow?: GanttRow) => string | unknown
  }
}
```

## Events

Custom events dispatched by the component.

| Event Name               | Detail (e.detail)                   | Description                                                                              |
| :----------------------- | :---------------------------------- | :--------------------------------------------------------------------------------------- |
| `rows-change`            | `GanttRow[]`                        | Fired when row data changes due to reordering or task movement.                          |
| `row-reordered`          | `RowReorderEventDetail`             | Fired when rows are reordered via drag & drop.                                           |
| `row-selection-change`   | `RowSelectionChangeEventDetail`     | Fired when row selection changes via checkbox or header click.                           |
| `bar-selection-change`   | `BarSelectionChangeEventDetail`     | Fired when task bar selection changes.                                                   |
| `row-clicked`            | `RowClickedEventDetail`             | Fired when a row header is clicked.                                                      |
| `task-update`            | `TaskUpdateEventDetail`             | Fired when a task is updated via drag & drop or resize.                                  |
| `task-drop`              | `TaskDropEventDetail`               | Fired when an external element is dropped. Can be used for creating new tasks.           |
| `row-header-resize`      | `RowHeaderResizeEventDetail`        | Fired when the row header width is resized.                                              |
| `row-header-dblclick`    | `RowHeaderDblClickEventDetail`      | Fired when a row header is double-clicked.                                               |
| `row-header-contextmenu` | `RowHeaderContextMenuEventDetail`   | Fired when a row header is right-clicked. Use for implementing custom context menus.     |
| `task-dblclick`          | `TaskClickEventDetail`              | Fired when a task bar is double-clicked.                                                 |
| `task-contextmenu`       | `TaskContextMenuEventDetail`        | Fired when a task bar is right-clicked. Use for implementing custom context menus.       |
| `chart-contextmenu`      | `ChartContextMenuEventDetail`       | Fired when the chart background (area without tasks) is right-clicked.                   |

## Methods

Public methods that can be called on the component instance.

| Method       | Signature                                                                    | Description                                                                                                                                                                  |
| :----------- | :--------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `selectTask` | `(taskId: string) => boolean`                                                | Selects the task with the specified ID. If the task is off-screen, it auto-scrolls to show it. Returns `true` if the task was found, `false` otherwise.                      |
| `hitTest`    | `(clientX: number, clientY: number) => { rowId: string; date: Date } \| null` | Returns the corresponding Gantt chart row ID and date from client coordinates (pixel position on screen). Returns `null` if the coordinates are outside the chart area.      |

### Usage Examples

#### selectTask

```javascript
const chart = document.querySelector('gantt-chart')

// Select a task and scroll to its position
const success = chart.selectTask('task-1')

if (!success) {
  console.warn('Specified task not found')
}
```

> **Note:** Calling `selectTask` also fires the `bar-selection-change` event.

#### hitTest

```javascript
const chart = document.querySelector('gantt-chart')

// Get the row and date from mouse coordinates on the Gantt chart
document.addEventListener('mousemove', (e) => {
  const result = chart.hitTest(e.clientX, e.clientY)
  if (result) {
    console.log(`Row: ${result.rowId}, Date: ${result.date}`)
  }
})
```

> **Note:** `hitTest` calculates the accurate date by considering scroll position and calendar settings. It's useful for implementing operations based on mouse position, such as paste via keyboard shortcuts.

## Type Definitions

Key type definitions used in event details and other interfaces.

### GanttRow

```typescript
interface GanttRow {
  id: string // Unique row ID
  name: string // Label displayed in the row header
  tasks: GanttTask[] // Array of tasks in this row
  markers?: GanttMarker[] // Array of markers displayed in this row
  visible?: boolean // Whether to show the row (default: true)
}
```

### GanttTask

```typescript
interface GanttTask {
  id: string // Unique task ID
  name?: string // Task display name
  start: Date // Start date/time
  end: Date // End date/time
  style?: string // Custom bar style (CSS string)
  labelStyle?: string // Custom bar label style (CSS string)
  pattern?: GanttTaskPattern // Bar fill pattern
  dependencies?: string[] // IDs of dependent tasks
  movable?: 'both' | 'x' | 'y' | 'none' // Movement permission ('both': both axes, 'x': horizontal only, 'y': vertical only, 'none': disabled)
  resizable?: boolean // Whether resizing is allowed (defaults to movable setting when unset)
}
```

### GanttTaskPattern

```typescript
interface GanttTaskPattern {
  // Pattern type
  // Available values: 'diagonal-stripe' | 'diagonal-stripe-thin' | 'diagonal-stripe-thick' | 'diagonal-stripe-reverse' | 'vertical-stripe' | 'horizontal-stripe' | 'checkerboard' | 'dots' | 'dots-dense' | 'triangle' | 'circle' | 'grid' | 'diagonal-grid'
  type: BarPattern
  color?: string // Pattern color
}
```

### GanttChartMilestone

```typescript
interface GanttChartMilestone {
  id: string // Unique milestone ID
  name: string // Milestone display name
  start: Date // Milestone date/time
  color: string // Milestone color (CSS color string)
  width?: number // Line width (px, default: 2)
  style?: string // Custom style (CSS string)
}
```

### MarkerType

```typescript
type MarkerType = 'triangle-up' | 'triangle-down' | 'triangle-left' | 'triangle-right'
```

### AnchorType

```typescript
type AnchorType = 'start' | 'end' | 'center'
```

### GanttMarker

```typescript
interface GanttMarker {
  id: string // Unique marker ID
  name?: string // Marker display name (text displayed next to or below the icon)
  date: Date // Marker date/time
  anchor?: AnchorType // Anchor position ('start': date is marker's left edge, 'end': date is marker's right edge, 'center': date is marker's center + label below, unset: center)
  type: MarkerType // Triangle direction
  color?: string // Marker color (CSS color string)
  style?: string // Custom marker style (CSS string)
}
```

### MoguchartLocale

```typescript
interface MoguchartLocale {
  /** Default month display format (dayjs-compatible format string) */
  monthFormat: string
  /** Date format function (e.g., "2024/1/15" / "1/15/2024") */
  dateFormat: (date: Date) => string
  /** Date-time format function (used when time is not 00:00) */
  dateTimeFormat: (date: Date) => string
  /** Duration formatting */
  duration: {
    /** Days format (e.g., 3 → "3日" / "3 days") */
    days: (n: number) => string
    /** Hours format (e.g., 2 → "2時間" / "2 hours") */
    hours: (n: number) => string
    /** Minutes format (e.g., 30 → "30分" / "30 minutes") */
    minutes: (n: number) => string
    /** Display when duration is zero */
    zero: string
  }
  /** Default tooltip strings */
  tooltip: {
    /** Duration display (e.g., 5 → "Duration: 5 days") */
    duration: (days: number) => string
  }
  /** Drag overlay strings */
  dragOverlay: {
    /** Fallback when title is not set */
    noTitle: string
    /** Move target display (e.g., "Move to: Row1") */
    moveTo: (name: string) => string
    /** Multi-task move display (e.g., "Moving 3 tasks") */
    movingTasks: (count: number) => string
  }
}
```

### RowReorderEventDetail

```typescript
interface RowReorderEventDetail {
  sourceId: string // Source row ID (single selection)
  sourceIds?: string[] // Source row IDs (multi-selection)
  targetId: string // Drop target row ID
  position?: 'top' | 'bottom' // Position relative to the target
  rows: GanttRow[] // New row data array after reordering
}
```

### TaskUpdateEventDetail

```typescript
interface TaskUpdateEventDetail extends GanttTask {
  dx?: number // Horizontal movement amount (px)
  dy: number // Vertical movement amount (px)
  isDragging: boolean // Whether currently dragging
  targetRowId?: string // Target row ID (for cross-row moves)
  x?: number // Mouse X coordinate (during drag only)
  y?: number // Mouse Y coordinate (during drag only)
  mode: GanttTaskMoveMode // Move mode ('move' | 'copy')
  selectedTaskIds?: string[] // Target task IDs for multi-selection drag
}
```

### TaskDropEventDetail

```typescript
interface TaskDropEventDetail {
  task: GanttTask // Original data of the dropped task
  dropDate: Date // Date corresponding to the drop position
  targetRowId: string // Target row ID
}
```

### RowHeaderResizeEventDetail

```typescript
interface RowHeaderResizeEventDetail {
  width: number // New width after resizing
}
```

### TaskClickEventDetail

```typescript
interface TaskClickEventDetail {
  task: GanttTask // Clicked task data
  event: MouseEvent // Original click event
}
```

### TaskContextMenuEventDetail

```typescript
interface TaskContextMenuEventDetail {
  task: GanttTask // Target task data
  event: MouseEvent // Original context menu event (use for coordinates, etc.)
}
```

### RowSelectionChangeEventDetail

```typescript
interface RowSelectionChangeEventDetail {
  selectedIds: string[] // Array of all currently selected row IDs
}
```

### BarSelectionChangeEventDetail

```typescript
interface BarSelectionChangeEventDetail {
  selectedIds: string[] // Array of all currently selected task IDs
}
```

### RowClickedEventDetail

```typescript
// Detail for the row-clicked event (fired from gantt-row)
interface RowClickedEventDetail {
  rowId: string // Clicked row ID
  event: MouseEvent // Original click event
}
```

### RowHeaderDblClickEventDetail

```typescript
interface RowHeaderDblClickEventDetail {
  rowId: string // Double-clicked row ID
  row: GanttRow // Double-clicked row data
  event: MouseEvent // Original double-click event
  target: HTMLElement // Double-clicked header element
}
```

### RowHeaderContextMenuEventDetail

```typescript
interface RowHeaderContextMenuEventDetail {
  rowId: string // Right-clicked row ID
  row: GanttRow // Right-clicked row data
  event: MouseEvent // Original context menu event
  target: HTMLElement // Right-clicked header element
}
```

### ChartContextMenuEventDetail

```typescript
interface ChartContextMenuEventDetail {
  event: MouseEvent // Original context menu event
  date: Date // Date corresponding to the clicked position
  rowId: string // Clicked row ID
}
```

### ThemeColorPalette

Key definitions used for customizing theme colors.

```typescript
interface ThemeColorPalette {
  bg: string // Background color
  text: string // Text color
  border: string // Border color
  gridLine: string // Grid line color
  subGridLine: string // Sub-grid line color
  dragTarget: string // Drag target background color
  tooltipBg: string // Tooltip background color
  tooltipText: string // Tooltip text color
  dragOverlayBg: string // Drag overlay background color
  dragOverlayText: string // Drag overlay text color
  dragOverlaySubText: string // Drag overlay sub-text color
  dragOverlayDivider: string // Drag overlay divider color
  dependencyLine: string // Dependency line color
  calendarBg: string // Calendar area background color
  saturday: string // Saturday background color
  sunday: string // Sunday background color
  holiday: string // Holiday background color
  rowHeaderBg: string // Row header background color
  rowSelected: string // Selected row background color
  rowSelectedHeader: string // Selected row header background color
  rowHiddenBg: string // Hidden row background color
  currentTimeLine: string // Current time line color
  currentTimeLineText: string // Current time line badge text color
  monday?: string // Monday background color (optional)
  tuesday?: string // Tuesday background color (optional)
  wednesday?: string // Wednesday background color (optional)
  thursday?: string // Thursday background color (optional)
  friday?: string // Friday background color (optional)
}
```

### GanttTaskMoveMode

```typescript
type GanttTaskMoveMode = 'copy' | 'move'
```

## Multi-Task Selection and Dragging

Hold `Ctrl` (Mac: `Cmd`) and click task bars to select multiple tasks. Selection state is communicated via the `bar-selection-change` event.

### Drag Behavior with Multi-Selection

When multiple task bars are selected and one of them is dragged, all selected bars move together.

- **Horizontal movement only**: Multi-selection drag is restricted to horizontal (date direction) movement only. Cross-row (vertical) movement is not available.
- **Ghost display**: While dragging, selected bars other than the one being directly dragged are displayed as semi-transparent ghosts, moving in sync with the same horizontal movement.
- **`task-update` event**: The `task-update` event fired on drop includes all selected task IDs in the `selectedTaskIds` field. The consumer should reference this ID list to apply the same `dx` to all selected tasks.

### Usage Example

```javascript
const chart = document.querySelector('gantt-chart')

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

## Milestones

Pass an array of milestones to `calendar.milestones` to display vertical lines and badges on the chart.

- Vertical lines are displayed on the chart body, and name badges appear in the calendar's year/month row.
- Normally displayed semi-transparent (opacity: 0.5), becoming opaque on mouseover of the badge or line.
- Badge and line hover effects are synchronized.

### Usage Example

```javascript
const chart = document.querySelector('gantt-chart')

chart.option = {
  calendar: {
    start: new Date('2025-04-01'),
    end: new Date('2025-06-30'),
    pxPerDay: 30,
    milestones: [
      {
        id: 'ms-1',
        name: 'Alpha Release',
        start: new Date('2025-04-08'),
        color: '#8b5cf6',
        width: 4, // Thick line
      },
      {
        id: 'ms-2',
        name: 'Production Release',
        start: new Date('2025-05-01'),
        color: '#10b981',
      },
    ],
  },
}
```

## Markers

Pass an array of markers to each row's `markers` property to display triangle icons with labels on the row timeline.

- Choose from 4 triangle directions (up, down, left, right).
- Control the marker's reference position with `anchor`.
  - `'start'`: date is the marker's left edge. Label is displayed to the right of the icon.
  - `'end'`: date is the marker's right edge. Label is displayed to the left of the icon.
  - `'center'`: date is the marker's center. Label is displayed below the icon, centered. The bottom edge of the marker is aligned with the row's vertical center.
  - Unset: date is the marker's center. Label is displayed to the right of the icon.
- Setting `name` displays a text label.

### Usage Example

```javascript
const rows = [
  {
    id: 'row-1',
    name: 'Project A',
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
      {
        id: 'marker-2',
        name: 'Scheduled Release',
        date: new Date('2025-04-20'),
        anchor: 'start',
        type: 'triangle-left',
        color: '#3b82f6',
      },
      {
        id: 'marker-3',
        name: '★',
        date: new Date('2025-04-15'),
        anchor: 'center',
        type: 'triangle-down',
        color: '#ef4444',
      },
    ],
  },
]
```

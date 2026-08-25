# moguchart-core API Reference

moguchart-core is a Gantt chart Web Component built with Lit.

## Component

```html
<gantt-chart></gantt-chart>
```

## Properties

Properties that can be passed to the component.

| Property               | Type                | Description                                                                                                                                        |
| :--------------------- | :------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rows`                 | `GanttRow[]`        | Array of row data to display in the Gantt chart. Each row contains tasks.                                                                          |
| `option`               | `GanttChartOption`  | Options object for configuring chart appearance and behavior.                                                                                      |
| `theme`                | `'light' \| 'dark'` | (Attribute) Specifies the theme. Serves as the base for CSS variable styling. If `option.theme` is specified, it takes precedence.                 |
| `selectedRowIds`       | `string[]`          | Array of row IDs to set as selected.                                                                                                               |
| `selectedTaskIds`      | `string[]`          | Array of task IDs to set as selected.                                                                                                              |
| `externalDraggingTask` | `GanttTask \| null` | When dragging a task from outside the component, pass the task information here. This displays a preview (ghost) of the dragged task on the chart. |

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
    pxPerMonth?: number // Width per month (px). When specified, each month is rendered at a fixed equal width.
    monthFormat?: string // Month display format (e.g., 'MMM YYYY')
    showRowBackground?: boolean // Whether to show row backgrounds
    isHoliday?: (date: Date) => boolean // Custom holiday detection logic
    showTime?: boolean // Whether to show time-unit grid
    showMonths?: boolean // Whether to show year/month headers
    showDays?: boolean // Whether to show date headers
    showCurrentTime?: boolean // Whether to show the current time line (default: false)
    showCurrentTimeBadge?: boolean // Whether to show the current time badge
    currentTimeUpdateInterval?: number // Current time line update interval (ms, default: 0 = no update)
    showWeeks?: boolean // Whether to show week number headers
    weekStartDay?: 0 | 1 | 2 | 3 | 4 | 5 | 6 // First day of the week (0=Sun ~ 6=Sat, default: 1=Mon)
    weekFormat?: (weekNumber: number, startDate: Date) => string // Custom week number format function
    weekTextAlign?: 'left' | 'center' | 'right' // Week cell text alignment (default: 'center')
    showMonthsRow?: boolean // Enable two-row month view (top=year, bottom=month)
    monthTextAlign?: 'left' | 'center' | 'right' // Month cell text alignment (default: 'center')
    milestones?: GanttChartMilestone[] // Array of milestones
    showCursorLine?: boolean // Whether to show a vertical line that follows the mouse cursor (default: false)
    cursorLineColor?: string // Color of the cursor tracking line (CSS color string; defaults to currentTimeLine color)
  }
  /** Whether the chart is read-only */
  readOnly?: boolean
  /** Whether to show tooltips */
  showTooltip?: boolean // (default: true)
  /** Delay before showing tooltips (ms) */
  tooltipDelay?: number // (default: 500)
  /** Whether to show the drag info overlay */
  showDragInfoOverlay?: boolean // (default: true)
  /** Theme setting ('light', 'dark', 'system') */
  theme?: 'light' | 'dark' | 'system'
  /** Custom theme colors (for overriding specific colors) */
  customTheme?: Partial<ThemeColorPalette>
  /** Enable drag & drop row reordering */
  enableRowReordering?: boolean // (default: false)
  /** Whether to allow dragging tasks across different rows (default: true) */
  enableCrossRowMove?: boolean // (default: true)
  /** Snap interval for task dragging (in minutes). E.g., 60 snaps to 1-hour intervals. */
  snapDuration?: number // (default: 1440 = 1 day)
  /** Whether to show rows with visible: false */
  showHiddenRows?: boolean // (default: false)
  /** Locale settings for internationalization (default: Japanese) */
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
    /** Function to render the top-left corner cell of the row header. Can return a string or Lit TemplateResult. */
    cornerContent?: () => string | unknown
    /** Function to render calendar month cells. Return an HTMLElement or HTML string. */
    calendarMonthContent?: (context: CalendarMonthCellContext) => string | unknown
    /** Function to render calendar day cells. Return an HTMLElement or HTML string. */
    calendarDayContent?: (context: CalendarDayCellContext) => string | unknown
    /** Function to render calendar week cells. Return an HTMLElement or HTML string. */
    calendarWeekContent?: (context: CalendarWeekCellContext) => string | unknown
    /** Function to render calendar hour cells. Return an HTMLElement or HTML string. */
    calendarHourContent?: (context: CalendarHourCellContext) => string | unknown
    /** Function to render Gantt chart background cells. Called for each day cell per row. Return an HTML string or TemplateResult. */
    chartBackground?: (context: ChartBackgroundCellContext) => string | unknown
    /** Function to render row header tooltip content. Called on mouse hover. Can return a string, HTMLElement, or Lit TemplateResult. */
    rowHeaderTooltip?: (row: GanttRow) => string | HTMLElement | unknown
  }
  /** Dependency line settings */
  dependency?: GanttChartOptionDependency
  /** Keyboard operation settings */
  keyboard?: {
    /** Whether to enable keyboard operations (default: true) */
    enabled?: boolean
    /** Task move amount per Shift+Arrow key press (in minutes). Uses snapDuration when omitted */
    moveStep?: number
  }
  /** Zoom feature settings */
  zoom?: {
    /** Whether to enable zoom (default: false) */
    enabled?: boolean
    /** Minimum pxPerDay (default: 2). Acts as minimum pxPerMonth in monthly mode */
    min?: number
    /** Maximum pxPerDay (default: 200). Acts as maximum pxPerMonth in monthly mode */
    max?: number
    /** Zoom multiplier per wheel tick (default: 1.2) */
    step?: number
  }
  /** Overview Minimap configuration */
  minimap?: {
    enabled?: boolean // Whether to enable minimap (default: false)
    width?: number // Width of the minimap in px (default: 200)
    height?: number // Height of the minimap in px (default: 120)
    maxHeight?: number // Maximum height when preserving aspect ratio in px (default: height or 120)
    preserveAspectRatio?: boolean // Whether to preserve the chart content aspect ratio (default: true)
    resizable?: boolean // Whether to allow drag resizing by user (default: true)
    minWidth?: number // Minimum width during resize in px (default: 120)
    maxWidth?: number // Maximum width during resize in px (default: 600)
    minHeight?: number // Minimum height during resize in px (default: 60)
    collapsible?: boolean // Whether to show collapse button (default: true)
    collapsed?: boolean // Whether initially collapsed (default: false)
    showMilestones?: boolean // Whether to display milestones on minimap (default: true)
    showCurrentTime?: boolean // Whether to display current time line on minimap (default: true)
    position?: { x: number; y: number } // Initial position of minimap in px relative to parent
  }
}
```

## Events

Custom events dispatched by the component.

| Event Name               | Detail (e.detail)                 | Description                                                                          |
| :----------------------- | :-------------------------------- | :----------------------------------------------------------------------------------- |
| `rows-change`            | `GanttRow[]`                      | Fired when row data changes due to reordering or task movement.                      |
| `row-reordered`          | `RowReorderEventDetail`           | Fired when rows are reordered via drag & drop.                                       |
| `row-selection-change`   | `RowSelectionChangeEventDetail`   | Fired when row selection changes via checkbox or header click.                       |
| `bar-selection-change`   | `BarSelectionChangeEventDetail`   | Fired when task bar selection changes.                                               |
| `bar-hover`              | `BarHoverEventDetail`             | Fired when a task bar is hovered over.                                               |
| `row-clicked`            | `RowClickedEventDetail`           | Fired when a row header is clicked.                                                  |
| `task-update`            | `TaskUpdateEventDetail`           | Fired when a task is updated via drag & drop or resize.                              |
| `minimap-resize`         | `MinimapResizeEventDetail`        | Fired when the minimap is resized by user dragging.                                  |
| `minimap-move`           | `MinimapMoveEventDetail`          | Fired when the minimap is dragged/moved by user.                                     |
| `task-drop`              | `TaskDropEventDetail`             | Fired when an external element is dropped. Can be used for creating new tasks.       |
| `row-header-resize`      | `RowHeaderResizeEventDetail`      | Fired when the row header width is resized.                                          |
| `row-header-click`       | `RowHeaderClickEventDetail`       | Fired when a row header is clicked.                                                  |
| `row-header-dblclick`    | `RowHeaderDblClickEventDetail`    | Fired when a row header is double-clicked.                                           |
| `row-header-contextmenu` | `RowHeaderContextMenuEventDetail` | Fired when a row header is right-clicked. Use for implementing custom context menus. |
| `task-dblclick`          | `TaskClickEventDetail`            | Fired when a task bar is double-clicked.                                             |
| `task-contextmenu`       | `TaskContextMenuEventDetail`      | Fired when a task bar is right-clicked. Use for implementing custom context menus.   |
| `chart-contextmenu`      | `ChartContextMenuEventDetail`     | Fired when the chart background (area without tasks) is right-clicked.               |
| `dependency-create`      | `DependencyCreateEventDetail`     | Fired when a dependency is created via drag & drop from a task bar connector.        |
| `dependency-click`       | `DependencyClickEventDetail`      | Fired when a dependency line is clicked.                                             |
| `task-delete`            | `TaskDeleteEventDetail`           | Fired when Delete / Backspace key is pressed while tasks are selected.               |
| `zoom-change`            | `ZoomChangeEventDetail`           | Fired when the zoom level changes (via Ctrl+wheel, `zoomTo()`, or `resetZoom()`).    |
| `marker-dblclick`        | `MarkerDblClickEventDetail`       | Fired when a marker is double-clicked.                                               |
| `marker-contextmenu`     | `MarkerContextMenuEventDetail`    | Fired when a marker is right-clicked. Use for implementing custom context menus.     |

## Methods

Public methods that can be called on the component instance.

| Method            | Signature                                                                                   | Description                                                                                                                                                                                     |
| :---------------- | :------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `selectTask`      | `(taskId: string) => boolean`                                                               | Selects the task with the specified ID. If the task is off-screen, it auto-scrolls to show it. Returns `true` if the task was found, `false` otherwise.                                         |
| `hitTest`         | `(clientX: number, clientY: number) => { rowId: string; date: Date } \| null`               | Returns the corresponding Gantt chart row ID and date from client coordinates (pixel position on screen). Returns `null` if the coordinates are outside the chart area.                         |
| `exportImage`     | `(format: 'png' \| 'pdf' = 'png', options?: ExportImageOptions) => Promise<string \| Blob>` | Exports the entire Gantt chart as an image or PDF. Returns a Data URL (string) for PNG, or a Blob for PDF. If `options.download: true` is specified, it automatically starts the file download. |
| `zoomTo`          | `(value: number) => void`                                                                   | Sets the zoom to the specified pxPerDay (or pxPerMonth in monthly mode). Clamped to zoom.min/max range.                                                                                         |
| `zoomToFit`       | `() => void`                                                                                | Automatically adjusts the zoom level so that all tasks fit within the visible area. Scrolls to the task start position.                                                                          |
| `resetZoom`       | `() => void`                                                                                | Resets zoom to the original scale set by `option.calendar.pxPerDay` (or `pxPerMonth`).                                                                                                          |
| `getRowPositions` | `() => { top: number; height: number; bottom: number }[]`                                   | Returns Y-coordinate layout information for each row (relative to the top of the row area, excluding the calendar header). Useful for calculating split positions during export.                 |

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

#### exportImage

```javascript
const chart = document.querySelector('gantt-chart')

// Get PNG data URL
const pngDataUrl = await chart.exportImage('png')

// Download as PDF
await chart.exportImage('pdf', {
  filename: 'my-gantt', // Default: 'gantt-chart'
  download: true, // Starts file download if true
})

// Embed PNG in an img tag
const img = document.createElement('img')
img.src = await chart.exportImage('png')
document.body.appendChild(img)
```

**ExportImageOptions**

```typescript
interface ExportImageOptions {
  /** Filename for download (without extension). Default: 'gantt-chart' */
  filename?: string
  /** If true, automatically starts file download. Default: false */
  download?: boolean
  /** Scale factor for PNG export (higher resolution). Default: 2 */
  scale?: number
  /** Splits the image vertically at the specified pixel height and inserts a calendar (header) at each split position. Unspecified means no split. */
  splitHeight?: number
}
```

> **Note:** `exportImage` exports the entire chart (all scrollable area) regardless of current scroll position. Shadow DOM styles are automatically collected. However, external fonts or images might not render correctly if they are cross-origin.

#### zoomTo / zoomToFit / resetZoom

```javascript
const chart = document.querySelector('gantt-chart')

// Enable zoom (requires option configuration)
chart.option = {
  ...chart.option,
  zoom: { enabled: true, min: 5, max: 200, step: 1.2 }
}

// Zoom to a specific pxPerDay
chart.zoomTo(100)

// Auto-fit all tasks into the viewport
chart.zoomToFit()

// Reset to original scale
chart.resetZoom()

// Listen for zoom change events
chart.addEventListener('zoom-change', (e) => {
  console.log(`pxPerDay: ${e.detail.pxPerDay}`)
  // Optionally sync option.calendar.pxPerDay
})
```

> **Note:** Zoom can also be controlled via `Ctrl+mouse wheel` (Mac: `Cmd+wheel`). During zoom, the scroll position is automatically adjusted to keep the date under the cursor in place. Setting `option` to a new object resets the zoom.

## Type Definitions

Key type definitions used in event details and other interfaces.

### GanttRow

```typescript
interface GanttRow {
  id: string // Unique row ID
  name: string // Label displayed in the row header
  tasks: GanttTask[] // Array of tasks in this row
  markers?: GanttMarker[] // Array of markers displayed in this row
  selectedMarkerId?: string // Currently selected (editing) marker ID
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

### GanttChartOptionCustomRendering

Type definition for the object passed to `option.customRendering`.

```typescript
interface GanttChartOptionCustomRendering {
  /** Function to render bar content. Can return a string or Lit TemplateResult. */
  barContent?: (task: GanttTask) => string | unknown
  /** Function to render row header content. Can return a string or Lit TemplateResult. */
  rowHeaderContent?: (row: GanttRow) => string | unknown
  /** Function to render tooltip content. Can return a string or Lit TemplateResult. */
  tooltip?: (task: GanttTask) => string | unknown
  /** Function to render drag info overlay content. Can return a string or Lit TemplateResult. */
  dragInfo?: (task: GanttTask, newStart: Date, newEnd: Date, targetRow?: GanttRow) => string | unknown
  /** Function to render the top-left corner cell of the row header. Can return a string or Lit TemplateResult. */
  cornerContent?: () => string | unknown
  /** Function to render calendar month cells. Return an HTMLElement or HTML string. */
  calendarMonthContent?: (context: CalendarMonthCellContext) => string | unknown
  /** Function to render calendar day cells. Return an HTMLElement or HTML string. */
  calendarDayContent?: (context: CalendarDayCellContext) => string | unknown
  /** Function to render calendar week cells. Return an HTMLElement or HTML string. */
  calendarWeekContent?: (context: CalendarWeekCellContext) => string | unknown
  /** Function to render calendar hour cells. Return an HTMLElement or HTML string. */
  calendarHourContent?: (context: CalendarHourCellContext) => string | unknown
  /** Function to render Gantt chart background cells. Called for each day cell per row. Return an HTML string or TemplateResult. */
  chartBackground?: (context: ChartBackgroundCellContext) => string | unknown
  /** Function to render row header tooltip content. Called on mouse hover. Can return a string, HTMLElement, or Lit TemplateResult. */
  rowHeaderTooltip?: (row: GanttRow) => string | HTMLElement | unknown
}
```

### CalendarMonthCellContext

Context passed when custom rendering calendar month cells.

```typescript
interface CalendarMonthCellContext {
  year: number // Year
  month: number // Month (0-11)
  width: number // Cell width (px)
  defaultLabel: string // Default label text
}
```

### CalendarDayCellContext

Context passed when custom rendering calendar day cells.

```typescript
interface CalendarDayCellContext {
  date: Date // Date
  width: number // Cell width (px)
  isSaturday: boolean // Whether it is Saturday
  isSunday: boolean // Whether it is Sunday
  isHoliday: boolean // Whether it is a holiday
  defaultLabel: string // Default label text
}
```

### CalendarWeekCellContext

Context passed when custom rendering calendar week cells.

```typescript
interface CalendarWeekCellContext {
  weekNumber: number // Week number
  startDate: Date // Start date of the week
  width: number // Cell width (px)
  defaultLabel: string // Default label text
}
```

### CalendarHourCellContext

Context passed when custom rendering calendar hour cells.

```typescript
interface CalendarHourCellContext {
  hour: number // Hour (0-23)
  width: number // Cell width (px)
  date: Date // Corresponding date
}
```

### ChartBackgroundCellContext

Context passed when custom rendering Gantt chart background cells. Called for each day cell in each row.

```typescript
interface ChartBackgroundCellContext {
  date: Date // Date
  width: number // Cell width (px)
  height: number // Cell height (px)
  rowId: string // Row ID
  isSaturday: boolean // Whether it is Saturday
  isSunday: boolean // Whether it is Sunday
  isHoliday: boolean // Whether it is a holiday
  defaultColor: string // Default background color
  index: number // Column index (0-based)
}
```

#### cornerContent Usage Example

```javascript
const option = {
  customRendering: {
    // Example: placing a custom button in the top-left corner cell of the row header
    cornerContent: () => {
      const btn = document.createElement('button')
      btn.textContent = 'Filter'
      btn.style.cssText = 'border: none; background: transparent; cursor: pointer; padding: 4px 8px;'
      btn.addEventListener('click', () => {
        console.log('Filter button clicked')
      })
      return btn
    },
    // Custom bar rendering
    barContent: (task) => {
      const div = document.createElement('div')
      div.style.padding = '2px 8px'
      div.textContent = task.name || ''
      return div
    },
  },
}
```

#### Calendar Custom Rendering Usage Example

```javascript
const option = {
  customRendering: {
    // Add an icon to month cells
    calendarMonthContent: (ctx) => {
      const el = document.createElement('div')
      el.style.display = 'flex'
      el.style.alignItems = 'center'
      el.style.gap = '4px'
      el.innerHTML = `<span>📅</span><span>${ctx.defaultLabel}</span>`
      return el
    },

    // Make holidays and Sundays red in day cells
    calendarDayContent: (ctx) => {
      const el = document.createElement('div')
      if (ctx.isSunday || ctx.isHoliday) {
        el.style.color = 'red'
        el.style.fontWeight = 'bold'
      }
      el.textContent = ctx.defaultLabel
      return el
    },

    // Custom week cell format
    calendarWeekContent: (ctx) => {
      return `<strong>Week ${ctx.weekNumber}</strong>`
    },

    // Custom hour cell format
    calendarHourContent: (ctx) => {
      return `${String(ctx.hour).padStart(2, '0')}:00`
    },
  },
}
```

#### chartBackground (Chart Background) Usage Example

```javascript
const option = {
  customRendering: {
    // Show stripe pattern on even days, icons on weekends
    chartBackground: (ctx) => {
      const isEvenDay = ctx.date.getDate() % 2 === 0
      const stripeStyle = isEvenDay
        ? 'background: repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(128,128,128,0.08) 3px, rgba(128,128,128,0.08) 6px);'
        : ''
      const icon = ctx.isSunday || ctx.isHoliday ? '🔴' : ctx.isSaturday ? '🔵' : ''
      return html`
        <div
          style="width: 100%; height: 100%; ${stripeStyle} display: flex; align-items: flex-end; justify-content: center; padding-bottom: 2px;"
        >
          ${icon ? html`<span style="font-size: 8px; opacity: 0.6;">${icon}</span>` : ''}
        </div>
      `
    },
  },
}
```

> **Note:** `chartBackground` renders as an overlay on top of the default background colors (weekend/holiday color coding). The default background color can be accessed via the `defaultColor` property. You can also use `rowId` to display different backgrounds per row.

> **Note:** Custom rendering functions can return an `HTMLElement` or an HTML string. HTMLElements are appended directly to the DOM, while strings are set as `innerHTML`. When a custom rendering function is set, the default text content is hidden.

#### rowHeaderTooltip Usage Example

Display a tooltip when hovering over a row header. Setting a function on `customRendering.rowHeaderTooltip` will show a tooltip with a delay (shares the `tooltipDelay` setting).

```javascript
const option = {
  customRendering: {
    // Return a string
    rowHeaderTooltip: (row) => {
      return `${row.name} (Tasks: ${row.tasks.length})`
    },
  },
}
```

```javascript
const option = {
  customRendering: {
    // Return an HTMLElement (rich tooltip)
    rowHeaderTooltip: (row) => {
      const container = document.createElement('div')
      container.style.maxWidth = '300px'

      const title = document.createElement('div')
      title.style.fontWeight = 'bold'
      title.textContent = row.name
      container.appendChild(title)

      const info = document.createElement('div')
      info.style.fontSize = '11px'
      info.style.marginTop = '4px'
      info.textContent = `Tasks: ${row.tasks.length}`
      container.appendChild(info)

      return container
    },
  },
}
```

> **Note:** If `rowHeaderTooltip` returns `null` or `undefined`, no tooltip is displayed. The display delay shares `option.tooltipDelay` (default: 500ms). The tooltip appears to the right of the row header, with automatic repositioning at screen edges.

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
type MarkerType = 'triangle-up' | 'triangle-down' | 'triangle-left' | 'triangle-right' | 'diamond' | 'square'
```

### MarkerFontSize

```typescript
type MarkerFontSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
```

| Value | Font Size       |
| :---- | :-------------- |
| `xs`  | 8px (extra small) |
| `sm`  | 10px (small)    |
| `md`  | 12px (medium)   |
| `lg`  | 14px (large)    |
| `xl`  | 18px (extra large) |

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
  type: MarkerType // Marker shape
  color?: string // Marker color (CSS color string)
  fontSize?: MarkerFontSize // Marker label font size (default: 'sm' = 10px)
  style?: string // Custom marker style (CSS string)
}
```

### MoguchartLocale

Allows customizing display strings for tooltips, the drag overlay, and date formatting. Built-in locales `jaLocale` (Japanese, default) and `enLocale` (English) are provided.

```typescript
interface MoguchartLocale {
  /** Default month display format (dayjs-compatible format string) */
  monthFormat: string
  /** Month display format for monthly view mode (e.g., 'MMM') */
  monthRowFormat: string
  /** Date format function (e.g., "1/15/2024") */
  dateFormat: (date: Date) => string
  /** Date format function for time-unit mode (e.g., "Jan 15, 2024") */
  timeUnitDateFormat: (date: Date) => string
  /** Date-time format function (used when time is not 00:00) */
  dateTimeFormat: (date: Date) => string
  /** Year-month format function (used in tooltips and drag overlays for monthly view) */
  yearMonthFormat: (date: Date) => string
  /** Duration formatting */
  duration: {
    /** Days format (e.g., 3 → "3 days") */
    days: (n: number) => string
    /** Hours format (e.g., 2 → "2 hours") */
    hours: (n: number) => string
    /** Minutes format (e.g., 30 → "30 minutes") */
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

#### Usage Example

```javascript
import { enLocale } from '@mogura/moguchart-core'

const option = {
  locale: enLocale,
  // ...
}
```

To create a custom locale, implement the `MoguchartLocale` interface:

```typescript
import type { MoguchartLocale } from '@mogura/moguchart-core'

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
  yearMonthFormat: (d) => `${d.getFullYear()}/${d.getMonth() + 1}`,
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
  barX?: number // Task bar center X coordinate (during drag only)
  barTop?: number // Task bar top edge Y coordinate (during drag only)
  barBottom?: number // Task bar bottom edge Y coordinate (during drag only)
  mode: GanttTaskMoveMode // Move mode ('move' | 'copy')
  selectedTaskIds?: string[] // Target task IDs for multi-selection drag
  isOutside?: boolean // Whether the cursor is outside the Gantt chart area
  isCancel?: boolean // Whether the drag operation was canceled
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

### BarHoverEventDetail

```typescript
interface BarHoverEventDetail {
  task: GanttTask // Target task data
  x: number // Mouse X coordinate
  y: number // Mouse Y coordinate (bar top edge)
  barBottom: number // Bar bottom edge Y coordinate
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

### RowHeaderClickEventDetail

```typescript
interface RowHeaderClickEventDetail {
  rowId: string // Clicked row ID
  row: GanttRow // Clicked row data
  event: MouseEvent // Original click event
  target: HTMLElement // Clicked header element
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
  subGridLine: string // Sub-grid line color (snap units, etc.)
  monthGridLine?: string // Monthly vertical grid line color (optional)
  yearGridLine?: string // Yearly vertical grid line color (optional)
  showTimeDateLine?: string // Date separator line color in time-unit mode (optional). Falls back to monthGridLine → border when unset
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
  criticalPath?: string // Critical path highlight color (optional)
  minimapBg?: string // Minimap background color (optional)
  minimapBorder?: string // Minimap border color (optional)
  minimapViewport?: string // Minimap viewport background color (optional)
  minimapViewportBorder?: string // Minimap viewport border color (optional)
  minimapTask?: string // Minimap task bar color (optional)
}
```

### GanttTaskMoveMode

```typescript
type GanttTaskMoveMode = 'copy' | 'move'
```

### DependencyLineStyle

```typescript
type DependencyLineStyle = 'curve' | 'orthogonal'
```

### DependencyEndpoint

```typescript
type DependencyEndpoint = 'start' | 'end'
```

### GanttChartOptionDependency

```typescript
interface GanttChartOptionDependency {
  /** Whether to show arrows (default: true) */
  showArrows?: boolean
  /** Arrow size in px (default: 8) */
  arrowSize?: number
  /**
   * Connection line style (default: 'orthogonal')
   * - 'curve': Bezier curve
   * - 'orthogonal': Orthogonal segmented line with rounded corners
   */
  lineStyle?: DependencyLineStyle
  /** Corner radius in px for orthogonal style (default: 8) */
  cornerRadius?: number
  /** Whether to show connector points (circles) on task bars (default: true) */
  showConnectors?: boolean
  /** Whether to show the critical path (default: false). Automatically calculates the longest chain in the dependency graph and highlights relevant task bars and lines */
  showCriticalPath?: boolean
}
```

> **Note:** The default `lineStyle` is `'orthogonal'`. For reverse-direction (right-to-left) dependencies, it automatically calculates a U-turn bypass route. If `'curve'` is specified, it draws a Bezier curve as before.

### DependencyCreateEventDetail

```typescript
interface DependencyCreateEventDetail {
  sourceTaskId: string // Source task ID
  sourceEndpoint: DependencyEndpoint // Source endpoint (start=left edge, end=right edge)
  targetTaskId: string // Target task ID
  targetEndpoint: DependencyEndpoint // Target endpoint (start=left edge, end=right edge)
}
```

### TaskDeleteEventDetail

```typescript
interface TaskDeleteEventDetail {
  taskIds: string[] // Array of task IDs to be deleted
  event: KeyboardEvent // Original keyboard event
}
```

### ZoomChangeEventDetail

```typescript
interface ZoomChangeEventDetail {
  pxPerDay: number // pxPerDay after zoom
  pxPerMonth?: number // pxPerMonth after zoom (only in monthly mode)
}
```

### DependencyClickEventDetail

```typescript
interface DependencyClickEventDetail {
  sourceTaskId: string // Source (dependency) task ID
  targetTaskId: string // Target (dependent) task ID
  event: MouseEvent // Original mouse event
}
```

### MarkerDblClickEventDetail

```typescript
interface MarkerDblClickEventDetail {
  marker: GanttMarker // Target marker
  rowId: string // Row ID the marker belongs to
  event: MouseEvent // Original mouse event
}
```

### MarkerContextMenuEventDetail

```typescript
interface MarkerContextMenuEventDetail {
  marker: GanttMarker // Target marker
  rowId: string // Row ID the marker belongs to
  event: MouseEvent // Original mouse event
}
```

### GanttChartOptionMinimap

```typescript
interface GanttChartOptionMinimap {
  enabled?: boolean // Whether to enable minimap (default: false)
  width?: number // Width of the minimap in px (default: 200)
  height?: number // Height of the minimap in px (default: 120)
  maxHeight?: number // Maximum height when preserving aspect ratio in px (default: height or 120)
  preserveAspectRatio?: boolean // Whether to preserve the chart content aspect ratio (default: true)
  resizable?: boolean // Whether to allow drag resizing by user (default: true)
  minWidth?: number // Minimum width during resize in px (default: 120)
  maxWidth?: number // Maximum width during resize in px (default: 600)
  minHeight?: number // Minimum height during resize in px (default: 60)
  collapsible?: boolean // Whether to show collapse button (default: true)
  collapsed?: boolean // Whether initially collapsed (default: false)
  showMilestones?: boolean // Whether to display milestones on minimap (default: true)
  showCurrentTime?: boolean // Whether to display current time line on minimap (default: true)
  position?: { x: number; y: number } // Initial position of minimap in px relative to parent
  opacity?: number // Opacity of minimap (0.1 to 1.0, default: 1.0)
}
```

### MinimapResizeEventDetail

```typescript
interface MinimapResizeEventDetail {
  width: number // New width after resize (px)
  height: number // New height after resize (px)
  position?: { x: number; y: number } // Position update resulting from resize (px)
}
```

### MinimapMoveEventDetail

```typescript
interface MinimapMoveEventDetail {
  x: number // New X coordinate (px)
  y: number // New Y coordinate (px)
}
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

Pass an array of markers to each row's `markers` property to display icons with labels on the row timeline.

- Choose from 6 shapes: triangles (up, down, left, right), diamond, and square.
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
    tasks: [
      /* ... */
    ],
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

## View Modes

### Week View Mode

Set `calendar.showWeeks: true` to switch to a two-row calendar header showing year/month on top and week numbers on the bottom. This mode is enabled automatically when `pxPerDay` is less than 20.

```javascript
const option = {
  calendar: {
    start: new Date('2025-01-01'),
    end: new Date('2025-12-31'),
    pxPerDay: 15,
    showWeeks: true,
    weekStartDay: 1, // 1 = Monday (default)
    weekFormat: (weekNum, startDate) => `W${weekNum}`, // Custom format
    weekTextAlign: 'center',
  },
}
```

### Monthly View Mode

Set `calendar.pxPerMonth` to render each month at a fixed equal width. When `pxPerMonth` is specified, snapping is automatically enforced at monthly boundaries regardless of `snapDuration`.

```javascript
const option = {
  calendar: {
    start: new Date('2025-01-01'),
    end: new Date('2027-12-31'),
    pxPerDay: 1, // Not referenced when pxPerMonth is set
    pxPerMonth: 120, // 120px per month
    showMonthsRow: true, // Two-row header: top=year, bottom=month
    monthTextAlign: 'left',
  },
}
```

## Cursor Tracking Line

Set `calendar.showCursorLine: true` to display a vertical line that follows the mouse cursor's X position in real time while it is over the Gantt chart.

- The line is only shown while the mouse is over the chart area, and disappears when the cursor leaves.
- The line is hidden over the row header area (the fixed left column showing row names).
- The line color can be specified with `cursorLineColor`. When omitted, it uses the same color as `customTheme.currentTimeLine`.

```javascript
const option = {
  calendar: {
    start: new Date('2025-01-01'),
    end: new Date('2025-12-31'),
    pxPerDay: 48,
    showCursorLine: true,
    cursorLineColor: 'rgba(99, 179, 237, 0.7)', // optional
  },
}
```

## Drag & Drop Dependency Creation

When you hover over a task bar, connector points (blue circles) will appear on the left and right edges. You can create a dependency between tasks by dragging from one of these connector points and dropping it onto another task bar (or its edge).

- A Bezier curve preview line is displayed during the drag.
- When you get close to a target task, it automatically snaps to the connector point.
- The target task is highlighted with a blue outline.
- The `dependency-create` event fires upon a successful drop.
- Connector points are not displayed in `readOnly` mode.
- Set `dependency.showConnectors: false` to hide connector points (existing dependency lines will still be displayed).

### Usage Example

```javascript
const chart = document.querySelector('gantt-chart')

chart.addEventListener('dependency-create', (e) => {
  const { sourceTaskId, targetTaskId, sourceEndpoint, targetEndpoint } = e.detail
  console.log(`${sourceTaskId} (${sourceEndpoint}) -> ${targetTaskId} (${targetEndpoint})`)

  // Update the rows data to add the dependency
  rows = rows.map((row) => ({
    ...row,
    tasks: row.tasks.map((task) => {
      if (task.id === targetTaskId) {
        const deps = task.dependencies ?? []
        if (!deps.includes(sourceTaskId)) {
          return { ...task, dependencies: [...deps, sourceTaskId] }
        }
      }
      return task
    }),
  }))
  chart.rows = rows
})
```

## Dependency Line Click

Clicking on a displayed dependency line (a Bezier curve with an arrow) fires the `dependency-click` event. Deletion or other operations should be implemented in the event handler.

- Hovering over a dependency line makes it thicker and highlights it with a glow effect.
- Clicking fires the `dependency-click` event.
- It cannot be clicked in `readOnly` mode.

### Usage Example

```javascript
const chart = document.querySelector('gantt-chart')

chart.addEventListener('dependency-click', (e) => {
  const { sourceTaskId, targetTaskId, event } = e.detail
  console.log(`Dependency clicked: ${sourceTaskId} -> ${targetTaskId}`)

  // Example: Show context menu at mouse coordinates or delete after confirmation
  if (confirm('Delete this dependency?')) {
    rows = rows.map((row) => ({
      ...row,
      tasks: row.tasks.map((task) => {
        if (task.id === targetTaskId && task.dependencies) {
          const newDeps = task.dependencies.filter((d) => d !== sourceTaskId)
          return { ...task, dependencies: newDeps.length > 0 ? newDeps : undefined }
        }
        return task
      }),
    }))
    chart.rows = rows
  }
})
```

## Critical Path Visualization

Set `dependency.showCriticalPath: true` to automatically calculate the longest task chain (critical path) in the dependency graph and highlight the relevant task bars and connection lines in red.

- Only tasks that participate in dependencies are included in the calculation. Independent tasks (not connected to any dependency) are excluded.
- Supports manual scheduling (tasks with gaps between them).
- The highlight color can be customized with `customTheme.criticalPath`.

### Usage Example

```javascript
const option = {
  dependency: {
    showCriticalPath: true, // Show critical path
    showArrows: true,
  },
  customTheme: {
    criticalPath: 'rgba(220, 38, 38, 0.85)', // Highlight color (optional)
  },
  // ...
}
```

## Keyboard Operations

When the Gantt chart has focus, you can navigate, select, move, and delete tasks using the keyboard.

### Supported Key Operations

| Key | Action |
| :--- | :--- |
| `←` `→` | Move focus between tasks within the same row (wraps to next/previous row at edges) |
| `↑` `↓` | Move focus to a task in another row |
| `Enter` / `Space` | Select the focused task |
| `Ctrl/Cmd + Enter` | Toggle selection of the focused task (multi-select) |
| `Shift + ←` `→` | Move selected tasks left/right (by `moveStep` amount) |
| `Delete` / `Backspace` | Fire `task-delete` event for selected tasks |
| `Escape` | Clear all selection and focus |
| `Home` | Focus the first task in the current row |
| `End` | Focus the last task in the current row |

### Configuration

```javascript
const option = {
  keyboard: {
    enabled: true,    // Whether to enable keyboard operations (default: true)
    moveStep: 60,     // Move amount per Shift+Arrow key press (minutes). Uses snapDuration when omitted
  },
  // ...
}
```

### task-delete Event Usage Example

```javascript
chart.addEventListener('task-delete', (e) => {
  const { taskIds } = e.detail
  console.log('Tasks to delete:', taskIds)

  // Example: Show confirmation dialog before deleting
  if (confirm(`Delete ${taskIds.length} task(s)?`)) {
    rows = rows.map((row) => ({
      ...row,
      tasks: row.tasks.filter((t) => !taskIds.includes(t.id)),
    }))
    chart.rows = rows
  }
})
```

## Overview Minimap

By setting the `minimap` option, you can display a floating overview window that provides a bird's-eye view of all tasks, milestones, and current time line across the entire Gantt chart.

- **Viewport Navigation**: Drag the translucent finder frame inside the minimap to pan/scroll, or click anywhere on the minimap to jump directly to that position.
- **Draggable Window**: Drag the minimap title bar to move and position it anywhere within the chart container. Fires the `minimap-move` event when moved.
- **Drag Resizing**: Drag the corners or edges of the minimap to resize it freely while optionally preserving the aspect ratio. Fires the `minimap-resize` event when resized.
- **Auto-Anchoring and Clamping**: Automatically follows container resizing or content updates using a bottom-right anchor and clamps within the parent container to prevent overflowing.
- **Collapsible**: Collapse or expand the minimap via the minimize button.
- **Theme Support**: Customize colors using `customTheme` keys like `minimapBg`, `minimapViewport`, and more.

### Usage Example

```javascript
const chart = document.querySelector('gantt-chart')

chart.option = {
  // ...
  minimap: {
    enabled: true,
    width: 240,
    preserveAspectRatio: true,
    resizable: true,
    position: { x: 20, y: 50 }, // Initial position (px)
  },
}

// Listen to resize events
chart.addEventListener('minimap-resize', (e) => {
  const { width, height, position } = e.detail
  console.log(`Minimap resized: ${width}x${height}`, position)
})

// Listen to move events
chart.addEventListener('minimap-move', (e) => {
  const { x, y } = e.detail
  console.log(`Minimap moved to: (${x}, ${y})`)
})
```

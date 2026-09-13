# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> Read this in [日本語 (Japanese)](./CHANGELOG.ja.md).

## [1.0.0] - 2026-09-13

Official Major Release! 🎉
With this release, `@mogura/moguchart-core` reaches version 1.0.0, establishing a production-ready, stable API.
This milestone introduces comprehensive support for **WBS (Hierarchical Tree Structure & Row Expand/Collapse)** and **Summary Tasks (Automatic Aggregation & Rendering of Duration and Progress)**, which are critical for robust project management.

### Added

- **Scroll Position Control Methods (`resetScroll`, `scrollToPosition`)**:
  - `GanttChartElement.resetScroll()`: Public method to reset horizontal and vertical scroll positions of the chart to the top-left (0, 0). Synchronously resets internal states (`currentScrollLeft`, `currentScrollTop`, `virtualScrollTop`).
  - `GanttChartElement.scrollToPosition(options)`: Public method to smoothly or instantly scroll to any coordinate (`left`, `top`, `behavior`).
  - Resolves remaining scroll offsets when switching or loading projects, ensuring a clean start from the beginning.

- **Chart-wide Font Scaling (`fontScale`)**:
  - Added `GanttChartOption.fontScale` (`number`, default: `1`) to scale all text throughout the chart uniformly.
  - Dynamically updates the CSS custom property `--moguchart-font-scale` on the host element. All typography scales proportionally with `calc(... * var(--moguchart-font-scale, 1))`, including calendar headers (month, week, day, hour, current-time badge, holiday badge), row headers, WBS code badges, tree collapse toggles, task bar labels, progress badges, marker labels, tooltips, and drag info overlays.
  - Enables parent applications to seamlessly synchronize font and row header visibility when zooming the chart.

- **WBS (Hierarchical Tree Structure & Expand/Collapse)**:
  - Added `parentId` to `GanttRow`, enabling unlimited nesting levels (e.g., Phase > Sub-phase > Task).
  - Added `collapsed` to `GanttRow` to define the initial collapsed state per row.
  - Added `isSummary` to `GanttRow` for explicit summary row state tracking.
  - Added `wbsCode` to `GanttRow` to store and display hierarchical WBS numbers (e.g., "1.2.1").
  - Hierarchical indentation in row headers (left grid) based on tree depth level.
  - Expand/collapse toggle icons (▶ / ▼) displayed on the left side of parent rows with click handling.
  - Added `row-toggle-collapse` event (`RowToggleCollapseEventDetail` type definition) dispatched when row collapse state changes.
  - Full synchronization of task bars, row grid, virtual scrolling, and minimap with row expand/collapse actions.
  - Added `GanttChartOptionTree` type definition and `GanttChartOption.tree` options:
    - `enabled`: Enable/disable tree view (default: `true`).
    - `indentWidth`: Indent width per hierarchy level in px (default: `16`).
    - `showToggleIcon`: Show/hide collapse toggle icons (default: `true`).
    - `showWbsCode`: Show/hide automatic WBS code badges in row headers (default: `false`).
    - `autoSummary`: Enable automatic aggregation of duration and progress from child tasks (default: `true`).
    - `summaryColor`: Default color for summary task bars (default: `'#334155'`).

- **Summary Tasks (Automatic Aggregation & Rendering)**:
  - Supports summary bars (bracket/arrowhead styling) computed automatically from child tasks' minimum start date, maximum end date, and duration-weighted average progress.
  - Added `'summary'` type to `GanttTask.type`.
  - Added `summaryColor` property to `GanttRow` for row-level summary color overrides.
  - Dual-layer rendering allowing normal task bars and summary task bars to coexist simultaneously on the same row.
  - Added `GanttChartOptionProgress.showSummaryLabel` option (default: `false`) to toggle progress labels on summary task bars.
  - Minimap (`<gantt-minimap>`) preview support for summary task bars and progress shading.

- **Tree-Aware Safe Drag & Drop Row Reordering**:
  - Dragging a parent row moves all its descendant rows as a single atomic block.
  - Circular reference prevention logic (`canDropRow`) preventing drops into a row's own descendants.

- **Programmatic Hierarchy Manipulation Methods**:
  - `chart.toggleRowCollapse(rowId: string, collapsed?: boolean)`: Toggle or explicitly set row collapse state.
  - `chart.collapseAll()`: Collapse all parent rows with child rows.
  - `chart.expandAll()`: Expand all rows.

- **WBS and Hierarchy Utility Functions Exported**:
  - `computeRowLevels`: Calculate tree depth levels for all rows.
  - `computeRowWbsCodes`: Generate hierarchical WBS numbering (1, 1.1, 1.2, etc.).
  - `computeChildRowIds`: Retrieve direct child or all descendant row IDs.
  - `computeVisibleTreeRows`: Filter rows visible given current collapsed states.
  - `computeSummaryTask`: Compute aggregated summary task dates and progress from an array of child tasks.
  - `canDropRow`: Validate whether a row can be safely dropped without circular hierarchies.

- **Comprehensive Unit Test Suite**:
  - Added `src/__tests__/gantt-chart-wbs.test.ts`, `src/__tests__/wbs.test.ts`, and `src/__tests__/gantt-bar-connector.test.ts` (over 40 new test cases added; all 221 tests passing).

### Changed

- **Suppressed Dependency Connector Rendering for Summary Tasks**:
  - Automatic suppression of dependency connector arrows originating from or targeting summary tasks to prevent confusion and circular references.
- **Documentation and Repository Structure Refresh**:
  - Aligned with international standards by setting `README.md` as English and moving Japanese version to `README.ja.md`.
  - Organized API documentation by language (`doc/API.md`, `doc/API.ja.md`).
  - Added WBS tree sample data, expand/collapse controls, and summary task options to the interactive demo (`src/demo/main.ts`, `src/demo/data.ts`).

### Fixed

- **Prevent Double-Click Side Effects on Collapse Toggle Icons**:
  - Stopped event propagation (`stopPropagation`) when double-clicking expand/collapse toggle icons (▶ / ▼) on parent row headers, preventing unintended trigger of row rename inline editing or row detail dialogs.

---

## [0.12.0] - 2026-09-05

### Added

- **Marquee (Rubber-Band) Selection for Gantt Bars**:
  - Drag over empty calendar backgrounds (date grid) to select multiple task bars within a rectangular selection box.
  - Implemented Axis-Aligned Bounding Box (AABB) intersection detection to highlight overlapping bars in real time during drag.
  - Added cumulative selection support via `Shift`, `Ctrl`, or `Cmd` + drag.
  - Regular drag without modifier keys clears prior selection and selects only bars within the marquee rectangle.
  - Auto-scrolling when dragging near chart viewport boundaries.
  - Threshold guard (minimum 4px movement) to avoid conflicts with single clicks, preserving background-click deselection.
  - Added `GanttChartOptionSelection` type and `GanttChartOption.selection` options (`marquee`, `borderColor`, `backgroundColor`).
  - Added `selectionMarqueeBorder` and `selectionMarqueeBg` to theme colors (`ThemeColorPalette`) with optimized palettes for light and dark themes.
  - Dispatches `bar-selection-change` event upon selection completion.
  - Seamlessly integrates with multi-task drag movement, keyboard navigation (Shift + Arrow keys), and batch deletion (Delete key).
  - Added marquee selection toggle controls to demo (`src/demo/main.ts`).
  - Added unit test suite for marquee selection (`src/__tests__/gantt-chart-marquee-selection.test.ts`).
- **Task Progress Management and Tracking**:
  - Added `progress` (0-100 percentage), `progressColor`, `progressStyle`, and `progressResizable` properties to `GanttTask`.
  - Renders progress indicators inside task bars with selectable styles (`full`, `bottom`, `top`).
  - Interactive progress drag handle at the edge of the progress bar for direct adjustments, with configurable step snapping (`snapStep`) and Escape key cancellation.
  - Enhanced visibility and styling for progress drag handle (hover/active enlargement, line and knob styling).
  - Added progress label display (`showLabel`: boolean, `labelPosition`: `'inside'` | `'right'` | `'left'` | `'center'`, custom formatter `labelFormatter`).
  - Dispatches `task-progress-change` event (`TaskProgressChangeEventDetail` type) upon progress edits.
  - Added `GanttChartOptionProgress` type and `GanttChartOption.progress` options (`enabled`, `editable`, `color`, `showLabel`, `labelPosition`, `labelFormatter`, `snapStep`, `indicatorPosition`).
  - Added `taskProgress` and `taskProgressHandle` to `ThemeColorPalette`.
  - Added `tooltip.progress` to `MoguchartLocale` for tooltip progress display.
  - Minimap (`<gantt-minimap>`) automatically reflects task progress with bar shading.
  - Exported progress calculation and normalization utilities: `clampProgress`, `calculateRowProgress`, `calculateWeightedRowProgress`, and `calculateProjectProgress`.
  - Added progress toggles and interactive controls to demo (`src/demo/main.ts`).
  - Added comprehensive unit tests for progress tracking (`src/__tests__/task-progress.test.ts`).

---

## [0.11.0] - 2026-08-29

### Added

- **Overview Minimap Component (`<gantt-minimap>`)**:
  - Fast, lightweight bird's-eye canvas rendering of all tasks, milestones, and the current-time indicator across the entire chart.
  - Viewport finder overlay (rounded 8px rectangle) visualizing the current visible view.
  - Interactive panning by dragging the viewport finder and instant scroll navigation by clicking anywhere on the minimap.
  - Free-floating draggable minimap positioning anywhere on the chart, dispatching `minimap-move` events (`MinimapMoveEventDetail`).
  - Relative anchor positioning based on parent container bottom-right offsets (`MinimapPosition`: `right`, `bottom`), maintaining stable placement across window resizes and display scaling.
  - Bounds checking to prevent minimap from overflowing parent containers during resizing or content changes.
  - Resizable minimap via edge and corner handles, dispatching `minimap-resize` events (`MinimapResizeEventDetail`).
  - Collapsible/expandable state with smooth transitions, dispatching `minimap-collapse` events (`MinimapCollapseEventDetail`).
  - Added `GanttChartOptionMinimap` and `MinimapPosition` types, and `GanttChartOption.minimap` options (`enabled`, `width`, `height`, `maxHeight`, `preserveAspectRatio`, `resizable`, `minWidth`, `maxWidth`, `minHeight`, `collapsible`, `collapsed`, `showMilestones`, `showCurrentTime`, `position`, `opacity`).
  - Configurable `opacity` setting with enhanced contrast during hover, drag, and resize interactions.
  - Added minimap theme colors (`minimapBg`, `minimapBorder`, `minimapViewport`, `minimapViewportBorder`, `minimapTask`).
  - Added minimap toggle control to demo (`src/demo/main.ts`).
  - Added unit test suite for minimap (`src/__tests__/gantt-minimap.test.ts`).

### Fixed

- **PNG/PDF Export Blank Content Bug**:
  - Fixed an issue where PNG/PDF exports (`exportImage` / `exportGanttWithHtml2Canvas`) rendered only the background color without chart content.
  - Changed `html2canvas` target from the Web Component host element to the actual rendering container inside Shadow DOM (`.scroll-container`).
  - Explicitly provided capture coordinates and scroll offsets (`scrollX: 0, scrollY: 0, x: 0, y: 0`).
  - Ensured theme background colors (Light / Dark / Custom) are properly applied to the exported image.
  - Preserved and restored the active scroll position before and after export execution.
- Added unit tests verifying export execution and scroll preservation.

---

## [0.10.0] - 2026-08-23

### Added

- Added `enableCrossRowMove` option (default: `true`) to control whether tasks can be moved across rows during drag (when set to `false`, movement is restricted to the same row).
- Added `enableCrossRowMove` toggle control and localized labels to demo (`src/demo/main.ts`).
- Added drag cancellation and return animation when cursor moves outside the chart area or over empty row zones.
- Added properties to `TaskUpdateEventDetail`: `barX`, `barTop`, `barBottom` (task bar coordinates), `isOutside` (out-of-bounds flag), and `isCancel` (cancellation flag).
- Added unit tests for drag cancellation and cross-row move constraints (`src/__tests__/gantt-bar-drag-cancel.test.ts`).

### Improved

- Improved positioning of drag information overlay to align relative to the task bar (top/bottom) instead of tracking raw cursor coordinates, improving readability.
- When dragging outside chart bounds or over invalid rows, the task bar now snaps back to its original position and the overlay hides, canceling the operation upon drop.

---

## [0.9.1] - 2026-08-15

### Removed

- Removed unused `@holiday-jp/holiday_jp` dependency from `devDependencies`.

### Changed

- Migrated demo (`src/demo/`) and test holiday calculations to an internal module (`src/demo/holidays.ts`) and mock functions.
- Added unit tests for holiday calculation logic (`src/__tests__/holidays.test.ts`).

---

## [0.9.0] - 2026-08-14

### Added

- Added external links to npm package and GitHub repository in the demo header (`src/demo/main.ts`).
- Added `row-header-mouseleave` custom event handling to `gantt-row` component.

### Changed

- Reconfigured package as pure ES Module (`"type": "module"`), optimizing Vite configuration and build outputs.
- Upgraded package manager to pnpm 11 (`pnpm@11.21.0`).
- Expanded `package.json` metadata (`description`, `keywords`, and added `README.md` to `files`).
- Added links to live online demo (Vercel) in `README.md` and `README.en.md`.

---

## [0.8.1] - 2026-07-05

### Added

- Added `barBottom` property (bottom Y coordinate of bar) to `BarHoverEventDetail`, used for positioning tooltips beneath the bar.

### Improved

- Improved task bar tooltip placement to render below the bar when near the top of the viewport. Elevated tooltip z-index to avoid overlap issues.
- Introduced a 3px movement threshold for drag initiation to distinguish between clicks and drags, preventing unintended snapping during bar selection.

---

## [0.8.0] - 2026-06-26

### Added

- `marker-dblclick` event (`MarkerDblClickEventDetail`): Dispatched on marker double-click.
- `marker-contextmenu` event (`MarkerContextMenuEventDetail`): Dispatched on marker right-click.
- Added `fontSize` property (`MarkerFontSize`: `'xs'` | `'sm'` | `'md'` | `'lg'` | `'xl'`) to `GanttMarker` to customize label font size.
- Added `selectedMarkerId` property to `GanttRow` to highlight currently selected/edited markers with pulse and glow animations.
- Added `customRendering.rowHeaderTooltip` option: Function returning a string, HTMLElement, or Lit TemplateResult displayed on row header hover. Shares `tooltipDelay` and automatically applies theme colors.

### Improved

- Fixed z-index layering so hovered milestones render above surrounding elements.
- Dynamically adjust marker dimensions in proportion to font size.
- Added viewport boundary detection to keep tooltips from overflowing the screen.

---

## [0.7.0] - 2026-06-13

### Added

- Added Ctrl/Cmd + mouse wheel zooming (enabled via `zoom` option).
- `zoomTo(value)` method: Set zoom level to a specific `pxPerDay` (or `pxPerMonth` in month mode).
- `zoomToFit()` method: Automatically adjust zoom level so all tasks fit within the visible viewport.
- `resetZoom()` method: Reset zoom scale back to original options.
- `zoom-change` event (`ZoomChangeEventDetail`): Dispatches updated `pxPerDay` / `pxPerMonth`.
- `zoom` options (`enabled`, `min`, `max`, `step`): Enable zooming with configurable boundary and step values.
- `dependency.showConnectors` option: Control visibility of connection points/dots (default: `true`). Setting to `false` hides connector handles and disables creating new dependencies via drag.
- `dependency.showCriticalPath` option: Automatically calculates the critical path (longest chain) from the dependency graph and highlights corresponding task bars and links in red (customizable via `criticalPath` theme color).
- `getRowPositions()` method: Returns layout coordinates (`top`, `height`, `bottom`) for each row.

### Changed

- Split image/PDF export pages on row boundaries instead of arbitrary `splitHeight` pixel cuts, avoiding cut-off rows.

### Fixed

- Fixed issue where the current-time indicator line and badge were included in exported images.
- Fixed issue where host element's `border-radius` and `border` affected exported images.

---

## [0.6.0] - 2026-06-06

### Added

- Multi-lane automatic layout for overlapping row markers and milestones.
- Vertical drag movement of multiple selected tasks across rows simultaneously.
- Proximity-based dependency connector visibility, displaying only connectors near the hovered bar.
- GitHub Release automation workflow (`.github/workflows/release.yml`) and configuration.

---

## [0.5.3] - 2026-05-30

### Security

- Replaced `unsafeHTML` with safe `textContent` in custom tooltip rendering to prevent XSS.
- Replaced direct `innerHTML` assignments in drag info overlays with Lit's `render()` + `html` tagged templates for automatic escaping.
- Replaced `innerHTML` in calendar header custom content injection (`injectCustomContent`) with `textContent`.

### Fixed

- Added validation and type checking (`id`, `name`, `start`, `end`, Date conversion) for externally dropped tasks (`handleExternalTaskDrop`).
- Removed leftover debug `console.log` statements in export module (`gantt-chart-export.ts`).

---

## [0.5.2] - 2026-05-24

### Changed

- Migrated from `lodash` to `lodash-es` for enhanced bundle size optimization and tree-shaking.
- Moved `@holiday-jp/holiday_jp` from `dependencies` to `devDependencies`.
- Separated demo build output to `dist-demo` to keep library artifacts (`dist`) clean.
- Configured scoped public publishing in `package.json` and bundled English documentation `README.en.md`.

### Fixed

- Resolved compilation errors in consumer projects caused by untranspiled path aliases (`@/`) in generated `.d.ts` files by converting all imports to relative paths.

---

## [0.5.1] - 2026-05-23

### Fixed

- Fixed S-curve connector drawing bug where identical start and end X coordinates rendered as a straight vertical line, ensuring proper crank curve routing matching linear mode.
- Improved drag info overlay alignment to follow the dragged task bar accurately.

---

## [0.5.0] - 2026-05-20

### Added

- Full keyboard navigation and shortcuts (arrow keys for navigation and selection, Shift + arrow keys to move tasks, Delete/Backspace to remove tasks).
- `keyboard` options (`enabled`, `moveStep`).
- `task-delete` event (`TaskDeleteEventDetail`).
- Added `timeUnitDateFormat` to `MoguchartLocale` for formatting date headers in hour mode.
- Added `showTimeDateLine` to `ThemeColorPalette` for date separator gridlines in hour mode.

---

## [0.1.0] - 2025-05-18

### Added

- Initial release of the Gantt chart Web Component.
- Framework-agnostic architecture built with Lit (compatible with Vue, React, Angular, Svelte, etc.).
- Interactive drag & drop for task bar movement and resizing.
- Multi-scale timeline modes (Day, Week, Month, Year).
- Japanese holiday highlighting (`@holiday-jp/holiday_jp`).
- PDF and PNG image export capabilities (`jspdf` / `html2canvas-pro`).
- UMD and ESM dual bundle outputs.
- Bundled TypeScript type definitions.

[1.0.0]: https://github.com/hiro-murakami/moguchart-core/compare/v0.12.0...v1.0.0
[0.12.0]: https://github.com/hiro-murakami/moguchart-core/compare/v0.11.0...v0.12.0
[0.11.0]: https://github.com/hiro-murakami/moguchart-core/compare/v0.10.0...v0.11.0
[0.10.0]: https://github.com/hiro-murakami/moguchart-core/compare/v0.9.1...v0.10.0
[0.9.1]: https://github.com/hiro-murakami/moguchart-core/compare/v0.9.0...v0.9.1
[0.9.0]: https://github.com/hiro-murakami/moguchart-core/compare/v0.8.1...v0.9.0
[0.8.1]: https://github.com/hiro-murakami/moguchart-core/compare/v0.8.0...v0.8.1
[0.8.0]: https://github.com/hiro-murakami/moguchart-core/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/hiro-murakami/moguchart-core/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/hiro-murakami/moguchart-core/compare/v0.5.3...v0.6.0
[0.5.3]: https://github.com/hiro-murakami/moguchart-core/compare/v0.5.2...v0.5.3
[0.5.2]: https://github.com/hiro-murakami/moguchart-core/compare/v0.5.1...v0.5.2
[0.5.1]: https://github.com/hiro-murakami/moguchart-core/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/hiro-murakami/moguchart-core/compare/v0.1.0...v0.5.0
[0.1.0]: https://github.com/hiro-murakami/moguchart-core/releases/tag/v0.1.0

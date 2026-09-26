# @mogura/moguchart-plugin-excel

[日本語](./README.ja.md)

Excel (.xlsx) export plugin for `@mogura/moguchart-core`.
Using ExcelJS, it generates beautifully styled Excel files with an interactive timeline (cell-shaded Gantt chart / schedule) completely in the browser.

## Features

- 📊 **Excel Timeline (Visual Gantt)**: Task attributes on the left (WBS, Task Name, Assignee, Dates, Progress) and calendar date columns on the right with colored task duration cells (summary tasks, weekend & holiday shading, progress labels).
- 🌐 **Multi-Language Support & Custom Locales**: Built-in support for Japanese (`ja`), English (`en`), and Simplified Chinese (`zh`). Easily register custom language packs with `registerExcelLocale`.
- 🌳 **WBS Hierarchy**: Retains parent-child hierarchy with WBS codes (`1`, `1.1`), indentations, and bold styling.
- 🎨 **Color Customization**: Reflects theme colors and task-specific colors (`progressColor`) in Excel.
- ⏱ **Multi-Scale Timelines**: Supports hour, day, week, and month scales, including sub-day and sub-hour column divisions.
- ⚡ **Client-side Generation**: Generates and downloads `.xlsx` files directly in the browser.

## Installation

```bash
pnpm add @mogura/moguchart-plugin-excel
# or
npm install @mogura/moguchart-plugin-excel
```

## Usage

### 1. Register as a Plugin (Recommended)

```typescript
import '@mogura/moguchart-core'
import { excelPlugin } from '@mogura/moguchart-plugin-excel'

const chart = document.querySelector('gantt-chart')

chart.use(excelPlugin({
  defaultFilename: 'project-schedule.xlsx',
  defaultSheetName: 'Schedule',
  themeColor: '#3B82F6'
}))

// Export with timeline
await chart.exportExcel()

// Export in English
await chart.exportExcel({
  locale: 'en',
  filename: 'project-schedule.xlsx'
})
```

### 2. Standalone Function (Dynamic Import)

```typescript
async function handleExportExcel(chartElement) {
  const { exportExcel } = await import('@mogura/moguchart-plugin-excel')
  await exportExcel(chartElement, {
    filename: 'schedule.xlsx',
    locale: 'en',
    download: true
  })
}
```

### 3. Adding Custom Locales

To register and use additional languages:

```typescript
import { registerExcelLocale, exportExcel } from '@mogura/moguchart-plugin-excel'

registerExcelLocale('fr', {
  code: 'fr',
  sheetName: 'Planning',
  defaultFilename: 'planning-gantt.xlsx',
  columns: {
    wbs: 'WBS',
    name: 'Nom de tâche',
    assignee: 'Responsable',
    startDate: 'Date de début',
    endDate: 'Date de fin',
    duration: 'Durée',
    progress: 'Progression',
  },
  dateFormat: 'DD/MM/YYYY',
  timeFormat: 'HH:mm',
  monthYearFormat: (year, month) => `${month}/${year}`,
  weekFormat: (year, week) => `Sem ${week}, ${year}`,
  dayHeaderFormat: (date) => `${date.getDate()}`,
  hourHeaderFormat: (hour) => `${hour}h`,
  dayNames: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'],
  durationUnit: ' d',
  summaryLabel: ' (Summary)',
  percentLabel: '%',
})

await chart.exportExcel({ locale: 'fr' })
```

## Options (`ExportExcelOptions`)

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `locale` | `'ja' \| 'en' \| 'zh' \| string \| ExcelLocaleDefinition` | Auto-detect / `'ja'` | Language & locale definition |
| `filename` | `string` | `'gantt-chart.xlsx'` | Output filename |
| `sheetName` | `string` | `'工程表'` | Output worksheet name |
| `timelineScale` | `'hour' \| 'day' \| 'week' \| 'month'` | Auto-detect (`'day'`) | Timeline column unit (hour, day, week, month) |
| `columnsPerUnit` | `number` | `1` | Number of columns per day or hour (e.g. 2 for half-day / 30-min slots) |
| `snapDurationMinutes` | `number` | Auto-detect / `1440` or `60` | Snap duration in minutes to auto-calculate columns per day/hour (e.g. 720 -> 2 cols/day) |
| `timelineColumnWidth` | `number` | Auto-computed | Timeline column width (in chars, auto-derived from screen px or defaults) |
| `dateFormat` | `string` | `'YYYY/MM/DD'` | Date format |
| `includeWeekends` | `boolean` | `true` | Include weekends in timeline (day scale only: Saturdays in light blue, Sundays & holidays in light red/pink) |
| `highlightToday` | `boolean` | `true` | Highlight today's date column |
| `themeColor` | `string` | `'#3B82F6'` | Theme color for header & bars |
| `isHoliday` | `(date: Date) => boolean` | Auto-detect | Holiday judgment function (auto-detected from `chart.option.calendar.isHoliday`) |
| `holidayColor` | `string` | `'#FEE2E2'` | Background color for holiday and Sunday columns (applies to day scale only) |
| `columns` | `ExcelExportColumn[]` | Standard cols | Custom column definitions |
| `download` | `boolean` | `true` | Auto-trigger file download |

## License

MIT

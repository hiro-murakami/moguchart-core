# @mogura/moguchart-plugin-export

[日本語](./README.ja.md)

PNG and PDF export plugin for the `@mogura/moguchart-core` Gantt chart component.
Powered by `html2canvas-pro` and `jspdf`, supporting Shadow DOM rendering and high-resolution multi-page split exports.

## Installation

```bash
pnpm add @mogura/moguchart-plugin-export
# or
npm install @mogura/moguchart-plugin-export
```

## Usage

### 1. Register as a Plugin (Recommended)

Register the plugin to your Gantt chart instance to enable the `chart.exportImage()` method.

```typescript
import '@mogura/moguchart-core'
import { exportPlugin } from '@mogura/moguchart-plugin-export'

const chart = document.querySelector('gantt-chart')

// Register plugin via chart.use()
chart.use(exportPlugin())

// Or pass declaratively via option.plugins
chart.option = {
  calendar: { ... },
  plugins: [exportPlugin()]
}

// Export as PNG image
await chart.exportImage('png', {
  filename: 'my-project-schedule',
  download: true,
  scale: 2
})

// Export as PDF document
await chart.exportImage('pdf', {
  filename: 'my-project-schedule',
  download: true
})
```

### 2. Standalone Function (Dynamic Import for Code Splitting)

Dynamically import the export function only when the user triggers an export, keeping the initial page bundle minimal.

```typescript
async function handleExportPdf(chartElement) {
  const { exportChart } = await import('@mogura/moguchart-plugin-export')
  await exportChart(chartElement, 'pdf', {
    filename: 'gantt-export',
    download: true
  })
}
```

## Plugin Configuration (`ExportPluginConfig`)

```typescript
chart.use(
  exportPlugin({
    defaultScale: 2, // Default resolution multiplier for PNG export
    defaultFilename: 'my-schedule', // Default output filename
    normalizeZoom: true, // Temporarily normalize zoom to 100% during export (default: true)
  })
)
```

## Options (`ExportImageOptions`)

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `filename` | `string` | `'gantt-chart'` | File name for downloaded file (without extension) |
| `download` | `boolean` | `false` | If `true`, automatically triggers browser file download |
| `scale` | `number` | `2` | Resolution multiplier for PNG rendering |
| `splitHeight` | `number` | `undefined` | Split height in pixels for vertical multi-page division with repeating calendar headers |
| `normalizeZoom` | `boolean` | `true` | Temporarily normalize zoom level to 100% (baseline scale) during export |

## License

MIT

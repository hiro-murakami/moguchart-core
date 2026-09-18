# @mogura/moguchart-plugin-export

[English](./README.md)

ガントチャートライブラリ `@mogura/moguchart-core` 用の PNG / PDF エクスポートプラグインです。
`html2canvas-pro` および `jspdf` を使用し、Shadow DOM や高解像度分割エクスポートに対応しています。

## インストール

```bash
pnpm add @mogura/moguchart-plugin-export
# または
npm install @mogura/moguchart-plugin-export
```

## 使い方

### 1. プラグインとして登録して使う（推奨）

チャートインスタンスにプラグインを登録すると、`chart.exportImage()` メソッドが有効化されます。

```typescript
import '@mogura/moguchart-core'
import { exportPlugin } from '@mogura/moguchart-plugin-export'

const chart = document.querySelector('gantt-chart')

// プラグインの登録
chart.use(exportPlugin())

// または option.plugins で宣言的に渡すことも可能
chart.option = {
  calendar: { ... },
  plugins: [exportPlugin()]
}

// PNG エクスポート
await chart.exportImage('png', {
  filename: 'my-project-schedule',
  download: true,
  scale: 2
})

// PDF エクスポート
await chart.exportImage('pdf', {
  filename: 'my-project-schedule',
  download: true
})
```

### 2. スタンドアロン関数として呼ぶ（必要な時だけ遅延インポート）

エクスポートボタンがクリックされた時だけ動的インポート（Dynamic Import）することで、初期バンドルサイズを最小限に抑えられます。

```typescript
async function handleExportPdf(chartElement) {
  const { exportChart } = await import('@mogura/moguchart-plugin-export')
  await exportChart(chartElement, 'pdf', {
    filename: 'gantt-export',
    download: true
  })
}
```

## オプション (`ExportImageOptions`)

| オプション | 型 | デフォルト値 | 説明 |
| :--- | :--- | :--- | :--- |
| `filename` | `string` | `'gantt-chart'` | ダウンロード時のファイル名（拡張子なし） |
| `download` | `boolean` | `false` | `true` の場合、自動的にファイルダウンロードをトリガー |
| `scale` | `number` | `2` | PNG 出力時の解像度倍率 |
| `splitHeight` | `number` | 未指定 | 指定ピクセル数で縦に分割し、分割位置にカレンダーヘッダーを挿入 |

## ライセンス

MIT

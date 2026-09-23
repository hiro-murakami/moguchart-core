# @mogura/moguchart-plugin-excel

[English](./README.md)

ガントチャートライブラリ `@mogura/moguchart-core` 用の Excel (.xlsx) エクスポートプラグインです。
ExcelJS を使用し、カレンダー日付列にタスク期間が色塗りされた「Excel製ガントチャート（タイムライン）」やデータ集計用の「タスク一覧テーブル」を高画質・スタイリング付きで出力します。

## 特徴

- 📊 **Excelタイムライン（疑似ガント）出力**: 右側にカレンダー列を配置し、タスクの開始日〜終了日に対応するセルを美しく着色（サマリータスク、土日・祝日の背景色分け、進捗率パーセント表示対応）。
- 📑 **データ集計用テーブル出力**: オートフィルター付きのシンプルなタスク一覧テーブル形式にも対応。
- 🌳 **WBS階層構造の保持**: 親行・子行の階層関係（WBSコード `1`, `1.1`, `1.2` 等）を維持し、インデントや太字を反映。
- 🎨 **カラーカスタマイズ**: テーマカラーやタスクごとのカスタムバー色（`progressColor`）がExcel上にも反映。
- ⚡ **クライアント完結**: ブラウザ上で直接 `.xlsx` ファイルを生成・自動ダウンロード可能。

## インストール

```bash
pnpm add @mogura/moguchart-plugin-excel
# または
npm install @mogura/moguchart-plugin-excel
```

## 使い方

### 1. プラグインとして登録して使う（推奨）

チャートインスタンスにプラグインを登録すると、`chart.exportExcel()` メソッドが有効化されます。

```typescript
import '@mogura/moguchart-core'
import { excelPlugin } from '@mogura/moguchart-plugin-excel'

const chart = document.querySelector('gantt-chart')

// プラグインの登録
chart.use(excelPlugin({
  defaultFilename: 'プロジェクト工程表.xlsx',
  defaultSheetName: '工程表',
  themeColor: '#3B82F6'
}))

// Excelエクスポート（タイムライン付き工程表）
await chart.exportExcel()

// テーブル形式のみでエクスポート
await chart.exportExcel({
  mode: 'table-only',
  filename: 'タスク一覧.xlsx'
})
```

### 2. スタンドアロン関数として呼ぶ（必要な時だけ遅延インポート）

エクスポートボタンがクリックされた時だけ動的インポート（Dynamic Import）することで、初期バンドルサイズを最小限に抑えられます。

```typescript
async function handleExportExcel(chartElement) {
  const { exportExcel } = await import('@mogura/moguchart-plugin-excel')
  await exportExcel(chartElement, {
    filename: '工程表.xlsx',
    mode: 'with-timeline',
    download: true
  })
}
```

## オプション (`ExportExcelOptions`)

| オプション | 型 | デフォルト値 | 説明 |
| :--- | :--- | :--- | :--- |
| `filename` | `string` | `'gantt-chart.xlsx'` | 出力ファイル名 |
| `sheetName` | `string` | `'工程表'` | 出力シート名 |
| `mode` | `'with-timeline' \| 'table-only' \| 'both'` | `'with-timeline'` | 出力モード（タイムライン付き / テーブルのみ / 両方） |
| `timelineScale` | `'hour' \| 'day' \| 'week' \| 'month'` | 自動判定 (`'day'`) | タイムライン列の刻み単位（時間・日・週・月） |
| `timelineColumnWidth` | `number` | 自動算出 | タイムライン列の幅（文字数単位。指定なし時は画面のpx幅または既定値から自動計算） |
| `dateFormat` | `string` | `'YYYY/MM/DD'` | 日付の表示形式 |
| `includeWeekends` | `boolean` | `true` | タイムラインに土日を含めるか（土日列は薄いグレー背景） |
| `highlightToday` | `boolean` | `true` | 今日の日付列をハイライト表示するか |
| `themeColor` | `string` | `'#3B82F6'` | ヘッダー行やアクセントのテーマカラー（HEX） |
| `columns` | `ExcelExportColumn[]` | 標準カラム | 出力するテーブル列のカスタム定義配列 |
| `download` | `boolean` | `true` | ブラウザで自動ダウンロードをトリガーするか |

## ライセンス

MIT

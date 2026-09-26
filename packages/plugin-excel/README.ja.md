# @mogura/moguchart-plugin-excel

[English](./README.md)

ガントチャートライブラリ `@mogura/moguchart-core` 用の Excel (.xlsx) エクスポートプラグインです。
ExcelJS を使用し、カレンダー日付列にタスク期間が色塗りされた「Excel製ガントチャート（工程表・タイムライン）」を高画質・スタイリング付きで出力します。

## 特徴

- 📊 **Excelタイムライン（工程表）出力**: 左側にタスク属性（WBS、タスク名、担当者、期間、進捗率等）、右側にカレンダー列を配置し、タスクの開始日〜終了日に対応するセルを美しく着色（サマリータスク、土日・祝日の背景色分け、進捗率パーセント表示対応）。
- 🌐 **多言語対応 & カスタムロケール**: 日本語（`ja`）、英語（`en`）、中国語簡体字（`zh`）を標準サポート。独自の言語定義（`registerExcelLocale`）も追加可能。
- 🌳 **WBS階層構造の保持**: 親行・子行の階層関係（WBSコード `1`, `1.1`, `1.2` 等）を維持し、インデントや太字を反映。
- 🎨 **カラーカスタマイズ**: テーマカラーやタスクごとのカスタムバー色（`progressColor`）がExcel上にも反映。
- ⏱ **多彩なタイムラインスケール**: 時間（hour）・日（day）・週（week）・月（month）スケール、および半日や30分などの列分割に対応。
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

// 英語でエクスポート
await chart.exportExcel({
  locale: 'en',
  filename: 'project-schedule.xlsx'
})
```

### 2. スタンドアロン関数として呼ぶ（必要な時だけ遅延インポート）

エクスポートボタンがクリックされた時だけ動的インポート（Dynamic Import）することで、初期バンドルサイズを最小限に抑えられます。

```typescript
async function handleExportExcel(chartElement) {
  const { exportExcel } = await import('@mogura/moguchart-plugin-excel')
  await exportExcel(chartElement, {
    filename: '工程表.xlsx',
    locale: 'ja',
    download: true
  })
}
```

### 3. カスタム言語・ロケールの追加

独自の言語定義を追加したい場合、`registerExcelLocale` を使用して新しいロケールを登録できます。

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
  durationUnit: ' j',
  summaryLabel: ' (Récapitulatif)',
  percentLabel: '%',
})

await chart.exportExcel({ locale: 'fr' })
```

## オプション (`ExportExcelOptions`)

| オプション | 型 | デフォルト値 | 説明 |
| :--- | :--- | :--- | :--- |
| `locale` | `'ja' \| 'en' \| 'zh' \| string \| ExcelLocaleDefinition` | 自動判定 / `'ja'` | 言語・ロケール指定（日本語、英語、中国語、または登録済み独自言語定義） |
| `filename` | `string` | `'gantt-chart.xlsx'` | 出力ファイル名 |
| `sheetName` | `string` | `'工程表'` | 出力シート名 |
| `timelineScale` | `'hour' \| 'day' \| 'week' \| 'month'` | 自動判定 (`'day'`) | タイムライン列の刻み単位（時間・日・週・月） |
| `columnsPerUnit` | `number` | `1` | 1日または1時間あたりの列数・分割数（例: 2で半日単位や30分刻み） |
| `snapDurationMinutes` | `number` | 自動判定 / `1440` or `60` | スナップ単位（分）。日単位（1440, 720, 360, 180等）や時間単位（60, 30, 15等）から分割列数を自動計算 |
| `timelineColumnWidth` | `number` | 自動算出 | タイムライン列の幅（文字数単位。指定なし時は画面のpx幅または既定値から自動計算） |
| `dateFormat` | `string` | `'YYYY/MM/DD'` | 日付の表示形式 |
| `includeWeekends` | `boolean` | `true` | タイムラインに土日を含めるか（日単位出力時: 土曜は淡いブルー、日曜・祝祭日は淡い赤/ピンク背景） |
| `highlightToday` | `boolean` | `true` | 今日の日付列をハイライト表示するか |
| `themeColor` | `string` | `'#3B82F6'` | ヘッダー行やアクセントのテーマカラー（HEX） |
| `isHoliday` | `(date: Date) => boolean` | 自動判定 | 祝祭日判定関数（指定なし時は `chart.option.calendar.isHoliday` を自動参照） |
| `holidayColor` | `string` | `'#FEE2E2'` | 祝祭日および日曜日の背景色（日単位出力時のみ適用、淡い赤/ピンク） |
| `columns` | `ExcelExportColumn[]` | 標準カラム | 出力するテーブル列のカスタム定義配列 |
| `download` | `boolean` | `true` | ブラウザで自動ダウンロードをトリガーするか |

## ライセンス

MIT

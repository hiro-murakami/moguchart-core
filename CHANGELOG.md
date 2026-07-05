# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.8.1] - 2026-07-05

### Added

- `BarHoverEventDetail` に `barBottom` プロパティ（バー下辺のY座標）を追加：ツールチップをバーの下方向に表示する際の位置計算に使用

### Improved

- タスクバーのツールチップが、バーが画面上部に近い場合はバーの下方向に表示されるように位置決定ロジックを改善。ツールチップの z-index も引き上げ、他の要素に隠れにくくなった
- タスクバーのクリックとドラッグを正しく区別するため、ドラッグ開始に3pxの移動閾値を導入。バーをクリックして選択する際に意図しない移動（スナップ単位への吸着）が発生しなくなった

## [0.8.0] - 2026-06-26

### Added

- `marker-dblclick` イベント（`MarkerDblClickEventDetail` 型定義）：マーカーのダブルクリック時に発火
- `marker-contextmenu` イベント（`MarkerContextMenuEventDetail` 型定義）：マーカーの右クリック時に発火
- `GanttMarker` に `fontSize` プロパティ（`MarkerFontSize` 型: `'xs'` | `'sm'` | `'md'` | `'lg'` | `'xl'`）を追加：マーカーラベルのフォントサイズを指定可能
- `GanttRow` に `selectedMarkerId` プロパティを追加：現在選択中（編集中）のマーカーを指定可能（選択時にパルスアニメーション・グローエフェクトが適用される）
- `customRendering.rowHeaderTooltip` を追加：行ヘッダーにマウスホバーした際にツールチップを表示する機能。文字列・HTMLElement・Lit TemplateResult を返す関数を設定可能。表示遅延は `tooltipDelay` を共有し、テーマに応じた配色が自動適用される

### Improved

- マイルストーンのホバー時にz-indexが正しく適用され、重なり順序が改善
- マーカーサイズがフォントサイズに応じて動的に調整されるように改善
- ツールチップがビューポートからはみ出さないよう位置自動調整を追加

## [0.7.0] - 2026-06-13

### Added

- Ctrl/Cmd + マウスホイールによるズームイン・ズームアウト機能を追加（`zoom` オプションで有効化）
- `zoomTo(value)` メソッド：指定した `pxPerDay`（月単位モードでは `pxPerMonth`）にズームレベルを設定
- `zoomToFit()` メソッド：全タスクが表示領域に収まるようズームレベルを自動調整
- `resetZoom()` メソッド：ズームをリセットし、`option` で設定された元のスケールに復元
- `zoom-change` イベント（`ZoomChangeEventDetail` 型定義）：ズーム変更時に `pxPerDay` / `pxPerMonth` を通知
- `zoom` オプション（`enabled`, `min`, `max`, `step`）：ズーム機能の有効化と制限値・倍率の設定
- `dependency.showConnectors` オプション：接続ポイント（丸印）の表示/非表示を制御（デフォルト: `true`）。`false` に設定するとバーのホバー時にコネクターが表示されなくなり、ドラッグによる依存関係の新規作成を無効化できる
- `dependency.showCriticalPath` オプション：依存関係グラフからクリティカルパス（最長チェーン）を自動計算し、該当するタスクバーと接続線を赤色でハイライト表示する機能を追加。テーマカラー `criticalPath` でハイライト色をカスタマイズ可能
- `getRowPositions()` メソッド：各行のY座標レイアウト情報（`top`, `height`, `bottom`）を取得

### Changed

- 画像/PDFエクスポートの分割時、`splitHeight` による分割位置が行の途中で切れないよう、行の境界に合わせて自動調整するように改善

### Fixed

- エクスポート時に現在時刻線（タイムインジケーター）およびバッジが出力画像に描画されてしまう問題を修正
- エクスポート時にホスト要素の `border-radius` と `border` が出力画像に影響する問題を修正

## [0.6.0] - 2026-06-06

### Added

- ガントチャートの行マーカー（マイルストーン等）が重なる場合に、自動的にマルチレーン配置するレイアウト機能を実装
- 同一行にある複数選択されたタスクを、まとめて別の行へ垂直移動できる機能を追加
- ガントバーにホバーした際、近接する接続線のみを表示するプロキシミティベースのコネクタ表示切替機能を追加
- GitHub Release 自動化ワークフロー（`.github/workflows/release.yml`）および設定ファイルを追加

## [0.5.3] - 2026-05-30

### Security

- ツールチップのカスタムレンダリングで使用していた `unsafeHTML` を削除し、文字列コンテンツは `textContent` で安全に挿入するように変更（XSS 防止）
- ドラッグ情報オーバーレイの `innerHTML` 直接代入を Lit の `render()` + `html` テンプレートリテラルに置換し、自動エスケープを有効化
- カレンダーヘッダーのカスタムコンテンツ注入（`injectCustomContent`）で使用していた `innerHTML` を `textContent` に変更

### Fixed

- 外部からドロップされたタスクデータ（`handleExternalTaskDrop`）に対して、必須フィールド（`id`, `name`, `start`, `end`）の存在・型検証および `Date` 変換のバリデーションを追加
- エクスポート機能（`gantt-chart-export.ts`）に残っていたデバッグ用 `console.log` を削除

## [0.5.2] - 2026-05-24

### Changed

- パッケージ互換性とバンドルサイズ最適化のため、`lodash` から `lodash-es` に移行
- 祝日判定用パッケージ `@holiday-jp/holiday_jp` を `dependencies` から `devDependencies` へ移動し、利用側のインストール容量を削減
- デモビルドの出力先を `dist-demo` に分離し、ライブラリ成果物（`dist`）との混在を防止
- `package.json` にパブリック公開用のスコープ設定を追加し、英語ドキュメント `README.en.md` をパッケージに同梱

### Fixed

- ビルド出力される型定義ファイル（`.d.ts`）内で、パスエイリアス（`@/`）がそのまま残ってしまい、利用側でコンパイルエラーになる問題を解消するため、すべてのインポートを相対パスに修正

## [0.5.1] - 2026-05-23

### Fixed

- 曲線（S字）モードの接続線で、開始と終了のX座標が同じ場合にただの垂直線になっていた問題を修正し、直線モードと同様にS字（クランク状）に回り込むように描画するよう改善
- ドラッグ中の情報オーバーレイがドラッグ中タスクバーに追従するよう改善

## [0.5.0] - 2026-05-20

### Added

- キーボード操作のサポート（矢印キーによるナビゲーション・選択、Shift+矢印キーによるタスク移動、Delete/Backspaceキーによる削除）
- `keyboard` オプション（`enabled`, `moveStep`）
- `task-delete` イベント（`TaskDeleteEventDetail` 型定義）
- `MoguchartLocale` に `timeUnitDateFormat` フィールドを追加（時間単位モードの日付フォーマット）
- `ThemeColorPalette` に `showTimeDateLine` フィールドを追加（時間単位モードの日付区切り罫線色）

## [0.1.0] - 2025-05-18

### Added

- ガントチャート Web Component の初回リリース
- Lit ベースのフレームワーク非依存アーキテクチャ（Vue / React / Angular / Svelte 等で利用可能）
- タスクバーのドラッグ＆ドロップによる移動・リサイズ
- 日・週・月・年単位のタイムスケール切り替え
- 日本の祝日表示（`@holiday-jp/holiday_jp`）
- PDF / 画像エクスポート機能（`jspdf` / `html2canvas-pro`）
- UMD / ESM 両形式のビルド出力
- TypeScript 型定義の同梱

[0.8.1]: https://github.com/hiro-murakami/moguchart-core/compare/v0.8.0...v0.8.1
[0.8.0]: https://github.com/hiro-murakami/moguchart-core/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/hiro-murakami/moguchart-core/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/hiro-murakami/moguchart-core/compare/v0.5.3...v0.6.0
[0.5.3]: https://github.com/hiro-murakami/moguchart-core/compare/v0.5.2...v0.5.3
[0.5.2]: https://github.com/hiro-murakami/moguchart-core/compare/v0.5.1...v0.5.2
[0.5.1]: https://github.com/hiro-murakami/moguchart-core/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/hiro-murakami/moguchart-core/compare/v0.1.0...v0.5.0
[0.1.0]: https://github.com/hiro-murakami/moguchart-core/releases/tag/v0.1.0



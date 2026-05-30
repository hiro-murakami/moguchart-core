# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.5.3]: https://github.com/hiro-murakami/moguchart-core/compare/v0.5.2...v0.5.3
[0.5.2]: https://github.com/hiro-murakami/moguchart-core/compare/v0.5.1...v0.5.2
[0.5.1]: https://github.com/hiro-murakami/moguchart-core/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/hiro-murakami/moguchart-core/compare/v0.1.0...v0.5.0
[0.1.0]: https://github.com/hiro-murakami/moguchart-core/releases/tag/v0.1.0


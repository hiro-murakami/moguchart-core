# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.5.0]: https://github.com/hiro-murakami/moguchart-core/compare/v0.1.0...v0.5.0
[0.1.0]: https://github.com/hiro-murakami/moguchart-core/releases/tag/v0.1.0

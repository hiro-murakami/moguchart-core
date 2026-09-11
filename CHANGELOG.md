# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-09-09

祝・正式リリース！🎉
本バージョンをもって `@mogura/moguchart-core` はメジャーバージョン 1.0.0 に到達し、プロダクションレディな安定版 API として正式にリリースされました。
本リリースでは、プロジェクト管理において極めて重要な **WBS（階層ツリー構造・行の開閉）** および **サマリータスク（親タスクの期間・進捗自動集計描画）** 機能を全面的にサポートしました。

### Added

- **スクロール位置制御メソッド (`resetScroll`, `scrollToPosition`) を追加**:
  - `GanttChartElement.resetScroll()`: ガントチャートのスクロール位置（横スクロール・縦スクロール）を左上（0, 0）にリセットする公開メソッドを追加。内部状態（`currentScrollLeft`, `currentScrollTop`, `virtualScrollTop`）も同期して初期化
  - `GanttChartElement.scrollToPosition(options)`: 任意のスクロール座標（`left`, `top`, `behavior`）へスクロール移動する公開メソッドを追加
  - プロジェクト切り替え時や新規読み込み時に前回のスクロール位置が残る問題を解消し、先頭位置へ確実にリセット可能に

- **チャート全体のフォントサイズ倍率スケーリング機能 (`fontScale`) を追加**:
  - `GanttChartOption.fontScale` オプション（`number`、デフォルト: `1`）を追加し、ガントチャート全体のフォントサイズを一括で拡大・縮小可能に
  - CSS カスタムプロパティ `--moguchart-font-scale` をホスト要素に動的に反映し、カレンダー（月・週・日・時・現在時刻バッジ・祝日バッジ）、行ヘッダー、WBSコードバッジ、ツリー開閉トグル、タスクバーラベル、進捗率ラベル、マーカーラベル、ツールチップ、ドラッグ情報オーバーレイのフォントサイズが `calc(.. * var(--moguchart-font-scale, 1))` で連動してスケーリングされるよう対応
  - 親アプリケーション側でチャートの表示倍率（ズーム）を変更する際に、バー幅だけでなくフォントサイズや行ヘッダーの視認性を同期して最適化可能に

- **WBS（階層ツリー構造・展開/折りたたみ）機能を追加**:
  - `GanttRow` に `parentId` プロパティを追加し、無制限の親子階層（大工程 ＞ 中工程 ＞ 詳細タスクなど）のツリー構造に対応
  - `GanttRow` に `collapsed` プロパティを追加し、行ごとの初期折りたたみ状態を指定可能に
  - `GanttRow` に `isSummary` プロパティを追加し、親サマリー行としての明示的なフラグ管理に対応
  - `GanttRow` に `wbsCode` プロパティを追加し、WBS番号（例: "1.2.1"）の保持・表示に対応
  - 行ヘッダー（左側グリッド）における階層インデント表示（階層レベルに応じた自動インデント）
  - 子階層を持つ親行の左側に開閉トグルアイコン（▶ / ▼）を表示し、クリックによる展開/折りたたみに対応
  - 行の開閉状態が変更された際に発火する `row-toggle-collapse` イベント（`RowToggleCollapseEventDetail` 型定義）を追加
  - 行の展開/折りたたみに伴うタスクバー描画、行グリッド、仮想スクロール、ミニマップの完全同期追従
  - `GanttChartOptionTree` 型定義および `GanttChartOption.tree` オプションを追加：
    - `enabled`: ツリー表示の有効/無効（デフォルト: `true`）
    - `indentWidth`: 階層レベルあたりのインデント幅（px、デフォルト: `16`）
    - `showToggleIcon`: 開閉トグルアイコンの表示/非表示（デフォルト: `true`）
    - `showWbsCode`: 行ヘッダーへの WBS コード自動表示（デフォルト: `false`）
    - `autoSummary`: 配下の子タスクからの期間・進捗率の自動集計有効化（デフォルト: `true`）
    - `summaryColor`: サマリータスクバーの既定色（デフォルト: `'#334155'`）
- **サマリータスク（Summary Task）自動計算＆描画機能を追加**:
  - 子階層を持つ親行において、配下の全タスクの最小開始日・最大終了日・期間加重平均進捗率を自動集計して描画するサマリータスクバー（ブラケット/矢じり形状のサマリーバー）をサポート
  - `GanttTask.type` に `'summary'` を追加
  - `GanttRow` に `summaryColor` プロパティを追加し、行単位でのサマリータスクバー色の個別オーバーライドに対応
  - 親行自身に通常タスクが登録されている場合でも、サマリータスクバーと通常タスクバーの共存・同時描画をサポート
  - `GanttChartOptionProgress.showSummaryLabel` オプション（デフォルト: `false`）を追加し、サマリータスク上での進捗率ラベル表示を制御可能に
  - ミニマップ（`<gantt-minimap>`）上でのサマリータスクバーのプレビュー描画および進捗率の濃淡描画に対応
- **階層構造に対応した安全なドラッグ＆ドロップ並び替え（D&D Reorder）**:
  - 親行をドラッグ移動した際、その配下の全子孫行がブロックとして一体となって追従移動
  - 自身の子孫階層へのドロップを自動検知して防止する循環参照防止ロジック（`canDropRow`）を実装
- **プログラムによる階層操作パブリックメソッドを追加**:
  - `chart.toggleRowCollapse(rowId: string, collapsed?: boolean)`: 指定行の開閉をトグル（または明示的に開閉）
  - `chart.collapseAll()`: 子行を持つすべての親行を一括折りたたみ
  - `chart.expandAll()`: すべての行を一括展開
- **WBS・階層計算ユーティリティ関数を公開**:
  - `computeRowLevels`: 全行のツリー深度（レベル）を計算
  - `computeRowWbsCodes`: WBS階層コード（1, 1.1, 1.2 等）の自動採番
  - `computeChildRowIds`: 指定行の直下または全子孫の行ID一覧を取得
  - `computeVisibleTreeRows`: 折りたたみ状態を考慮した表示対象行の抽出
  - `computeSummaryTask`: 子タスク配列から期間・進捗率を集計したサマリータスク情報を算出
  - `canDropRow`: 循環参照を防ぐ安全な行ドロップ可否判定
- **包括的な単体テストスイートを追加**:
  - `src/__tests__/gantt-chart-wbs.test.ts`, `src/__tests__/wbs.test.ts`, `src/__tests__/gantt-bar-connector.test.ts` を追加（計40件以上のテストを追加し、総テスト数207件すべてパス）

### Changed

- **サマリータスクの依存関係線（Connector）描画の抑止**:
  - サマリータスクは子タスクの集計結果であるため、意図しない依存関係線の混乱や循環参照を防ぐ目的で、サマリータスクからの依存関係線（矢印）の描画を自動的に無効化
- **ドキュメント・リポジトリ構成の刷新**:
  - 国際化標準に合わせて `README.md` を英語版とし、日本語版を `README.ja.md` に移行
  - API ドキュメントを言語別（`doc/API.ja.md`, `doc/API.md`）に集約・整備
  - デモ画面（`src/demo/main.ts`, `src/demo/data.ts`）に WBS ツリーデータおよび折りたたみ・サマリータスク操作のコントロールを追加

### Fixed

- **行ヘッダーの開閉トグルアイコンでのダブルクリック誤動作を修正**:
  - 親行の開閉トグルアイコン（▶ / ▼）をダブルクリックした際にイベント伝播を停止（`stopPropagation`）し、親行のダブルクリックイベント（行名インライン編集や行編集ダイアログ表示）が誤発火してしまう問題を解消

## [0.12.0] - 2026-09-05

### Added

- ガントバーの矩形範囲選択（ラバーバンド選択 / Marquee Selection）機能を追加
  - チャート背景（日付グリッド領域）をドラッグして、矩形で囲まれた複数のタスクバーを一括選択できる機能を追加
  - ドラッグ中に交差するタスクがリアルタイムにハイライト選択される AABB（Axis-Aligned Bounding Box）交差判定を実装
  - Shift / Ctrl / Cmd キーを押しながらのドラッグ操作による追加選択（複数選択の累積）に対応
  - 修飾キーなしの通常ドラッグ時は以前の選択をリセットして範囲内タスクのみを選択
  - ドラッグ中にチャート端に達した際のオートスクロール（自動スクロール）機能に対応
  - 単なるクリック操作（移動量4px未満）との競合を防ぎ、背景クリックによる選択解除とスムーズに共存
  - `GanttChartOptionSelection` 型定義および `GanttChartOption.selection` オプション（`marquee`, `borderColor`, `backgroundColor`）を追加
  - テーマカラー（`ThemeColorPalette`）に `selectionMarqueeBorder`, `selectionMarqueeBg` を追加（Light / Dark テーマごとの最適色を定義）
  - 選択完了時に `bar-selection-change` イベントを発火
  - 矩形選択された複数タスクの一括ドラッグ移動、キーボード移動（Shift+矢印キー）、一括削除（Deleteキー）と完全に連携
  - デモ画面（`src/demo/main.ts`）に矩形範囲選択のトグルコントロールを追加
  - 矩形範囲選択機能の包括的な単体テスト（`src/__tests__/gantt-chart-marquee-selection.test.ts`）を追加
- タスクの進捗状況（Progress）管理・追従機能を追加
  - `GanttTask` に `progress`（0〜100 の進捗率）、`progressColor`（カスタム色）、`progressStyle`（カスタムCSSスタイル）、`progressResizable`（ドラッグ編集可否）プロパティを追加
  - タスクバー内に進捗率に応じたインジケーター（`full`、`bottom`、`top` スタイル）を描画
  - 進捗バー端のハンドルをドラッグして直感的に進捗率を変更できるインタラクティブ編集機能を追加（`snapStep` によるスナップ刻み設定、Esc キーによるドラッグキャンセル対応）
  - 進捗変更ハンドルの視認性向上・UI改善（ホバー/ドラッグ時の拡大表示、ライン・ノブのスタイリング）
  - 進捗ラベル表示機能（`showLabel`: boolean、`labelPosition`: `'inside'` | `'right'` | `'left'` | `'center'`、カスタムフォーマッタ `labelFormatter`）を追加
  - 進捗変更完了時に発火する `task-progress-change` イベント（`TaskProgressChangeEventDetail` 型定義）を追加
  - `GanttChartOptionProgress` 型定義および `GanttChartOption.progress` オプション（`enabled`, `editable`, `color`, `showLabel`, `labelPosition`, `labelFormatter`, `snapStep`, `indicatorPosition`）を追加
  - テーマカラー（`ThemeColorPalette`）に `taskProgress`, `taskProgressHandle` を追加
  - ロケール（`MoguchartLocale`）に `tooltip.progress` を追加し、ツールチップで進捗率が表示されるよう対応
  - ミニマップ（`<gantt-minimap>`）のタスクバーに進捗率が自動的に反映・濃淡描画されるよう対応
  - 進捗計算・正規化ユーティリティ関数を公開：`clampProgress`, `calculateRowProgress`（行・タスク配列の単純平均進捗率）, `calculateWeightedRowProgress`（期間加重平均進捗率）, `calculateProjectProgress`（プロジェクト全体の期間加重平均進捗率）
  - デモ画面（`src/demo/main.ts`）に進捗表示・ドラッグ編集・進捗ラベル表示のトグルコントロールを追加
  - 進捗管理機能の包括的な単体テスト（`src/__tests__/task-progress.test.ts`）を追加

## [0.11.0] - 2026-08-29

### Added

- フローティング小窓型のミニマップ（Overview Minimap）コンポーネント（`<gantt-minimap>`）を追加
  - チャート全体の全タスク・マイルストーン・現在時刻線を `<canvas>` で高速・軽量に鳥瞰描画
  - 現在の表示領域（ビューポート）を半透明枠（ファインダー、角丸 8px）で可視化
  - ファインダー枠のドラッグによるスクロール同期（パン操作）およびミニマップクリックによるジャンプ移動に対応
  - ミニマップをドラッグしてチャート内の任意の位置へ自由に移動できる機能および `minimap-move` イベント（`MinimapMoveEventDetail` 型定義）を追加
  - ミニマップの表示位置・保存座標を親要素の右下基準（`MinimapPosition` 型: `right`, `bottom` オフセット）として管理し、画面リサイズ時や解像度変更時にも安定して右下相対位置を保持するよう設計
  - チャートのビューポート（親要素）サイズ変更やコンテンツ更新時に、右下アンカー基準でミニマップの表示位置を自動追従し、親コンテナ外へのはみ出しを防止
  - ミニマップの四隅やエッジをドラッグしてサイズを自由に変更（ドラッグリサイズ）できる機能および `minimap-resize` イベント（`MinimapResizeEventDetail` 型定義）を追加
  - 折りたたみ（最小化 / 展開）機能およびアニメーション、`minimap-collapse` イベント（`MinimapCollapseEventDetail` 型定義）を追加
  - `GanttChartOptionMinimap`, `MinimapPosition` 型定義および `GanttChartOption.minimap` オプション（`enabled`, `width`, `height`, `maxHeight`, `preserveAspectRatio`, `resizable`, `minWidth`, `maxWidth`, `minHeight`, `collapsible`, `collapsed`, `showMilestones`, `showCurrentTime`, `position`, `opacity`）
  - ミニマップの不透明度（`opacity`）設定およびホバー・ドラッグ・リサイズ時の視認性向上スタイルの追加
  - テーマカラー（`minimapBg`, `minimapBorder`, `minimapViewport`, `minimapViewportBorder`, `minimapTask`）のサポート
  - デモ画面（`src/demo/main.ts`）にミニマップ表示トグルを追加
  - ミニマップ単体およびガントチャート統合の単体テスト（`src/__tests__/gantt-minimap.test.ts`）を追加

### Fixed

- PNG/PDF エクスポート（`exportImage` / `exportGanttWithHtml2Canvas`）時に、中身が描画されず背景色のみが出力されてしまう問題を修正
  - `html2canvas` の描画対象を Web Components ホスト要素から Shadow DOM 内の実描画コンテナ（`.scroll-container`）に変更
  - キャプチャ座標およびスクロールオフセット（`scrollX: 0, scrollY: 0, x: 0, y: 0`）を明示的に指定
  - テーマ設定（Light / Dark / Custom）に応じた背景色が出力画像に反映されるよう改善
  - エクスポート実行時に現在のスクロール位置がリセットされず保持・復元されるよう改善
- エクスポート処理およびスクロール位置保持を検証する単体テストを追加

## [0.10.0] - 2026-08-23

### Added

- `enableCrossRowMove` オプション（デフォルト: `true`）を追加：タスクバーのドラッグ時に行を跨いだ移動（縦方向の移動）を許可するかどうかを設定可能（`false` の場合は同一行内でのみ移動可能）
- デモ画面（`src/demo/main.ts`）に `enableCrossRowMove` の設定トグルおよび多言語ラベルを追加
- ガントチャート領域外またはタスクが存在しない行外へカーソルが移動した際のドラッグキャンセル・復帰機能を追加
- `TaskUpdateEventDetail` にプロパティを追加：`barX`, `barTop`, `barBottom`（タスクバー座標情報）、`isOutside`（チャート領域外判定フラグ）、`isCancel`（キャンセル判定フラグ）
- ドラッグキャンセルおよび行間移動制御の単体テスト（`src/__tests__/gantt-bar-drag-cancel.test.ts`）を追加

### Improved

- ドラッグ中の情報オーバーレイの表示位置計算をマウス座標追従からタスクバー基準（上下配置）へと改善し、ドラッグ中のタスクとの視認性を向上
- ガントチャートの表示領域外や有効な行が存在しない場所へドラッグした際、タスクバーが初期位置に戻り、オーバーレイが非表示になるよう挙動を改善。また、その位置でドロップされた場合は移動処理をキャンセルするように改善

## [0.9.1] - 2026-08-15

### Removed

- `devDependencies` から不要になった `@holiday-jp/holiday_jp` への依存を削除

### Changed

- デモ環境（`src/demo/`）およびテストにおける祝日判定を、内製の祝日判定モジュール（`src/demo/holidays.ts`）およびモック関数を利用する構成へ移行
- 祝日判定ロジックの単体テスト（`src/__tests__/holidays.test.ts`）を追加

## [0.9.0] - 2026-08-14

### Added

- デモページ（`src/demo/main.ts`）のヘッダーに npm パッケージおよび GitHub リポジトリへの外部リンクを追加
- `gantt-row` コンポーネントに `row-header-mouseleave` カスタムイベントのハンドリングを追加

### Changed

- パッケージを純粋な ES Module (`"type": "module"`) として再構成し、Vite 設定およびビルド出力を最適化
- パッケージマネージャーを pnpm 11 (`pnpm@11.21.0`) へ移行・更新
- `package.json` のメタデータ（`description`, `keywords`, `files` に `README.md` を追加）を拡充
- `README.md` および `README.en.md` にオンラインデモサイト（Vercel）へのリンクを追加

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

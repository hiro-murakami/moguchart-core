// デモページ用UIテキスト定義
export interface DemoTexts {
  viewMode: string
  dayUnit: string
  weekUnit: string
  monthUnit: string
  hourUnit: string
  theme: string
  readOnlyMode: string
  showDragInfo: string
  enableRowReorder: string
  enableCrossRowMove: string
  showMinimap: string
  autoUpdateTime: string
  customRendering: string
  rowHeaderResize: string
  showHiddenRows: string
  showConnectors: string
  showTime: string
  showYearMonth: string
  showDates: string
  showCurrentTimeLine: string
  showCurrentTimeBadge: string
  snapUnit: string
  barHeight: string
  dayWidth: string
  rowHeaderWidth: string
  tooltipDelay: string
  // セクションタイトル
  sectionCalendar: string
  sectionBehavior: string
  sectionSize: string
  oneDay: string
  oneMonth: string
  minutes: (n: number) => string
  candidateTasks: string
  duration: string
  daysUnit: string
  hoursUnit: string
  weeksUnit: string
  monthsUnit: string
  weekStartDay: string
  dayNames: string[]
  noTasks: string
  // データ用テキスト
  project: (n: number) => string
  requirementsDefinition: string
  design: string
  assignee: (n: number) => string
  morningMeeting: string
  taskA: string
  break_: string
  taskB: string
  reviewDeadline: string
  releaseScheduled: string
  alphaRelease: string
  betaRelease: string
  officialRelease: string
  newTaskA: string
  newTaskB: string
  meetingSetup: string
  patternTask: string
  labelStyleTask: string
  // ショーケース用タスク名
  planning: string
  development: string
  testing: string
  release: string
  review: string
  deployment: string
  research: string
  prototyping: string
  codeReview: string
  bugfix: string
  documentation: string
  integration: string
  uiDesign: string
  backendDev: string
  frontendDev: string
  qaTest: string
  staging: string
  monitoring: string
  // コンテキストメニュー
  edit: string
  duplicate: string
  delete_: string
  editDetail: (name: string, id: string) => string
  editAction: (name: string) => string
  duplicateAction: (name: string) => string
  moveTo: (name: string) => string
}

export const jaTexts: DemoTexts = {
  viewMode: '表示モード:',
  dayUnit: '日単位',
  weekUnit: '週単位',
  monthUnit: '月単位',
  hourUnit: '時間単位',
  theme: 'テーマ:',
  readOnlyMode: '表示専用モード',
  showDragInfo: 'ドラッグ情報を表示',
  enableRowReorder: '行の並び替えを有効化',
  enableCrossRowMove: '行を跨いだタスク移動を有効化',
  showMinimap: 'ミニマップ（全体鳥瞰）を表示',
  autoUpdateTime: '現在時刻を自動更新',
  customRendering: 'カスタムレンダリング有効',
  rowHeaderResize: '行ヘッダーのリサイズ許可',
  showHiddenRows: '非表示行を表示 (5行おき)',
  showConnectors: '接続ポイント（丸印）を表示',
  showTime: '時間を表示',
  showYearMonth: '年月を表示',
  showDates: '日付を表示',
  showCurrentTimeLine: '現在時刻線を表示',
  showCurrentTimeBadge: '現在時刻バッジを表示',
  snapUnit: 'スナップ単位:',
  barHeight: 'バーの高さ:',
  dayWidth: '1日の幅:',
  rowHeaderWidth: '行ヘッダーの幅:',
  tooltipDelay: 'ツールチップ遅延:',
  sectionCalendar: 'カレンダー表示',
  sectionBehavior: '動作設定',
  sectionSize: 'サイズ設定',
  oneDay: '1日',
  oneMonth: '1ヶ月',
  minutes: (n) => `${n}分`,
  candidateTasks: '◯ タスクテンプレート',
  duration: '期間:',
  daysUnit: '日',
  hoursUnit: '時間',
  weeksUnit: '週',
  monthsUnit: 'ヶ月',
  weekStartDay: '週の始まり:',
  dayNames: ['日曜', '月曜', '火曜', '水曜', '木曜', '金曜', '土曜'],
  noTasks: 'タスクはありません',
  project: (n) => {
    const names = [
      '', // 0 is unused
      '新規ECサイト構築',
      'モバイルアプリ刷新',
      'API基盤リプレース',
      '社内ポータル開発',
      '決済システム導入',
      'データ分析基盤',
      'セキュリティ強化',
      'CI/CDパイプライン',
      'マイクロサービス移行',
      'v2.0リリース',
      '在庫管理システム',
      'CRM連携開発',
      'チャットボット導入',
      '帳票システム刷新',
      'SSO認証基盤',
      'ログ収集基盤',
      '通知サービス構築',
      'CDN最適化',
      'DB移行プロジェクト',
      'パフォーマンス改善',
      'アクセシビリティ対応',
      'i18n多言語対応',
      'ダッシュボード開発',
      'レポート自動生成',
      'ワークフロー自動化',
      'メール配信基盤',
      'ファイル管理システム',
      '検索エンジン改善',
      'AI推薦エンジン',
      'リアルタイム通知',
      'モニタリング基盤',
      'バッチ処理最適化',
      'テスト自動化推進',
      'ドキュメント管理',
      'API Gateway構築',
      'コンテナ環境整備',
      'DR対策構築',
      'データバックアップ',
      'セキュリティ監査',
      '負荷テスト環境',
      'ステージング環境構築',
      '開発環境統一',
      'コードベース統合',
      'UIデザインシステム',
      'ユーザー調査分析',
      'A/Bテスト基盤',
      'フィーチャーフラグ',
      'キャッシュ戦略',
      'GraphQL移行',
      '外部API連携',
    ]
    return names[n] || `プロジェクト ${n}`
  },
  requirementsDefinition: '要件定義',
  design: '設計',
  assignee: (n) => {
    const names = [
      '',
      '田中 太郎', '鈴木 花子', '佐藤 健一', '高橋 美咲', '伊藤 大輔',
      '渡辺 裕子', '山本 翔太', '中村 あおい', '小林 誠', '加藤 さくら',
      '吉田 隆', '山田 真由', '松本 拓海', '井上 彩', '木村 涼介',
      '林 由美子', '清水 蓮', '山口 楓', '池田 悠斗', '橋本 結衣',
      '阿部 将太', '石川 千尋', '前田 陸', '藤田 凛', '岡田 颯太',
      '後藤 葵', '村上 大和', '近藤 ひなた', '坂本 樹', '遠藤 心春',
    ]
    return names[n] || `担当者 ${n}`
  },
  morningMeeting: '朝会',
  taskA: 'タスクA',
  break_: '休憩',
  taskB: 'タスクB',
  reviewDeadline: 'レビュー期限',
  releaseScheduled: 'リリース予定',
  alphaRelease: 'α版リリース',
  betaRelease: 'β版リリース',
  officialRelease: '正式リリース',
  newTaskA: '新規タスクA',
  newTaskB: '新規タスクB',
  meetingSetup: '会議設定',
  patternTask: 'パターン付きタスク',
  labelStyleTask: 'ラベルスタイル付き',
  planning: '企画',
  development: '開発',
  testing: 'テスト',
  release: 'リリース',
  review: 'レビュー',
  deployment: 'デプロイ',
  research: '調査',
  prototyping: 'プロトタイプ',
  codeReview: 'コードレビュー',
  bugfix: 'バグ修正',
  documentation: 'ドキュメント',
  integration: '結合',
  uiDesign: 'UI設計',
  backendDev: 'バックエンド開発',
  frontendDev: 'フロントエンド開発',
  qaTest: 'QAテスト',
  staging: 'ステージング',
  monitoring: '監視設定',
  edit: '編集',
  duplicate: '複製',
  delete_: '削除',
  editDetail: (name, id) => `詳細編集: ${name} (ID: ${id})`,
  editAction: (name) => `編集: ${name}`,
  duplicateAction: (name) => `複製: ${name}`,
  moveTo: (name) => `移動先: ${name}`,
}

export const enTexts: DemoTexts = {
  viewMode: 'View Mode:',
  dayUnit: 'Day',
  weekUnit: 'Week',
  monthUnit: 'Month',
  hourUnit: 'Hour',
  theme: 'Theme:',
  readOnlyMode: 'Read Only',
  showDragInfo: 'Show Drag Info',
  enableRowReorder: 'Enable Row Reorder',
  enableCrossRowMove: 'Enable Cross-Row Move',
  showMinimap: 'Show Minimap (Overview)',
  autoUpdateTime: 'Auto Update Time',
  customRendering: 'Custom Rendering',
  rowHeaderResize: 'Resizable Row Header',
  showHiddenRows: 'Show Hidden Rows (every 5)',
  showConnectors: 'Show Connectors',
  showTime: 'Show Time',
  showYearMonth: 'Show Year/Month',
  showDates: 'Show Dates',
  showCurrentTimeLine: 'Show Current Time Line',
  showCurrentTimeBadge: 'Show Current Time Badge',
  snapUnit: 'Snap Unit:',
  barHeight: 'Bar Height:',
  dayWidth: 'Day Width:',
  rowHeaderWidth: 'Row Header Width:',
  tooltipDelay: 'Tooltip Delay:',
  sectionCalendar: 'Calendar',
  sectionBehavior: 'Behavior',
  sectionSize: 'Sizing',
  oneDay: '1 day',
  oneMonth: '1 month',
  minutes: (n) => `${n} min`,
  candidateTasks: '◯ Task Templates',
  duration: 'Duration:',
  daysUnit: 'days',
  hoursUnit: 'hours',
  weeksUnit: 'weeks',
  monthsUnit: 'months',
  weekStartDay: 'Week starts on:',
  dayNames: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  noTasks: 'No tasks',
  project: (n) => {
    const names = [
      '',
      'E-Commerce Platform',
      'Mobile App Redesign',
      'API Infrastructure',
      'Internal Portal',
      'Payment Integration',
      'Data Analytics Platform',
      'Security Enhancement',
      'CI/CD Pipeline',
      'Microservices Migration',
      'v2.0 Release',
      'Inventory Management',
      'CRM Integration',
      'Chatbot Development',
      'Reporting System',
      'SSO Authentication',
      'Log Aggregation',
      'Notification Service',
      'CDN Optimization',
      'Database Migration',
      'Performance Tuning',
      'Accessibility Compliance',
      'i18n Localization',
      'Dashboard Development',
      'Report Automation',
      'Workflow Automation',
      'Email Delivery System',
      'File Management',
      'Search Engine Upgrade',
      'AI Recommendation',
      'Real-time Notifications',
      'Monitoring Platform',
      'Batch Processing',
      'Test Automation',
      'Documentation Hub',
      'API Gateway Setup',
      'Container Environment',
      'Disaster Recovery',
      'Data Backup System',
      'Security Audit',
      'Load Testing Env',
      'Staging Environment',
      'Dev Env Unification',
      'Codebase Consolidation',
      'UI Design System',
      'User Research',
      'A/B Testing Platform',
      'Feature Flags',
      'Cache Strategy',
      'GraphQL Migration',
      'External API Integration',
    ]
    return names[n] || `Project ${n}`
  },
  requirementsDefinition: 'Requirements',
  design: 'Design',
  assignee: (n) => {
    const names = [
      '',
      'Alice Johnson', 'Bob Smith', 'Carol Williams', 'David Brown', 'Emma Davis',
      'Frank Wilson', 'Grace Miller', 'Henry Taylor', 'Ivy Anderson', 'Jack Thomas',
      'Karen Jackson', 'Leo White', 'Mia Harris', 'Noah Martin', 'Olivia Garcia',
      'Paul Martinez', 'Quinn Robinson', 'Ruby Clark', 'Sam Rodriguez', 'Tina Lewis',
      'Umar Lee', 'Vera Walker', 'Will Hall', 'Xena Allen', 'Yuki Young',
      'Zach King', 'Amy Wright', 'Ben Lopez', 'Cara Hill', 'Dan Scott',
    ]
    return names[n] || `Assignee ${n}`
  },
  morningMeeting: 'Morning Meeting',
  taskA: 'Task A',
  break_: 'Break',
  taskB: 'Task B',
  reviewDeadline: 'Review Deadline',
  releaseScheduled: 'Release Planned',
  alphaRelease: 'Alpha Release',
  betaRelease: 'Beta Release',
  officialRelease: 'Official Release',
  newTaskA: 'New Task A',
  newTaskB: 'New Task B',
  meetingSetup: 'Meeting Setup',
  patternTask: 'Patterned Task',
  labelStyleTask: 'Styled Label',
  planning: 'Planning',
  development: 'Development',
  testing: 'Testing',
  release: 'Release',
  review: 'Review',
  deployment: 'Deploy',
  research: 'Research',
  prototyping: 'Prototype',
  codeReview: 'Code Review',
  bugfix: 'Bugfix',
  documentation: 'Docs',
  integration: 'Integration',
  uiDesign: 'UI Design',
  backendDev: 'Backend Dev',
  frontendDev: 'Frontend Dev',
  qaTest: 'QA Test',
  staging: 'Staging',
  monitoring: 'Monitoring',
  edit: 'Edit',
  duplicate: 'Duplicate',
  delete_: 'Delete',
  editDetail: (name, id) => `Edit: ${name} (ID: ${id})`,
  editAction: (name) => `Edit: ${name}`,
  duplicateAction: (name) => `Duplicate: ${name}`,
  moveTo: (name) => `Move to: ${name}`,
}

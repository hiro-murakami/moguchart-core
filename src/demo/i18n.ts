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
  autoUpdateTime: string
  customRendering: string
  rowHeaderResize: string
  showHiddenRows: string
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
  autoUpdateTime: '現在時刻を自動更新',
  customRendering: 'カスタムレンダリング有効',
  rowHeaderResize: '行ヘッダーのリサイズ許可',
  showHiddenRows: '非表示行を表示 (5行おき)',
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
  oneDay: '1日',
  oneMonth: '1ヶ月',
  minutes: (n) => `${n}分`,
  candidateTasks: '◯ 追加候補タスク',
  duration: '期間:',
  daysUnit: '日',
  hoursUnit: '時間',
  weeksUnit: '週',
  monthsUnit: 'ヶ月',
  weekStartDay: '週の始まり:',
  dayNames: ['日曜', '月曜', '火曜', '水曜', '木曜', '金曜', '土曜'],
  noTasks: 'タスクはありません',
  project: (n) => `プロジェクト ${n}`,
  requirementsDefinition: '要件定義',
  design: '設計',
  assignee: (n) => `担当者 ${n}`,
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
  autoUpdateTime: 'Auto Update Time',
  customRendering: 'Custom Rendering',
  rowHeaderResize: 'Resizable Row Header',
  showHiddenRows: 'Show Hidden Rows (every 5)',
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
  oneDay: '1 day',
  oneMonth: '1 month',
  minutes: (n) => `${n} min`,
  candidateTasks: '◯ Unassigned Tasks',
  duration: 'Duration:',
  daysUnit: 'days',
  hoursUnit: 'hours',
  weeksUnit: 'weeks',
  monthsUnit: 'months',
  weekStartDay: 'Week starts on:',
  dayNames: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  noTasks: 'No tasks',
  project: (n) => `Project ${n}`,
  requirementsDefinition: 'Requirements',
  design: 'Design',
  assignee: (n) => `Assignee ${n}`,
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
  edit: 'Edit',
  duplicate: 'Duplicate',
  delete_: 'Delete',
  editDetail: (name, id) => `Edit: ${name} (ID: ${id})`,
  editAction: (name) => `Edit: ${name}`,
  duplicateAction: (name) => `Duplicate: ${name}`,
  moveTo: (name) => `Move to: ${name}`,
}

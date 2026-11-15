/**
 * moguchart-coreのロケール定義インターフェース。
 * 新しい言語を追加するには、このインターフェースに準拠したオブジェクトを作成し、
 * GanttChartOption.locale に渡してください。
 */
export interface MoguchartLocale {
  /** デフォルトの月表示フォーマット (dayjs互換フォーマット文字列) */
  monthFormat: string
  /** 月単位モードの月表示フォーマット (dayjs互換フォーマット文字列、例: 'M月' / 'MMM') */
  monthRowFormat: string
  /** 日付のフォーマット関数 (例: "2024/1/15" / "1/15/2024") */
  dateFormat: (date: Date) => string
  /** 時間単位モードの日付フォーマット関数 */
  timeUnitDateFormat: (date: Date) => string
  /** 日時のフォーマット関数（時刻が00:00でない場合に使用） */
  dateTimeFormat: (date: Date) => string
  /** 年月のみのフォーマット関数 (月単位モードのツールチップ・ドラッグオーバーレイで使用) */
  yearMonthFormat: (date: Date) => string
  /** 期間フォーマット */
  duration: {
    /** 日数のフォーマット (例: 3 → "3日" / "3 days") */
    days: (n: number) => string
    /** 時間のフォーマット (例: 2 → "2時間" / "2 hours") */
    hours: (n: number) => string
    /** 分のフォーマット (例: 30 → "30分" / "30 minutes") */
    minutes: (n: number) => string
    /** 期間がゼロの場合の表示 */
    zero: string
  }
  /** ツールチップのデフォルト文字列 */
  tooltip: {
    /** 所要日数の表示 (例: 5 → "所要日数: 5日" / "Duration: 5 days") */
    duration: (days: number) => string
    /** 稼働日を含めた所要日数の表示 (例: (5, 3) → "所要日数: 5日 (稼働3日)") */
    workingDays?: (days: number, workingDays: number) => string
    /** 進捗率の表示 (例: 75 → "進捗: 75%" / "Progress: 75%") (オプション) */
    progress?: (percent: number) => string
    /** ベースラインの表示 (例: "計画: 2024/1/1 - 2024/1/10 (10日)") */
    baseline?: (startStr: string, endStr: string, days: number) => string
    /** 遅延の表示 (例: "+3日遅れ" / "+3 days delay") */
    delay?: (days: number) => string
    /** 前倒しの表示 (例: "-2日前倒し" / "2 days ahead") */
    ahead?: (days: number) => string
    /** 計画通りの表示 (例: "計画通り" / "On schedule") */
    onSchedule?: string
    /** デッドライン（期限）の表示 (例: "期限: 2024/1/15") */
    deadline?: (dateStr: string) => string
    /** 期限超過の表示 (例: "期限超過 +2日") */
    overdue?: (days: number) => string
    /** 期限までの残日数の表示 (例: "残り3日") */
    deadlineRemaining?: (days: number) => string
    /** 期限内の表示 (例: "期限内") */
    deadlineOnTime?: string
    /** SNET制約の表示 (例: "制約: 2024/1/15 以降に開始 (SNET)") */
    constraintSnet?: (dateStr: string) => string
    /** FNLT制約の表示 (例: "制約: 2024/1/20 までに終了 (FNLT)") */
    constraintFnlt?: (dateStr: string) => string
  }
  /** ドラッグオーバーレイの文字列 */
  dragOverlay: {
    /** タイトル未設定時のフォールバック */
    noTitle: string
    /** 移動先の表示 (例: "移動先: Row1" / "Move to: Row1") */
    moveTo: (name: string) => string
    /** 複数タスク移動中の表示 (例: "3件のタスクを移動中" / "Moving 3 tasks") */
    movingTasks: (count: number) => string
    /** SNET制約ドラッグガイドバッジの表示 (例: "2024/1/15 以降に開始 (SNET)") */
    constraintSnet?: (dateStr: string) => string
    /** FNLT制約ドラッグガイドバッジの表示 (例: "2024/1/20 までに終了 (FNLT)") */
    constraintFnlt?: (dateStr: string) => string
  }
  /** マルチカラムデータグリッドの文字列 */
  grid?: {
    columns: {
      wbs: string
      name: string
      startDate: string
      endDate: string
      startMonth?: string
      endMonth?: string
      startDateTime?: string
      endDateTime?: string
      duration: string
      workingDays?: string
      progress: string
      deadline?: string
    }
    /** 固定フッター集計行のラベル (例: "集計" / "Summary") */
    footerLabel?: string
  }
  /** 組み込み依存関係編集ポップオーバーの文字列 */
  dependencyPopover?: {
    /** ポップオーバー見出し */
    title: string
    /** 種別ラベル */
    typeLabel: string
    /** ラグラベル (例: "ラグ (日)" / "Lag (d)") */
    lagLabel: (unit: string) => string
    /** ラグの単位表示 */
    units: {
      days: string
      hours: string
      minutes: string
      months: string
    }
    /** 各依存関係種別のツールチップ・説明 */
    types: {
      FS: string
      SS: string
      FF: string
      SF: string
    }
    /** 保存ボタンラベル */
    save: string
    /** 削除ボタンラベル */
    delete: string
    /** キャンセルボタンラベル */
    cancel: string
    /** 線上の編集アイコンボタンのアクセシビリティラベル */
    editButtonTitle: string
    /** 線上の削除アイコンボタンのアクセシビリティラベル */
    deleteButtonTitle: string
  }
  /** タイムライン新規タスク作成・WAI-ARIA 関連の文字列 */
  taskCreation?: {
    /** 新規タスクの既定名称 */
    defaultName: string
    /** 履歴コマンド説明 */
    commandDescription: string
  }
  /** アクセシビリティ (WAI-ARIA) 用の文字列 */
  aria?: {
    /** ガントチャートグリッド全体のラベル */
    chartLabel: string
    /** 行の展開/折りたたみボタンのラベル */
    toggleExpand: string
    toggleCollapse: string
    /** タスクバーのスクリーンリーダー向けラベル生成 */
    taskBarLabel: (name: string, startStr: string, endStr: string, progress?: number) => string
  }
}

/**
 * 日本語ロケール (デフォルト)
 */
export const jaLocale: MoguchartLocale = {
  monthFormat: 'YYYY年M月',
  monthRowFormat: 'M月',
  dateFormat: (d) => `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`,
  timeUnitDateFormat: (d) =>
    `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`,
  dateTimeFormat: (d) => {
    const date = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
    const h = d.getHours()
    const m = d.getMinutes()
    if (h === 0 && m === 0) return date
    return `${date} ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
  },
  yearMonthFormat: (d) => `${d.getFullYear()}/${d.getMonth() + 1}`,
  duration: {
    days: (n) => `${n}日`,
    hours: (n) => `${n}時間`,
    minutes: (n) => `${n}分`,
    zero: '0分',
  },
  tooltip: {
    duration: (days) => `所要日数: ${days}日`,
    workingDays: (days, workingDays) => `所要日数: ${days}日 (稼働${workingDays}日)`,
    progress: (percent) => `進捗: ${percent}%`,
    baseline: (startStr, endStr, days) => `計画: ${startStr} - ${endStr} (${days}日)`,
    delay: (days) => `+${days}日遅れ`,
    ahead: (days) => `-${days}日前倒し`,
    onSchedule: '計画通り',
    deadline: (dateStr) => `期限: ${dateStr}`,
    overdue: (days) => `期限超過 +${days}日`,
    deadlineRemaining: (days) => `残り${days}日`,
    deadlineOnTime: '期限内',
    constraintSnet: (dateStr) => `制約: ${dateStr} 以降に開始 (SNET)`,
    constraintFnlt: (dateStr) => `制約: ${dateStr} までに終了 (FNLT)`,
  },
  dragOverlay: {
    noTitle: 'タイトルなし',
    moveTo: (name) => `移動先: ${name}`,
    movingTasks: (count) => `${count}件のタスクを移動中`,
    constraintSnet: (dateStr) => `${dateStr} 以降に開始 (SNET)`,
    constraintFnlt: (dateStr) => `${dateStr} までに終了 (FNLT)`,
  },
  grid: {
    columns: {
      wbs: 'WBS',
      name: 'タスク名',
      startDate: '開始日',
      endDate: '終了日',
      startMonth: '開始月',
      endMonth: '終了月',
      startDateTime: '開始日時',
      endDateTime: '終了日時',
      duration: '期間',
      workingDays: '稼働日',
      progress: '進捗率',
      deadline: '期限',
    },
    footerLabel: '集計',
  },
  dependencyPopover: {
    title: '依存関係の編集',
    typeLabel: '種別',
    lagLabel: (unit) => `ラグ (${unit})`,
    units: {
      days: '日',
      hours: '時間',
      minutes: '分',
      months: 'ヶ月',
    },
    types: {
      FS: '終了→開始 (Finish-to-Start)',
      SS: '開始→開始 (Start-to-Start)',
      FF: '終了→終了 (Finish-to-Finish)',
      SF: '開始→終了 (Start-to-Finish)',
    },
    save: '保存',
    delete: '削除',
    cancel: 'キャンセル',
    editButtonTitle: '依存関係を編集',
    deleteButtonTitle: '依存関係を削除',
  },
  taskCreation: {
    defaultName: '新規タスク',
    commandDescription: 'タスク新規作成',
  },
  aria: {
    chartLabel: 'ガントチャート',
    toggleExpand: '行を展開',
    toggleCollapse: '行を折りたたむ',
    taskBarLabel: (name, startStr, endStr, progress) =>
      progress !== undefined
        ? `${name} (${startStr} 〜 ${endStr}, 進捗 ${progress}%)`
        : `${name} (${startStr} 〜 ${endStr})`,
  },
}

/**
 * 英語ロケール
 */
export const enLocale: MoguchartLocale = {
  monthFormat: 'MMM YYYY',
  monthRowFormat: 'MMM',
  dateFormat: (d) => `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`,
  timeUnitDateFormat: (d) => {
    const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${shortMonths[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
  },
  dateTimeFormat: (d) => {
    const date = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`
    const h = d.getHours()
    const m = d.getMinutes()
    if (h === 0 && m === 0) return date
    return `${date} ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
  },
  yearMonthFormat: (d) => `${d.getFullYear()}/${d.getMonth() + 1}`,
  duration: {
    days: (n) => `${n} day${n !== 1 ? 's' : ''}`,
    hours: (n) => `${n} hour${n !== 1 ? 's' : ''}`,
    minutes: (n) => `${n} minute${n !== 1 ? 's' : ''}`,
    zero: '0 minutes',
  },
  tooltip: {
    duration: (days) => `Duration: ${days} day${days !== 1 ? 's' : ''}`,
    workingDays: (days, workingDays) =>
      `Duration: ${days} day${days !== 1 ? 's' : ''} (${workingDays} working day${workingDays !== 1 ? 's' : ''})`,
    progress: (percent) => `Progress: ${percent}%`,
    baseline: (startStr, endStr, days) => `Baseline: ${startStr} - ${endStr} (${days}d)`,
    delay: (days) => `+${days}d delay`,
    ahead: (days) => `-${days}d ahead`,
    onSchedule: 'On schedule',
    deadline: (dateStr) => `Deadline: ${dateStr}`,
    overdue: (days) => `Overdue +${days}d`,
    deadlineRemaining: (days) => `${days}d left`,
    deadlineOnTime: 'On time',
    constraintSnet: (dateStr) => `Constraint: Start ≥ ${dateStr} (SNET)`,
    constraintFnlt: (dateStr) => `Constraint: Finish ≤ ${dateStr} (FNLT)`,
  },
  dragOverlay: {
    noTitle: 'No Title',
    moveTo: (name) => `Move to: ${name}`,
    movingTasks: (count) => `Moving ${count} task${count !== 1 ? 's' : ''}`,
    constraintSnet: (dateStr) => `Start no earlier than ${dateStr} (SNET)`,
    constraintFnlt: (dateStr) => `Finish no later than ${dateStr} (FNLT)`,
  },
  grid: {
    columns: {
      wbs: 'WBS',
      name: 'Task Name',
      startDate: 'Start Date',
      endDate: 'End Date',
      startMonth: 'Start Month',
      endMonth: 'End Month',
      startDateTime: 'Start Date/Time',
      endDateTime: 'End Date/Time',
      duration: 'Duration',
      workingDays: 'Working Days',
      progress: 'Progress',
      deadline: 'Deadline',
    },
    footerLabel: 'Summary',
  },
  dependencyPopover: {
    title: 'Edit Dependency',
    typeLabel: 'Type',
    lagLabel: (unit) => `Lag (${unit})`,
    units: {
      days: 'd',
      hours: 'h',
      minutes: 'min',
      months: 'mo',
    },
    types: {
      FS: 'Finish-to-Start (FS)',
      SS: 'Start-to-Start (SS)',
      FF: 'Finish-to-Finish (FF)',
      SF: 'Start-to-Finish (SF)',
    },
    save: 'Save',
    delete: 'Delete',
    cancel: 'Cancel',
    editButtonTitle: 'Edit dependency',
    deleteButtonTitle: 'Delete dependency',
  },
  taskCreation: {
    defaultName: 'New Task',
    commandDescription: 'Create task',
  },
  aria: {
    chartLabel: 'Gantt Chart',
    toggleExpand: 'Expand row',
    toggleCollapse: 'Collapse row',
    taskBarLabel: (name, startStr, endStr, progress) =>
      progress !== undefined
        ? `${name} (${startStr} - ${endStr}, Progress ${progress}%)`
        : `${name} (${startStr} - ${endStr})`,
  },
}

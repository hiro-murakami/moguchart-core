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
  }
  /** ドラッグオーバーレイの文字列 */
  dragOverlay: {
    /** タイトル未設定時のフォールバック */
    noTitle: string
    /** 移動先の表示 (例: "移動先: Row1" / "Move to: Row1") */
    moveTo: (name: string) => string
    /** 複数タスク移動中の表示 (例: "3件のタスクを移動中" / "Moving 3 tasks") */
    movingTasks: (count: number) => string
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
  },
  dragOverlay: {
    noTitle: 'タイトルなし',
    moveTo: (name) => `移動先: ${name}`,
    movingTasks: (count) => `${count}件のタスクを移動中`,
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
  },
  dragOverlay: {
    noTitle: 'No Title',
    moveTo: (name) => `Move to: ${name}`,
    movingTasks: (count) => `Moving ${count} task${count !== 1 ? 's' : ''}`,
  },
}

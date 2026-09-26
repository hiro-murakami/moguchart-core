import type { GanttChartElement } from '@mogura/moguchart-core'

/**
 * Excelエクスポートのロケール定義インターフェース
 */
export interface ExcelLocaleDefinition {
  /** ロケール識別名 (例: 'ja', 'en', 'zh', 'ko', 'de' 等) */
  name?: string

  /** シート名定義 */
  sheets?: {
    /** デフォルトのガントチャートシート名 (例: '工程表', 'Gantt Chart') */
    gantt?: string
  }

  /** 標準カラムヘッダーおよび数値・日付フォーマット */
  columns?: {
    taskNo?: string
    wbs?: string
    rowName?: string
    taskName?: string
    start?: {
      day?: string
      month?: string
      hour?: string
    }
    end?: {
      day?: string
      month?: string
      hour?: string
    }
    duration?: {
      header?: string
      dayNumFmt?: string
      hourNumFmt?: string
    }
    progress?: string
    dependencies?: string
    dateFormat?: {
      day?: string
      month?: string
      hour?: string
    }
  }

  /** タイムライン（カレンダー）ヘッダーの表示設定 */
  timeline?: {
    /** 曜日表記配列 (0:日曜, 1:月曜, ..., 6:土曜) */
    dayNames?: string[]
    /** 月名表記配列 (0:1月, ..., 11:12月) */
    monthNames?: string[]
    /** 年グループヘッダー (scale === 'month') */
    yearFormat?: (year: number) => string
    /** 年月グループヘッダー (scale === 'day' | 'week') */
    yearMonthFormat?: (year: number, month: number, monthName: string) => string
    /** 年月日（＋曜日）グループヘッダー (scale === 'hour' や multi-column day) */
    yearMonthDayFormat?: (
      year: number,
      month: number,
      day: number,
      dayName: string,
      monthName: string
    ) => string
    /** 週サブラベル (scale === 'week') */
    weekSubLabel?: (month: number, day: number, weekNumber: number, monthName: string) => string
  }
}

/**
 * 日本語ロケール (デフォルト)
 */
export const jaLocale: ExcelLocaleDefinition = {
  name: 'ja',
  sheets: {
    gantt: '工程表',
  },
  columns: {
    taskNo: 'No.',
    wbs: 'WBS',
    rowName: 'カテゴリ/行',
    taskName: 'タスク名',
    start: {
      day: '開始日',
      month: '開始月',
      hour: '開始日時',
    },
    end: {
      day: '終了日',
      month: '終了月',
      hour: '終了日時',
    },
    duration: {
      header: '期間',
      dayNumFmt: '#,##0"日"',
      hourNumFmt: '#,##0.#"時間"',
    },
    progress: '進捗',
    dependencies: '先行タスク',
    dateFormat: {
      day: 'yyyy/mm/dd',
      month: 'yyyy/mm',
      hour: 'yyyy/mm/dd hh:mm',
    },
  },
  timeline: {
    dayNames: ['日', '月', '火', '水', '木', '金', '土'],
    monthNames: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    yearFormat: (year) => `${year}年`,
    yearMonthFormat: (year, month) => `${year}年${month}月`,
    yearMonthDayFormat: (year, month, day, dayName) =>
      dayName ? `${year}年${month}月${day}日 (${dayName})` : `${year}年${month}月${day}日`,
    weekSubLabel: (month, day) => `${month}/${day}〜`,
  },
}

/**
 * 英語ロケール
 */
export const enLocale: ExcelLocaleDefinition = {
  name: 'en',
  sheets: {
    gantt: 'Gantt Chart',
  },
  columns: {
    taskNo: 'No.',
    wbs: 'WBS',
    rowName: 'Category / Row',
    taskName: 'Task Name',
    start: {
      day: 'Start Date',
      month: 'Start Month',
      hour: 'Start Date & Time',
    },
    end: {
      day: 'End Date',
      month: 'End Month',
      hour: 'End Date & Time',
    },
    duration: {
      header: 'Duration',
      dayNumFmt: '#,##0" days"',
      hourNumFmt: '#,##0.#" hrs"',
    },
    progress: 'Progress',
    dependencies: 'Dependencies',
    dateFormat: {
      day: 'm/d/yyyy',
      month: 'yyyy/mm',
      hour: 'm/d/yyyy hh:mm',
    },
  },
  timeline: {
    dayNames: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    monthNames: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    yearFormat: (year) => `${year}`,
    yearMonthFormat: (year, _month, monthName) => `${monthName} ${year}`,
    yearMonthDayFormat: (year, _month, day, dayName, monthName) =>
      dayName ? `${monthName} ${day}, ${year} (${dayName})` : `${monthName} ${day}, ${year}`,
    weekSubLabel: (month, day) => `${month}/${day}~`,
  },
}

/**
 * 中国語（簡体字）ロケール
 */
export const zhLocale: ExcelLocaleDefinition = {
  name: 'zh',
  sheets: {
    gantt: '甘特图',
  },
  columns: {
    taskNo: '序号',
    wbs: 'WBS',
    rowName: '类别/行',
    taskName: '任务名称',
    start: {
      day: '开始日期',
      month: '开始月份',
      hour: '开始时间',
    },
    end: {
      day: '结束日期',
      month: '结束月份',
      hour: '结束时间',
    },
    duration: {
      header: '工期',
      dayNumFmt: '#,##0"天"',
      hourNumFmt: '#,##0.#"小时"',
    },
    progress: '进度',
    dependencies: '前置任务',
    dateFormat: {
      day: 'yyyy/mm/dd',
      month: 'yyyy/mm',
      hour: 'yyyy/mm/dd hh:mm',
    },
  },
  timeline: {
    dayNames: ['日', '一', '二', '三', '四', '五', '六'],
    monthNames: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    yearFormat: (year) => `${year}年`,
    yearMonthFormat: (year, month) => `${year}年${month}月`,
    yearMonthDayFormat: (year, month, day, dayName) =>
      dayName ? `${year}年${month}月${day}日 (周${dayName})` : `${year}年${month}月${day}日`,
    weekSubLabel: (month, day) => `${month}/${day}~`,
  },
}

/**
 * 登録済みロケール辞書
 */
const localeRegistry: Record<string, ExcelLocaleDefinition> = {
  ja: jaLocale,
  en: enLocale,
  zh: zhLocale,
}

/**
 * 独自のExcelロケールを登録する
 *
 * @param name ロケール識別名 (例: 'zh', 'ko', 'fr', 'de' 等)
 * @param definition ロケール定義
 */
export function registerExcelLocale(name: string, definition: ExcelLocaleDefinition): void {
  localeRegistry[name.toLowerCase()] = {
    ...definition,
    name: definition.name || name,
  }
}

/**
 * 登録されているExcelロケール定義を取得する
 *
 * @param name ロケール識別名
 */
export function getExcelLocale(name: string): ExcelLocaleDefinition | undefined {
  return localeRegistry[name.toLowerCase()]
}

/**
 * 登録されているすべてのロケール識別名を取得する
 */
export function getSupportedExcelLocales(): string[] {
  return Object.keys(localeRegistry)
}

/**
 * 2つのロケール定義をディープマージする
 */
export function mergeLocaleDefinitions(
  base: ExcelLocaleDefinition,
  custom: ExcelLocaleDefinition
): ExcelLocaleDefinition {
  return {
    name: custom.name || base.name,
    sheets: {
      ...base.sheets,
      ...custom.sheets,
    },
    columns: {
      ...base.columns,
      ...custom.columns,
      start: {
        ...base.columns?.start,
        ...custom.columns?.start,
      },
      end: {
        ...base.columns?.end,
        ...custom.columns?.end,
      },
      duration: {
        ...base.columns?.duration,
        ...custom.columns?.duration,
      },
      dateFormat: {
        ...base.columns?.dateFormat,
        ...custom.columns?.dateFormat,
      },
    },
    timeline: {
      ...base.timeline,
      ...custom.timeline,
      dayNames: custom.timeline?.dayNames || base.timeline?.dayNames,
      monthNames: custom.timeline?.monthNames || base.timeline?.monthNames,
    },
  }
}

/**
 * 指定されたパラメータから最終的なExcelLocaleDefinitionを解決する
 */
export function resolveExcelLocale(
  locale?: string | ExcelLocaleDefinition,
  chart?: GanttChartElement
): ExcelLocaleDefinition {
  // 1. オブジェクトとして直接渡された場合
  if (typeof locale === 'object' && locale !== null) {
    const base = locale.name && getExcelLocale(locale.name) ? getExcelLocale(locale.name)! : jaLocale
    return mergeLocaleDefinitions(base, locale)
  }

  // 2. 文字列で指定された場合
  if (typeof locale === 'string' && locale.trim()) {
    const key = locale.trim().toLowerCase()
    const found = getExcelLocale(key)
    if (found) {
      return found
    }
  }

  // 3. chart.option.locale から自動判定
  const chartLocale = chart?.option?.locale
  if (chartLocale) {
    if (
      chartLocale.monthFormat === 'MMM YYYY' ||
      (typeof chartLocale.duration?.days === 'function' && chartLocale.duration.days(1).includes('day'))
    ) {
      return enLocale
    }
  }

  // 4. デフォルトは日本語
  return jaLocale
}

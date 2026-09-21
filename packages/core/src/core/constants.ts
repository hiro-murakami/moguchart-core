export const DEFAULT_ROW_HEADER_WIDTH = 150
export const DEFAULT_MONTH_FORMAT = 'YYYY年M月'

export const DEFAULT_BAR_HEIGHT = 28
export const DEFAULT_BAR_MARGIN = 4
export const DEFAULT_BAR_CORNER_RADIUS = 4

export const DEFAULT_COLOR = {
  BAR: '#3b82f6',
  LABEL_BACKGROUND: '#fafafa',
  SATURDAY: '#dbeafe',
  SUNDAY: '#fee2e2',
  HOLIDAY: '#fee2e2',
  BORDER: '#e2e8f0',
}

export const DEFAULT_BAR_COLOR = DEFAULT_COLOR.BAR

/** Chrome風のプリセットズームレベル（パーセンテージ） */
export const CHROME_ZOOM_LEVELS = [50, 67, 75, 80, 90, 100, 110, 125, 150, 175, 200] as const

/** ズームのデフォルト値 */
export const DEFAULT_ZOOM_CONFIG = {
  MIN_PERCENT: 50,
  MAX_PERCENT: 200,
  DEFAULT_PERCENT: 100,
  STEP: 1.1,
} as const

import type { GanttTaskPattern, BarPattern } from './types'

// ============================================================
// パターン定数
// ============================================================

export const ALL_BAR_PATTERNS: BarPattern[] = [
  'diagonal-stripe',
  'diagonal-stripe-thin',
  'diagonal-stripe-thick',
  'diagonal-stripe-reverse',
  'vertical-stripe',
  'horizontal-stripe',
  'checkerboard',
  'dots',
  // 'dots-dense',
  'triangle',
  'circle',
  'grid',
  'diagonal-grid',
]

export const PATTERN_DIAGONAL_STRIPE: GanttTaskPattern = {
  type: 'diagonal-stripe',
}

export const PATTERN_DIAGONAL_STRIPE_REVERSE: GanttTaskPattern = {
  type: 'diagonal-stripe-reverse',
}

export const PATTERN_VERTICAL_STRIPE: GanttTaskPattern = {
  type: 'vertical-stripe',
}

export const PATTERN_HORIZONTAL_STRIPE: GanttTaskPattern = {
  type: 'horizontal-stripe',
}

export const PATTERN_CHECKERBOARD: GanttTaskPattern = {
  type: 'checkerboard',
}

export const PATTERN_DOTS: GanttTaskPattern = {
  type: 'dots',
}

export const PATTERN_TRIANGLE: GanttTaskPattern = {
  type: 'triangle',
}

export const PATTERN_CIRCLE: GanttTaskPattern = {
  type: 'circle',
}

export const PATTERN_GRID: GanttTaskPattern = {
  type: 'grid',
}

export const PATTERN_DIAGONAL_GRID: GanttTaskPattern = {
  type: 'diagonal-grid',
}

export const PATTERN_STRIPE_THIN: GanttTaskPattern = {
  type: 'diagonal-stripe-thin',
}

export const PATTERN_STRIPE_THICK: GanttTaskPattern = {
  type: 'diagonal-stripe-thick',
}

export const PATTERN_DOTS_DENSE: GanttTaskPattern = {
  type: 'dots-dense',
}

// ============================================================
// パターンユーティリティ
// ============================================================

/**
 * GanttTaskPattern からCSSのbackground-imageスタイル文字列を生成します。
 * @param pattern パターン設定
 * @returns CSS文字列
 */
export function getPatternStyle(pattern?: GanttTaskPattern): string {
  if (!pattern?.type) return ''
  const color = pattern.color || 'rgba(255, 255, 255, 0.3)'
  const defaultSize = pattern.type === 'dots' ? '6px' : '8px'
  // sizeプロパティは廃止されたため、パターンタイプごとに固定サイズを定義
  let size = defaultSize

  switch (pattern.type) {
    case 'diagonal-stripe':
      return `
          background-image: linear-gradient(45deg, ${color} 25%, transparent 25%, transparent 50%, ${color} 50%, ${color} 75%, transparent 75%, transparent);
          background-size: ${size} ${size};
          background-repeat: repeat;
        `
    case 'diagonal-stripe-thin':
      size = '4px'
      return `
          background-image: linear-gradient(45deg, ${color} 25%, transparent 25%, transparent 50%, ${color} 50%, ${color} 75%, transparent 75%, transparent);
          background-size: ${size} ${size};
          background-repeat: repeat;
        `
    case 'diagonal-stripe-thick':
      size = '16px'
      return `
          background-image: linear-gradient(45deg, ${color} 25%, transparent 25%, transparent 50%, ${color} 50%, ${color} 75%, transparent 75%, transparent);
          background-size: ${size} ${size};
          background-repeat: repeat;
        `
    case 'diagonal-stripe-reverse':
      return `
          background-image: linear-gradient(135deg, ${color} 25%, transparent 25%, transparent 50%, ${color} 50%, ${color} 75%, transparent 75%, transparent);
          background-size: ${size} ${size};
          background-repeat: repeat;
        `
    case 'diagonal-grid':
      return `
          background-image: linear-gradient(45deg, ${color} 25%, transparent 25%, transparent 50%, ${color} 50%, ${color} 75%, transparent 75%, transparent), linear-gradient(135deg, ${color} 25%, transparent 25%, transparent 50%, ${color} 50%, ${color} 75%, transparent 75%, transparent);
          background-size: ${size} ${size};
          background-repeat: repeat;
        `
    case 'vertical-stripe':
      return `
          background-image: linear-gradient(90deg, ${color} 50%, transparent 50%);
          background-size: ${size} ${size};
          background-repeat: repeat;
        `
    case 'horizontal-stripe':
      return `
          background-image: linear-gradient(0deg, ${color} 50%, transparent 50%);
          background-size: ${size} ${size};
          background-repeat: repeat;
        `
    case 'checkerboard':
      return `
          background-image: linear-gradient(45deg, ${color} 25%, transparent 25%, transparent 75%, ${color} 75%, ${color}), linear-gradient(45deg, ${color} 25%, transparent 25%, transparent 75%, ${color} 75%, ${color});
          background-position: 0 0, calc(${size} / 2) calc(${size} / 2);
          background-size: ${size} ${size};
          background-repeat: repeat;
        `
    case 'dots':
      return `
          background-image: radial-gradient(${color} 20%, transparent 20%);
          background-size: ${size} ${size};
          background-repeat: repeat;
        `
    case 'dots-dense':
      size = '4px'
      return `
          background-image: radial-gradient(${color} 20%, transparent 20%);
          background-size: ${size} ${size};
          background-repeat: repeat;
        `
    case 'triangle':
      return `
          background-image: conic-gradient(from 150deg at 50% 35%, ${color} 60deg, transparent 60deg);
          background-size: ${size} ${size};
          background-repeat: repeat;
        `
    case 'circle':
      return `
          background-image: radial-gradient(circle, transparent 50%, ${color} 50%, ${color} 70%, transparent 70%);
          background-size: ${size} ${size};
          background-repeat: repeat;
        `
    case 'grid':
      return `
          background-image: linear-gradient(${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px);
          background-size: ${size} ${size};
          background-repeat: repeat;
        `
    default:
      return ''
  }
}

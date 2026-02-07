import type { GanttTaskPattern } from '@/types'

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
        `
    case 'diagonal-stripe-thin':
      size = '4px'
      return `
          background-image: linear-gradient(45deg, ${color} 25%, transparent 25%, transparent 50%, ${color} 50%, ${color} 75%, transparent 75%, transparent);
          background-size: ${size} ${size};
        `
    case 'diagonal-stripe-thick':
      size = '16px'
      return `
          background-image: linear-gradient(45deg, ${color} 25%, transparent 25%, transparent 50%, ${color} 50%, ${color} 75%, transparent 75%, transparent);
          background-size: ${size} ${size};
        `
    case 'diagonal-stripe-reverse':
      return `
          background-image: linear-gradient(135deg, ${color} 25%, transparent 25%, transparent 50%, ${color} 50%, ${color} 75%, transparent 75%, transparent);
          background-size: ${size} ${size};
        `
    case 'diagonal-grid':
      return `
          background-image: linear-gradient(45deg, ${color} 25%, transparent 25%, transparent 50%, ${color} 50%, ${color} 75%, transparent 75%, transparent), linear-gradient(135deg, ${color} 25%, transparent 25%, transparent 50%, ${color} 50%, ${color} 75%, transparent 75%, transparent);
          background-size: ${size} ${size};
        `
    case 'vertical-stripe':
      return `
          background-image: linear-gradient(90deg, ${color} 50%, transparent 50%);
          background-size: ${size} ${size};
        `
    case 'horizontal-stripe':
      return `
          background-image: linear-gradient(0deg, ${color} 50%, transparent 50%);
          background-size: ${size} ${size};
        `
    case 'checkerboard':
      return `
          background-image: linear-gradient(45deg, ${color} 25%, transparent 25%, transparent 75%, ${color} 75%, ${color}), linear-gradient(45deg, ${color} 25%, transparent 25%, transparent 75%, ${color} 75%, ${color});
          background-position: 0 0, calc(${size} / 2) calc(${size} / 2);
          background-size: ${size} ${size};
        `
    case 'dots':
      return `
          background-image: radial-gradient(${color} 20%, transparent 20%);
          background-size: ${size} ${size};
        `
    case 'dots-dense':
      size = '4px'
      return `
          background-image: radial-gradient(${color} 20%, transparent 20%);
          background-size: ${size} ${size};
        `
    case 'triangle':
      return `
          background-image: conic-gradient(from 150deg at 50% 35%, ${color} 60deg, transparent 60deg);
          background-size: ${size} ${size};
        `
    case 'circle':
      return `
          background-image: radial-gradient(circle, transparent 50%, ${color} 50%, ${color} 70%, transparent 70%);
          background-size: ${size} ${size};
        `
    case 'grid':
      return `
          background-image: linear-gradient(${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px);
          background-size: ${size} ${size};
        `
    default:
      return ''
  }
}

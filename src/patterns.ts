import type { GanttTaskPattern, BarPattern } from '@/types'

export const ALL_BAR_PATTERNS: BarPattern[] = [
  'diagonal-stripe',
  'diagonal-stripe-thin',
  'diagonal-stripe-thick',
  'diagonal-stripe-reverse',
  'vertical-stripe',
  'horizontal-stripe',
  'checkerboard',
  'dots',
  'dots-dense',
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

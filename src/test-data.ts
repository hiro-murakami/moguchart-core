import type { GanttRow } from '@/types'
import {
  PATTERN_CHECKERBOARD,
  PATTERN_GRID,
  PATTERN_DIAGONAL_STRIPE,
  PATTERN_DOTS,
  PATTERN_VERTICAL_STRIPE,
} from '@/patterns'

const today = new Date()
today.setHours(0, 0, 0, 0)

const getDate = (baseDate: Date, offset: number) => {
  const d = new Date(baseDate)
  d.setDate(d.getDate() + offset)
  return d
}

const generateProject = (
  idPrefix: string,
  namePrefix: string,
  startOffset: number,
): GanttRow[] => {
  const projectStart = getDate(today, startOffset)
  const d = (day: number) => getDate(projectStart, day)

  return [
    {
      id: `${idPrefix}-row-1`,
      label: `${namePrefix} Planning`,
      tasks: [
        {
          id: `${idPrefix}-t-1`,
          name: 'Requirement',
          start: d(0),
          end: d(10), // 10日間
          style: 'background-color: #60a5fa; border: 1px solid silver', // blue
          pattern: PATTERN_DIAGONAL_STRIPE,
        },
        {
          id: `${idPrefix}-t-2`,
          name: 'Design',
          start: d(12),
          end: d(24), // 12日間
          dependencies: [`${idPrefix}-t-1`],
          style: 'background-color: #34d399', // green
          pattern: PATTERN_DOTS,
        },
      ],
    },
    {
      id: `${idPrefix}-row-2`,
      label: `${namePrefix} Dev`,
      tasks: [
        {
          id: `${idPrefix}-t-3`,
          name: 'Backend API',
          start: d(26),
          end: d(46), // 20日間
          dependencies: [`${idPrefix}-t-2`],
          style: 'background-color: #818cf8', // indigo
          pattern: { ...PATTERN_VERTICAL_STRIPE, size: '4px' },
        },
        {
          id: `${idPrefix}-t-4`,
          name: 'Frontend UI',
          start: d(28),
          end: d(48), // 20日間
          dependencies: [`${idPrefix}-t-2`],
          style: 'background-color: #f472b6', // pink
          pattern: {
            ...PATTERN_CHECKERBOARD,
            color: 'rgba(255, 255, 255, 0.5)',
            size: '12px',
          },
        },
      ],
    },
    {
      id: `${idPrefix}-row-3`,
      label: `${namePrefix} QA & Release`,
      tasks: [
        {
          id: `${idPrefix}-t-5`,
          name: 'Integration Test',
          start: d(50),
          end: d(60), // 10日間
          dependencies: [`${idPrefix}-t-3`, `${idPrefix}-t-4`],
          style: 'background-color: #fbbf24', // amber
          pattern: PATTERN_GRID,
        },
        {
          id: `${idPrefix}-t-6`,
          name: 'Deploy',
          start: d(62),
          end: d(65), // 3日間
          dependencies: [`${idPrefix}-t-5`],
          style: 'background-color: #f87171', // red
        },
      ],
    },
  ]
}

export const testRows: GanttRow[] = [
  ...generateProject('p1', 'Alpha', 0),
  ...generateProject('p2', 'Beta', 15),
  ...generateProject('p3', 'Gamma', 30),
  ...generateProject('p4', 'Delta', 45),
  ...generateProject('p5', 'Epsilon', 60),
  ...generateProject('p6', 'Zeta', 75),
  ...generateProject('p7', 'Eta', 90),
  ...generateProject('p8', 'Theta', 105),
  ...generateProject('p9', 'Iota', 120),
  ...generateProject('p10', 'Kappa', 135),
]

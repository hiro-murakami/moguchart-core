import type { GanttRow } from '@/types'

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
          color: '#60a5fa', // blue
        },
        {
          id: `${idPrefix}-t-2`,
          name: 'Design',
          start: d(12),
          end: d(24), // 12日間
          dependencies: [`${idPrefix}-t-1`],
          color: '#34d399', // green
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
          color: '#818cf8', // indigo
        },
        {
          id: `${idPrefix}-t-4`,
          name: 'Frontend UI',
          start: d(28),
          end: d(48), // 20日間
          dependencies: [`${idPrefix}-t-2`],
          color: '#f472b6', // pink
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
          color: '#fbbf24', // amber
        },
        {
          id: `${idPrefix}-t-6`,
          name: 'Deploy',
          start: d(62),
          end: d(65), // 3日間
          dependencies: [`${idPrefix}-t-5`],
          color: '#f87171', // red
        },
      ],
    },
  ]
}

export const testRows: GanttRow[] = [
  ...generateProject('p1', 'Alpha', 0),
  ...generateProject('p2', 'Beta', 15),
  ...generateProject('p3', 'Gamma', 30),
]

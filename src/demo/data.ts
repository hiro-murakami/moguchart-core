import type { GanttRow, GanttTask, GanttTaskPattern } from '@/core/types'
import type { DemoTexts } from './i18n'

const chartStart = new Date()
chartStart.setHours(0, 0, 0, 0)

/**
 * 日付ヘルパー: 開始日からの日オフセットで日付を生成
 */
const d = (base: Date, offset: number): Date =>
  new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset)

/**
 * 日単位モードのデモデータを生成します。
 *
 * 先頭10行は「ショーケースエリア」として、バーの色・パターン・依存関係の
 * 多彩なバリエーションを確認できるように構成しています。
 */
export const generateDayModeData = (t: DemoTexts): GanttRow[] => {
  const start = new Date(chartStart)
  const rows: GanttRow[] = []

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ショーケースエリア (row 1-10): 色・パターン・依存関係のバリエーション
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // 色パレット定義
  const colors = {
    blue: '#3b82f6',
    purple: '#8b5cf6',
    green: '#10b981',
    orange: '#f59e0b',
    pink: '#ec4899',
    red: '#ef4444',
    cyan: '#06b6d4',
    indigo: '#6366f1',
    amber: '#d97706',
    lime: '#84cc16',
  }

  // ── Row 1: 基本の色バリエーション + 行間チェーン依存の起点 ──
  rows.push({
    id: 'row1',
    name: t.project(1),
    tasks: [
      {
        id: 't1-1',
        name: t.planning,
        start: d(start, 0),
        end: d(start, 4),
        style: `background-color: ${colors.blue};`,
        labelStyle: 'font-weight: bold;',
      },
      {
        id: 't1-2',
        name: t.design,
        start: d(start, 5),
        end: d(start, 12),
        style: `background-color: ${colors.purple};`,
        dependencies: ['t1-1'],
      },
      {
        id: 't1-3',
        name: t.development,
        start: d(start, 13),
        end: d(start, 25),
        style: `background-color: ${colors.green};`,
        dependencies: ['t1-2'],
      },
    ],
    markers: [
      {
        id: 'marker-1-1',
        date: d(start, 4),
        anchor: 'end',
        type: 'triangle-right',
        color: colors.red,
        name: t.reviewDeadline,
      },
      {
        id: 'marker-1-2',
        date: d(start, 25),
        anchor: 'start',
        type: 'triangle-left',
        color: colors.purple,
        name: t.releaseScheduled,
      },
      {
        id: 'marker-1-3',
        date: d(start, 12),
        anchor: 'center',
        type: 'triangle-down',
        color: colors.orange,
        name: '★',
      },
    ],
  })

  // ── Row 2: 暖色系 + Row1からの行間依存関係 ──
  rows.push({
    id: 'row2',
    name: t.project(2),
    tasks: [
      {
        id: 't2-1',
        name: t.uiDesign,
        start: d(start, 2),
        end: d(start, 8),
        style: `background-color: ${colors.orange};`,
      },
      {
        id: 't2-2',
        name: t.frontendDev,
        start: d(start, 9),
        end: d(start, 20),
        style: `background-color: ${colors.pink};`,
        dependencies: ['t2-1', 't1-2'], // Row1の設計が完了後に着手（行間依存）
      },
      {
        id: 't2-3',
        name: t.testing,
        start: d(start, 21),
        end: d(start, 28),
        style: `background-color: ${colors.red};`,
        dependencies: ['t2-2'],
      },
    ],
    markers: [
      {
        id: 'marker-2-1',
        date: d(start, 8),
        anchor: 'end',
        type: 'diamond',
        color: colors.orange,
        name: t.reviewDeadline,
      },
    ],
  })

  // ── Row 3: 寒色系 + Row1,2からの合流依存 ──
  rows.push({
    id: 'row3',
    name: t.project(3),
    tasks: [
      {
        id: 't3-1',
        name: t.backendDev,
        start: d(start, 5),
        end: d(start, 18),
        style: `background-color: ${colors.cyan};`,
        dependencies: ['t1-1'], // Row1企画完了後に着手
      },
      {
        id: 't3-2',
        name: t.integration,
        start: d(start, 21),
        end: d(start, 30),
        style: `background-color: ${colors.indigo};`,
        dependencies: ['t3-1', 't2-2'], // バックエンド + フロントエンド両方完了後（合流依存）
      },
    ],
    markers: [
      {
        id: 'marker-3-1',
        date: d(start, 30),
        anchor: 'center',
        type: 'square',
        color: colors.green,
        name: t.releaseScheduled,
      },
    ],
  })

  // ── Row 4: diagonal-stripe パターン ──
  rows.push({
    id: 'row4',
    name: t.project(4),
    tasks: [
      {
        id: 't4-1',
        name: t.research,
        start: d(start, 0),
        end: d(start, 6),
        style: `background-color: ${colors.blue};`,
        pattern: { type: 'diagonal-stripe', color: 'rgba(255,255,255,0.4)' },
      },
      {
        id: 't4-2',
        name: t.prototyping,
        start: d(start, 7),
        end: d(start, 14),
        style: `background-color: ${colors.purple};`,
        pattern: { type: 'diagonal-stripe-reverse', color: 'rgba(255,255,255,0.4)' },
        dependencies: ['t4-1'],
      },
      {
        id: 't4-3',
        name: t.review,
        start: d(start, 15),
        end: d(start, 20),
        style: `background-color: ${colors.green};`,
        pattern: { type: 'diagonal-stripe-thin', color: 'rgba(255,255,255,0.5)' },
        dependencies: ['t4-2'],
      },
    ],
  })

  // ── Row 5: dots / checkerboard / grid パターン ──
  rows.push({
    id: 'row5',
    name: t.project(5),
    tasks: [
      {
        id: 't5-1',
        name: t.planning,
        start: d(start, 1),
        end: d(start, 7),
        style: `background-color: ${colors.orange};`,
        pattern: { type: 'dots', color: 'rgba(255,255,255,0.5)' },
      },
      {
        id: 't5-2',
        name: t.development,
        start: d(start, 8),
        end: d(start, 16),
        style: `background-color: ${colors.pink};`,
        pattern: { type: 'checkerboard', color: 'rgba(255,255,255,0.3)' },
        dependencies: ['t5-1'],
      },
      {
        id: 't5-3',
        name: t.deployment,
        start: d(start, 17),
        end: d(start, 22),
        style: `background-color: ${colors.cyan};`,
        pattern: { type: 'grid', color: 'rgba(255,255,255,0.3)' },
        dependencies: ['t5-2'],
      },
    ],
  })

  // ── Row 6: vertical / horizontal / diagonal-grid パターン ──
  rows.push({
    id: 'row6',
    name: t.project(6),
    tasks: [
      {
        id: 't6-1',
        name: t.documentation,
        start: d(start, 3),
        end: d(start, 10),
        style: `background-color: ${colors.indigo};`,
        pattern: { type: 'vertical-stripe', color: 'rgba(255,255,255,0.35)' },
      },
      {
        id: 't6-2',
        name: t.codeReview,
        start: d(start, 11),
        end: d(start, 17),
        style: `background-color: ${colors.amber};`,
        pattern: { type: 'horizontal-stripe', color: 'rgba(255,255,255,0.35)' },
        dependencies: ['t6-1'],
      },
      {
        id: 't6-3',
        name: t.bugfix,
        start: d(start, 18),
        end: d(start, 25),
        style: `background-color: ${colors.red};`,
        pattern: { type: 'diagonal-grid', color: 'rgba(255,255,255,0.3)' },
        dependencies: ['t6-2'],
      },
    ],
  })

  // ── Row 7: triangle / circle / dots-dense パターン ──
  rows.push({
    id: 'row7',
    name: t.project(7),
    tasks: [
      {
        id: 't7-1',
        name: t.qaTest,
        start: d(start, 0),
        end: d(start, 8),
        style: `background-color: ${colors.green};`,
        pattern: { type: 'triangle', color: 'rgba(255,255,255,0.35)' },
      },
      {
        id: 't7-2',
        name: t.staging,
        start: d(start, 9),
        end: d(start, 15),
        style: `background-color: ${colors.lime};`,
        pattern: { type: 'circle', color: 'rgba(255,255,255,0.3)' },
        dependencies: ['t7-1'],
      },
      {
        id: 't7-3',
        name: t.monitoring,
        start: d(start, 16),
        end: d(start, 22),
        style: `background-color: ${colors.purple};`,
        pattern: { type: 'dots-dense', color: 'rgba(255,255,255,0.4)' },
        dependencies: ['t7-2'],
      },
    ],
  })

  // ── Row 8: diagonal-stripe-thick + ラベルスタイルのバリエーション ──
  rows.push({
    id: 'row8',
    name: t.project(8),
    tasks: [
      {
        id: 't8-1',
        name: t.planning,
        start: d(start, 2),
        end: d(start, 9),
        style: `background-color: ${colors.cyan};`,
        pattern: { type: 'diagonal-stripe-thick', color: 'rgba(255,255,255,0.3)' },
        labelStyle: 'font-weight: bold; color: yellow;',
      },
      {
        id: 't8-2',
        name: t.development,
        start: d(start, 10),
        end: d(start, 22),
        style: `background-color: ${colors.red};`,
        dependencies: ['t8-1'],
        labelStyle: 'font-style: italic;',
      },
      {
        id: 't8-3',
        name: t.release,
        start: d(start, 23),
        end: d(start, 28),
        style: `background-color: ${colors.amber};`,
        dependencies: ['t8-2', 't7-3'], // Row7からの行間依存
      },
    ],
  })

  // ── Row 9: 複数行からの集約依存（Row4,5,6の完了タスクに依存）──
  rows.push({
    id: 'row9',
    name: t.project(9),
    tasks: [
      {
        id: 't9-1',
        name: t.integration,
        start: d(start, 22),
        end: d(start, 32),
        style: `background-color: ${colors.indigo};`,
        dependencies: ['t4-3', 't5-3', 't6-3'], // 3行からの集約依存
      },
      {
        id: 't9-2',
        name: t.deployment,
        start: d(start, 33),
        end: d(start, 38),
        style: `background-color: ${colors.green};`,
        pattern: { type: 'diagonal-stripe', color: 'rgba(255,255,255,0.3)' },
        dependencies: ['t9-1'],
      },
    ],
    markers: [
      {
        id: 'marker-9-1',
        date: d(start, 38),
        anchor: 'end',
        type: 'triangle-up',
        color: colors.green,
        name: '🚀',
      },
    ],
  })

  // ── Row 10: 最終統合 + 全マーカー種類のデモ ──
  rows.push({
    id: 'row10',
    name: t.project(10),
    tasks: [
      {
        id: 't10-1',
        name: t.review,
        start: d(start, 30),
        end: d(start, 35),
        style: `background-color: ${colors.pink};`,
        dependencies: ['t3-2', 't8-3'], // Row3とRow8からの行間依存
      },
      {
        id: 't10-2',
        name: t.release,
        start: d(start, 36),
        end: d(start, 42),
        style: `background-color: ${colors.blue};`,
        pattern: { type: 'checkerboard', color: 'rgba(255,255,255,0.25)' },
        dependencies: ['t10-1', 't9-2'], // Row9からの行間依存
      },
    ],
    markers: [
      {
        id: 'marker-10-1',
        date: d(start, 30),
        anchor: 'start',
        type: 'triangle-right',
        color: colors.blue,
      },
      {
        id: 'marker-10-2',
        date: d(start, 35),
        anchor: 'center',
        type: 'diamond',
        color: colors.purple,
        name: '✓',
      },
      {
        id: 'marker-10-3',
        date: d(start, 42),
        anchor: 'end',
        type: 'triangle-left',
        color: colors.green,
        name: '🎉',
      },
    ],
  })

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 通常データエリア (row 11-50): 大量データのパフォーマンス確認用
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const patternTypes: GanttTaskPattern['type'][] = [
    'diagonal-stripe',
    'dots',
    'checkerboard',
    'vertical-stripe',
    'horizontal-stripe',
    'grid',
    'diagonal-stripe-reverse',
    'triangle',
  ]
  const barColors = [
    colors.blue,
    colors.purple,
    colors.green,
    colors.orange,
    colors.pink,
    colors.red,
    colors.cyan,
    colors.indigo,
  ]

  for (let i = 11; i <= 50; i++) {
    const offset = (i - 11) % 10
    const colorIdx = (i - 11) % barColors.length
    const hasPattern = i % 4 === 0
    const patternIdx = (i - 11) % patternTypes.length

    rows.push({
      id: `row${i}`,
      name: t.project(i),
      tasks: [
        {
          id: `t${i}-1`,
          name: t.requirementsDefinition,
          start: d(start, offset),
          end: d(start, offset + 5),
          style: `background-color: ${barColors[colorIdx]};`,
          pattern: hasPattern
            ? { type: patternTypes[patternIdx], color: 'rgba(255,255,255,0.35)' }
            : undefined,
        },
        {
          id: `t${i}-2`,
          name: t.design,
          start: d(start, offset + 6),
          end: d(start, offset + 15),
          style: `background-color: ${barColors[(colorIdx + 1) % barColors.length]};`,
          dependencies: [`t${i}-1`],
        },
      ],
      visible: i % 5 !== 0,
    })
  }
  return rows
}

/**
 * 週単位モードのデモデータを生成します。
 */
export const generateWeekModeData = (t: DemoTexts): GanttRow[] => {
  const start = new Date(chartStart)
  const rows: GanttRow[] = []

  const barColors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#ef4444', '#06b6d4', '#6366f1']
  const patternTypes: GanttTaskPattern['type'][] = [
    'diagonal-stripe', 'dots', 'checkerboard', 'vertical-stripe',
    'horizontal-stripe', 'grid', 'diagonal-stripe-reverse', 'triangle',
  ]

  for (let i = 1; i <= 30; i++) {
    const offset = ((i - 1) % 8) * 7
    const colorIdx = (i - 1) % barColors.length
    const hasPattern = i % 3 === 0
    const patternIdx = (i - 1) % patternTypes.length

    // 先頭5行は行間依存関係も追加
    const extraDeps = i >= 2 && i <= 5 ? [`w${i - 1}-2`] : []

    rows.push({
      id: `wrow${i}`,
      name: t.project(i),
      tasks: [
        {
          id: `w${i}-1`,
          name: i <= 5 ? t.planning : t.requirementsDefinition,
          start: d(start, offset),
          end: d(start, offset + 7),
          style: `background-color: ${barColors[colorIdx]};`,
          pattern: hasPattern
            ? { type: patternTypes[patternIdx], color: 'rgba(255,255,255,0.35)' }
            : undefined,
        },
        {
          id: `w${i}-2`,
          name: i <= 5 ? t.development : t.design,
          start: d(start, offset + 7),
          end: d(start, offset + 21),
          style: `background-color: ${barColors[(colorIdx + 2) % barColors.length]};`,
          dependencies: [`w${i}-1`, ...extraDeps],
        },
      ],
      visible: i % 5 !== 0,
    })
  }
  return rows
}

/**
 * 時間単位モードのデモデータを生成します。
 */
export const generateHourModeData = (t: DemoTexts): GanttRow[] => {
  const start = new Date(chartStart)
  const setTime = (base: Date, h: number, m: number) => {
    const newDate = new Date(base)
    newDate.setHours(h, m, 0, 0)
    return newDate
  }

  const barColors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#ef4444', '#06b6d4', '#6366f1']
  const breakPatterns: GanttTaskPattern['type'][] = ['dots', 'diagonal-stripe', 'horizontal-stripe', 'checkerboard', 'grid', 'vertical-stripe']

  const rows: GanttRow[] = []
  for (let i = 1; i <= 30; i++) {
    const shift = (i - 1) % 3
    const colorIdx = (i - 1) % barColors.length
    const breakPatternIdx = (i - 1) % breakPatterns.length

    rows.push({
      id: `user${i}`,
      name: t.assignee(i),
      tasks: [
        {
          id: `h${i}-1`,
          name: t.morningMeeting,
          start: setTime(start, 9, 0),
          end: setTime(start, 10, 0),
          movable: 'none',
          style: 'background-color: #ef4444;',
        },
        {
          id: `h${i}-2`,
          name: t.taskA,
          start: setTime(start, 10 + shift, 0),
          end: setTime(start, 12 + shift, 0),
          style: `background-color: ${barColors[colorIdx]};`,
        },
        {
          id: `h${i}-3`,
          name: t.break_,
          start: setTime(start, 12, 0),
          end: setTime(start, 13, 0),
          pattern: { type: breakPatterns[breakPatternIdx], color: '#aaa' },
        },
        {
          id: `h${i}-4`,
          name: t.taskB,
          start: setTime(start, 13, 0),
          end: setTime(start, 16 + shift, 30),
          style: `background-color: ${barColors[(colorIdx + 3) % barColors.length]};`,
        },
      ],
    })
  }
  return rows
}

/**
 * 月単位モードのデモデータを生成します。
 */
export const generateMonthModeData = (t: DemoTexts): GanttRow[] => {
  const start = new Date(chartStart)
  const rows: GanttRow[] = []
  for (let i = 1; i <= 40; i++) {
    // 約5年（60ヶ月）の期間にプロジェクトを散りばめる
    const offsetMonths = Math.floor((i - 1) * 1.5)
    const taskStart = new Date(start.getFullYear(), start.getMonth() + offsetMonths, 1)
    const designStart = new Date(taskStart)
    designStart.setMonth(designStart.getMonth() + 1)
    const designEnd = new Date(designStart)
    designEnd.setMonth(designEnd.getMonth() + 2)
    rows.push({
      id: `mrow${i}`,
      name: t.project(i),
      tasks: [
        {
          id: `m${i}-1`,
          name: t.requirementsDefinition,
          start: taskStart,
          end: new Date(taskStart.getFullYear(), taskStart.getMonth() + 1, 1),
          pattern: i % 4 === 0 ? { type: 'diagonal-stripe', color: '#3b82f6' } : undefined,
        },
        {
          id: `m${i}-2`,
          name: t.design,
          start: designStart,
          end: designEnd,
          dependencies: [`m${i}-1`],
        },
      ],
      visible: i % 5 !== 0,
    })
  }
  return rows
}

/**
 * 未割り当てタスク（追加候補）のリストを生成します。
 */
export const generateUnassignedTasks = (t: DemoTexts): GanttTask[] => [
  {
    id: 'new-1',
    name: t.newTaskA,
    start: new Date(),
    end: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    style: 'background-color: #8b5cf6;',
  },
  {
    id: 'new-2',
    name: t.newTaskB,
    start: new Date(),
    end: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    style: 'background-color: #ec4899;',
  },
  {
    id: 'new-3',
    name: t.meetingSetup,
    start: new Date(),
    end: new Date(Date.now() + 1 * 60 * 60 * 1000),
    style: 'background-color: #10b981;',
  },
  {
    id: 'new-4',
    name: t.patternTask,
    start: new Date(),
    end: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    style: 'background-color: #f59e0b;',
    pattern: { type: 'diagonal-stripe', color: 'rgba(255, 255, 255, 0.5)' },
  },
  {
    id: 'new-5',
    name: t.labelStyleTask,
    start: new Date(),
    end: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
    style: 'background-color: #3b82f6;',
    labelStyle: 'font-weight: bold; font-size: 14px; color: yellow;',
  },
]

export { chartStart }

import type { GanttRow, GanttTask, GanttTaskPattern } from '../core/types'
import { isHoliday } from './holidays'
import type { DemoTexts } from './i18n'

const chartStart = new Date()
chartStart.setHours(0, 0, 0, 0)

/**
 * 日付ヘルパー: 開始日からの日オフセットで日付を生成
 */
const d = (base: Date, offset: number): Date =>
  new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset)

/**
 * デモの標準非営業日（土日・祝日・カスタム休業日 +3, +10, +11）かどうかを判定
 */
const isDemoNonWorkingOffset = (base: Date, offset: number): boolean => {
  if (offset === 3 || offset === 10 || offset === 11) return true
  const dt = d(base, offset)
  const day = dt.getDay()
  if (day === 0 || day === 6) return true
  return Boolean(isHoliday(dt))
}

/** 指定オフセット以降で最初の営業日オフセットを返す */
const nextWorkingOffset = (base: Date, minOffset: number): number => {
  let cur = minOffset
  while (isDemoNonWorkingOffset(base, cur) && cur < minOffset + 14) {
    cur++
  }
  return cur
}

/** 開始オフセットから指定営業日数分の期間をとった exclusive end オフセットを返す */
const addWorkingDaysOffset = (base: Date, startOffset: number, workingDays: number): number => {
  let cur = startOffset
  let count = 0
  while (count < workingDays && cur < startOffset + 30) {
    if (!isDemoNonWorkingOffset(base, cur)) {
      count++
    }
    cur++
  }
  return cur
}

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
        progress: 100,
        baseline: {
          start: d(start, 0),
          end: d(start, 4),
          progress: 100,
        },
      },
      {
        id: 't1-2',
        name: t.design,
        start: d(start, 5),
        end: d(start, 13),
        style: `background-color: ${colors.purple};`,
        dependencies: ['t1-1'],
        progress: 75,
        deadline: d(start, 10), // 期限超過 (+3d) のデモ
        baseline: {
          start: d(start, 5),
          end: d(start, 11),
          progress: 80,
        },
      },
      {
        id: 't1-3',
        name: t.development,
        start: d(start, 14),
        end: d(start, 25),
        style: `background-color: ${colors.green};`,
        dependencies: ['t1-2'],
        progress: 30,
        baseline: {
          start: d(start, 13),
          end: d(start, 26),
          progress: 25,
        },
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

  // ── Row 2: 暖色系 + Row1からの行間依存関係 (SS + ラグ / FS + ラグ) ──
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
        dependencies: [{ taskId: 't1-1', type: 'SS', lag: 2 * 1440 }], // Row1企画開始の2日後に並行開始 (SS + 2日ラグ)
        progress: 90,
      },
      {
        id: 't2-2',
        name: t.frontendDev,
        start: d(start, 9),
        end: d(start, 20),
        style: `background-color: ${colors.pink};`,
        dependencies: ['t2-1', { taskId: 't1-2', type: 'SS', lag: 4 * 1440 }], // UI設計完了後(FS) & Row1設計開始の4日後(SS)
        progress: 45,
        deadline: d(start, 18), // 期限超過 (+2d) のデモ
      },
      {
        id: 't2-3',
        name: t.testing,
        start: d(start, 21),
        end: d(start, 28),
        style: `background-color: ${colors.red};`,
        dependencies: [{ taskId: 't2-2', type: 'FS', lag: 1440 }], // フロントエンド完了の1日後に着手 (FS + 1日ラグ)
        progress: 0,
        deadline: d(start, 32), // 期限余裕あり (残り4日) のデモ
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

  // ── Row 3: 寒色系 + Row1,2からの合流依存 (FS + FF) ──
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
        dependencies: ['t1-1'], // Row1企画完了後に着手 (FS)
        progress: 60,
        deadline: d(start, 18), // 期限当日 (On time) のデモ
      },
      {
        id: 't3-2',
        name: t.integration,
        start: d(start, 21),
        end: d(start, 30),
        style: `background-color: ${colors.indigo};`,
        dependencies: ['t3-1', 't2-2', { taskId: 't2-3', type: 'FF', lag: 2 * 1440 }], // FF + 2日ラグを含む合流依存
        progress: 10,
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
        deadline: d(start, 23), // パターン付きバー + 期限余裕あり (残り3日)
      },
    ],
  })

  // ── Row 5: dots / checkerboard / grid パターン (SF依存を含む) ──
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
        dependencies: [{ taskId: 't4-2', type: 'SF' }], // Row4試作開始に合わせて完了 (SF)
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
        deadline: d(start, 22), // パターン付きバー + 期限超過 (+3d)
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
        deadline: d(start, 30), // 期限余裕あり (残り2日)
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
  // スケジュール制約 (SNET / FNLT) ショーケースエリア
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const snetLimitOffset = nextWorkingOffset(start, 6)
  const snetTaskStart = nextWorkingOffset(start, snetLimitOffset + 3)
  const snetTaskEnd = addWorkingDaysOffset(start, snetTaskStart, 4)

  rows.push({
    id: 'constraint-snet',
    name: t.constraintSnetRow,
    tasks: [
      {
        id: 't-constraint-snet',
        name: t.constraintSnetTask,
        start: d(start, snetTaskStart),
        end: d(start, snetTaskEnd),
        style: `background-color: ${colors.blue};`,
        progress: 25,
        constraintType: 'SNET',
        constraintDate: d(start, snetLimitOffset), // この日以降に開始（左へドラッグしても押し戻される）
      },
    ],
    markers: [
      {
        id: 'marker-snet',
        date: d(start, snetLimitOffset),
        anchor: 'end',
        type: 'triangle-right',
        color: colors.blue,
        name: 'SNET',
      },
    ],
  })

  const fnltTaskStart = nextWorkingOffset(start, 12)
  const fnltTaskEnd = addWorkingDaysOffset(start, fnltTaskStart, 4)
  const fnltLimitOffset = nextWorkingOffset(start, Math.max(21, fnltTaskEnd + 3)) + 1

  rows.push({
    id: 'constraint-fnlt',
    name: t.constraintFnltRow,
    tasks: [
      {
        id: 't-constraint-fnlt',
        name: t.constraintFnltTask,
        start: d(start, fnltTaskStart),
        end: d(start, fnltTaskEnd),
        style: `background-color: ${colors.orange};`,
        progress: 40,
        deadline: d(start, fnltLimitOffset),
        constraintType: 'FNLT',
        constraintDate: d(start, fnltLimitOffset), // この日までに終了（右へドラッグしても引き戻される）
      },
    ],
    markers: [
      {
        id: 'marker-fnlt',
        date: d(start, fnltLimitOffset),
        anchor: 'start',
        type: 'triangle-left',
        color: colors.red,
        name: 'FNLT',
      },
    ],
  })

  const chainPredStart = nextWorkingOffset(start, 1)
  const chainPredEnd = addWorkingDaysOffset(start, chainPredStart, 3)
  const chainSnetOffset = nextWorkingOffset(start, 12)
  const chainSnetEnd = addWorkingDaysOffset(start, chainSnetOffset, 4)
  const chainFnltStart = nextWorkingOffset(start, chainSnetEnd + 1)
  const chainFnltEnd = addWorkingDaysOffset(start, chainFnltStart, 3)
  const chainFnltLimitOffset = nextWorkingOffset(start, chainFnltEnd + 4) + 1

  rows.push({
    id: 'constraint-chain',
    name: t.constraintChainRow,
    tasks: [
      {
        id: 't-chain-1',
        name: t.constraintChainPred,
        start: d(start, chainPredStart),
        end: d(start, chainPredEnd),
        style: `background-color: ${colors.cyan};`,
        progress: 100,
      },
      {
        id: 't-chain-2',
        name: t.constraintChainSnet,
        start: d(start, chainSnetOffset),
        end: d(start, chainSnetEnd),
        style: `background-color: ${colors.purple};`,
        dependencies: ['t-chain-1'],
        progress: 50,
        constraintType: 'SNET',
        constraintDate: d(start, chainSnetOffset),
      },
      {
        id: 't-chain-3',
        name: t.constraintChainFnlt,
        start: d(start, chainFnltStart),
        end: d(start, chainFnltEnd),
        style: `background-color: ${colors.pink};`,
        dependencies: ['t-chain-2'],
        progress: 10,
        deadline: d(start, chainFnltLimitOffset),
        constraintType: 'FNLT',
        constraintDate: d(start, chainFnltLimitOffset),
      },
    ],
    markers: [
      {
        id: 'marker-chain-snet',
        date: d(start, chainSnetOffset),
        anchor: 'end',
        type: 'triangle-right',
        color: colors.purple,
        name: 'SNET',
      },
      {
        id: 'marker-chain-fnlt',
        date: d(start, chainFnltLimitOffset),
        anchor: 'start',
        type: 'triangle-left',
        color: colors.red,
        name: 'FNLT',
      },
    ],
  })

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 単一タスク（1行1タスク）ショーケースエリア
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  rows.push({
    id: 'single-1',
    name: t.singleTask1,
    tasks: [
      {
        id: 't-single-1',
        name: t.singleTask1,
        start: d(start, 3),
        end: d(start, 12),
        style: `background-color: ${colors.cyan};`,
        progress: 85,
        deadline: d(start, 10), // 期限超過 (+2d) - グリッド赤字表示・インライン編集確認用
        baseline: {
          start: d(start, 2),
          end: d(start, 10),
          progress: 90,
        },
      },
    ],
    markers: [
      {
        id: 'marker-s1',
        date: d(start, 12),
        anchor: 'end',
        type: 'diamond',
        color: colors.cyan,
        name: '★',
      },
    ],
  })

  rows.push({
    id: 'single-2',
    name: t.singleTask2,
    tasks: [
      {
        id: 't-single-2',
        name: t.singleTask2,
        start: d(start, 13),
        end: d(start, 22),
        style: `background-color: ${colors.amber};`,
        dependencies: ['t-single-1'],
        progress: 50,
        deadline: d(start, 25), // 期限余裕あり (残り3日)
        baseline: {
          start: d(start, 12),
          end: d(start, 20),
          progress: 60,
        },
      },
    ],
  })

  rows.push({
    id: 'single-3',
    name: t.singleTask3,
    tasks: [
      {
        id: 't-single-3',
        name: t.singleTask3,
        start: d(start, 20),
        end: d(start, 29),
        style: `background-color: ${colors.lime};`,
        dependencies: ['t-single-2'],
        progress: 15,
        deadline: d(start, 29), // 期限当日 (On time)
      },
    ],
  })

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // WBS 階層ツリー & サマリータスク ショーケースエリア
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  rows.push({
    id: 'wbs-root',
    name: t.wbsRoot,
    parentId: null,
    tasks: [], // autoSummary により配下タスクから自動計算
  })
  rows.push({
    id: 'wbs-phase1',
    name: t.wbsPhase1,
    parentId: 'wbs-root',
    tasks: [], // autoSummary サマリー行
  })
  rows.push({
    id: 'wbs-task1',
    name: t.wbsTask1,
    parentId: 'wbs-phase1',
    tasks: [
      {
        id: 't-wbs-1',
        name: t.wbsTask1,
        start: d(start, 1),
        end: d(start, 7),
        style: `background-color: ${colors.blue};`,
        progress: 100,
        deadline: d(start, 7), // 期限通り完了
        baseline: {
          start: d(start, 1),
          end: d(start, 6),
        },
      },
    ],
  })
  rows.push({
    id: 'wbs-task2',
    name: t.wbsTask2,
    parentId: 'wbs-phase1',
    tasks: [
      {
        id: 't-wbs-2',
        name: t.wbsTask2,
        start: d(start, 8),
        end: d(start, 16),
        style: `background-color: ${colors.purple};`,
        dependencies: ['t-wbs-1'],
        progress: 80,
        deadline: d(start, 14), // 期限超過 (+2d)
        baseline: {
          start: d(start, 7),
          end: d(start, 14),
        },
      },
    ],
  })
  rows.push({
    id: 'wbs-ms1',
    name: t.wbsMilestone1,
    parentId: 'wbs-phase1',
    tasks: [
      {
        id: 't-wbs-ms1',
        name: t.wbsMilestone1,
        type: 'milestone',
        start: d(start, 16),
        end: d(start, 16),
        style: `background-color: ${colors.purple};`,
        dependencies: ['t-wbs-2'],
        deadline: d(start, 15), // マイルストーンの期限超過 (+1d)
      },
    ],
  })
  rows.push({
    id: 'wbs-phase2',
    name: t.wbsPhase2,
    parentId: 'wbs-root',
    tasks: [], // autoSummary サマリー行
  })
  rows.push({
    id: 'wbs-task3',
    name: t.wbsTask3,
    parentId: 'wbs-phase2',
    tasks: [
      {
        id: 't-wbs-3',
        name: t.wbsTask3,
        start: d(start, 16),
        end: d(start, 24),
        style: `background-color: ${colors.orange};`,
        dependencies: ['t-wbs-ms1'],
        progress: 40,
        deadline: d(start, 26), // 期限余裕あり (残り2日)
      },
    ],
  })
  rows.push({
    id: 'wbs-task4',
    name: t.wbsTask4,
    parentId: 'wbs-phase2',
    tasks: [
      {
        id: 't-wbs-4',
        name: t.wbsTask4,
        start: d(start, 22),
        end: d(start, 30),
        style: `background-color: ${colors.pink};`,
        dependencies: ['t-wbs-3'],
        progress: 10,
        deadline: d(start, 28), // 期限超過 (+2d)
      },
    ],
  })
  rows.push({
    id: 'wbs-ms2',
    name: t.wbsMilestone2,
    parentId: 'wbs-phase2',
    tasks: [
      {
        id: 't-wbs-ms2',
        name: t.wbsMilestone2,
        type: 'milestone',
        start: d(start, 30),
        end: d(start, 30),
        style: `background-color: ${colors.green};`,
        dependencies: ['t-wbs-4'],
        deadline: d(start, 32), // マイルストーンの期限余裕あり (残り2日)
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
    const isSingleTask = i % 2 === 1
    const hasDeadline = i % 3 === 0
    const deadlineDelta = i % 9 === 0 ? -2 : i % 9 === 3 ? 3 : 0

    const rowTasks: GanttTask[] = isSingleTask
      ? [
          {
            id: `t${i}-1`,
            name: t.project(i),
            start: d(start, offset),
            end: d(start, offset + 12),
            style: `background-color: ${barColors[colorIdx]};`,
            pattern: hasPattern
              ? { type: patternTypes[patternIdx], color: 'rgba(255,255,255,0.35)' }
              : undefined,
            progress: (i * 19) % 100,
            deadline: hasDeadline ? d(start, offset + 12 + deadlineDelta) : undefined,
          },
        ]
      : [
          {
            id: `t${i}-1`,
            name: t.requirementsDefinition,
            start: d(start, offset),
            end: d(start, offset + 5),
            style: `background-color: ${barColors[colorIdx]};`,
            pattern: hasPattern
              ? { type: patternTypes[patternIdx], color: 'rgba(255,255,255,0.35)' }
              : undefined,
            progress: 100,
          },
          {
            id: `t${i}-2`,
            name: t.design,
            start: d(start, offset + 6),
            end: d(start, offset + 15),
            style: `background-color: ${barColors[(colorIdx + 1) % barColors.length]};`,
            dependencies: [`t${i}-1`],
            progress: (i * 13) % 80,
            deadline: hasDeadline ? d(start, offset + 15 + deadlineDelta) : undefined,
          },
        ]

    rows.push({
      id: `row${i}`,
      name: t.project(i),
      tasks: rowTasks,
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
    const isSingleTask = i > 5 && i % 2 === 1

    // 先頭5行は行間依存関係も追加
    const extraDeps = i >= 2 && i <= 5 ? [`w${i - 1}-2`] : []
    const weekDeadlineDelta =
      i === 1 ? -3 : i === 2 ? 7 : i === 3 ? 0 : i % 3 === 0 ? (i % 6 === 0 ? -4 : 5) : undefined

    const tasks: GanttTask[] = isSingleTask
      ? [
          {
            id: `w${i}-1`,
            name: t.project(i),
            start: d(start, offset),
            end: d(start, offset + 14),
            style: `background-color: ${barColors[colorIdx]};`,
            pattern: hasPattern
              ? { type: patternTypes[patternIdx], color: 'rgba(255,255,255,0.35)' }
              : undefined,
            deadline:
              weekDeadlineDelta !== undefined ? d(start, offset + 14 + weekDeadlineDelta) : undefined,
          },
        ]
      : [
          {
            id: `w${i}-1`,
            name: i === 4 ? `${t.planning} [SNET]` : i <= 5 ? t.planning : t.requirementsDefinition,
            start: d(start, offset),
            end: d(start, offset + 7),
            style: `background-color: ${barColors[colorIdx]};`,
            pattern: hasPattern
              ? { type: patternTypes[patternIdx], color: 'rgba(255,255,255,0.35)' }
              : undefined,
            constraintType: i === 4 ? 'SNET' : undefined,
            constraintDate: i === 4 ? d(start, offset) : undefined,
          },
          {
            id: `w${i}-2`,
            name: i === 4 ? `${t.development} [FNLT]` : i <= 5 ? t.development : t.design,
            start: d(start, offset + 7),
            end: d(start, offset + 21),
            style: `background-color: ${barColors[(colorIdx + 2) % barColors.length]};`,
            dependencies: [`w${i}-1`, ...extraDeps],
            deadline:
              i === 4
                ? d(start, offset + 28)
                : weekDeadlineDelta !== undefined
                  ? d(start, offset + 21 + weekDeadlineDelta)
                  : undefined,
            constraintType: i === 4 ? 'FNLT' : undefined,
            constraintDate: i === 4 ? d(start, offset + 28) : undefined,
          },
        ]

    rows.push({
      id: `wrow${i}`,
      name: t.project(i),
      tasks,
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
          name: i === 4 ? `${t.taskA} [SNET]` : t.taskA,
          start: setTime(start, 10 + shift, 0),
          end: setTime(start, 12 + shift, 0),
          style: `background-color: ${barColors[colorIdx]};`,
          deadline: i === 1 ? setTime(start, 11, 30) : undefined,
          constraintType: i === 4 ? 'SNET' : undefined,
          constraintDate: i === 4 ? setTime(start, 10 + shift, 0) : undefined,
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
          name: i === 4 ? `${t.taskB} [FNLT]` : t.taskB,
          start: setTime(start, 13, 0),
          end: setTime(start, 16 + shift, 30),
          style: `background-color: ${barColors[(colorIdx + 3) % barColors.length]};`,
          deadline:
            i === 1
              ? setTime(start, 17, 30)
              : i === 2
                ? setTime(start, 16, 30)
                : i === 3
                  ? setTime(start, 18, 30)
                  : i % 4 === 0
                    ? setTime(start, 17 + shift, 30)
                    : undefined,
          constraintType: i === 4 ? 'FNLT' : undefined,
          constraintDate: i === 4 ? setTime(start, 17 + shift, 30) : undefined,
        },
      ],
    })
  }
  return rows
}

/**
 * 月単位モードのデモデータを生成します。
 *
 * 先頭10行は「ショーケースエリア」として、バーの色・パターン・マーカー・
 * 行間依存関係の多彩なバリエーションを確認できるように構成しています。
 */
export const generateMonthModeData = (t: DemoTexts): GanttRow[] => {
  const start = new Date(chartStart)
  const rows: GanttRow[] = []

  /** 月オフセットで日付を生成するヘルパー */
  const m = (base: Date, monthOffset: number, day = 1): Date =>
    new Date(base.getFullYear(), base.getMonth() + monthOffset, day)

  // 色パレット
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

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ショーケースエリア (row 1-10): 色・パターン・依存関係のバリエーション
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // ── Row 1: 基本の4フェーズ + マーカー ──
  rows.push({
    id: 'mrow1',
    name: t.project(1),
    tasks: [
      {
        id: 'm1-1',
        name: t.requirementsDefinition,
        start: m(start, 0),
        end: m(start, 2),
        style: `background-color: ${colors.blue};`,
        labelStyle: 'font-weight: bold;',
      },
      {
        id: 'm1-2',
        name: t.design,
        start: m(start, 2),
        end: m(start, 5),
        style: `background-color: ${colors.purple};`,
        dependencies: ['m1-1'],
      },
      {
        id: 'm1-3',
        name: t.development,
        start: m(start, 5),
        end: m(start, 11),
        style: `background-color: ${colors.green};`,
        dependencies: ['m1-2'],
        deadline: m(start, 10), // 月単位の期限超過デモ
      },
      {
        id: 'm1-4',
        name: t.release,
        start: m(start, 11),
        end: m(start, 13),
        style: `background-color: ${colors.orange};`,
        dependencies: ['m1-3'],
      },
    ],
    markers: [
      {
        id: 'mm-1-1',
        date: m(start, 5),
        anchor: 'start',
        type: 'diamond',
        color: colors.purple,
        name: t.alphaRelease,
      },
      {
        id: 'mm-1-2',
        date: m(start, 13),
        anchor: 'end',
        type: 'triangle-left',
        color: colors.green,
        name: '🚀',
      },
    ],
  })

  // ── Row 2: 暖色系 + Row1からの行間依存 ──
  rows.push({
    id: 'mrow2',
    name: t.project(2),
    tasks: [
      {
        id: 'm2-1',
        name: t.uiDesign,
        start: m(start, 1),
        end: m(start, 4),
        style: `background-color: ${colors.orange};`,
      },
      {
        id: 'm2-2',
        name: t.frontendDev,
        start: m(start, 4),
        end: m(start, 10),
        style: `background-color: ${colors.pink};`,
        dependencies: ['m2-1', 'm1-2'], // Row1の設計完了後（行間依存）
      },
      {
        id: 'm2-3',
        name: t.testing,
        start: m(start, 10),
        end: m(start, 13),
        style: `background-color: ${colors.red};`,
        dependencies: ['m2-2'],
        deadline: m(start, 15), // 月単位の期限余裕ありデモ
      },
    ],
    markers: [
      {
        id: 'mm-2-1',
        date: m(start, 4),
        anchor: 'end',
        type: 'triangle-right',
        color: colors.orange,
        name: t.reviewDeadline,
      },
    ],
  })

  // ── Row 3: 寒色系 + Row1,2からの合流依存 ──
  rows.push({
    id: 'mrow3',
    name: t.project(3),
    tasks: [
      {
        id: 'm3-1',
        name: t.backendDev,
        start: m(start, 3),
        end: m(start, 9),
        style: `background-color: ${colors.cyan};`,
        dependencies: ['m1-1'],
        deadline: m(start, 9), // 月単位の期限当月デモ
      },
      {
        id: 'm3-2',
        name: t.integration,
        start: m(start, 10),
        end: m(start, 15),
        style: `background-color: ${colors.indigo};`,
        dependencies: ['m3-1', 'm2-2'], // バックエンド＋フロントエンド合流
      },
    ],
    markers: [
      {
        id: 'mm-3-1',
        date: m(start, 15),
        anchor: 'center',
        type: 'square',
        color: colors.green,
        name: t.releaseScheduled,
      },
    ],
  })

  // ── Row 4: パターン付きバー（diagonal-stripe系）──
  rows.push({
    id: 'mrow4',
    name: t.project(4),
    tasks: [
      {
        id: 'm4-1',
        name: t.research,
        start: m(start, 0),
        end: m(start, 3),
        style: `background-color: ${colors.blue};`,
        pattern: { type: 'diagonal-stripe', color: 'rgba(255,255,255,0.4)' },
      },
      {
        id: 'm4-2',
        name: `${t.prototyping} [SNET]`,
        start: m(start, 3),
        end: m(start, 7),
        style: `background-color: ${colors.purple};`,
        pattern: { type: 'diagonal-stripe-reverse', color: 'rgba(255,255,255,0.4)' },
        dependencies: ['m4-1'],
        constraintType: 'SNET',
        constraintDate: m(start, 3),
      },
      {
        id: 'm4-3',
        name: `${t.review} [FNLT]`,
        start: m(start, 7),
        end: m(start, 9),
        style: `background-color: ${colors.green};`,
        pattern: { type: 'diagonal-stripe-thin', color: 'rgba(255,255,255,0.5)' },
        dependencies: ['m4-2'],
        deadline: m(start, 11),
        constraintType: 'FNLT',
        constraintDate: m(start, 11),
      },
    ],
  })

  // ── Row 5: dots / checkerboard / grid パターン ──
  rows.push({
    id: 'mrow5',
    name: t.project(5),
    tasks: [
      {
        id: 'm5-1',
        name: t.planning,
        start: m(start, 2),
        end: m(start, 5),
        style: `background-color: ${colors.orange};`,
        pattern: { type: 'dots', color: 'rgba(255,255,255,0.5)' },
      },
      {
        id: 'm5-2',
        name: t.development,
        start: m(start, 5),
        end: m(start, 11),
        style: `background-color: ${colors.pink};`,
        pattern: { type: 'checkerboard', color: 'rgba(255,255,255,0.3)' },
        dependencies: ['m5-1'],
      },
      {
        id: 'm5-3',
        name: t.deployment,
        start: m(start, 11),
        end: m(start, 14),
        style: `background-color: ${colors.cyan};`,
        pattern: { type: 'grid', color: 'rgba(255,255,255,0.3)' },
        dependencies: ['m5-2'],
      },
    ],
    visible: false, // 非表示行のデモ
  })

  // ── Row 6: 長期プロジェクト + vertical/horizontal パターン ──
  rows.push({
    id: 'mrow6',
    name: t.project(6),
    tasks: [
      {
        id: 'm6-1',
        name: t.planning,
        start: m(start, 1),
        end: m(start, 4),
        style: `background-color: ${colors.indigo};`,
        pattern: { type: 'vertical-stripe', color: 'rgba(255,255,255,0.35)' },
      },
      {
        id: 'm6-2',
        name: t.development,
        start: m(start, 4),
        end: m(start, 14),
        style: `background-color: ${colors.amber};`,
        dependencies: ['m6-1'],
      },
      {
        id: 'm6-3',
        name: t.documentation,
        start: m(start, 14),
        end: m(start, 17),
        style: `background-color: ${colors.lime};`,
        pattern: { type: 'horizontal-stripe', color: 'rgba(255,255,255,0.35)' },
        dependencies: ['m6-2'],
      },
      {
        id: 'm6-4',
        name: t.deployment,
        start: m(start, 17),
        end: m(start, 19),
        style: `background-color: ${colors.green};`,
        dependencies: ['m6-3'],
        deadline: m(start, 18), // 月単位の期限超過デモ
      },
    ],
  })

  // ── Row 7: 並行タスク + triangle/circle パターン ──
  rows.push({
    id: 'mrow7',
    name: t.project(7),
    tasks: [
      {
        id: 'm7-1',
        name: t.requirementsDefinition,
        start: m(start, 0),
        end: m(start, 2),
        style: `background-color: ${colors.red};`,
        pattern: { type: 'triangle', color: 'rgba(255,255,255,0.35)' },
      },
      {
        id: 'm7-2',
        name: t.frontendDev,
        start: m(start, 2),
        end: m(start, 8),
        style: `background-color: ${colors.blue};`,
        dependencies: ['m7-1'],
      },
      {
        id: 'm7-3',
        name: t.backendDev,
        start: m(start, 2),
        end: m(start, 9),
        style: `background-color: ${colors.cyan};`,
        pattern: { type: 'circle', color: 'rgba(255,255,255,0.3)' },
        dependencies: ['m7-1'],
      },
      {
        id: 'm7-4',
        name: t.qaTest,
        start: m(start, 9),
        end: m(start, 12),
        style: `background-color: ${colors.purple};`,
        dependencies: ['m7-2', 'm7-3'], // 並行タスクの合流
      },
    ],
    markers: [
      {
        id: 'mm-7-1',
        date: m(start, 9),
        anchor: 'center',
        type: 'triangle-down',
        color: colors.orange,
        name: t.betaRelease,
      },
    ],
  })

  // ── Row 8: ラベルスタイルのバリエーション + Row7からの行間依存 ──
  rows.push({
    id: 'mrow8',
    name: t.project(8),
    tasks: [
      {
        id: 'm8-1',
        name: t.planning,
        start: m(start, 4),
        end: m(start, 7),
        style: `background-color: ${colors.cyan};`,
        pattern: { type: 'diagonal-stripe-thick', color: 'rgba(255,255,255,0.3)' },
        labelStyle: 'font-weight: bold; color: yellow;',
      },
      {
        id: 'm8-2',
        name: t.development,
        start: m(start, 7),
        end: m(start, 14),
        style: `background-color: ${colors.red};`,
        dependencies: ['m8-1'],
        labelStyle: 'font-style: italic;',
      },
      {
        id: 'm8-3',
        name: t.staging,
        start: m(start, 14),
        end: m(start, 16),
        style: `background-color: ${colors.lime};`,
        pattern: { type: 'dots-dense', color: 'rgba(255,255,255,0.4)' },
        dependencies: ['m8-2', 'm7-4'], // Row7からの行間依存
      },
      {
        id: 'm8-4',
        name: t.release,
        start: m(start, 16),
        end: m(start, 18),
        style: `background-color: ${colors.amber};`,
        dependencies: ['m8-3'],
      },
    ],
  })

  // ── Row 9: 複数行からの集約依存 (Row4,5,6の完了タスクに依存) ──
  rows.push({
    id: 'mrow9',
    name: t.project(9),
    tasks: [
      {
        id: 'm9-1',
        name: t.integration,
        start: m(start, 15),
        end: m(start, 20),
        style: `background-color: ${colors.indigo};`,
        dependencies: ['m4-3', 'm5-3', 'm6-4'], // 3行からの集約依存
      },
      {
        id: 'm9-2',
        name: t.monitoring,
        start: m(start, 20),
        end: m(start, 23),
        style: `background-color: ${colors.green};`,
        pattern: { type: 'diagonal-stripe', color: 'rgba(255,255,255,0.3)' },
        dependencies: ['m9-1'],
      },
    ],
    markers: [
      {
        id: 'mm-9-1',
        date: m(start, 23),
        anchor: 'end',
        type: 'triangle-up',
        color: colors.green,
        name: '🚀',
      },
    ],
  })

  // ── Row 10: 最終統合 + マーカー全種 ──
  rows.push({
    id: 'mrow10',
    name: t.project(10),
    tasks: [
      {
        id: 'm10-1',
        name: t.review,
        start: m(start, 18),
        end: m(start, 21),
        style: `background-color: ${colors.pink};`,
        dependencies: ['m3-2', 'm8-4'],
      },
      {
        id: 'm10-2',
        name: t.release,
        start: m(start, 21),
        end: m(start, 25),
        style: `background-color: ${colors.blue};`,
        pattern: { type: 'checkerboard', color: 'rgba(255,255,255,0.25)' },
        dependencies: ['m10-1', 'm9-2'],
      },
    ],
    markers: [
      {
        id: 'mm-10-1',
        date: m(start, 18),
        anchor: 'start',
        type: 'triangle-right',
        color: colors.blue,
      },
      {
        id: 'mm-10-2',
        date: m(start, 21),
        anchor: 'center',
        type: 'diamond',
        color: colors.purple,
        name: '✓',
      },
      {
        id: 'mm-10-3',
        date: m(start, 25),
        anchor: 'end',
        type: 'triangle-left',
        color: colors.green,
        name: '🎉',
      },
    ],
    visible: false, // 非表示行のデモ
  })

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 通常データエリア (row 11-40): バリエーション豊富な大量データ
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const barColors = [
    colors.blue, colors.purple, colors.green, colors.orange,
    colors.pink, colors.red, colors.cyan, colors.indigo,
  ]
  const patternTypes: GanttTaskPattern['type'][] = [
    'diagonal-stripe', 'dots', 'checkerboard', 'vertical-stripe',
    'horizontal-stripe', 'grid', 'diagonal-stripe-reverse', 'triangle',
  ]

  // タスク構成パターン（フェーズの組み合わせ）
  const taskTemplates: ((idx: number) => { name: string; durationMonths: number }[])[] = [
    // パターンA: 要件→設計→開発→テスト (4フェーズ)
    () => [
      { name: t.requirementsDefinition, durationMonths: 2 },
      { name: t.design, durationMonths: 2 },
      { name: t.development, durationMonths: 4 },
      { name: t.testing, durationMonths: 2 },
    ],
    // パターンB: 調査→プロトタイプ→開発 (3フェーズ)
    () => [
      { name: t.research, durationMonths: 3 },
      { name: t.prototyping, durationMonths: 2 },
      { name: t.development, durationMonths: 5 },
    ],
    // パターンC: 設計→開発→デプロイ (3フェーズ)
    () => [
      { name: t.design, durationMonths: 2 },
      { name: t.development, durationMonths: 6 },
      { name: t.deployment, durationMonths: 1 },
    ],
    // パターンD: 企画→UI設計→フロントエンド→QA (4フェーズ)
    () => [
      { name: t.planning, durationMonths: 1 },
      { name: t.uiDesign, durationMonths: 3 },
      { name: t.frontendDev, durationMonths: 4 },
      { name: t.qaTest, durationMonths: 2 },
    ],
    // パターンE: 要件→バックエンド→結合→リリース (4フェーズ)
    () => [
      { name: t.requirementsDefinition, durationMonths: 2 },
      { name: t.backendDev, durationMonths: 5 },
      { name: t.integration, durationMonths: 2 },
      { name: t.release, durationMonths: 1 },
    ],
    // パターンF: 企画→開発→レビュー→ドキュメント→デプロイ (5フェーズ)
    () => [
      { name: t.planning, durationMonths: 1 },
      { name: t.development, durationMonths: 3 },
      { name: t.codeReview, durationMonths: 1 },
      { name: t.documentation, durationMonths: 1 },
      { name: t.deployment, durationMonths: 1 },
    ],
    // パターンG: 調査→設計→開発→ステージング→監視 (5フェーズ)
    () => [
      { name: t.research, durationMonths: 2 },
      { name: t.design, durationMonths: 2 },
      { name: t.development, durationMonths: 4 },
      { name: t.staging, durationMonths: 1 },
      { name: t.monitoring, durationMonths: 2 },
    ],
    // パターンH: 短期 要件→バグ修正→テスト (3フェーズ)
    () => [
      { name: t.requirementsDefinition, durationMonths: 1 },
      { name: t.bugfix, durationMonths: 3 },
      { name: t.testing, durationMonths: 1 },
    ],
    // パターンI: 単一タスク (1行1タスク)
    (idx: number) => [
      { name: t.project(idx), durationMonths: 6 },
    ],
  ]

  for (let i = 11; i <= 40; i++) {
    const templateIdx = (i - 11) % taskTemplates.length
    const offsetMonths = Math.floor((i - 11) * 1.3)
    const colorIdx = (i - 11) % barColors.length
    const hasPattern = i % 3 === 0
    const patternIdx = (i - 11) % patternTypes.length

    const phases = taskTemplates[templateIdx](i)
    let currentMonth = offsetMonths

    const tasks = phases.map((phase, phaseIdx) => {
      const taskStart = m(start, currentMonth)
      const taskEnd = m(start, currentMonth + phase.durationMonths)
      const endMonthOffset = currentMonth + phase.durationMonths
      currentMonth += phase.durationMonths
      const isLastPhase = phaseIdx === phases.length - 1
      const hasMonthDeadline = isLastPhase && i % 3 === 0
      const monthDeadlineDelta = i % 9 === 0 ? -1 : i % 9 === 3 ? 2 : 0

      return {
        id: `m${i}-${phaseIdx + 1}`,
        name: phase.name,
        start: taskStart,
        end: taskEnd,
        style: `background-color: ${barColors[(colorIdx + phaseIdx) % barColors.length]};`,
        pattern: hasPattern && phaseIdx === 0
          ? { type: patternTypes[patternIdx], color: 'rgba(255,255,255,0.35)' } as GanttTaskPattern
          : undefined,
        dependencies: phaseIdx > 0 ? [`m${i}-${phaseIdx}`] : undefined,
        deadline: hasMonthDeadline ? m(start, endMonthOffset + monthDeadlineDelta) : undefined,
      }
    })

    // 一部の行に行間依存を追加
    if (i >= 13 && i <= 15) {
      const prevRowLastTask = `m${i - 1}-${taskTemplates[(i - 12) % taskTemplates.length](i - 1).length}`
      if (tasks[0]) {
        tasks[0].dependencies = [prevRowLastTask]
      }
    }

    rows.push({
      id: `mrow${i}`,
      name: t.project(i),
      tasks,
      visible: i % 5 !== 0,
    })
  }

  return rows
}

/**
 * 大規模データ（3年間・200行・WBS階層・複数フェーズタスク）のストレステスト用データを生成します。
 */
export const generateLargeScaleData = (t: DemoTexts, totalGroups = 20, childrenPerGroup = 9): GanttRow[] => {
  const start = new Date(chartStart)
  const rows: GanttRow[] = []
  const palette = [
    '#3b82f6',
    '#8b5cf6',
    '#10b981',
    '#f59e0b',
    '#ec4899',
    '#06b6d4',
    '#6366f1',
    '#14b8a6',
  ]
  const phaseLabels = [
    t.planning,
    t.design,
    t.development,
    t.testing,
    t.staging,
    t.release,
  ]

  let rowSeq = 1
  for (let g = 1; g <= totalGroups; g++) {
    const groupRowId = `ls-group-${g}`
    rows.push({
      id: groupRowId,
      name: `📁 ${t.project(((g - 1) % 50) + 1)} (#${g})`,
      tasks: [],
    })
    rowSeq++

    let prevTaskId: string | undefined = undefined
    for (let c = 1; c <= childrenPerGroup; c++) {
      const childIdx = (g - 1) * childrenPerGroup + c
      const rowId = `ls-row-${childIdx}`
      const tasks: GanttTask[] = []

      // 3年間（約1095日）にわたって各行に4フェーズのタスクを配置（先頭付近にも必ず表示されるようオフセット分散）
      const baseOffset = ((c - 1) * 7 + (g - 1) * 4) % 45
      for (let p = 0; p < 4; p++) {
        const taskId = `ls-t-${childIdx}-${p + 1}`
        const phaseSpan = p === 0 ? 0 : p * 240
        const startOffset = baseOffset + phaseSpan + c * 5
        const durationDays = 10 + ((childIdx + p * 3) % 18)
        const taskStart = d(start, startOffset)
        const taskEnd = d(start, startOffset + durationDays)
        const color = palette[(childIdx + p) % palette.length]
        const progress = p === 0 ? Math.min(100, ((childIdx * 17) % 11) * 10) : p === 1 ? ((childIdx * 7) % 6) * 10 : 0

        const hasLsDeadline = childIdx % 3 === 0 && (p === 0 || p === 3)
        const lsDeadlineDelta = childIdx % 6 === 0 ? -2 : 4

        tasks.push({
          id: taskId,
          name: `${phaseLabels[(c + p) % phaseLabels.length]} Y${p + 1}`,
          start: taskStart,
          end: taskEnd,
          style: `background-color: ${color};`,
          progress,
          dependencies: p === 0 && prevTaskId && c <= 4 ? [prevTaskId] : p > 0 ? [`ls-t-${childIdx}-${p}`] : undefined,
          deadline: hasLsDeadline ? d(start, startOffset + durationDays + lsDeadlineDelta) : undefined,
          baseline: {
            start: taskStart,
            end: d(start, startOffset + Math.max(5, durationDays - (childIdx % 4 === 0 ? 3 : 0))),
            progress,
          },
        })
        if (p === 0) {
          prevTaskId = taskId
        }
      }

      rows.push({
        id: rowId,
        parentId: groupRowId,
        name: `${t.assignee(((rowSeq - 1) % 30) + 1)} — ${phaseLabels[c % phaseLabels.length]}`,
        tasks,
      })
      rowSeq++
    }
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
  {
    id: 'new-deadline',
    name: t.deadlineTaskTemplate,
    start: new Date(),
    end: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    style: 'background-color: #06b6d4;',
  },
  {
    id: 'new-milestone',
    name: t.milestoneTemplate,
    type: 'milestone',
    start: new Date(),
    end: new Date(),
    style: 'background-color: #f59e0b;',
  },
]

export { chartStart }

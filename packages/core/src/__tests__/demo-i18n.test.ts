import { describe, expect, it } from 'vitest'
import { getInitialLang } from '../demo/i18n'

describe('getInitialLang (demo i18n)', () => {
  it('?lang=en の場合に en を返す', () => {
    expect(getInitialLang('?lang=en')).toBe('en')
    expect(getInitialLang('?foo=bar&lang=en&baz=1')).toBe('en')
  })

  it('?lang=ja の場合に ja を返す', () => {
    expect(getInitialLang('?lang=ja')).toBe('ja')
    expect(getInitialLang('?foo=bar&lang=ja')).toBe('ja')
  })

  it('lang パラメータが未指定の場合はデフォルト ja を返す', () => {
    expect(getInitialLang('')).toBe('ja')
    expect(getInitialLang('?')).toBe('ja')
    expect(getInitialLang('?mode=day')).toBe('ja')
  })

  it('未サポートの言語コードの場合はデフォルト ja を返す', () => {
    expect(getInitialLang('?lang=fr')).toBe('ja')
    expect(getInitialLang('?lang=zh')).toBe('ja')
    expect(getInitialLang('?lang=')).toBe('ja')
  })
})

describe('DemoTexts (collapse/expand)', () => {
  it('jaTexts と enTexts に折りたたみ・展開テキストが定義されている', async () => {
    const { jaTexts, enTexts } = await import('../demo/i18n')
    expect(jaTexts.collapseAll).toBe('折りたたみ')
    expect(jaTexts.collapseAllTitle).toBe('親行を一括折りたたみ')
    expect(jaTexts.expandAll).toBe('展開')
    expect(jaTexts.expandAllTitle).toBe('すべての行を展開')

    expect(enTexts.collapseAll).toBe('Collapse')
    expect(enTexts.collapseAllTitle).toBe('Collapse all parent rows')
    expect(enTexts.expandAll).toBe('Expand')
    expect(enTexts.expandAllTitle).toBe('Expand all rows')

    expect(jaTexts.showSummaryProgressLabel).toBe('サマリー進捗ラベル表示')
    expect(enTexts.showSummaryProgressLabel).toBe('Show Summary Progress Label')

    expect(jaTexts.zoomLevel).toBe('表示倍率:')
    expect(enTexts.zoomLevel).toBe('Zoom:')

    expect(jaTexts.resetZoom).toBe('100%に戻す')
    expect(enTexts.resetZoom).toBe('Reset 100%')

    expect(jaTexts.showQuarters).toBe('四半期ヘッダーを表示')
    expect(enTexts.showQuarters).toBe('Show Quarter Header')
    expect(jaTexts.autoExtendTimeline).toBe('期間端で自動拡張')
    expect(enTexts.autoExtendTimeline).toBe('Auto-Extend Timeline')
    expect(jaTexts.largeScaleMode).toBe('大規模データ (3年・200行)')
    expect(enTexts.largeScaleMode).toBe('Large Scale (3yr · 200 rows)')

    expect(jaTexts.sectionDeadline).toBe('デッドライン (Deadline)')
    expect(enTexts.sectionDeadline).toBe('Deadline Management')
    expect(jaTexts.enableDeadline).toBe('デッドラインを表示')
    expect(enTexts.enableDeadline).toBe('Show Deadlines')
    expect(jaTexts.deadlineTaskTemplate).toBe('期限付きタスク')
    expect(enTexts.deadlineTaskTemplate).toBe('Task with Deadline')
  })
})

describe('Demo data deadline showcase', () => {
  it('各表示モードのデモデータに期限超過・期限内・余裕ありのデッドラインが含まれている', async () => {
    const { jaTexts } = await import('../demo/i18n')
    const {
      generateDayModeData,
      generateWeekModeData,
      generateMonthModeData,
      generateHourModeData,
      generateLargeScaleData,
      generateUnassignedTasks,
    } = await import('../demo/data')
    const { calculateTaskDeadline } = await import('../core/utils')

    const dayTasks = generateDayModeData(jaTexts).flatMap((r) => r.tasks)
    const dayWithDeadline = dayTasks.filter((t) => t.deadline instanceof Date)
    expect(dayWithDeadline.length).toBeGreaterThanOrEqual(10)
    expect(dayWithDeadline.some((t) => calculateTaskDeadline(t).isOverdue)).toBe(true)
    expect(dayWithDeadline.some((t) => calculateTaskDeadline(t).remainingDays > 0)).toBe(true)
    expect(
      dayWithDeadline.some((t) => {
        const info = calculateTaskDeadline(t)
        return info.hasDeadline && !info.isOverdue && info.remainingMs === 0
      }),
    ).toBe(true)
    expect(dayWithDeadline.some((t) => t.type === 'milestone')).toBe(true)

    expect(generateWeekModeData(jaTexts).flatMap((r) => r.tasks).some((t) => t.deadline instanceof Date)).toBe(true)
    expect(generateMonthModeData(jaTexts).flatMap((r) => r.tasks).some((t) => t.deadline instanceof Date)).toBe(true)
    expect(generateHourModeData(jaTexts).flatMap((r) => r.tasks).some((t) => t.deadline instanceof Date)).toBe(true)
    expect(generateLargeScaleData(jaTexts).flatMap((r) => r.tasks).some((t) => t.deadline instanceof Date)).toBe(true)
    expect(generateUnassignedTasks(jaTexts).some((t) => t.deadline instanceof Date)).toBe(true)
  })
})


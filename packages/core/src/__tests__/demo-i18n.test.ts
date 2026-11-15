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

    // Plan 3: シナリオプリセット・セマンティックズーム・タイムライン新規作成テキスト
    expect(jaTexts.enableSemanticZoom).toContain('セマンティック')
    expect(enTexts.enableSemanticZoom).toContain('Semantic Zoom')
    expect(jaTexts.enableTaskCreation).toContain('Alt+ドラッグ')
    expect(enTexts.enableTaskCreation).toContain('Alt+Drag')
    expect(jaTexts.semanticScaleBadge('日')).toContain('日')
    expect(enTexts.semanticScaleBadge('Day')).toBe('Scale: Day')
    expect(jaTexts.presetInteractiveUx).toBeTruthy()
    expect(enTexts.presetInteractiveUx).toBeTruthy()
    expect(jaTexts.presetStandardWbs).toBeTruthy()
    expect(enTexts.presetStandardWbs).toBeTruthy()
    expect(jaTexts.presetBaselineCpm).toBeTruthy()
    expect(enTexts.presetBaselineCpm).toBeTruthy()
    expect(jaTexts.presetSpreadsheetGrid).toBeTruthy()
    expect(enTexts.presetSpreadsheetGrid).toBeTruthy()
    expect(jaTexts.presetHourlySchedule).toBeTruthy()
    expect(enTexts.presetHourlySchedule).toBeTruthy()
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

  it('SNET / FNLT スケジュール制約が確認できるデモデータが含まれ、自動スケジューリングで機能する', async () => {
    const { jaTexts, enTexts } = await import('../demo/i18n')
    const {
      generateDayModeData,
      generateWeekModeData,
      generateMonthModeData,
      generateHourModeData,
      chartStart,
    } = await import('../demo/data')
    const { propagateAutoSchedule } = await import('../core/auto-schedule')
    const { isHoliday } = await import('../demo/holidays')

    expect(jaTexts.constraintSnetRow).toContain('SNET')
    expect(enTexts.constraintSnetRow).toContain('SNET')
    expect(jaTexts.constraintFnltRow).toContain('FNLT')
    expect(enTexts.constraintFnltRow).toContain('FNLT')

    const dayRows = generateDayModeData(jaTexts)
    const dayTasks = dayRows.flatMap((r) => r.tasks)
    expect(dayTasks.some((t) => t.constraintType === 'SNET' && t.constraintDate instanceof Date)).toBe(true)
    expect(dayTasks.some((t) => t.constraintType === 'FNLT' && t.constraintDate instanceof Date)).toBe(true)

    // SNET 単体行を制約日より前へ移動した際に制約日へ押し戻されることを確認
    const snetRow = dayRows.find((r) => r.id === 'constraint-snet')!
    const snetTask = snetRow.tasks[0]
    const movedEarlyRows = dayRows.map((r) =>
      r.id === 'constraint-snet'
        ? {
            ...r,
            tasks: [
              {
                ...snetTask,
                start: new Date(chartStart),
                end: new Date(chartStart.getTime() + 3 * 24 * 60 * 60 * 1000),
              },
            ],
          }
        : r,
    )
    const snetScheduled = propagateAutoSchedule(movedEarlyRows, [snetTask.id], {
      calendarMode: 'weekends-holidays',
      isHoliday,
    })
    const updatedSnetTask = snetScheduled.rows.find((r) => r.id === 'constraint-snet')!.tasks[0]
    expect(updatedSnetTask.start.getTime()).toBe(snetTask.constraintDate!.getTime())

    // FNLT 単体行を制約日より後ろへ移動した際に制約日以内に引き戻されることを確認
    const fnltRow = dayRows.find((r) => r.id === 'constraint-fnlt')!
    const fnltTask = fnltRow.tasks[0]
    const lateStart = new Date(fnltTask.constraintDate!.getTime() + 4 * 24 * 60 * 60 * 1000)
    const lateEnd = new Date(lateStart.getTime() + (fnltTask.end.getTime() - fnltTask.start.getTime()))
    const movedLateRows = dayRows.map((r) =>
      r.id === 'constraint-fnlt'
        ? {
            ...r,
            tasks: [{ ...fnltTask, start: lateStart, end: lateEnd }],
          }
        : r,
    )
    const fnltScheduled = propagateAutoSchedule(movedLateRows, [fnltTask.id], {
      calendarMode: 'weekends-holidays',
      isHoliday,
    })
    const updatedFnltTask = fnltScheduled.rows.find((r) => r.id === 'constraint-fnlt')!.tasks[0]
    expect(updatedFnltTask.end.getTime()).toBe(fnltTask.constraintDate!.getTime())

    // 週・月・時間モードにも SNET / FNLT が含まれることを確認
    expect(generateWeekModeData(jaTexts).flatMap((r) => r.tasks).some((t) => t.constraintType === 'SNET')).toBe(true)
    expect(generateWeekModeData(jaTexts).flatMap((r) => r.tasks).some((t) => t.constraintType === 'FNLT')).toBe(true)
    expect(generateMonthModeData(jaTexts).flatMap((r) => r.tasks).some((t) => t.constraintType === 'SNET')).toBe(true)
    expect(generateMonthModeData(jaTexts).flatMap((r) => r.tasks).some((t) => t.constraintType === 'FNLT')).toBe(true)
    expect(generateHourModeData(jaTexts).flatMap((r) => r.tasks).some((t) => t.constraintType === 'SNET')).toBe(true)
    expect(generateHourModeData(jaTexts).flatMap((r) => r.tasks).some((t) => t.constraintType === 'FNLT')).toBe(true)
  })
})


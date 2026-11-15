import { describe, it, expect, vi, afterEach } from 'vitest'
import '../components/gantt-chart'
import type { GanttChartElement } from '../components/gantt-chart'
import { enLocale } from '../core/i18n'

vi.stubGlobal(
  'ResizeObserver',
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
)

describe('WAI-ARIA Accessibility (B-5)', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.clearAllMocks()
  })

  it('gantt-chart, gantt-calendar, gantt-row, gantt-bar に適切な WAI-ARIA ロールと属性が付与される', async () => {
    const el = document.createElement('gantt-chart') as GanttChartElement
    el.rows = [
      {
        id: 'parent-1',
        name: 'Phase 1',
        tasks: [],
      },
      {
        id: 'child-1',
        parentId: 'parent-1',
        name: 'Design UI',
        tasks: [
          {
            id: 'task-1',
            name: 'Wireframe',
            start: new Date(2026, 3, 2),
            end: new Date(2026, 3, 6),
            progress: 60,
          },
        ],
      },
    ]
    el.option = {
      locale: enLocale,
      calendar: {
        start: new Date(2026, 3, 1),
        end: new Date(2026, 3, 30),
        pxPerDay: 40,
      },
      tree: {
        enabled: true,
        autoSummary: true,
      },
      grid: {
        columns: [
          { id: 'name', title: 'Task Name', field: 'name', width: 180, sortable: true },
          { id: 'progress', title: 'Progress', field: 'task.progress', width: 90, sortable: true },
        ],
      },
    }

    document.body.appendChild(el)
    await el.updateComplete

    // 1. gantt-chart ホスト属性
    expect(el.getAttribute('role')).toBe('treegrid')
    expect(el.getAttribute('aria-multiselectable')).toBe('true')
    expect(el.getAttribute('aria-label')).toBe('Gantt Chart')
    expect(el.getAttribute('aria-rowcount')).toBe('3') // ヘッダー1 + 表示行2
    expect(el.getAttribute('aria-colcount')).toBe('3') // グリッド2列 + タイムライン1列

    // 2. gantt-calendar 列ヘッダーと aria-sort
    const calendarEl = el.shadowRoot?.querySelector('gantt-calendar')
    await (calendarEl as any)?.updateComplete
    const headerCells = calendarEl?.shadowRoot?.querySelectorAll('.grid-header-cell')
    expect(headerCells?.length).toBe(2)
    expect(headerCells?.[0].getAttribute('role')).toBe('columnheader')
    expect(headerCells?.[0].getAttribute('aria-colindex')).toBe('1')
    expect(headerCells?.[0].getAttribute('aria-sort')).toBe('none')

    // ヘッダークリックで昇順ソート -> aria-sort="ascending"
    ;(headerCells?.[0] as HTMLElement).click()
    await el.updateComplete
    await (calendarEl as any)?.updateComplete
    const updatedHeaderCell = calendarEl?.shadowRoot?.querySelectorAll('.grid-header-cell')?.[0]
    expect(updatedHeaderCell?.getAttribute('aria-sort')).toBe('ascending')

    // 3. gantt-row の階層属性・トグルボタン・セル属性
    const rowEls = el.shadowRoot?.querySelectorAll('gantt-row')
    expect(rowEls?.length).toBe(2)
    const parentRowEl = rowEls?.[0] as any
    const childRowEl = rowEls?.[1] as any
    await parentRowEl?.updateComplete
    await childRowEl?.updateComplete

    const parentContainer = parentRowEl.shadowRoot?.querySelector('.row-container')
    expect(parentContainer?.getAttribute('role')).toBe('row')
    expect(parentContainer?.getAttribute('aria-level')).toBe('1')
    expect(parentContainer?.getAttribute('aria-expanded')).toBe('true')
    expect(parentContainer?.getAttribute('aria-selected')).toBe('false')

    const toggleBtn = parentRowEl.shadowRoot?.querySelector('.tree-toggle-btn') as HTMLElement
    expect(toggleBtn?.getAttribute('role')).toBe('button')
    expect(toggleBtn?.getAttribute('aria-expanded')).toBe('true')
    expect(toggleBtn?.getAttribute('aria-label')).toContain('Collapse')

    const childContainer = childRowEl.shadowRoot?.querySelector('.row-container')
    expect(childContainer?.getAttribute('aria-level')).toBe('2')
    expect(childContainer?.hasAttribute('aria-expanded')).toBe(false) // 子を持たないリーフ行

    // 4. gantt-bar のタスクボタン属性と進捗プログレスバー属性
    const barEl = childRowEl.shadowRoot?.querySelector('gantt-bar') as any
    await barEl?.updateComplete
    const taskGroup = barEl?.shadowRoot?.querySelector('.task-group')
    expect(taskGroup?.getAttribute('role')).toBe('button')
    expect(taskGroup?.getAttribute('aria-selected')).toBe('false')
    expect(taskGroup?.getAttribute('aria-label')).toContain('Wireframe')
    expect(taskGroup?.getAttribute('aria-label')).toContain('60%')

    const progressBar = barEl?.shadowRoot?.querySelector('.progress-bar')
    expect(progressBar?.getAttribute('role')).toBe('progressbar')
    expect(progressBar?.getAttribute('aria-valuemin')).toBe('0')
    expect(progressBar?.getAttribute('aria-valuemax')).toBe('100')
    expect(progressBar?.getAttribute('aria-valuenow')).toBe('60')

    // タスク選択時に aria-selected="true" に更新されること
    el.selectTask('task-1')
    await el.updateComplete
    await childRowEl?.updateComplete
    await barEl?.updateComplete
    expect(barEl?.shadowRoot?.querySelector('.task-group')?.getAttribute('aria-selected')).toBe('true')

    // ツリー無効時はホストが role="grid" に切り替わること
    el.option = {
      ...el.option,
      tree: { enabled: false },
    }
    await el.updateComplete
    expect(el.getAttribute('role')).toBe('grid')
  })
})

import { describe, it, expect, vi, afterEach } from 'vitest'
import '../components/gantt-chart'
import type { GanttChartElement } from '../components/gantt-chart'
import type { GanttRow, GanttChartOption } from '../core/types'

// Mock ResizeObserver
vi.stubGlobal(
  'ResizeObserver',
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
)

/**
 * gantt-row の row-header-contextmenu イベントをシミュレートする。
 * jsdom 環境では Shadow DOM のイベント伝搬が不完全なため、
 * gantt-row 要素から直接カスタムイベントをディスパッチする。
 */
function simulateRowContextMenu(
  chart: GanttChartElement,
  rowId: string,
) {
  const rowElements = chart.shadowRoot?.querySelectorAll('gantt-row')
  const targetRow = Array.from(rowElements || []).find(
    (el: any) => el.row?.id === rowId,
  )
  if (!targetRow) throw new Error(`Row ${rowId} not found`)

  targetRow.dispatchEvent(
    new CustomEvent('row-header-contextmenu', {
      detail: {
        rowId,
        row: (targetRow as any).row,
        event: new MouseEvent('contextmenu', {
          bubbles: true,
          composed: true,
          button: 2,
        }),
        target: targetRow,
      },
      bubbles: true,
      composed: true,
    }),
  )
}

/**
 * gantt-row の row-clicked イベントをシミュレートする。
 */
function simulateRowClick(
  chart: GanttChartElement,
  rowId: string,
  options: { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean } = {},
) {
  const rowElements = chart.shadowRoot?.querySelectorAll('gantt-row')
  const targetRow = Array.from(rowElements || []).find(
    (el: any) => el.row?.id === rowId,
  )
  if (!targetRow) throw new Error(`Row ${rowId} not found`)

  targetRow.dispatchEvent(
    new CustomEvent('row-clicked', {
      detail: {
        rowId,
        event: new MouseEvent('click', {
          bubbles: true,
          composed: true,
          metaKey: options.metaKey ?? false,
          ctrlKey: options.ctrlKey ?? false,
          shiftKey: options.shiftKey ?? false,
        }),
      },
      bubbles: true,
      composed: true,
    }),
  )
}

describe('GanttChartElement Right Click Selection', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('selects row on header context menu', async () => {
    const rows: GanttRow[] = [
      { id: 'row1', name: 'Row 1', tasks: [] },
      { id: 'row2', name: 'Row 2', tasks: [] },
    ]
    const option: GanttChartOption = {
      calendar: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
        pxPerDay: 50,
      },
    }

    const el = document.createElement('gantt-chart') as GanttChartElement
    el.rows = rows
    el.option = option
    document.body.appendChild(el)

    await el.updateComplete

    let selectionEvent: any = null
    el.addEventListener('row-selection-change', (e: any) => {
      selectionEvent = e
    })

    // 未選択の row2 を右クリック → 選択される
    simulateRowContextMenu(el, 'row2')

    await el.updateComplete

    expect(selectionEvent).toBeTruthy()
    expect(selectionEvent.detail.selectedIds).toEqual(['row2'])
  })

  it('preserves selection when right clicking an already selected row', async () => {
    const rows: GanttRow[] = [
      { id: 'row1', name: 'Row 1', tasks: [] },
      { id: 'row2', name: 'Row 2', tasks: [] },
    ]
    const option: GanttChartOption = {
      calendar: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
        pxPerDay: 50,
      },
    }

    const el = document.createElement('gantt-chart') as GanttChartElement
    el.rows = rows
    el.option = option
    document.body.appendChild(el)
    await el.updateComplete

    const selectionHistory: string[][] = []
    el.addEventListener('row-selection-change', (e: any) => {
      selectionHistory.push(e.detail.selectedIds)
    })

    // row1 を選択
    simulateRowClick(el, 'row1')
    await el.updateComplete

    // row2 を Ctrl+クリックで追加選択
    simulateRowClick(el, 'row2', { metaKey: true })
    await el.updateComplete

    // 両方選択されていることを確認
    const lastSelection = selectionHistory[selectionHistory.length - 1] || []
    expect(lastSelection).toContain('row1')
    expect(lastSelection).toContain('row2')
    expect(lastSelection.length).toBe(2)

    const eventCountBeforeCtx = selectionHistory.length

    // 既に選択済みの row2 を右クリック → 選択は変わらないはず
    simulateRowContextMenu(el, 'row2')
    await el.updateComplete

    // 選択変更イベントは発火しないはず
    expect(selectionHistory.length).toBe(eventCountBeforeCtx)
  })

  it('updates selection on right click even if another row is selected', async () => {
    const rows: GanttRow[] = [
      { id: 'row1', name: 'Row 1', tasks: [] },
      { id: 'row2', name: 'Row 2', tasks: [] },
    ]
    const option: GanttChartOption = {
      calendar: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
        pxPerDay: 50,
      },
    }

    const el = document.createElement('gantt-chart') as GanttChartElement
    el.rows = rows
    el.option = option
    document.body.appendChild(el)
    await el.updateComplete

    // row1 を選択
    simulateRowClick(el, 'row1')
    await el.updateComplete

    let selectionEvent: any = null
    el.addEventListener('row-selection-change', (e: any) => {
      selectionEvent = e
    })

    // 未選択の row2 を右クリック → row2 が選択される
    simulateRowContextMenu(el, 'row2')
    await el.updateComplete

    expect(selectionEvent).toBeTruthy()
    expect(selectionEvent.detail.selectedIds).toEqual(['row2'])
  })
})

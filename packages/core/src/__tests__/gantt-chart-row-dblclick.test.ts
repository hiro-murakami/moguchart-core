import { describe, it, expect, vi, beforeAll } from 'vitest'
import type { GanttChartElement } from '../components/gantt-chart'
import '../components/gantt-chart'
import type { GanttChartOption, GanttRow } from '../core/types'

beforeAll(() => {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof globalThis.ResizeObserver
})

describe('gantt-chart row-header-dblclick event propagation', () => {
  it('dispatches row-header-dblclick from gantt-row through gantt-chart with contentTarget', async () => {
    const rows: GanttRow[] = [
      {
        id: 'parent-1',
        name: 'Parent Group',
        tasks: [],
      },
      {
        id: 'child-1',
        parentId: 'parent-1',
        name: 'Child Task Row',
        tasks: [],
      },
    ]

    const option: GanttChartOption = {
      calendar: {
        start: new Date('2026-04-01'),
        end: new Date('2026-04-30'),
        pxPerDay: 40,
      },
      tree: {
        enabled: true,
        indentWidth: 20,
      },
    }

    const chart = document.createElement('gantt-chart') as GanttChartElement
    chart.rows = rows
    chart.option = option
    document.body.appendChild(chart)

    await chart.updateComplete

    const spy = vi.fn()
    chart.addEventListener('row-header-dblclick', spy)

    const ganttRows = chart.shadowRoot?.querySelectorAll('gantt-row')
    expect(ganttRows?.length).toBe(2)
    const childRowEl = ganttRows?.[1]
    expect(childRowEl).toBeTruthy()
    await (childRowEl as any).updateComplete

    const rowHeader = childRowEl?.shadowRoot?.querySelector('.row-header') as HTMLElement
    expect(rowHeader).toBeTruthy()

    const contentEl = childRowEl?.shadowRoot?.querySelector('.row-header-content') as HTMLElement
    expect(contentEl).toBeTruthy()

    // インデントスペーサーが存在することを確認
    const indentSpacer = childRowEl?.shadowRoot?.querySelector('.tree-indent-spacer') as HTMLElement
    expect(indentSpacer).toBeTruthy()

    rowHeader.dispatchEvent(
      new MouseEvent('dblclick', {
        bubbles: true,
        composed: true,
        shiftKey: true,
      }),
    )

    expect(spy).toHaveBeenCalledTimes(1)
    const event = spy.mock.calls[0][0] as CustomEvent
    expect(event.detail.rowId).toBe('child-1')
    expect(event.detail.row.name).toBe('Child Task Row')
    expect(event.detail.event.shiftKey).toBe(true)
    expect(event.detail.target).toBe(rowHeader)
    expect(event.detail.contentTarget).toBe(contentEl)
  })
})

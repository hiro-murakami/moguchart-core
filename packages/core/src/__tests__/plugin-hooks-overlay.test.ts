import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { html } from 'lit'
import { GanttChartElement } from '../components/gantt-chart'
import '../components/gantt-chart'
import type { GanttPlugin } from '../core/plugin'
import type { GanttViewportState } from '../core/types'

const matchMediaMock = vi.fn()
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: matchMediaMock,
})

globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('Plugin Lifecycle Hooks & Overlay Rendering Slot', () => {
  let chart: GanttChartElement

  beforeEach(async () => {
    matchMediaMock.mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })

    chart = new GanttChartElement()
    chart.option = {
      calendar: {
        start: new Date('2026-01-01T00:00:00'),
        end: new Date('2026-01-31T23:59:59'),
        pxPerDay: 50,
      },
      grid: {
        enabled: true,
        columns: [
          { id: 'name', title: 'Name', field: 'name', editable: true, width: 140 },
        ],
      },
    }
    chart.rows = [
      {
        id: 'r1',
        name: 'Design',
        tasks: [
          {
            id: 't1',
            name: 'Design',
            start: new Date('2026-01-05T00:00:00'),
            end: new Date('2026-01-08T00:00:00'),
          },
        ],
      },
      {
        id: 'r2',
        name: 'Implement',
        tasks: [
          {
            id: 't2',
            name: 'Implement',
            start: new Date('2026-01-10T00:00:00'),
            end: new Date('2026-01-15T00:00:00'),
            dependencies: ['t1'],
          },
          {
            id: 't3',
            name: 'QA',
            start: new Date('2026-01-16T00:00:00'),
            end: new Date('2026-01-20T00:00:00'),
          },
        ],
      },
    ]
    document.body.appendChild(chart)
    await chart.updateComplete
  })

  afterEach(() => {
    if (chart && chart.parentNode) {
      chart.parentNode.removeChild(chart)
    }
    vi.clearAllMocks()
  })

  it('invokes beforeTaskUpdate and afterTaskUpdate, and blocks task update when beforeTaskUpdate returns false', async () => {
    let allowUpdate = false
    const beforeSpy = vi.fn(async () => allowUpdate)
    const afterSpy = vi.fn()

    const guardPlugin: GanttPlugin = {
      name: 'task-guard',
      hooks: {
        beforeTaskUpdate: beforeSpy,
        afterTaskUpdate: afterSpy,
      },
    }
    chart.use(guardPlugin)

    // 1. beforeTaskUpdate が false (Promise) を返す場合 → rows は更新されない
    chart.handleTaskUpdate(
      new CustomEvent('task-update', {
        detail: {
          id: 't1',
          name: 'Design',
          start: new Date('2026-01-05T00:00:00'),
          end: new Date('2026-01-08T00:00:00'),
          dx: 100, // +2日
          dy: 0,
          isDragging: false,
          mode: 'move',
        },
      }),
    )
    await Promise.resolve()
    await new Promise((resolve) => requestAnimationFrame(resolve))

    expect(beforeSpy).toHaveBeenCalledTimes(1)
    expect(afterSpy).not.toHaveBeenCalled()
    expect(chart.rows[0].tasks[0].start).toEqual(new Date('2026-01-05T00:00:00'))

    // 2. beforeTaskUpdate が true を返す場合 → rows が更新され afterTaskUpdate が呼ばれる
    allowUpdate = true
    chart.handleTaskUpdate(
      new CustomEvent('task-update', {
        detail: {
          id: 't1',
          name: 'Design',
          start: new Date('2026-01-05T00:00:00'),
          end: new Date('2026-01-08T00:00:00'),
          dx: 100, // +2日
          dy: 0,
          isDragging: false,
          mode: 'move',
        },
      }),
    )
    await Promise.resolve()
    await new Promise((resolve) => requestAnimationFrame(resolve))

    expect(beforeSpy).toHaveBeenCalledTimes(2)
    expect(afterSpy).toHaveBeenCalledTimes(1)
    expect(chart.rows[0].tasks[0].start).toEqual(new Date('2026-01-07T00:00:00'))
  })

  it('invokes dependency create/delete lifecycle hooks and supports cancellation', async () => {
    let allowDepCreate = false
    let allowDepDelete = false
    const beforeCreate = vi.fn(() => allowDepCreate)
    const afterCreate = vi.fn()
    const beforeDelete = vi.fn(() => allowDepDelete)
    const afterDelete = vi.fn()

    chart.use({
      name: 'dep-guard',
      hooks: {
        beforeDependencyCreate: beforeCreate,
        afterDependencyCreate: afterCreate,
        beforeDependencyDelete: beforeDelete,
        afterDependencyDelete: afterDelete,
      },
    })

    // 1. 削除のブロック検証
    chart.triggerDependencyDelete('t1', 't2')
    expect(beforeDelete).toHaveBeenCalledTimes(1)
    expect(afterDelete).not.toHaveBeenCalled()
    expect(chart.rows[1].tasks[0].dependencies).toEqual(['t1'])

    // 2. 削除の許可検証
    allowDepDelete = true
    chart.triggerDependencyDelete('t1', 't2')
    expect(afterDelete).toHaveBeenCalledTimes(1)
    expect(chart.rows[1].tasks[0].dependencies).toEqual([])

    // 3. 作成のブロック検証 (t2 -> t3)
    chart.connectorDrag = {
      sourceTaskId: 't2',
      sourceEndpoint: 'end',
      startX: 500,
      startY: 60,
      currentClientX: 600,
      currentClientY: 60,
      targetTaskId: 't3',
      targetEndpoint: 'start',
    }
    chart.handleConnectorDragEnd(new CustomEvent('connector-drag-end', { detail: { cancelled: false } }))
    expect(beforeCreate).toHaveBeenCalledTimes(1)
    expect(afterCreate).not.toHaveBeenCalled()
    expect(chart.rows[1].tasks[1].dependencies ?? []).toEqual([])

    // 4. 作成の許可検証
    allowDepCreate = true
    chart.connectorDrag = {
      sourceTaskId: 't2',
      sourceEndpoint: 'end',
      startX: 500,
      startY: 60,
      currentClientX: 600,
      currentClientY: 60,
      targetTaskId: 't3',
      targetEndpoint: 'start',
    }
    chart.handleConnectorDragEnd(new CustomEvent('connector-drag-end', { detail: { cancelled: false } }))
    expect(afterCreate).toHaveBeenCalledTimes(1)
    expect(chart.rows[1].tasks[1].dependencies).toEqual(['t2'])
  })

  it('invokes beforeCellEdit and afterCellEdit hooks and cancels invalid edits', async () => {
    const afterCellEdit = vi.fn()
    chart.use({
      name: 'cell-validator',
      hooks: {
        beforeCellEdit: (detail) => detail.newValue !== 'FORBIDDEN',
        afterCellEdit,
      },
    })

    const rowEl = chart.shadowRoot?.querySelector('gantt-row') as any
    await rowEl.updateComplete

    // 禁止ワードによる編集 → キャンセルされること
    rowEl.dispatchEvent(
      new CustomEvent('row-cell-edit', {
        detail: { rowId: 'r1', columnId: 'name', rawValue: 'FORBIDDEN' },
        bubbles: true,
        composed: true,
      }),
    )
    expect(chart.rows[0].name).toBe('Design')
    expect(afterCellEdit).not.toHaveBeenCalled()

    // 正常な編集 → 反映され afterCellEdit が呼ばれること
    rowEl.dispatchEvent(
      new CustomEvent('row-cell-edit', {
        detail: { rowId: 'r1', columnId: 'name', rawValue: 'Approved Design' },
        bubbles: true,
        composed: true,
      }),
    )
    expect(chart.rows[0].name).toBe('Approved Design')
    expect(afterCellEdit).toHaveBeenCalledTimes(1)
    expect(afterCellEdit.mock.calls[0][0].newValue).toBe('Approved Design')
  })

  it('notifies onViewportChange and renders custom plugin overlay layer', async () => {
    const viewportStates: GanttViewportState[] = []
    const overlayPlugin: GanttPlugin = {
      name: 'presence-overlay',
      renderOverlay: (ctx) => html`
        <div
          class="custom-presence-marker"
          data-x="${ctx.getDateX(new Date('2026-01-10T00:00:00'))}"
        >
          Alice
        </div>
      `,
      hooks: {
        onViewportChange: (vp) => viewportStates.push(vp),
      },
    }

    chart.use(overlayPlugin)
    await chart.updateComplete

    const overlayLayer = chart.shadowRoot?.querySelector('.plugin-overlay-layer')
    expect(overlayLayer).toBeTruthy()
    const marker = overlayLayer?.querySelector('.custom-presence-marker') as HTMLElement
    expect(marker).toBeTruthy()
    expect(marker.textContent?.trim()).toBe('Alice')
    expect(marker.getAttribute('data-x')).toBe('450') // 9 days * 50px

    chart.scrollToPosition({ left: 300, top: 20 })
    expect(viewportStates.length).toBeGreaterThanOrEqual(1)
    expect(viewportStates[viewportStates.length - 1].scrollLeft).toBe(300)
  })
})

import { describe, it, expect, vi } from 'vitest'
import { GanttRowElement } from '../components/gantt-row'
import type { GanttRow, GanttChartOption } from '../core/types'

describe('GanttRowElement', () => {
  it('dispatches row-clicked event', async () => {
    const row: GanttRow = {
      id: 'row1',
      name: 'Test Row',
      tasks: [],
    }
    const option: GanttChartOption = {
      calendar: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
        pxPerDay: 50,
      },
    }

    const el = document.createElement('gantt-row') as GanttRowElement
    el.row = row
    el.option = option
    document.body.appendChild(el)

    await el.updateComplete

    const header = el.shadowRoot?.querySelector('.row-header') as HTMLElement
    expect(header).toBeTruthy()

    let capturedEvent: any = null
    const spy = vi.fn((e) => {
      capturedEvent = e
    })
    // gantt-row は 'row-clicked' イベントを発火する（'row-header-click' ではない）
    el.addEventListener('row-clicked', spy)

    header.click()

    expect(spy).toHaveBeenCalled()

    // Check the target of the CustomEvent
    expect(capturedEvent.target).toBe(el)

    expect(capturedEvent.detail.rowId).toBe('row1')
  })

  it('dispatches row-header-contextmenu event on right click', async () => {
    const row: GanttRow = {
      id: 'row1',
      name: 'Test Row',
      tasks: [],
    }
    const option: GanttChartOption = {
      calendar: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
        pxPerDay: 50,
      },
    }

    const el = document.createElement('gantt-row') as GanttRowElement
    el.row = row
    el.option = option
    document.body.appendChild(el)

    await el.updateComplete

    const header = el.shadowRoot?.querySelector('.row-header') as HTMLElement
    expect(header).toBeTruthy()

    let capturedEvent: any = null
    const spy = vi.fn((e) => {
      capturedEvent = e
    })
    el.addEventListener('row-header-contextmenu', spy)

    header.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        composed: true,
        button: 2,
      }),
    )

    expect(spy).toHaveBeenCalled()
    expect(capturedEvent.detail.rowId).toBe('row1')
  })

  it('dispatches row-header-dblclick event on header double click', async () => {
    const row: GanttRow = {
      id: 'row1',
      name: 'Test Row',
      tasks: [],
    }
    const option: GanttChartOption = {
      calendar: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
        pxPerDay: 50,
      },
    }

    const el = document.createElement('gantt-row') as GanttRowElement
    el.row = row
    el.option = option
    document.body.appendChild(el)

    await el.updateComplete

    const header = el.shadowRoot?.querySelector('.row-header') as HTMLElement
    expect(header).toBeTruthy()

    const spy = vi.fn()
    el.addEventListener('row-header-dblclick', spy)

    header.dispatchEvent(
      new MouseEvent('dblclick', {
        bubbles: true,
        composed: true,
      }),
    )

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][0].detail.rowId).toBe('row1')
  })

  it('does NOT dispatch row-header-dblclick when clicking/double-clicking tree toggle icon', async () => {
    const row: GanttRow = {
      id: 'parent1',
      name: 'Parent Row',
      tasks: [],
    }
    const option: GanttChartOption = {
      calendar: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
        pxPerDay: 50,
      },
      tree: {
        enabled: true,
        showToggleIcon: true,
      },
    }

    const el = document.createElement('gantt-row') as GanttRowElement
    el.row = row
    el.option = option
    el.hasChildren = true
    document.body.appendChild(el)

    await el.updateComplete

    const toggleBtn = el.shadowRoot?.querySelector('.tree-toggle-btn') as HTMLElement
    expect(toggleBtn).toBeTruthy()

    const dblClickSpy = vi.fn()
    const toggleSpy = vi.fn()
    el.addEventListener('row-header-dblclick', dblClickSpy)
    el.addEventListener('row-toggle-collapse', toggleSpy)

    // ダブルクリックイベントを発行
    toggleBtn.dispatchEvent(
      new MouseEvent('dblclick', {
        bubbles: true,
        composed: true,
      }),
    )

    // row-header-dblclick は呼ばれないこと
    expect(dblClickSpy).not.toHaveBeenCalled()
  })

  it('does NOT have title attribute on tree toggle button (no browser tooltip)', async () => {
    const row: GanttRow = {
      id: 'parent1',
      name: 'Parent Row',
      tasks: [],
      collapsed: false,
    }
    const option: GanttChartOption = {
      calendar: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
        pxPerDay: 50,
      },
      tree: {
        enabled: true,
        showToggleIcon: true,
      },
    }

    const el = document.createElement('gantt-row') as GanttRowElement
    el.row = row
    el.option = option
    el.hasChildren = true
    document.body.appendChild(el)

    await el.updateComplete

    const toggleBtn = el.shadowRoot?.querySelector('.tree-toggle-btn') as HTMLElement
    expect(toggleBtn).toBeTruthy()
    expect(toggleBtn.getAttribute('title')).toBeNull()
  })

  it('does NOT display rowHeaderTooltip when hovering over tree toggle icon', async () => {
    vi.useFakeTimers()
    try {
      const tooltipSpy = vi.fn((r: GanttRow) => `Tooltip for ${r.name}`)
      const row: GanttRow = {
        id: 'parent1',
        name: 'Parent Row',
        tasks: [],
      }
      const option: GanttChartOption = {
        calendar: {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-31'),
          pxPerDay: 50,
        },
        tree: {
          enabled: true,
          showToggleIcon: true,
        },
        tooltipDelay: 100,
        customRendering: {
          rowHeaderTooltip: tooltipSpy,
        },
      }

      const el = document.createElement('gantt-row') as GanttRowElement
      el.row = row
      el.option = option
      el.hasChildren = true
      document.body.appendChild(el)

      await el.updateComplete

      const toggleBtn = el.shadowRoot?.querySelector('.tree-toggle-btn') as HTMLElement
      expect(toggleBtn).toBeTruthy()

      // tree-toggle-btn から直接 mouseenter された場合
      const header = el.shadowRoot?.querySelector('.row-header') as HTMLElement
      header.dispatchEvent(
        new MouseEvent('mouseenter', {
          bubbles: false,
        }),
      )
      // イベントのtargetプロパティはdispatchEventで設定されるが、
      // toggleBtnでmouseenterも発火
      toggleBtn.dispatchEvent(
        new MouseEvent('mouseenter', {
          bubbles: false,
        }),
      )

      vi.advanceTimersByTime(200)

      expect(tooltipSpy).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('scales tree-toggle-btn and tree-toggle-spacer dimensions with --moguchart-font-scale', () => {
    const styles = GanttRowElement.styles
    const cssText = Array.isArray(styles)
      ? styles.map((s: any) => s.cssText).join('\n')
      : (styles as any).cssText

    // .tree-toggle-btn width and height should scale with --moguchart-font-scale
    expect(cssText).toMatch(
      /\.tree-toggle-btn\s*\{[^}]*width:\s*calc\(16px\s*\*\s*var\(--moguchart-font-scale,\s*1\)\)/,
    )
    expect(cssText).toMatch(
      /\.tree-toggle-btn\s*\{[^}]*height:\s*calc\(16px\s*\*\s*var\(--moguchart-font-scale,\s*1\)\)/,
    )
    // .tree-toggle-spacer width and height should scale with --moguchart-font-scale
    expect(cssText).toMatch(
      /\.tree-toggle-spacer\s*\{[^}]*width:\s*calc\(16px\s*\*\s*var\(--moguchart-font-scale,\s*1\)\)/,
    )
    expect(cssText).toMatch(
      /\.tree-toggle-spacer\s*\{[^}]*height:\s*calc\(16px\s*\*\s*var\(--moguchart-font-scale,\s*1\)\)/,
    )
  })

  it('renders inline SVG icon instead of Unicode triangle character in tree-toggle-btn (prevents emoji rendering on iOS/iPadOS)', async () => {
    const baseOption: GanttChartOption = {
      calendar: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
        pxPerDay: 50,
      },
      tree: {
        enabled: true,
        showToggleIcon: true,
      },
    }

    // 1. 通常行ヘッダー表示モード
    const el = document.createElement('gantt-row') as GanttRowElement
    el.row = { id: 'parent1', name: 'Parent Row', tasks: [], collapsed: false }
    el.option = baseOption
    el.hasChildren = true
    document.body.appendChild(el)
    await el.updateComplete

    let toggleBtn = el.shadowRoot?.querySelector('.tree-toggle-btn') as HTMLElement
    expect(toggleBtn).toBeTruthy()
    expect(toggleBtn.textContent?.trim()).toBe('')
    const expandedSvg = toggleBtn.querySelector('svg.tree-toggle-icon')
    expect(expandedSvg).toBeTruthy()
    const expandedPath = expandedSvg?.querySelector('path')?.getAttribute('d')
    expect(expandedPath).toBeTruthy()

    // 折りたたみ状態に更新
    el.row = { id: 'parent1', name: 'Parent Row', tasks: [], collapsed: true }
    await el.updateComplete

    toggleBtn = el.shadowRoot?.querySelector('.tree-toggle-btn') as HTMLElement
    expect(toggleBtn.textContent?.trim()).toBe('')
    const collapsedSvg = toggleBtn.querySelector('svg.tree-toggle-icon')
    expect(collapsedSvg).toBeTruthy()
    const collapsedPath = collapsedSvg?.querySelector('path')?.getAttribute('d')
    expect(collapsedPath).toBeTruthy()
    expect(collapsedPath).not.toBe(expandedPath)

    // 2. マルチカラムグリッド表示モード
    el.option = {
      ...baseOption,
      grid: {
        enabled: true,
        columns: [{ id: 'name', label: 'タスク名', width: 200, isTreeColumn: true }],
      },
    }
    await el.updateComplete

    const gridToggleBtn = el.shadowRoot?.querySelector('.grid-cell .tree-toggle-btn') as HTMLElement
    expect(gridToggleBtn).toBeTruthy()
    expect(gridToggleBtn.textContent?.trim()).toBe('')
    expect(gridToggleBtn.querySelector('svg.tree-toggle-icon path')?.getAttribute('d')).toBe(collapsedPath)

    el.remove()
  })
})



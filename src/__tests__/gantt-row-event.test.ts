import { describe, it, expect, vi } from 'vitest'
import '../components/gantt-row'
import type { GanttRowElement } from '../components/gantt-row'
import type { GanttRow, GanttChartOption } from '@/core/types'

describe('GanttRowElement', () => {
  it('dispatches row-header-click event', async () => {
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
    el.addEventListener('row-header-click', spy)

    header.click()

    expect(spy).toHaveBeenCalled()

    // Check the target of the CustomEvent
    expect(capturedEvent.target).toBe(el)

    expect(capturedEvent.detail.target).toBe(header)
  })

  it('does not dispatch event when clicking checkbox', async () => {
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

    const checkbox = el.shadowRoot?.querySelector(
      'input[type="checkbox"]',
    ) as HTMLElement
    expect(checkbox).toBeTruthy()

    const spy = vi.fn()
    el.addEventListener('row-header-click', spy)

    checkbox.click()

    expect(spy).not.toHaveBeenCalled()
  })
})

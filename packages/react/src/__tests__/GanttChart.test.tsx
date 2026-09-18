import { describe, it, expect, vi, beforeAll } from 'vitest'
import React, { createRef } from 'react'
import { render } from '@testing-library/react'
import { GanttChart, GanttChartElement, type GanttRow, type GanttChartOption } from '../index'

beforeAll(() => {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof globalThis.ResizeObserver
})

describe('GanttChart (React Wrapper)', () => {
  const sampleRows: GanttRow[] = [
    {
      id: 'row-1',
      name: 'Task Group 1',
      tasks: [
        {
          id: 'task-1',
          name: 'First Task',
          start: new Date('2026-04-01'),
          end: new Date('2026-04-10'),
        },
      ],
    },
  ]

  const sampleOption: GanttChartOption = {
    calendar: {
      start: new Date('2026-04-01'),
      end: new Date('2026-04-30'),
      pxPerDay: 40,
    },
  }

  it('renders gantt-chart element with properties', () => {
    const { container } = render(
      <GanttChart
        rows={sampleRows}
        option={sampleOption}
        theme="dark"
      />
    )

    const el = container.querySelector('gantt-chart') as GanttChartElement | null
    expect(el).not.toBeNull()
    expect(el?.theme).toBe('dark')
    expect(el?.rows).toEqual(sampleRows)
    expect(el?.option).toEqual(sampleOption)
  })

  it('provides ref to the underlying GanttChartElement instance', () => {
    const ref = createRef<GanttChartElement>()
    render(
      <GanttChart
        ref={ref}
        rows={sampleRows}
        option={sampleOption}
      />
    )

    expect(ref.current).not.toBeNull()
    expect(ref.current?.tagName.toLowerCase()).toBe('gantt-chart')
    expect(typeof ref.current?.use).toBe('function')
  })

  it('invokes event handlers when custom events are dispatched', () => {
    const handleTaskClick = vi.fn()
    const handleTaskUpdate = vi.fn()

    const { container } = render(
      <GanttChart
        rows={sampleRows}
        option={sampleOption}
        onTaskClick={handleTaskClick}
        onTaskUpdate={handleTaskUpdate}
      />
    )

    const el = container.querySelector('gantt-chart') as GanttChartElement
    expect(el).not.toBeNull()

    // task-click イベントをディスパッチ
    const clickDetail = { task: sampleRows[0].tasks[0] }
    el.dispatchEvent(new CustomEvent('task-click', { detail: clickDetail, bubbles: true, composed: true }))

    expect(handleTaskClick).toHaveBeenCalledTimes(1)
    expect(handleTaskClick.mock.calls[0][0].detail).toEqual(clickDetail)

    // task-update イベントをディスパッチ
    const updateDetail = { ...sampleRows[0].tasks[0], name: 'Updated Name' }
    el.dispatchEvent(new CustomEvent('task-update', { detail: updateDetail, bubbles: true, composed: true }))

    expect(handleTaskUpdate).toHaveBeenCalledTimes(1)
    expect(handleTaskUpdate.mock.calls[0][0].detail).toEqual(updateDetail)
  })
})

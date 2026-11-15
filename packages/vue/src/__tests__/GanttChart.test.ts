import { describe, it, expect, vi, beforeAll } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import {
  GanttChart,
  type GanttChartInstance,
  type GanttChartElement,
  type GanttRow,
  type GanttChartOption,
} from '../index'

beforeAll(() => {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof globalThis.ResizeObserver
})

describe('GanttChart (Vue 3 Wrapper)', () => {
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

  it('renders gantt-chart element with initial props', () => {
    const wrapper = mount(GanttChart, {
      props: {
        rows: sampleRows,
        option: sampleOption,
        theme: 'dark',
      },
    })

    const el = wrapper.find('gantt-chart').element as GanttChartElement
    expect(el).toBeDefined()
    expect(el.tagName.toLowerCase()).toBe('gantt-chart')
    expect(el.theme).toBe('dark')
    expect(el.rows).toEqual(sampleRows)
    expect(el.option).toEqual(sampleOption)
  })

  it('reactively updates element properties when props change', async () => {
    const wrapper = mount(GanttChart, {
      props: {
        rows: sampleRows,
        option: sampleOption,
        theme: 'light',
      },
    })

    const el = wrapper.find('gantt-chart').element as GanttChartElement
    expect(el.theme).toBe('light')

    const newRows: GanttRow[] = [
      ...sampleRows,
      {
        id: 'row-2',
        name: 'Task Group 2',
        tasks: [],
      },
    ]

    await wrapper.setProps({
      rows: newRows,
      theme: 'dark',
    })

    expect(el.theme).toBe('dark')
    expect(el.rows).toEqual(newRows)
  })

  it('exposes underlying element and methods via component instance ref', () => {
    const wrapper = mount(GanttChart, {
      props: {
        rows: sampleRows,
        option: sampleOption,
      },
    })

    const vm = wrapper.vm as unknown as {
      element: GanttChartElement | null
      use: Function
      exportImage: Function
      zoomTo: Function
    }

    expect(vm.element).toBeDefined()
    expect(vm.element?.tagName.toLowerCase()).toBe('gantt-chart')
    expect(typeof vm.use).toBe('function')
    expect(typeof vm.exportImage).toBe('function')
    expect(typeof vm.zoomTo).toBe('function')
  })

  it('emits events when custom events are dispatched from the web component', () => {
    const wrapper = mount(GanttChart, {
      props: {
        rows: sampleRows,
        option: sampleOption,
      },
    })

    const el = wrapper.find('gantt-chart').element as GanttChartElement

    // task-click イベントをディスパッチ
    const clickDetail = { task: sampleRows[0].tasks[0] }
    el.dispatchEvent(
      new CustomEvent('task-click', {
        detail: clickDetail,
        bubbles: true,
        composed: true,
      })
    )

    expect(wrapper.emitted('task-click')).toBeTruthy()
    expect(wrapper.emitted('task-click')![0][0]).toEqual(clickDetail)

    // task-update イベントをディスパッチ
    const updateDetail = { ...sampleRows[0].tasks[0], name: 'Updated Name' }
    el.dispatchEvent(
      new CustomEvent('task-update', {
        detail: updateDetail,
        bubbles: true,
        composed: true,
      })
    )

    expect(wrapper.emitted('task-update')).toBeTruthy()
    expect(wrapper.emitted('task-update')![0][0]).toEqual(updateDetail)
  })

  it('exposes v1.10 filter and dependency methods and emits filter-change / dependency-update', () => {
    const depRows: GanttRow[] = [
      {
        id: 'row-1',
        name: 'Design',
        tasks: [
          {
            id: 'task-1',
            name: 'Design Spec',
            start: new Date('2026-04-01'),
            end: new Date('2026-04-05'),
          },
        ],
      },
      {
        id: 'row-2',
        name: 'Implementation',
        tasks: [
          {
            id: 'task-2',
            name: 'API Implementation',
            start: new Date('2026-04-06'),
            end: new Date('2026-04-10'),
            dependencies: ['task-1'],
          },
        ],
      },
    ]

    const wrapper = mount(GanttChart, {
      props: {
        rows: depRows,
        option: sampleOption,
      },
    })

    const vm = wrapper.vm as unknown as GanttChartInstance
    expect(typeof vm.setFilter).toBe('function')
    expect(typeof vm.clearFilter).toBe('function')
    expect(typeof vm.getFilter).toBe('function')
    expect(typeof vm.getFilterResult).toBe('function')
    expect(typeof vm.updateDependency).toBe('function')
    expect(typeof vm.openDependencyEditPopover).toBe('function')
    expect(typeof vm.closeDependencyEditPopover).toBe('function')

    const filterResult = vm.setFilter({ query: 'API' })
    expect(filterResult?.matchedRowCount).toBe(1)
    expect(wrapper.emitted('filter-change')).toBeTruthy()

    vm.clearFilter()
    expect(vm.getFilter()).toBeNull()

    const updated = vm.updateDependency('task-1', 'task-2', { type: 'FF', lagDays: 2 })
    expect(updated).toBe(true)
    expect(wrapper.emitted('dependency-update')).toBeTruthy()
    expect((wrapper.emitted('dependency-update')![0][0] as any).dependency).toEqual({
      taskId: 'task-1',
      type: 'FF',
      lag: 2880,
    })

    // task-create イベント転送確認
    const createDetail = {
      rowId: 'row-1',
      row: depRows[0],
      task: {
        id: 'created-vue-1',
        name: 'Created Task',
        start: new Date('2026-04-12'),
        end: new Date('2026-04-14'),
      },
      source: 'drag' as const,
    }
    const el = wrapper.find('gantt-chart').element as GanttChartElement
    el.dispatchEvent(
      new CustomEvent('task-create', {
        detail: createDetail,
        bubbles: true,
        composed: true,
      })
    )
    expect(wrapper.emitted('task-create')).toBeTruthy()
    expect(wrapper.emitted('task-create')![0][0]).toEqual(createDetail)
  })
})

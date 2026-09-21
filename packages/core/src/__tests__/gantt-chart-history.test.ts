import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GanttChartElement } from '../components/gantt-chart'
import type { GanttChartOption, GanttRow, CommandEventDetail } from '../core/types'

// Mock ResizeObserver
;(globalThis as any).ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

describe('GanttChart History (Undo/Redo)', () => {
  let chart: GanttChartElement
  let rows: GanttRow[]
  let defaultOption: GanttChartOption

  beforeEach(async () => {
    chart = new GanttChartElement()
    rows = [
      {
        id: 'row1',
        name: 'Row 1',
        tasks: [
          {
            id: 'task1',
            name: 'Task 1',
            start: new Date('2024-01-02T00:00:00'),
            end: new Date('2024-01-05T00:00:00'),
            progress: 20,
          },
        ],
      },
      {
        id: 'row2',
        name: 'Row 2',
        tasks: [
          {
            id: 'task2',
            name: 'Task 2',
            start: new Date('2024-01-07T00:00:00'),
            end: new Date('2024-01-10T00:00:00'),
            progress: 50,
          },
        ],
      },
    ]

    defaultOption = {
      calendar: {
        start: new Date('2024-01-01T00:00:00'),
        end: new Date('2024-01-31T00:00:00'),
        pxPerDay: 50,
      },
      bar: {
        height: 30,
        margin: 5,
      },
      history: {
        enabled: true,
        keyboard: true,
      },
      readOnly: false,
    }

    chart.rows = rows
    chart.option = defaultOption
    document.body.appendChild(chart)
    await chart.updateComplete
  })

  afterEach(() => {
    chart.remove()
  })

  it('初期状態では canUndo と canRedo が false であること', () => {
    expect(chart.canUndo).toBe(false)
    expect(chart.canRedo).toBe(false)
  })

  it('行の並び替え実行後に command と history-change イベントが発火し、Undo で元に戻ること', async () => {
    const commandListener = vi.fn()
    const historyChangeListener = vi.fn()
    chart.addEventListener('command', commandListener)
    chart.addEventListener('history-change', historyChangeListener)

    // row1 を row2 の下に移動
    ;(chart as any).reorderRows('row1', 'row2', 'bottom')
    await chart.updateComplete

    expect(chart.rows.map((r) => r.id)).toEqual(['row2', 'row1'])
    expect(chart.canUndo).toBe(true)
    expect(chart.canRedo).toBe(false)
    expect(commandListener).toHaveBeenCalledTimes(1)
    expect(historyChangeListener).toHaveBeenCalledTimes(1)

    const cmdDetail = (commandListener.mock.calls[0][0] as CustomEvent<CommandEventDetail>).detail
    expect(cmdDetail.command.type).toBe('row-reorder')

    // Undo 実行
    const undoSuccess = await chart.undo()
    expect(undoSuccess).toBe(true)
    await chart.updateComplete

    expect(chart.rows.map((r) => r.id)).toEqual(['row1', 'row2'])
    expect(chart.canUndo).toBe(false)
    expect(chart.canRedo).toBe(true)

    // Redo 実行
    const redoSuccess = await chart.redo()
    expect(redoSuccess).toBe(true)
    await chart.updateComplete

    expect(chart.rows.map((r) => r.id)).toEqual(['row2', 'row1'])
    expect(chart.canUndo).toBe(true)
    expect(chart.canRedo).toBe(false)
  })

  it('進捗率変更イベントを受信した際に Undo で元の進捗率に戻ること', async () => {
    // task-progress-change をシミュレート
    const progressEvent = new CustomEvent('task-progress-change', {
      detail: {
        task: chart.rows[0].tasks[0],
        progress: 80,
        originalProgress: 20,
        cancelled: false,
      },
      bubbles: true,
      composed: true,
    })
    chart.dispatchEvent(progressEvent)
    await chart.updateComplete

    expect(chart.rows[0].tasks[0].progress).toBe(80)
    expect(chart.canUndo).toBe(true)

    await chart.undo()
    await chart.updateComplete

    expect(chart.rows[0].tasks[0].progress).toBe(20)
    expect(chart.canRedo).toBe(true)

    await chart.redo()
    await chart.updateComplete

    expect(chart.rows[0].tasks[0].progress).toBe(80)
  })

  it('進捗率が未設定（undefined）のタスクでも進捗率変更後に Undo で未設定に戻り、Redo で復元されること', async () => {
    // progressが未設定のタスク
    delete chart.rows[0].tasks[0].progress
    expect(chart.rows[0].tasks[0].progress).toBeUndefined()

    const progressEvent = new CustomEvent('task-progress-change', {
      detail: {
        task: chart.rows[0].tasks[0],
        progress: 50,
        originalProgress: undefined,
        cancelled: false,
      },
      bubbles: true,
      composed: true,
    })
    chart.dispatchEvent(progressEvent)
    await chart.updateComplete

    expect(chart.rows[0].tasks[0].progress).toBe(50)
    expect(chart.canUndo).toBe(true)

    // Undo で undefined に戻る
    await chart.undo()
    await chart.updateComplete
    expect(chart.rows[0].tasks[0].progress).toBeUndefined()
    expect(chart.canRedo).toBe(true)

    // Redo で 50 に戻る
    await chart.redo()
    await chart.updateComplete
    expect(chart.rows[0].tasks[0].progress).toBe(50)
  })

  it('gantt-row / 子要素から task-progress-change がバブリングした際にコマンドが二重登録されず、1回の Undo で元に戻ること', async () => {
    chart.clearHistory()
    const rowEl = chart.shadowRoot?.querySelector('gantt-row')
    expect(rowEl).not.toBeNull()

    const initialProgress = chart.rows[0].tasks[0].progress ?? 0
    const newProgress = 75

    const progressEvent = new CustomEvent('task-progress-change', {
      detail: {
        task: chart.rows[0].tasks[0],
        progress: newProgress,
        originalProgress: initialProgress,
        cancelled: false,
      },
      bubbles: true,
      composed: true,
    })
    rowEl!.dispatchEvent(progressEvent)
    await chart.updateComplete

    expect(chart.rows[0].tasks[0].progress).toBe(newProgress)
    // 履歴マネージャーの undoCount は 1 であること（二重登録されていないこと）
    expect(chart.historyManager.state.undoCount).toBe(1)

    // 1回の Undo で元の進捗率に戻ること
    await chart.undo()
    await chart.updateComplete
    expect(chart.rows[0].tasks[0].progress).toBe(initialProgress)
    expect(chart.historyManager.state.undoCount).toBe(0)
    expect(chart.canRedo).toBe(true)
  })

  it('タスク移動後に Undo で元の開始・終了日時に戻ること', async () => {
    const originalStart = new Date(chart.rows[0].tasks[0].start)
    const originalEnd = new Date(chart.rows[0].tasks[0].end)

    const updateEvent = new CustomEvent('task-update', {
      detail: {
        id: 'task1',
        start: originalStart,
        end: originalEnd,
        dx: 100,
        dy: 0,
        isDragging: false,
        mode: 'move',
      },
    })
    ;(chart as any).handleTaskUpdate(updateEvent)

    await new Promise((r) => requestAnimationFrame(r))
    await chart.updateComplete

    expect(chart.canUndo).toBe(true)
    const movedStart = new Date(chart.rows[0].tasks[0].start)
    expect(movedStart.getTime()).not.toBe(originalStart.getTime())

    await chart.undo()
    await chart.updateComplete

    expect(chart.rows[0].tasks[0].start.getTime()).toBe(originalStart.getTime())
    expect(chart.rows[0].tasks[0].end.getTime()).toBe(originalEnd.getTime())

    await chart.redo()
    await chart.updateComplete

    expect(chart.rows[0].tasks[0].start.getTime()).toBe(movedStart.getTime())
  })

  it('キーボードショートカット Cmd+Z / Ctrl+Z で Undo、Cmd+Shift+Z / Ctrl+Y で Redo できること', async () => {
    ;(chart as any).reorderRows('row1', 'row2', 'bottom')
    await chart.updateComplete
    expect(chart.rows.map((r) => r.id)).toEqual(['row2', 'row1'])

    // Cmd+Z
    const undoEvent = new KeyboardEvent('keydown', {
      key: 'z',
      metaKey: true,
      bubbles: true,
      composed: true,
    })
    chart.dispatchEvent(undoEvent)
    await chart.updateComplete

    expect(chart.rows.map((r) => r.id)).toEqual(['row1', 'row2'])
    expect(chart.canRedo).toBe(true)

    // Cmd+Shift+Z
    const redoEvent = new KeyboardEvent('keydown', {
      key: 'z',
      metaKey: true,
      shiftKey: true,
      bubbles: true,
      composed: true,
    })
    chart.dispatchEvent(redoEvent)
    await chart.updateComplete

    expect(chart.rows.map((r) => r.id)).toEqual(['row2', 'row1'])
  })

  it('子要素でstopPropagationされる操作（進捗ハンドルドラッグ等）でもフォーカスが当たりCmd+ZでUndoできること', async () => {
    // 初期状態ではchartにフォーカスがない状態をシミュレート
    document.body.focus()
    expect(document.activeElement).not.toBe(chart)

    // stopPropagationする子要素でのpointerdownをシミュレート
    const fakeChild = document.createElement('div')
    chart.appendChild(fakeChild)
    fakeChild.addEventListener('pointerdown', (e) => {
      e.stopPropagation()
    })

    const pointerDownEvent = new PointerEvent('pointerdown', {
      bubbles: true,
      composed: true,
    })
    fakeChild.dispatchEvent(pointerDownEvent)

    // キャプチャフェーズによりチャートにフォーカスが当たること
    expect(document.activeElement).toBe(chart)

    // 進捗変更を実行
    const progressEvent = new CustomEvent('task-progress-change', {
      detail: {
        task: chart.rows[0].tasks[0],
        progress: 90,
        originalProgress: 20,
        cancelled: false,
      },
      bubbles: true,
      composed: true,
    })
    chart.dispatchEvent(progressEvent)
    await chart.updateComplete
    expect(chart.rows[0].tasks[0].progress).toBe(90)

    // チャートにフォーカスがある状態でCmd+Zを押下
    const undoEvent = new KeyboardEvent('keydown', {
      key: 'z',
      metaKey: true,
      bubbles: true,
      composed: true,
    })
    chart.dispatchEvent(undoEvent)
    await chart.updateComplete

    // 元の進捗率に戻ること
    expect(chart.rows[0].tasks[0].progress).toBe(20)

    // Cmd+Shift+Z
    const redoEvent = new KeyboardEvent('keydown', {
      key: 'z',
      metaKey: true,
      shiftKey: true,
      bubbles: true,
      composed: true,
    })
    chart.dispatchEvent(redoEvent)
    await chart.updateComplete

    expect(chart.rows[0].tasks[0].progress).toBe(90)
  })

  it('recordCommand を使って外部コマンドを登録し、Undo/Redo できること', async () => {
    let customVal = 'after'
    chart.recordCommand({
      id: 'custom-1',
      type: 'custom',
      description: 'カスタム外部操作',
      timestamp: Date.now(),
      before: 'before',
      after: 'after',
      undo: () => {
        customVal = 'before'
      },
      redo: () => {
        customVal = 'after'
      },
    })

    expect(chart.canUndo).toBe(true)

    await chart.undo()
    expect(customVal).toBe('before')

    await chart.redo()
    expect(customVal).toBe('after')
  })

  it('option.history.onUndo で false を返した場合は Undo がキャンセルされること', async () => {
    const onUndo = vi.fn().mockResolvedValue(false)
    chart.option = {
      ...defaultOption,
      history: {
        enabled: true,
        onUndo,
      },
    }
    await chart.updateComplete

    ;(chart as any).reorderRows('row1', 'row2', 'bottom')
    await chart.updateComplete
    expect(chart.canUndo).toBe(true)

    const undoSuccess = await chart.undo()
    expect(undoSuccess).toBe(false)
    expect(onUndo).toHaveBeenCalled()
    // 行は移動したまま
    expect(chart.rows.map((r) => r.id)).toEqual(['row2', 'row1'])
    expect(chart.canUndo).toBe(true)
  })

  it('接続線（依存関係）追加後に Undo で接続線が削除され、Redo で復元されること', async () => {
    // 初期状態: task2 は dependencies を持たない
    expect(chart.rows[1].tasks[0].dependencies).toBeUndefined()

    // コネクタドラッグの擬似終了
    ;(chart as any).connectorDrag = {
      sourceTaskId: 'task1',
      sourceEndpoint: 'right',
      targetTaskId: 'task2',
      targetEndpoint: 'left',
    }
    const endEvent = new CustomEvent('connector-drag-end', {
      detail: { cancelled: false },
    })
    ;(chart as any).handleConnectorDragEnd(endEvent)
    await chart.updateComplete

    // task2 の dependencies に task1 が追加されていること
    expect(chart.rows[1].tasks[0].dependencies).toEqual(['task1'])
    expect(chart.canUndo).toBe(true)

    // Undo で接続線が削除されること（元の undefined に戻る）
    await chart.undo()
    await chart.updateComplete

    expect(chart.rows[1].tasks[0].dependencies).toBeUndefined()
    expect(chart.canRedo).toBe(true)

    // Redo で接続線が再作成されること
    await chart.redo()
    await chart.updateComplete

    expect(chart.rows[1].tasks[0].dependencies).toEqual(['task1'])
  })

  it('接続線（依存関係）削除後に Undo で接続線が復元され、Redo で再削除されること', async () => {
    // task2 に依存関係を持たせる
    chart.rows = [
      chart.rows[0],
      {
        ...chart.rows[1],
        tasks: [
          {
            ...chart.rows[1].tasks[0],
            dependencies: ['task1'],
          },
        ],
      },
    ]
    await chart.updateComplete
    chart.clearHistory()
    expect(chart.rows[1].tasks[0].dependencies).toEqual(['task1'])

    // 接続線を削除
    chart.triggerDependencyDelete('task1', 'task2')
    await chart.updateComplete

    expect(chart.rows[1].tasks[0].dependencies).toEqual([])
    expect(chart.canUndo).toBe(true)

    // Undo で復元されること
    await chart.undo()
    await chart.updateComplete

    expect(chart.rows[1].tasks[0].dependencies).toEqual(['task1'])
    expect(chart.canRedo).toBe(true)

    // Redo で再削除されること
    await chart.redo()
    await chart.updateComplete

    expect(chart.rows[1].tasks[0].dependencies).toEqual([])
  })
})


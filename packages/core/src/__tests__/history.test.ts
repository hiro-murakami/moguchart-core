import { describe, it, expect, vi } from 'vitest'
import { HistoryManager, type GanttCommand } from '../core/history'

describe('HistoryManager', () => {
  const createMockCommand = (id: string, description: string): { command: GanttCommand; undoFn: any; redoFn: any } => {
    const undoFn = vi.fn()
    const redoFn = vi.fn()
    return {
      command: {
        id,
        type: 'task-move',
        description,
        timestamp: Date.now(),
        before: { val: 'before_' + id },
        after: { val: 'after_' + id },
        undo: undoFn,
        redo: redoFn,
      },
      undoFn,
      redoFn,
    }
  }

  it('初期状態では canUndo と canRedo が false であること', () => {
    const manager = new HistoryManager()
    expect(manager.canUndo).toBe(false)
    expect(manager.canRedo).toBe(false)
    expect(manager.state.undoCount).toBe(0)
    expect(manager.state.redoCount).toBe(0)
  })

  it('コマンドを実行（追加）すると canUndo が true になり、canRedo は false のままであること', () => {
    const manager = new HistoryManager()
    const { command } = createMockCommand('cmd-1', 'テスト操作1')

    manager.execute(command)

    expect(manager.canUndo).toBe(true)
    expect(manager.canRedo).toBe(false)
    expect(manager.state.undoCount).toBe(1)
    expect(manager.state.lastCommand?.id).toBe('cmd-1')
  })

  it('undo を呼び出すと command.undo() が実行され、canRedo が true になること', async () => {
    const manager = new HistoryManager()
    const { command, undoFn } = createMockCommand('cmd-1', 'テスト操作1')

    manager.execute(command)
    const success = await manager.undo()

    expect(success).toBe(true)
    expect(undoFn).toHaveBeenCalledTimes(1)
    expect(manager.canUndo).toBe(false)
    expect(manager.canRedo).toBe(true)
    expect(manager.state.undoCount).toBe(0)
    expect(manager.state.redoCount).toBe(1)
  })

  it('redo を呼び出すと command.redo() が実行され、canUndo が true に戻ること', async () => {
    const manager = new HistoryManager()
    const { command, undoFn, redoFn } = createMockCommand('cmd-1', 'テスト操作1')

    manager.execute(command)
    await manager.undo()
    const success = await manager.redo()

    expect(success).toBe(true)
    expect(undoFn).toHaveBeenCalledTimes(1)
    expect(redoFn).toHaveBeenCalledTimes(1)
    expect(manager.canUndo).toBe(true)
    expect(manager.canRedo).toBe(false)
  })

  it('Undo 後に新しい操作を実行すると Redo スタックがクリアされること', async () => {
    const manager = new HistoryManager()
    const cmd1 = createMockCommand('cmd-1', '操作1')
    const cmd2 = createMockCommand('cmd-2', '操作2')

    manager.execute(cmd1.command)
    await manager.undo()
    expect(manager.canRedo).toBe(true)

    manager.execute(cmd2.command)
    expect(manager.canRedo).toBe(false)
    expect(manager.canUndo).toBe(true)
    expect(manager.state.undoCount).toBe(1)
    expect(manager.state.lastCommand?.id).toBe('cmd-2')
  })

  it('maxDepth を超えた場合、最も古い履歴が破棄されること', () => {
    const manager = new HistoryManager({ maxDepth: 2 })
    const cmd1 = createMockCommand('cmd-1', '操作1')
    const cmd2 = createMockCommand('cmd-2', '操作2')
    const cmd3 = createMockCommand('cmd-3', '操作3')

    manager.execute(cmd1.command)
    manager.execute(cmd2.command)
    manager.execute(cmd3.command)

    expect(manager.state.undoCount).toBe(2)
    expect(manager.state.lastCommand?.id).toBe('cmd-3')
  })

  it('onUndo フックで false を返した場合は Undo がキャンセルされスタックが維持されること', async () => {
    const onUndo = vi.fn().mockReturnValue(false)
    const manager = new HistoryManager({ onUndo })
    const { command, undoFn } = createMockCommand('cmd-1', '操作1')

    manager.execute(command)
    const success = await manager.undo()

    expect(success).toBe(false)
    expect(undoFn).not.toHaveBeenCalled()
    expect(manager.canUndo).toBe(true)
    expect(manager.canRedo).toBe(false)
  })

  it('onRedo フックで false を返した場合は Redo がキャンセルされスタックが維持されること', async () => {
    const onRedo = vi.fn().mockReturnValue(false)
    const manager = new HistoryManager({ onRedo })
    const { command, redoFn } = createMockCommand('cmd-1', '操作1')

    manager.execute(command)
    await manager.undo()
    const success = await manager.redo()

    expect(success).toBe(false)
    expect(redoFn).not.toHaveBeenCalled()
    expect(manager.canUndo).toBe(false)
    expect(manager.canRedo).toBe(true)
  })

  it('非同期の onUndo / onRedo フックが正常に待機されること', async () => {
    let order: string[] = []
    const onUndo = vi.fn().mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 10))
      order.push('hook')
    })
    const undoFn = vi.fn().mockImplementation(() => {
      order.push('undo')
    })
    const manager = new HistoryManager({ onUndo })
    const { command } = createMockCommand('cmd-1', '操作1')
    command.undo = undoFn

    manager.execute(command)
    await manager.undo()

    expect(order).toEqual(['hook', 'undo'])
  })

  it('clear() を呼ぶと Undo/Redo スタックが初期化されること', async () => {
    const manager = new HistoryManager()
    const cmd1 = createMockCommand('cmd-1', '操作1')
    const cmd2 = createMockCommand('cmd-2', '操作2')

    manager.execute(cmd1.command)
    manager.execute(cmd2.command)
    await manager.undo()

    expect(manager.canUndo).toBe(true)
    expect(manager.canRedo).toBe(true)

    manager.clear()

    expect(manager.canUndo).toBe(false)
    expect(manager.canRedo).toBe(false)
  })

  it('enabled = false の場合は操作が無視されること', async () => {
    const manager = new HistoryManager({ enabled: false })
    const { command } = createMockCommand('cmd-1', '操作1')

    manager.execute(command)
    expect(manager.canUndo).toBe(false)

    const undoSuccess = await manager.undo()
    expect(undoSuccess).toBe(false)
  })

  it('状態変更時に onChange コールバックが発火すること', async () => {
    const onChange = vi.fn()
    const manager = new HistoryManager({ onChange })
    const { command } = createMockCommand('cmd-1', '操作1')

    manager.execute(command)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ canUndo: true, canRedo: false, undoCount: 1 }))

    await manager.undo()
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ canUndo: false, canRedo: true, undoCount: 0 }))
  })
})

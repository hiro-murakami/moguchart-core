import type { ReactiveController, ReactiveControllerHost } from 'lit'
import type {
  BarSelectionChangeEventDetail,
  GanttChartOption,
  GanttRow,
  GanttTaskMoveMode,
  TaskDeleteEventDetail,
} from '../../core/types'

export interface KeyboardControllerHost extends ReactiveControllerHost, HTMLElement {
  option: GanttChartOption
  rows: GanttRow[]
  displayRows: GanttRow[]
  selectedTasks: Set<string>
  selectedDependency: { sourceTaskId: string; targetTaskId: string } | null
  undo(): Promise<boolean>
  redo(): Promise<boolean>
  resetZoom(): void
  clearSelection(): void
  scrollToTask(taskId: string): void
  triggerDependencyDelete(sourceTaskId: string, targetTaskId: string, e?: Event): void
}

export class KeyboardController implements ReactiveController {
  private host: KeyboardControllerHost

  public focusedTaskId: string | null = null
  public focusedRowId: string | null = null

  constructor(host: KeyboardControllerHost) {
    this.host = host
    host.addController(this)
  }

  hostConnected(): void {}

  hostDisconnected(): void {}

  public handleKeyDown = (e: KeyboardEvent): void => {
    // キーボード操作が無効化されている場合はスキップ
    if (this.host.option?.keyboard?.enabled === false) return

    // 入力要素にフォーカスがある場合はスキップ
    const composedPath = e.composedPath()
    const target = composedPath[0] as HTMLElement
    if (target !== this.host && target?.tagName && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return

    // Undo / Redo キーボードショートカット
    if (this.host.option?.history?.keyboard !== false && this.host.option?.history?.enabled !== false) {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey
      if (isCmdOrCtrl && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          if (!this.host.option.readOnly) {
            this.host.redo()
          }
        } else {
          if (!this.host.option.readOnly) {
            this.host.undo()
          }
        }
        e.preventDefault()
        return
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 'y') {
        if (!this.host.option.readOnly) {
          this.host.redo()
        }
        e.preventDefault()
        return
      }
    }

    // ズームキーボードショートカット (Cmd/Ctrl + 0 でリセット)
    if (this.host.option?.zoom?.enabled !== false && this.host.option?.zoom?.shortcuts !== false) {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey
      if (isCmdOrCtrl && (e.key === '0' || e.key === 'Numpad0')) {
        this.host.resetZoom()
        e.preventDefault()
        return
      }
    }

    switch (e.key) {
      case 'ArrowRight':
        if (e.shiftKey && !this.host.option.readOnly) {
          this.moveSelectedTasksByKeyboard(1)
        } else {
          this.moveFocusHorizontal(1)
        }
        e.preventDefault()
        break

      case 'ArrowLeft':
        if (e.shiftKey && !this.host.option.readOnly) {
          this.moveSelectedTasksByKeyboard(-1)
        } else {
          this.moveFocusHorizontal(-1)
        }
        e.preventDefault()
        break

      case 'ArrowDown':
        this.moveFocusVertical(1)
        e.preventDefault()
        break

      case 'ArrowUp':
        this.moveFocusVertical(-1)
        e.preventDefault()
        break

      case 'Enter':
      case ' ':
        if (this.focusedTaskId) {
          if (e.ctrlKey || e.metaKey) {
            this.toggleTaskSelection(this.focusedTaskId)
          } else {
            this.selectSingleTask(this.focusedTaskId)
          }
        }
        e.preventDefault()
        break

      case 'Escape':
        this.host.clearSelection()
        this.focusedTaskId = null
        this.focusedRowId = null
        this.host.requestUpdate()
        break

      case 'Delete':
      case 'Backspace':
        if (!this.host.option.readOnly) {
          if (this.host.selectedDependency && this.host.option.dependency?.deletable !== false) {
            this.host.triggerDependencyDelete(
              this.host.selectedDependency.sourceTaskId,
              this.host.selectedDependency.targetTaskId,
              e,
            )
            e.preventDefault()
            break
          }
          if (this.host.selectedTasks.size > 0) {
            this.host.dispatchEvent(
              new CustomEvent<TaskDeleteEventDetail>('task-delete', {
                detail: {
                  taskIds: [...this.host.selectedTasks],
                  event: e,
                },
                bubbles: true,
                composed: true,
              }),
            )
          }
        }
        e.preventDefault()
        break

      case 'Home':
        this.focusFirstOrLastTaskInRow('first')
        e.preventDefault()
        break

      case 'End':
        this.focusFirstOrLastTaskInRow('last')
        e.preventDefault()
        break
    }
  }

  /**
   * 水平方向にフォーカスを移動する（同一行内のタスク間、または次/前行へ）
   */
  public moveFocusHorizontal(direction: 1 | -1): void {
    const rows = this.host.displayRows
    if (rows.length === 0) return

    // フォーカスがない場合は最初のタスクにフォーカス
    if (!this.focusedTaskId || !this.focusedRowId) {
      this.focusFirstAvailableTask()
      return
    }

    const rowIndex = rows.findIndex((r) => r.id === this.focusedRowId)
    if (rowIndex === -1) {
      this.focusFirstAvailableTask()
      return
    }

    const row = rows[rowIndex]
    const sortedTasks = [...row.tasks].sort((a, b) => a.start.getTime() - b.start.getTime())
    const taskIndex = sortedTasks.findIndex((t) => t.id === this.focusedTaskId)

    if (taskIndex === -1) {
      if (sortedTasks.length > 0) {
        this.setFocus(sortedTasks[0].id, row.id)
      }
      return
    }

    const nextIndex = taskIndex + direction
    if (nextIndex >= 0 && nextIndex < sortedTasks.length) {
      // 同一行内で移動
      this.setFocus(sortedTasks[nextIndex].id, row.id)
    } else {
      // 次/前の行に移動
      this.moveFocusVertical(direction)
    }
  }

  /**
   * 垂直方向にフォーカスを移動する（行をまたぐ）
   */
  public moveFocusVertical(direction: 1 | -1): void {
    const rows = this.host.displayRows
    if (rows.length === 0) return

    if (!this.focusedTaskId || !this.focusedRowId) {
      this.focusFirstAvailableTask()
      return
    }

    const currentRowIndex = rows.findIndex((r) => r.id === this.focusedRowId)
    if (currentRowIndex === -1) {
      this.focusFirstAvailableTask()
      return
    }

    // タスクがある行を探す
    for (let i = currentRowIndex + direction; i >= 0 && i < rows.length; i += direction) {
      const row = rows[i]
      if (row.tasks.length > 0) {
        const sortedTasks = [...row.tasks].sort((a, b) => a.start.getTime() - b.start.getTime())
        const targetTask = direction > 0 ? sortedTasks[0] : sortedTasks[sortedTasks.length - 1]
        this.setFocus(targetTask.id, row.id)
        return
      }
    }
  }

  /**
   * 最初にタスクを持つ行の最初のタスクにフォーカスする
   */
  public focusFirstAvailableTask(): void {
    for (const row of this.host.displayRows) {
      if (row.tasks.length > 0) {
        const sortedTasks = [...row.tasks].sort((a, b) => a.start.getTime() - b.start.getTime())
        this.setFocus(sortedTasks[0].id, row.id)
        return
      }
    }
  }

  /**
   * 現在の行の最初または最後のタスクにフォーカスする
   */
  public focusFirstOrLastTaskInRow(position: 'first' | 'last'): void {
    if (!this.focusedRowId) {
      this.focusFirstAvailableTask()
      return
    }

    const row = this.host.displayRows.find((r) => r.id === this.focusedRowId)
    if (!row || row.tasks.length === 0) return

    const sortedTasks = [...row.tasks].sort((a, b) => a.start.getTime() - b.start.getTime())
    const target = position === 'first' ? sortedTasks[0] : sortedTasks[sortedTasks.length - 1]
    this.setFocus(target.id, row.id)
  }

  /**
   * フォーカスを設定し、必要に応じてスクロールする
   */
  public setFocus(taskId: string, rowId: string): void {
    this.focusedTaskId = taskId
    this.focusedRowId = rowId
    this.host.scrollToTask(taskId)
    this.host.requestUpdate()
  }

  public clearFocus(): void {
    this.focusedTaskId = null
    this.focusedRowId = null
    this.host.requestUpdate()
  }

  /**
   * タスクの選択をトグルする（Ctrl/Cmd+Enter）
   */
  public toggleTaskSelection(taskId: string): void {
    const newSelectedTasks = new Set(this.host.selectedTasks)
    if (newSelectedTasks.has(taskId)) {
      newSelectedTasks.delete(taskId)
    } else {
      newSelectedTasks.add(taskId)
    }
    this.host.selectedTasks = newSelectedTasks
    this.host.requestUpdate()
    this.host.dispatchEvent(
      new CustomEvent<BarSelectionChangeEventDetail>('bar-selection-change', {
        detail: { selectedIds: [...newSelectedTasks] },
        bubbles: true,
        composed: true,
      }),
    )
  }

  /**
   * 単一タスクを選択する（Enter/Space）
   */
  public selectSingleTask(taskId: string): void {
    this.host.selectedTasks = new Set([taskId])
    this.host.requestUpdate()
    this.host.dispatchEvent(
      new CustomEvent<BarSelectionChangeEventDetail>('bar-selection-change', {
        detail: { selectedIds: [taskId] },
        bubbles: true,
        composed: true,
      }),
    )
  }

  /**
   * Shift+矢印キーで選択中タスクを移動する
   */
  public moveSelectedTasksByKeyboard(direction: 1 | -1): void {
    if (this.host.selectedTasks.size === 0) return

    const moveStep = this.host.option.keyboard?.moveStep ?? this.host.option.snapDuration ?? 1440
    const moveMs = moveStep * 60 * 1000 * direction

    const newRows = this.host.rows.map((row) => {
      const hasSelectedTask = row.tasks.some((t) => this.host.selectedTasks.has(t.id))
      if (!hasSelectedTask) return row

      return {
        ...row,
        tasks: row.tasks.map((t) => {
          if (!this.host.selectedTasks.has(t.id)) return t
          return {
            ...t,
            start: new Date(t.start.getTime() + moveMs),
            end: new Date(t.end.getTime() + moveMs),
          }
        }),
      }
    })

    // 各選択タスクについて task-update イベントを発火
    for (const row of this.host.rows) {
      for (const task of row.tasks) {
        if (!this.host.selectedTasks.has(task.id)) continue
        const newStart = new Date(task.start.getTime() + moveMs)
        const newEnd = new Date(task.end.getTime() + moveMs)
        this.host.dispatchEvent(
          new CustomEvent('task-update', {
            detail: {
              id: task.id,
              name: task.name,
              start: newStart,
              end: newEnd,
              dx: 0,
              dy: 0,
              isDragging: false,
              mode: 'move' as GanttTaskMoveMode,
              targetRowId: row.id,
            },
            bubbles: true,
            composed: true,
          }),
        )
      }
    }

    this.host.rows = newRows
    this.host.requestUpdate()
    this.host.dispatchEvent(
      new CustomEvent('rows-change', {
        detail: this.host.rows,
        bubbles: true,
        composed: true,
      }),
    )
  }
}

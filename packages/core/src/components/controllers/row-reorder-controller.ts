import type { ReactiveController, ReactiveControllerHost } from 'lit'
import type { GanttChartOption, GanttRow, GanttTask, RowReorderEventDetail } from '../../core/types'
import type { GanttCommandType } from '../../core/history'
import { canDropRow, computeChildRowIds } from '../../core/wbs'
import { xToDate } from '../../core/utils'
import type { GanttRowElement } from '../gantt-row'
import type { DragPreviewState } from './task-drag-controller'

export interface RowReorderControllerHost extends ReactiveControllerHost, HTMLElement {
  rows: GanttRow[]
  displayRows: GanttRow[]
  option: GanttChartOption
  selectedRows: Set<string>
  _collapsedRowIds: Set<string>
  externalDraggingTask?: GanttTask | null
  currentRowHeaderWidth: number
  calendarHeight: number
  effectivePxPerDay: number
  effectivePxPerMonth: number | undefined
  dragPreview?: DragPreviewState | null
  calculateLayout(): { layouts: Array<{ top: number; height: number }>; totalHeight: number }
  applyRowsChangeWithCommand(
    previousRows: GanttRow[],
    newRows: GanttRow[],
    commandInfo: { type: GanttCommandType; description: string },
  ): void
  handleExternalTaskDrop?(e: DragEvent, taskJson: string): void
}

/**
 * ガントチャートの行並び替え（ドラッグ＆ドロップ、ツリー階層・循環参照チェック、FLIPアニメーション）を管理するコントローラー
 */
export class RowReorderController implements ReactiveController {
  private host: RowReorderControllerHost

  public dragOverRowId: string | null = null
  public dragOverPosition: 'top' | 'bottom' | null = null
  public _draggingRowId: string | null = null

  constructor(host: RowReorderControllerHost) {
    this.host = host
    host.addController(this)
  }

  hostConnected(): void {}
  hostDisconnected(): void {}

  /**
   * 行の並び替えを実行する
   */
  public async reorderRows(sourceIds: string | string[], targetId: string, position: 'top' | 'bottom'): Promise<void> {
    const previousRows = this.host.rows
    const initialIds = Array.isArray(sourceIds) ? sourceIds : [sourceIds]

    // 循環参照・階層ルールガード: 移動対象自身または自身の子孫へのドロップ、親ブロック外移動は禁止
    if (!canDropRow(this.host.rows, initialIds, targetId, position)) {
      return
    }

    // ブロック連動: 親行が移動対象の場合、その配下の子孫行も一緒に移動対象に含める
    const allMovingIdsSet = new Set<string>()
    for (const id of initialIds) {
      allMovingIdsSet.add(id)
      const descendantIds = computeChildRowIds(this.host.rows, id, true)
      for (const descId of descendantIds) {
        allMovingIdsSet.add(descId)
      }
    }

    // 元の配列の順序を保った移動対象IDリスト
    const ids = this.host.rows
      .filter((r) => allMovingIdsSet.has(r.id))
      .map((r) => r.id)

    const rowElements = Array.from(this.host.shadowRoot?.querySelectorAll('gantt-row') ?? []) as GanttRowElement[]
    const positions = new Map<string, number>()
    rowElements.forEach((el) => {
      if (el.row) {
        positions.set(el.row.id, el.getBoundingClientRect().top)
      }
    })

    const newRows = [...this.host.rows]
    const movingRows: GanttRow[] = []
    const targetIndex = newRows.findIndex((r) => r.id === targetId)
    if (targetIndex === -1) return

    ids.forEach((id) => {
      const index = newRows.findIndex((r) => r.id === id)
      if (index !== -1) {
        movingRows.push(newRows[index])
      }
    })

    const filteredRows = newRows.filter((r) => !ids.includes(r.id))

    if (ids.includes(targetId)) return

    let newTargetIndex = filteredRows.findIndex((r) => r.id === targetId)

    if (position === 'bottom') {
      const targetRow = filteredRows[newTargetIndex]
      const isTargetCollapsed = targetRow && (targetRow.collapsed || this.host._collapsedRowIds.has(targetId))
      if (isTargetCollapsed) {
        // 折りたたまれた親行の下にドロップした場合、配下の全子孫行の末尾の後ろに配置する
        const descendantIds = new Set(computeChildRowIds(filteredRows, targetId, true))
        if (descendantIds.size > 0) {
          for (let i = newTargetIndex + 1; i < filteredRows.length; i++) {
            if (descendantIds.has(filteredRows[i].id)) {
              newTargetIndex = i
            }
          }
        }
      }
      newTargetIndex++
    }

    const targetRowInOrig = this.host.rows.find((r) => r.id === targetId)
    const firstParentId = movingRows[0]?.parentId ?? null

    // 新しい親IDの決定:
    // 1) ターゲットが自身の直接の親行（targetRow.id === firstParentId）の場合:
    //    - bottom: 親配下の先頭に移動（親はそのまま firstParentId）
    //    - top: 親行の前へ移動（親は targetRow.parentId）
    // 2) ターゲットがそれ以外の行の場合:
    //    - 常に targetRow.parentId が新しい親IDとなる
    const newParentId =
      firstParentId !== null && targetRowInOrig && targetRowInOrig.id === firstParentId && position === 'bottom'
        ? firstParentId
        : (targetRowInOrig?.parentId ?? null)

    // 移動した直接の対象行（initialIds）の parentId を newParentId に更新
    const updatedMovingRows = movingRows.map((row) => {
      if (initialIds.includes(row.id)) {
        if ((row.parentId ?? null) !== newParentId) {
          return { ...row, parentId: newParentId }
        }
      }
      return row
    })

    filteredRows.splice(newTargetIndex, 0, ...updatedMovingRows)

    this.host.applyRowsChangeWithCommand(previousRows, filteredRows, {
      type: 'row-reorder',
      description: '行の並び替え',
    })

    await this.host.updateComplete

    const newRowElements = Array.from(this.host.shadowRoot?.querySelectorAll('gantt-row') ?? []) as GanttRowElement[]

    newRowElements.forEach((el) => {
      if (el.row) {
        const oldTop = positions.get(el.row.id)
        if (oldTop !== undefined) {
          const newTop = el.getBoundingClientRect().top
          const dy = oldTop - newTop
          if (dy !== 0) {
            el.animate(
              [
                { transform: `translateY(${dy}px)`, zIndex: '1' },
                { transform: 'translateY(0)', zIndex: '1' },
              ],
              {
                duration: 300,
                easing: 'ease-out',
              },
            )
          }
        }
      }
    })

    this.host.dispatchEvent(
      new CustomEvent<RowReorderEventDetail>('row-reordered', {
        detail: {
          sourceId: ids[0],
          sourceIds: ids,
          targetId,
          position,
          rows: this.host.rows,
        },
        bubbles: true,
        composed: true,
      }),
    )
  }

  /**
   * 行ドラッグ開始ハンドラ
   */
  public handleRowDragStart(e: CustomEvent<{ rowId: string }>): void {
    const { rowId } = e.detail
    this._draggingRowId = rowId
    if (typeof window !== 'undefined') {
      ;(window as any).__moguchart_dragging_row_id = rowId
    }
  }

  /**
   * 行ドラッグ終了ハンドラ
   */
  public handleRowDragEnd(): void {
    this.dragOverRowId = null
    this.dragOverPosition = null
    this._draggingRowId = null
    if (typeof window !== 'undefined') {
      delete (window as any).__moguchart_dragging_row_id
    }
    this.host.requestUpdate()
  }

  /**
   * コンテナの dragover ハンドラ
   */
  public handleContainerDragOver(e: DragEvent): void {
    const isExternalTask = !!(e.dataTransfer && e.dataTransfer.types.includes('application/json'))

    if (!this.host.option.enableRowReordering && !isExternalTask) {
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'none'
      }
      return
    }

    const container = this.host.shadowRoot?.querySelector('.scroll-container') as HTMLElement
    if (!container) return

    const rect = container.getBoundingClientRect()
    const y = e.clientY - rect.top + container.scrollTop
    const yInRows = y - this.host.calendarHeight

    const { layouts } = this.host.calculateLayout()

    let foundIndex = -1
    for (let i = 0; i < layouts.length; i++) {
      const layout = layouts[i]
      if (yInRows >= layout.top && yInRows < layout.top + layout.height) {
        foundIndex = i
        break
      }
    }

    if (foundIndex !== -1) {
      const row = this.host.displayRows[foundIndex]

      if (isExternalTask) {
        e.preventDefault()
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'copy'
        }

        if (this.dragOverRowId !== row.id || this.dragOverPosition !== null) {
          this.dragOverRowId = row.id
          this.dragOverPosition = null
          this.host.requestUpdate()
        }

        // ゴースト表示の計算
        if (this.host.externalDraggingTask) {
          const labelWidth = this.host.currentRowHeaderWidth
          const scrollLeft = container.scrollLeft
          const x = e.clientX - rect.left + scrollLeft - labelWidth
          const pxPerDay = this.host.effectivePxPerDay
          const pxPerMonth = this.host.effectivePxPerMonth

          // スナップ計算
          const snapDuration = this.host.option.snapDuration ?? 1440
          const pxPerMinute = pxPerDay / (24 * 60)
          const snapPx = pxPerMinute * snapDuration
          const snappedX = Math.round(x / snapPx) * snapPx

          // 日時計算
          const currentStart = xToDate(snappedX, this.host.option.calendar.start, pxPerDay, pxPerMonth)
          const durationMs = this.host.externalDraggingTask.end.getTime() - this.host.externalDraggingTask.start.getTime()
          const currentEnd = new Date(currentStart.getTime() + durationMs)

          if (
            !this.host.dragPreview ||
            this.host.dragPreview.rowId !== row.id ||
            this.host.dragPreview.currentStart.getTime() !== currentStart.getTime()
          ) {
            this.host.dragPreview = {
              task: this.host.externalDraggingTask,
              currentStart,
              currentEnd,
              rowId: row.id,
            }
            this.host.requestUpdate()
          }
        }
      } else {
        const layout = layouts[foundIndex]
        const relativeY = yInRows - layout.top
        const position = relativeY < layout.height / 2 ? 'top' : 'bottom'

        // 行ドラッグ中の場合、移動可否をチェックして不可ならドロップインジケータを表示せず禁止マークにする
        let canDrop = true
        const draggingId =
          this._draggingRowId ||
          (typeof window !== 'undefined' ? (window as any).__moguchart_dragging_row_id : null)

        if (draggingId) {
          const sourceIds =
            this.host.selectedRows.has(draggingId) && this.host.selectedRows.size > 1
              ? Array.from(this.host.selectedRows)
              : [draggingId]
          canDrop = canDropRow(this.host.rows, sourceIds, row.id, position)
        }

        if (!canDrop) {
          if (this.dragOverRowId !== null || this.dragOverPosition !== null) {
            this.dragOverRowId = null
            this.dragOverPosition = null
            this.host.requestUpdate()
          }
          if (e.dataTransfer) {
            e.dataTransfer.dropEffect = 'none'
          }
          return
        }

        // ドロップ可能な場合のみ preventDefault() を呼び出し、dropEffect = 'move' を設定
        e.preventDefault()
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'move'
        }

        if (this.dragOverRowId !== row.id || this.dragOverPosition !== position) {
          this.dragOverRowId = row.id
          this.dragOverPosition = position
          this.host.requestUpdate()
        }
      }
    } else {
      let changed = false
      if (this.dragOverRowId !== null || this.dragOverPosition !== null || this.host.dragPreview !== null) {
        changed = true
      }
      this.dragOverRowId = null
      this.dragOverPosition = null
      if (this.host.dragPreview) {
        this.host.dragPreview = null
      }
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'none'
      }
      if (changed) {
        this.host.requestUpdate()
      }
    }
  }

  /**
   * コンテナの dragleave ハンドラ
   */
  public handleContainerDragLeave(e: DragEvent): void {
    const relatedTarget = e.relatedTarget as HTMLElement | null
    const container = this.host.shadowRoot?.querySelector('.scroll-container')
    if (!relatedTarget || !container?.contains(relatedTarget)) {
      this.dragOverRowId = null
      this.dragOverPosition = null
      if (this.host.dragPreview) {
        this.host.dragPreview = null
      }
      this.host.requestUpdate()
    }
  }

  /**
   * コンテナの drop ハンドラ
   */
  public handleContainerDrop(e: DragEvent): void {
    e.preventDefault()

    const taskJson = e.dataTransfer?.getData('application/json')
    if (taskJson) {
      if (this.host.handleExternalTaskDrop) {
        this.host.handleExternalTaskDrop(e, taskJson)
      }
      this.dragOverRowId = null
      this.dragOverPosition = null
      if (this.host.dragPreview) {
        this.host.dragPreview = null
      }
      this._draggingRowId = null
      if (typeof window !== 'undefined') {
        delete (window as any).__moguchart_dragging_row_id
      }
      this.host.requestUpdate()
      return
    }

    if (!this.host.option.enableRowReordering) return
    const sourceId = e.dataTransfer?.getData('text/plain') || this._draggingRowId
    const targetId = this.dragOverRowId
    const position = this.dragOverPosition

    this.dragOverRowId = null
    this.dragOverPosition = null
    if (this.host.dragPreview) {
      this.host.dragPreview = null
    }
    this._draggingRowId = null
    if (typeof window !== 'undefined') {
      delete (window as any).__moguchart_dragging_row_id
    }
    this.host.requestUpdate()

    if (sourceId && targetId && sourceId !== targetId && position) {
      const sourceIds =
        this.host.selectedRows.has(sourceId) && this.host.selectedRows.size > 1
          ? Array.from(this.host.selectedRows)
          : [sourceId]

      if (!canDropRow(this.host.rows, sourceIds, targetId, position)) {
        return
      }

      this.reorderRows(sourceIds, targetId, position)
    }
  }
}

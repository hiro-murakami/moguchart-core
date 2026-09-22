import type { ReactiveController, ReactiveControllerHost } from 'lit'
import type {
  GanttChartOption,
  GanttRow,
  GanttTask,
  GanttTaskMoveMode,
  TaskUpdateEventDetail,
} from '../../core/types'
import type { GanttCommandType } from '../../core/history'
import {
  TaskDragController,
  type DragOverlayInfo,
  type DragPreviewState,
  type DraggingTaskState,
  type TaskDragControllerHost,
} from './task-drag-controller'
import {
  RowReorderController,
  type RowReorderControllerHost,
} from './row-reorder-controller'

export type { DragOverlayInfo, DragPreviewState, DraggingTaskState }

export interface DragDropControllerHost
  extends ReactiveControllerHost,
    HTMLElement,
    TaskDragControllerHost,
    RowReorderControllerHost {
  rows: GanttRow[]
  displayRows: GanttRow[]
  option: GanttChartOption
  theme: 'light' | 'dark'
  selectedTasks: Set<string>
  selectedRows: Set<string>
  effectivePxPerDay: number
  effectivePxPerMonth: number | undefined
  effectiveBarHeight: number
  calendarHeight: number
  currentRowHeaderWidth: number
  externalDraggingTask: GanttTask | null
  _collapsedRowIds: Set<string>
  calculateLayout(): { layouts: Array<{ top: number; height: number }>; totalHeight: number }
  getDateX(date: Date): number
  applyRowsChangeWithCommand(
    previousRows: GanttRow[],
    newRows: GanttRow[],
    commandInfo: { type: GanttCommandType; description: string },
  ): void
  clearTooltip?(): void
}

/**
 * @deprecated 後方互換性のためのファサードコントローラー。
 * 個別には TaskDragController または RowReorderController を使用してください。
 */
export class DragDropController implements ReactiveController {
  private taskDrag: TaskDragController
  private rowReorder: RowReorderController

  constructor(host: DragDropControllerHost) {
    this.taskDrag = new TaskDragController(host)
    this.rowReorder = new RowReorderController(host)
    host.addController(this)
  }

  hostConnected(): void {}
  hostDisconnected(): void {}

  // --- TaskDragController への委譲プロパティ ---
  public get draggingTask(): DraggingTaskState | null {
    return this.taskDrag.draggingTask
  }
  public set draggingTask(val: DraggingTaskState | null) {
    this.taskDrag.draggingTask = val
  }

  public get draggingTaskIds(): string[] {
    return this.taskDrag.draggingTaskIds
  }
  public set draggingTaskIds(val: string[]) {
    this.taskDrag.draggingTaskIds = val
  }

  public get multiDragDx(): number {
    return this.taskDrag.multiDragDx
  }
  public set multiDragDx(val: number) {
    this.taskDrag.multiDragDx = val
  }

  public get multiDragDy(): number {
    return this.taskDrag.multiDragDy
  }
  public set multiDragDy(val: number) {
    this.taskDrag.multiDragDy = val
  }

  public get multiDragSameRow(): boolean {
    return this.taskDrag.multiDragSameRow
  }
  public set multiDragSameRow(val: boolean) {
    this.taskDrag.multiDragSameRow = val
  }

  public get dragTargetRowIndex(): number | null {
    return this.taskDrag.dragTargetRowIndex
  }
  public set dragTargetRowIndex(val: number | null) {
    this.taskDrag.dragTargetRowIndex = val
  }

  public get dragOverlayInfo(): DragOverlayInfo | null {
    return this.taskDrag.dragOverlayInfo
  }
  public set dragOverlayInfo(val: DragOverlayInfo | null) {
    this.taskDrag.dragOverlayInfo = val
  }

  public get dragPreview(): DragPreviewState | null {
    return this.taskDrag.dragPreview
  }
  public set dragPreview(val: DragPreviewState | null) {
    this.taskDrag.dragPreview = val
  }

  // --- RowReorderController への委譲プロパティ ---
  public get dragOverRowId(): string | null {
    return this.rowReorder.dragOverRowId
  }
  public set dragOverRowId(val: string | null) {
    this.rowReorder.dragOverRowId = val
  }

  public get dragOverPosition(): 'top' | 'bottom' | null {
    return this.rowReorder.dragOverPosition
  }
  public set dragOverPosition(val: 'top' | 'bottom' | null) {
    this.rowReorder.dragOverPosition = val
  }

  public get _draggingRowId(): string | null {
    return this.rowReorder._draggingRowId
  }
  public set _draggingRowId(val: string | null) {
    this.rowReorder._draggingRowId = val
  }

  // --- TaskDragController への委譲メソッド ---
  public isMultiDrag(taskId: string): boolean {
    return this.taskDrag.isMultiDrag(taskId)
  }

  public isMultiDragSameRow(): boolean {
    return this.taskDrag.isMultiDragSameRow()
  }

  public cleanupDragState(): void {
    this.taskDrag.cleanupDragState()
  }

  public updateDragOverlay(): void {
    this.taskDrag.updateDragOverlay()
  }

  public hideDragOverlay(): void {
    this.taskDrag.hideDragOverlay()
  }

  public handleTaskUpdate(e: CustomEvent<TaskUpdateEventDetail & { mode?: GanttTaskMoveMode }>): void {
    this.taskDrag.handleTaskUpdate(e)
  }

  public handleExternalTaskDrop(e: DragEvent, taskJson: string): void {
    this.taskDrag.handleExternalTaskDrop(e, taskJson)
  }

  // --- RowReorderController への委譲メソッド ---
  public async reorderRows(sourceIds: string | string[], targetId: string, position: 'top' | 'bottom'): Promise<void> {
    return this.rowReorder.reorderRows(sourceIds, targetId, position)
  }

  public handleRowDragStart(e: CustomEvent<{ rowId: string }>): void {
    this.rowReorder.handleRowDragStart(e)
  }

  public handleRowDragEnd(): void {
    this.rowReorder.handleRowDragEnd()
  }

  public handleContainerDragOver(e: DragEvent): void {
    this.rowReorder.handleContainerDragOver(e)
  }

  public handleContainerDragLeave(e: DragEvent): void {
    this.rowReorder.handleContainerDragLeave(e)
  }

  public handleContainerDrop(e: DragEvent): void {
    this.rowReorder.handleContainerDrop(e)
  }
}

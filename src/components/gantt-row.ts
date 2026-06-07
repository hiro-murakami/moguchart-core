import { DEFAULT_BAR_HEIGHT, DEFAULT_BAR_MARGIN, DEFAULT_ROW_HEADER_WIDTH } from '../core/constants'
import type { GanttChartOption, GanttMarker, GanttRow, GanttTask, GanttTaskMoveMode, MarkerType, RowHeaderContextMenuEventDetail } from '../core/types'
import { calculateTaskLanes, getThemeColors, dateToX } from '../core/utils'
import { LitElement, css, html, render, type PropertyValues } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { repeat } from 'lit/directives/repeat.js'
import './gantt-bar'
import './gantt-row-background'

@customElement('gantt-row')
export class GanttRowElement extends LitElement {
  @property({ type: Object }) row!: GanttRow
  @property({ type: Object }) option!: GanttChartOption
  @property({ type: Boolean }) isDragTarget = false
  @property({ type: Object }) draggingTask: {
    id: string
    start: Date
    end: Date
    name?: string
    currentStart?: Date
    currentEnd?: Date
    mode?: GanttTaskMoveMode
  } | null = null
  @property({ type: Array }) draggingTaskIds: string[] = []
  @property({ type: Number }) multiDragDx = 0
  @property({ type: Number }) multiDragDy = 0
  @property({ type: Boolean }) multiDragSameRow = false
  @property({ type: Object }) externalDragTask: {
    task: GanttTask
    currentStart: Date
    currentEnd: Date
  } | null = null
  @property({ type: String })
  theme: 'light' | 'dark' = 'light'

  @property({ type: Boolean, reflect: true })
  isSelected = false

  @property({ type: String })
  dropPosition: 'top' | 'bottom' | null = null

  @property({ type: Array })
  selectedTaskIds: string[] = []

  @property({ type: String })
  focusedTaskId: string | null = null

  @property({ type: Boolean, reflect: true })
  isExporting = false

  @property({ type: Array })
  criticalPathTaskIds: string[] = []

  // 月境界線キャッシュ（option.calendar.start/end/pxPerDay/pxPerMonth が変わらない限り再計算不要）
  private _cachedMonthGridLines: { left: number; isYearBoundary: boolean }[] | null = null
  private _cachedMonthGridStartTime = 0
  private _cachedMonthGridEndTime = 0
  private _cachedMonthGridPxPerDay = 0
  private _cachedMonthGridPxPerMonth = 0

  private getDateX(date: Date): number {
    return dateToX(date, this.option.calendar.start, this.option.calendar.pxPerDay, this.option.calendar.pxPerMonth)
  }

  /**
   * マーカーのSVGパスを生成する
   */
  private getMarkerPath(type: MarkerType, size: number): string {
    const half = size / 2
    switch (type) {
      case 'triangle-up':
        return `M 0 ${size} L ${half} 0 L ${size} ${size} Z`
      case 'triangle-down':
        return `M 0 0 L ${size} 0 L ${half} ${size} Z`
      case 'triangle-left':
        return `M ${size} 0 L 0 ${half} L ${size} ${size} Z`
      case 'triangle-right':
        return `M 0 0 L ${size} ${half} L 0 ${size} Z`
      case 'diamond':
        return `M ${half} 0 L ${size} ${half} L ${half} ${size} L 0 ${half} Z`
      case 'square':
        return `M 0 0 L ${size} 0 L ${size} ${size} L 0 ${size} Z`
      default:
        return `M 0 ${size} L ${half} 0 L ${size} ${size} Z`
    }
  }

  /**
   * マーカーの表示幅を推定する（アイコン＋ラベル）
   */
  private estimateMarkerWidth(marker: { name?: string; anchor?: string }, markerSize: number): number {
    const labelWidth = marker.name ? marker.name.length * 7 + 4 : 0 // 大まかな文字幅推定
    const isCenter = marker.anchor === 'center'
    if (isCenter) {
      // center配置: ラベルは下に出るのでアイコン幅のみ考慮
      return markerSize
    }
    return markerSize + labelWidth
  }

  /**
   * マーカーのX方向の占有範囲を計算する
   */
  private getMarkerXRange(marker: { date: Date; name?: string; anchor?: string }, markerSize: number): { left: number; right: number } {
    const x = this.getDateX(marker.date)
    const totalWidth = this.estimateMarkerWidth(marker, markerSize)
    const isCenter = marker.anchor === 'center'
    const labelOnLeft = marker.anchor === 'end'

    let left: number
    if (marker.anchor === 'start') {
      left = x
    } else if (marker.anchor === 'end') {
      left = x - markerSize
    } else {
      left = x - markerSize / 2
    }

    if (isCenter) {
      return { left, right: left + markerSize }
    }
    if (labelOnLeft) {
      const labelWidth = totalWidth - markerSize
      return { left: left - labelWidth, right: left + markerSize }
    }
    return { left, right: left + totalWidth }
  }

  /**
   * マーカー群のレーン（段）を計算して重なりを回避する
   */
  private calculateMarkerLanes(markers: GanttMarker[], markerSize: number): { marker: GanttMarker; lane: number }[] {
    if (!markers.length) return []

    // X座標でソート
    const sorted = markers.map((m) => ({
      marker: m,
      range: this.getMarkerXRange(m, markerSize),
    })).sort((a, b) => a.range.left - b.range.left)

    // 各レーンの右端を記録
    const laneEnds: number[] = []
    const result: { marker: GanttMarker; lane: number }[] = []

    for (const item of sorted) {
      let assignedLane = -1
      const GAP = 2 // マーカー間の最低間隔（px）
      for (let i = 0; i < laneEnds.length; i++) {
        if (item.range.left >= laneEnds[i] + GAP) {
          laneEnds[i] = item.range.right
          assignedLane = i
          break
        }
      }
      if (assignedLane === -1) {
        laneEnds.push(item.range.right)
        assignedLane = laneEnds.length - 1
      }
      result.push({ marker: item.marker, lane: assignedLane })
    }

    return result
  }

  static styles = css`
    :host {
      display: block;
      width: fit-content;
      min-width: 100%;
      box-sizing: border-box;
      background-color: transparent;
    }
    .row-container {
      display: flex;
      height: 100%;
      box-sizing: border-box;
      background: inherit;
      position: relative;
    }
    .row-container.drop-top::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      background-color: #3b82f6;
      z-index: 110;
      pointer-events: none;
    }
    .row-container.drop-bottom::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 2px;
      background-color: #3b82f6;
      z-index: 110;
      pointer-events: none;
    }
    .row-header {
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 0;
      flex-shrink: 0;
      box-sizing: border-box;
      position: sticky;
      left: 0;
      z-index: 100;
    }
    .row-header-content {
      flex-grow: 1;
      padding: 6px 12px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    :host([isexporting]) .row-header-content,
    :host([isexporting]) .row-header-content * {
      text-overflow: clip !important;
    }
    .bars-container {
      flex: none;
      position: relative;
    }
    .grid-background {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }
  `

  private handleDragStart(e: DragEvent) {
    // If dragging an unselected row, trigger selection
    if (!this.isSelected) {
      this.dispatchEvent(
        new CustomEvent('row-clicked', {
          detail: {
            rowId: this.row.id,
            event: e,
          },
          bubbles: true,
          composed: true,
        }),
      )
    }

    if (e.dataTransfer) {
      e.dataTransfer.setData('text/plain', this.row.id)
      e.dataTransfer.effectAllowed = 'move'

      // Use a consistent drag image for both single and multi-row dragging
      // The image will be a stack of row headers
      const colors = getThemeColors(this.theme, this.option.customTheme)
      const container = document.createElement('div')
      container.style.position = 'absolute'
      container.style.top = '-1000px'
      container.style.left = '-1000px'
      container.style.display = 'flex'
      container.style.flexDirection = 'column'
      container.style.zIndex = '9999'
      container.style.width = 'fit-content'
      // Add a small shadow and border to the container for better visibility
      container.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
      container.style.border = `1px solid ${colors.border}`
      container.style.borderRadius = '4px'
      container.style.overflow = 'hidden'

      let rowsToClone: GanttRowElement[] = []

      if (this.isSelected) {
        // Find all selected rows
        const root = this.getRootNode() as ShadowRoot | Document
        const selectedRowElements = Array.from(root.querySelectorAll('gantt-row[isselected]')) as GanttRowElement[]
        if (selectedRowElements.length > 0) {
          rowsToClone = selectedRowElements
        } else {
          rowsToClone = [this]
        }
      } else {
        rowsToClone = [this]
      }

      // Limit max rows to avoid huge drag image
      const displayRows = rowsToClone.slice(0, 10)

      displayRows.forEach((el, index) => {
        const originalHeader = el.shadowRoot?.querySelector('.row-header') as HTMLElement
        if (originalHeader) {
          const clone = originalHeader.cloneNode(true) as HTMLElement
          const compStyle = window.getComputedStyle(originalHeader)

          clone.style.width = compStyle.width
          clone.style.minWidth = compStyle.minWidth
          clone.style.height = `${el.offsetHeight}px`
          clone.style.boxSizing = compStyle.boxSizing
          clone.style.background = compStyle.backgroundColor
          clone.style.color = compStyle.color
          clone.style.fontSize = compStyle.fontSize
          clone.style.display = compStyle.display
          clone.style.alignItems = compStyle.alignItems
          clone.style.padding = compStyle.padding
          // Remove border from individual clones except maybe bottom, handled by container or loop
          clone.style.border = 'none'
          clone.style.borderBottom = index < displayRows.length - 1 ? `1px solid ${colors.border}` : 'none'
          clone.style.cursor = 'grabbing'

          // Ensure the clone has the correct content (it should from cloneNode(true))
          // But we might need to re-apply some specific styles if they rely on external classes not captured?
          // getComputedStyle covers most.

          container.appendChild(clone)
        }
      })

      // Add a badge if there are more rows than displayed
      if (rowsToClone.length > 10) {
        const badge = document.createElement('div')
        badge.style.padding = '4px 8px'
        badge.style.background = colors.bg
        badge.style.color = colors.text
        badge.style.fontSize = '11px'
        badge.style.textAlign = 'center'
        badge.textContent = `+ ${rowsToClone.length - 10} more`
        container.appendChild(badge)
      }

      document.body.appendChild(container)
      e.dataTransfer.setDragImage(container, 0, 0)

      setTimeout(() => {
        document.body.removeChild(container)
      }, 0)
    }
  }

  private handleHeaderClick(e: MouseEvent) {
    this.dispatchEvent(
      new CustomEvent('row-clicked', {
        detail: {
          rowId: this.row.id,
          event: e,
        },
        bubbles: true,
        composed: true,
      }),
    )

    // Stop propagation to prevent other potential parent handlers from firing,
    // as we are now handling selection logic centrally in gantt-chart.
    e.stopPropagation()
  }

  private handleHeaderContextMenu(e: MouseEvent) {
    e.preventDefault()
    this.dispatchEvent(
      new CustomEvent<RowHeaderContextMenuEventDetail>('row-header-contextmenu', {
        detail: {
          rowId: this.row.id,
          row: this.row,
          event: e,
          target: e.currentTarget as HTMLElement,
        },
        bubbles: true,
        composed: true,
      }),
    )
  }

  private handleHeaderDblClick(e: MouseEvent) {
    this.dispatchEvent(
      new CustomEvent('row-header-dblclick', {
        detail: {
          rowId: this.row.id,
          row: this.row,
          event: e,
          target: e.currentTarget as HTMLElement,
        },
        bubbles: true,
        composed: true,
      }),
    )
  }

  protected updated(changedProperties: PropertyValues): void {
    super.updated(changedProperties)

    // ドラッグ関連プロパティのみ変更された場合はヘッダー再描画をスキップ
    // ヘッダーの再描画は row / option が変わった時のみ必要
    const needsHeaderUpdate =
      changedProperties.has('row') ||
      changedProperties.has('option') ||
      changedProperties.has('isSelected') ||
      changedProperties.has('theme')

    if (!needsHeaderUpdate) return

    const rowHeaderContentEl = this.shadowRoot?.querySelector('.row-header-content') as HTMLElement
    if (rowHeaderContentEl) {
      const content = this.option.customRendering?.rowHeaderContent
        ? this.option.customRendering.rowHeaderContent(this.row)
        : this.row.name

      render(content, rowHeaderContentEl)
    }
  }

  render() {
    const colors = getThemeColors(this.theme, this.option.customTheme)

    let displayTasks = [...this.row.tasks]
    if (this.externalDragTask) {
      const ghostTask: GanttTask = {
        ...this.externalDragTask.task,
        start: this.externalDragTask.currentStart,
        end: this.externalDragTask.currentEnd,
        style: `${this.externalDragTask.task.style || ''}; opacity: 0.6; pointer-events: none;`,
      }
      displayTasks = [...displayTasks, ghostTask]
    }

    let tasksWithLanes, laneCount

    const originalTaskInRow = this.row.tasks.find((t) => this.draggingTask && t.id === this.draggingTask.id)

    if (this.draggingTask?.mode === 'copy' && originalTaskInRow) {
      const tasksForLaneCalc = displayTasks.filter((t) => t.id !== this.draggingTask!.id)
      tasksForLaneCalc.push({
        ...originalTaskInRow,
        id: `${originalTaskInRow.id}-static`,
        movable: 'none',
        resizable: false,
        style: `${originalTaskInRow.style || ''}; opacity: 0.5;`,
      })

      const result = calculateTaskLanes(tasksForLaneCalc)
      tasksWithLanes = result.tasksWithLanes
      laneCount = result.laneCount

      const staticTask = tasksWithLanes.find((t) => t.id === `${originalTaskInRow.id}-static`)
      if (staticTask) {
        tasksWithLanes.push({ ...originalTaskInRow, lane: staticTask.lane })
      }
    } else {
      const result = calculateTaskLanes(displayTasks)
      tasksWithLanes = result.tasksWithLanes
      laneCount = result.laneCount
    }

    const barHeight = this.option.bar?.height ?? DEFAULT_BAR_HEIGHT
    const barMargin = this.option.bar?.margin ?? DEFAULT_BAR_MARGIN

    // マーカーのレーン計算
    const markers = this.row.markers ?? []
    const markerSize = Math.min(barHeight, 12)
    const markerItemHeight = markerSize + 2 // マーカー1段あたりの高さ（余白含む）
    const markersWithLanes = this.calculateMarkerLanes(markers, markerSize)
    const markerLaneCount = markersWithLanes.length > 0
      ? Math.max(...markersWithLanes.map((m) => m.lane)) + 1
      : 0

    // タスクエリアの高さ
    const taskAreaHeight = laneCount * (barHeight + barMargin) + barMargin
    // マーカーエリアの高さ（複数段ある場合のみ追加スペース）
    const markerAreaHeight = markerLaneCount > 1
      ? (markerLaneCount - 1) * markerItemHeight
      : 0
    const rowHeight = taskAreaHeight + markerAreaHeight

    this.style.height = `${rowHeight}px`

    let backgroundStyle = ''
    let monthGridLines: { left: number; isYearBoundary: boolean }[] | null = null
    
    // Always calculate month grid lines for all views
    const startTime = this.option.calendar.start.getTime()
    const endTime = this.option.calendar.end.getTime()
    const pxPerDay = this.option.calendar.pxPerDay
    const pxPerMonth = this.option.calendar.pxPerMonth ?? 0

    if (
      !this._cachedMonthGridLines ||
      startTime !== this._cachedMonthGridStartTime ||
      endTime !== this._cachedMonthGridEndTime ||
      pxPerDay !== this._cachedMonthGridPxPerDay ||
      pxPerMonth !== this._cachedMonthGridPxPerMonth
    ) {
      this._cachedMonthGridStartTime = startTime
      this._cachedMonthGridEndTime = endTime
      this._cachedMonthGridPxPerDay = pxPerDay
      this._cachedMonthGridPxPerMonth = pxPerMonth

      const start = new Date(this.option.calendar.start)
      const startX = this.getDateX(start)
      // 月単位モードでは end が月の途中でも次の月初日まで含めるため、翌月1日の位置を上限にする
      const calEnd = this.option.calendar.end
      const calEndNextMonth = new Date(calEnd.getFullYear(), calEnd.getMonth() + 1, 1)
      const endX = this.option.calendar.pxPerMonth !== undefined
        ? this.getDateX(calEndNextMonth)
        : this.getDateX(calEnd)
      const monthBoundaries: { left: number; isYearBoundary: boolean }[] = []

      let currentMonthStart = new Date(start)
      currentMonthStart.setDate(1)
      currentMonthStart.setHours(0, 0, 0, 0)

      while (currentMonthStart <= calEndNextMonth) {
        const x = this.getDateX(currentMonthStart)
        if (x > startX && x <= endX) {
          const isYearBoundary = currentMonthStart.getMonth() === 0
          monthBoundaries.push({ left: x, isYearBoundary })
        }
        currentMonthStart.setMonth(currentMonthStart.getMonth() + 1)
      }
      this._cachedMonthGridLines = monthBoundaries
    }
    monthGridLines = this._cachedMonthGridLines

    if (this.option.calendar.showMonthsRow) {
      // no background pattern needed, just use monthGridLines
      backgroundStyle = ''
    } else if (this.option.calendar.showTime) {
      const hourWidth = this.option.calendar.pxPerDay / 24
      const snapMinutes = this.option.snapDuration ?? 60
      const snapWidth = (this.option.calendar.pxPerDay / (24 * 60)) * snapMinutes
      const dayWidth = this.option.calendar.pxPerDay
      const dayLineColor = this.option.customTheme?.showTimeDateLine ?? colors.monthGridLine ?? colors.gridLine

      // 開始時刻が0時でない場合、背景グリッドをオフセットして日区切り線位置を合わせる
      const startDate = this.option.calendar.start
      const startOffsetMs =
        startDate.getHours() * 60 * 60 * 1000 +
        startDate.getMinutes() * 60 * 1000 +
        startDate.getSeconds() * 1000
      const startOffsetPx = (startOffsetMs / (24 * 60 * 60 * 1000)) * dayWidth
      const hourOffsetPx = startOffsetPx % hourWidth
      const snapOffsetPx = startOffsetPx % snapWidth
      const dayBgPos = startOffsetPx === 0 ? '0px 0' : `${-startOffsetPx}px 0`
      const hourBgPos = hourOffsetPx === 0 ? '0px 0' : `${-hourOffsetPx}px 0`
      const snapBgPos = snapOffsetPx === 0 ? '0px 0' : `${-snapOffsetPx}px 0`

      const gradients = [
        `linear-gradient(90deg, transparent ${dayWidth - 1}px, ${dayLineColor} ${dayWidth - 1}px)`,
        `linear-gradient(90deg, transparent ${hourWidth - 1}px, ${colors.gridLine} ${hourWidth - 1}px)`,
        `linear-gradient(90deg, transparent ${snapWidth - 1}px, ${colors.subGridLine} ${snapWidth - 1}px)`,
      ]
      const sizes = [`${dayWidth}px 100%`, `${hourWidth}px 100%`, `${snapWidth}px 100%`]
      const positions = [dayBgPos, hourBgPos, snapBgPos]

      backgroundStyle = `
        background-image: ${gradients.join(', ')};
        background-size: ${sizes.join(', ')};
        background-position: ${positions.join(', ')};
      `
    } else {
      const gridWidth = this.option.calendar.pxPerDay
      // 開始時刻が0時でない場合（時間単位モードで日付単位グリッドを描画する際）のオフセット補正
      const startDate = this.option.calendar.start
      const startOffsetMs =
        startDate.getHours() * 60 * 60 * 1000 +
        startDate.getMinutes() * 60 * 1000 +
        startDate.getSeconds() * 1000
      const startOffsetPx = (startOffsetMs / (24 * 60 * 60 * 1000)) * gridWidth
      const dayBgPos = startOffsetPx === 0 ? '0px 0' : `${-startOffsetPx}px 0`
      backgroundStyle = `
        background-image: linear-gradient(90deg, transparent ${gridWidth - 1}px, ${colors.gridLine} ${gridWidth - 1}px);
        background-size: ${gridWidth}px 100%;
        background-position: ${dayBgPos};
      `
    }

    const canReorder = this.option.enableRowReordering && !this.option.readOnly

    const isHidden = this.row.visible === false

    const headerBg = this.isSelected ? colors.rowSelectedHeader : isHidden ? colors.rowHiddenBg : colors.rowHeaderBg

    // Check if it's a gradient/image or simple color
    const isHeaderGradient = headerBg.includes('gradient')
    const headerStyle = isHeaderGradient ? `background: ${headerBg};` : `background-color: ${headerBg};`

    return html`
      <style>
        :host {
          color: ${colors.text};
          background-color: ${isHidden ? colors.rowHiddenBg : 'transparent'};
        }

        .row-header {
          cursor: ${canReorder ? 'grab' : 'pointer'};
          border-right: 1px solid ${colors.border};
          border-bottom: 1px solid ${colors.border};
          box-sizing: border-box;
        }
        .row-header:active {
          cursor: ${canReorder ? 'grabbing' : 'pointer'};
        }
        .bars-container {
          border-bottom: 1px solid ${colors.border};
          box-sizing: border-box;
        }
        .hidden-row-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 5;
          pointer-events: none;
          opacity: 0.5;
        }
        .selected-row-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 1;
          pointer-events: none;
          background-color: ${colors.rowSelected};
          opacity: 0.5;
        }
      </style>
      <div class="row-container ${this.dropPosition ? `drop-${this.dropPosition}` : ''}">
        <div
          class="row-header"
          style="width: ${this.option.rowHeader?.width ?? DEFAULT_ROW_HEADER_WIDTH}px; ${headerStyle}"
          draggable="${canReorder ? 'true' : 'false'}"
          @dragstart="${canReorder ? this.handleDragStart : undefined}"
          @click="${this.handleHeaderClick}"
          @dblclick="${this.handleHeaderDblClick}"
          @contextmenu="${this.handleHeaderContextMenu}"
        >
          <div
            class="row-header-content"
            style="${this.option.customRendering?.rowHeaderContent ? 'padding: 0; height: 100%;' : ''}"
          ></div>
        </div>
        <div class="bars-container" style="width: ${(() => {
            if (this.option.calendar.pxPerMonth !== undefined) {
              const e = this.option.calendar.end
              return this.getDateX(new Date(e.getFullYear(), e.getMonth() + 1, 1))
            }
            return this.getDateX(this.option.calendar.end)
          })()}px">
          ${this.option.calendar.showRowBackground !== false && !this.option.calendar.showMonthsRow
            ? html`<gantt-row-background .option="${this.option}" .theme="${this.theme}" .rowId="${this.row.id}" /> `
            : ''}
          ${this.isSelected ? html`<div class="selected-row-overlay"></div>` : ''}
          ${backgroundStyle ? html`<div class="grid-background" style="${backgroundStyle}"></div>` : ''}
          ${monthGridLines
            ? monthGridLines.map(
                (line) => {
                  let lineColor;
                  if (line.isYearBoundary) {
                    lineColor = colors.yearGridLine || colors.monthGridLine || colors.gridLine;
                  } else {
                    const isMonthMode = this.option.calendar.showMonthsRow || (this.option.calendar.showDays === false && !this.option.calendar.showWeeks);
                    lineColor = isMonthMode ? colors.gridLine : (colors.monthGridLine || colors.gridLine);
                  }
                  return html`<div style="position: absolute; top: 0; left: ${line.left - 1}px; width: 1px; height: 100%; background-color: ${lineColor}; pointer-events: none; z-index: 1;"></div>`;
                }
              )
            : ''}
          ${isHidden ? html`<div class="hidden-row-overlay" style="background: ${colors.rowHiddenBg};"></div>` : ''}
          ${repeat(
            tasksWithLanes,
            (task) => task.id,
            (task) => {
              const isDragging = this.draggingTask?.id === task.id
              const isMultiDragging = !isDragging && this.draggingTaskIds.length >= 2 && this.draggingTaskIds.includes(task.id)
              const displayTask = isDragging
                ? {
                    ...task,
                    start: this.draggingTask!.start,
                    end: this.draggingTask!.end,
                  }
                : task
              const isTaskSelected = this.selectedTaskIds.includes(task.id)
              const barMultiDragDx = isMultiDragging ? this.multiDragDx : 0
              const barMultiDragDy = isMultiDragging ? this.multiDragDy : 0
              const isPrimaryDrag = isDragging && this.draggingTaskIds.length >= 2

              return html`
                <gantt-bar
                  .task="${displayTask}"
                  .option="${this.option}"
                  .lane="${task.lane}"
                  .selected="${isTaskSelected}"
                  .focused="${this.focusedTaskId === task.id}"
                  .multiDragDx="${barMultiDragDx}"
                  .multiDragDy="${barMultiDragDy}"
                  .multiDragActive="${isPrimaryDrag}"
                  .multiDragSameRow="${this.multiDragSameRow}"
                  .isExporting="${this.isExporting}"
                  .isCriticalPath="${this.criticalPathTaskIds.includes(task.id)}"
                />
              `
            },
          )}
          ${markersWithLanes.map(({ marker, lane: markerLane }) => {
            const x = this.getDateX(marker.date)
            const markerColor = marker.color ?? '#ef4444'
            // ラベル表示モード: 'center'の場合は下部表示、'end'は左側、それ以外は右側
            const isCenter = marker.anchor === 'center'
            // マーカーのY位置: タスクエリアの中心を基準に、レーンに応じてオフセット
            const baseY = isCenter ? (taskAreaHeight / 2 - markerSize) : (taskAreaHeight - markerSize) / 2
            const markerY = baseY + markerLane * markerItemHeight
            // anchor: 'start' → dateがマーカー左端, 'end' → dateがマーカー右端, 'center'/未指定 → 中央
            const markerLeft = marker.anchor === 'start' ? x
              : marker.anchor === 'end' ? x - markerSize
              : x - markerSize / 2
            const labelOnLeft = marker.anchor === 'end'
            return html`
              <div
                class="marker-wrapper"
                style="
                  position: absolute;
                  left: ${markerLeft}px;
                  top: ${markerY}px;
                  z-index: 2;
                  display: flex;
                  ${isCenter ? `flex-direction: column; align-items: center; width: ${markerSize}px; overflow: visible;` : `align-items: center; ${labelOnLeft ? 'flex-direction: row-reverse;' : ''}`}
                  pointer-events: auto;
                  cursor: default;
                  white-space: nowrap;
                "
                title="${marker.name ?? ''}"
              >
                <svg
                  class="marker-icon"
                  width="${markerSize}"
                  height="${markerSize}"
                  viewBox="0 0 ${markerSize} ${markerSize}"
                  style="
                    flex-shrink: 0;
                    filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
                    ${marker.style ?? ''}
                  "
                >
                  <path d="${this.getMarkerPath(marker.type, markerSize)}" fill="${markerColor}" />
                </svg>
                ${marker.name
                  ? html`<span style="
                      font-size: 10px;
                      color: ${markerColor};
                      line-height: 1;
                      ${isCenter ? 'padding: 1px 0 0 0;' : 'padding: 0 2px;'}
                    ">${marker.name}</span>`
                  : ''}
              </div>
            `
          })}
        </div>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gantt-row': GanttRowElement
  }
}

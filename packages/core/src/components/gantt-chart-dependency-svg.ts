import { svg, type SVGTemplateResult } from 'lit'
import type {
  DependencyLineStyle,
  GanttChartOption,
  GanttRow,
} from '../core/types'
import { buildOrthogonalPath } from './gantt-chart-dependency-path'
import { computeCriticalPath } from '../core/critical-path'
import { DEFAULT_BAR_MARGIN } from '../core/constants'
import type { ConnectorDragState } from './controllers/dependency-controller'

export interface DependencySvgOptions {
  taskCoords: Map<string, any>
  displayRows: GanttRow[]
  option: GanttChartOption
  effectiveBarHeight: number
  selectedDependency: { sourceTaskId: string; targetTaskId: string } | null
  connectorDrag: ConnectorDragState | null
  scrollContainer: HTMLElement | null
  calendarHeight: number
  totalHeight: number
  labelWidth: number
  colors: {
    dependencyLine: string
    [key: string]: any
  }
  getDateX(date: Date): number
  onDependencyLineClick(event: MouseEvent, targetTaskId: string, sourceTaskId: string): void
  onDependencyDelete(sourceTaskId: string, targetTaskId: string, originalEvent?: Event): void
}

/**
 * ガントチャートのタスク間依存関係線（矢印、削除ボタン、プレビュー線含む）のSVGを描画する
 */
export function renderDependencySvg(params: DependencySvgOptions): SVGTemplateResult {
  const {
    taskCoords,
    displayRows,
    option,
    effectiveBarHeight,
    selectedDependency,
    connectorDrag,
    scrollContainer,
    calendarHeight,
    totalHeight,
    labelWidth,
    colors,
    getDateX,
    onDependencyLineClick,
    onDependencyDelete,
  } = params

  const isReadOnly = option.readOnly === true
  const showArrows = option.dependency?.showArrows !== false
  const arrowSize = option.dependency?.arrowSize ?? 8
  const lineStyle: DependencyLineStyle = option.dependency?.lineStyle ?? 'orthogonal'
  const cornerRadius = option.dependency?.cornerRadius ?? 8
  const showCriticalPath = option.dependency?.showCriticalPath === true
  const criticalPathTaskIds = showCriticalPath ? computeCriticalPath(displayRows) : new Set<string>()

  const lines: SVGTemplateResult[] = []

  for (const [taskId, task] of taskCoords) {
    if (task.dependencies) {
      for (const depId of task.dependencies) {
        const depTask = taskCoords.get(depId)
        if (depTask) {
          const startX = depTask.x + depTask.width
          const startY = depTask.y + depTask.height / 2
          const endX = task.x
          const endY = task.y + task.height / 2

          // 前進方向か（ターゲットタスクが開始タスクより右側にあるか）
          const isForward = startX < endX
          // 矢印表示時は線の終端を矢印分だけ手前にする
          const rawAdjustedEndX = showArrows ? endX - arrowSize : endX
          // 前進方向の場合、パスの終端がstartXより左に行かないように制限する
          const adjustedEndX = isForward ? Math.max(startX, rawAdjustedEndX) : rawAdjustedEndX

          let pathD: string
          let hitPathD: string
          let arrowPathD: string

          const barHeight = effectiveBarHeight
          const barMargin = option.bar?.margin ?? DEFAULT_BAR_MARGIN

          const isSameRow = Math.abs(startY - endY) < 1

          if (isSameRow && isForward) {
            // 同じ行で前進方向（距離が近い場合も含む）、ループさせずに直線を引く
            pathD = adjustedEndX > startX ? `M ${startX} ${startY} L ${adjustedEndX} ${endY}` : ''
            hitPathD = endX > startX ? `M ${startX} ${startY} L ${endX} ${endY}` : ''
          } else if (lineStyle === 'orthogonal') {
            // 直角折れ線（角丸付き）
            const paths = buildOrthogonalPath(
              startX,
              startY,
              endX,
              endY,
              adjustedEndX,
              barHeight,
              barMargin,
              cornerRadius,
            )
            pathD = paths.pathD
            hitPathD = paths.hitPathD
          } else {
            // ベジェ曲線
            if (isForward) {
              // 前進方向: シンプルなベジェ曲線
              const midX = (startX + adjustedEndX) / 2
              pathD = `M ${startX} ${startY} C ${midX} ${startY} ${midX} ${endY} ${adjustedEndX} ${endY}`
              hitPathD = `M ${startX} ${startY} C ${(startX + endX) / 2} ${startY} ${(startX + endX) / 2} ${endY} ${endX} ${endY}`
            } else {
              // 後退方向: S字カーブ
              const offset = Math.max(12, (startX - endX) * 0.15)
              const midY = (startY + endY) / 2
              const effectiveMidY =
                Math.abs(startY - endY) < barHeight ? midY + barHeight + barMargin : midY

              pathD = `M ${startX} ${startY} C ${startX + offset} ${startY}, ${startX + offset} ${effectiveMidY}, ${(startX + adjustedEndX) / 2} ${effectiveMidY} S ${adjustedEndX - offset} ${endY}, ${adjustedEndX} ${endY}`
              hitPathD = `M ${startX} ${startY} C ${startX + offset} ${startY}, ${startX + offset} ${effectiveMidY}, ${(startX + endX) / 2} ${effectiveMidY} S ${endX - offset} ${endY}, ${endX} ${endY}`
            }
          }

          // 矢印用の直線パス（マーカーが正しい方向を向くように）
          arrowPathD = showArrows ? `M ${adjustedEndX} ${endY} L ${endX} ${endY}` : ''

          // 削除ボタンの表示位置（パスの中央付近）
          let btnX = (startX + adjustedEndX) / 2
          let btnY = (startY + endY) / 2
          if (isSameRow && isForward) {
            btnY = startY
          } else if (!isForward) {
            const midY = (startY + endY) / 2
            btnY = Math.abs(startY - endY) < barHeight ? midY + barHeight + barMargin : midY
          }

          const isSelected =
            selectedDependency?.sourceTaskId === depId &&
            selectedDependency?.targetTaskId === taskId
          const canDelete = !isReadOnly && option.dependency?.deletable !== false
          const showDeleteBtn = canDelete && option.dependency?.showDeleteButton !== false

          lines.push(
            svg`<g class="dependency-group ${isSelected ? 'selected' : ''}">
              ${!isReadOnly
                ? svg`<path class="dependency-hit-area" d="${hitPathD}" @click="${(e: MouseEvent) => {
                    e.stopPropagation()
                    onDependencyLineClick(e, taskId, depId)
                  }}" />`
                : ''}
              <path class="dependency-line ${showCriticalPath && criticalPathTaskIds.has(taskId) && criticalPathTaskIds.has(depId) ? 'critical-path' : ''}" d="${pathD}" />
              ${showArrows
                ? svg`<path class="dependency-line dependency-arrow-line ${showCriticalPath && criticalPathTaskIds.has(taskId) && criticalPathTaskIds.has(depId) ? 'critical-path' : ''}" d="${arrowPathD}" marker-end="url(#dependency-arrowhead)" />`
                : ''}
              ${showDeleteBtn
                ? svg`<g
                    class="dependency-delete-btn"
                    transform="translate(${btnX}, ${btnY})"
                    @pointerdown="${(e: PointerEvent) => {
                      e.stopPropagation()
                    }}"
                    @click="${(e: MouseEvent) => {
                      e.stopPropagation()
                      e.preventDefault()
                      onDependencyDelete(depId, taskId, e)
                    }}"
                  >
                    <circle class="dependency-delete-btn-hit-area" r="14" cx="0" cy="0" />
                    <circle class="dependency-delete-btn-circle" r="8" cx="0" cy="0" />
                    <line class="dependency-delete-btn-icon" x1="-3" y1="-3" x2="3" y2="3" />
                    <line class="dependency-delete-btn-icon" x1="3" y1="-3" x2="-3" y2="3" />
                  </g>`
                : ''}
            </g>`,
          )
        }
      }
    }
  }

  // コネクタードラッグ中のプレビュー線
  let connectorPreviewLine: SVGTemplateResult | null = null
  if (connectorDrag && scrollContainer) {
    const rect = scrollContainer.getBoundingClientRect()
    const srcStartX = connectorDrag.startX
    const srcStartY = connectorDrag.startY

    let endContentX: number
    let endContentY: number

    if (connectorDrag.targetTaskId && connectorDrag.targetEndpoint) {
      // ターゲットにスナップ
      const targetCoord = taskCoords.get(connectorDrag.targetTaskId)
      if (targetCoord) {
        endContentX =
          connectorDrag.targetEndpoint === 'start'
            ? targetCoord.x
            : targetCoord.x + targetCoord.width
        endContentY = targetCoord.y + targetCoord.height / 2
      } else {
        endContentX = connectorDrag.currentClientX - rect.left + scrollContainer.scrollLeft
        endContentY =
          connectorDrag.currentClientY - rect.top + scrollContainer.scrollTop - calendarHeight
      }
    } else {
      // フリー
      endContentX = connectorDrag.currentClientX - rect.left + scrollContainer.scrollLeft
      endContentY =
        connectorDrag.currentClientY - rect.top + scrollContainer.scrollTop - calendarHeight
    }

    const midPX = (srcStartX + endContentX) / 2
    connectorPreviewLine = svg`<path class="connector-preview-line" d="M ${srcStartX} ${srcStartY} C ${midPX} ${srcStartY} ${midPX} ${endContentY} ${endContentX} ${endContentY}" />`
  }

  return svg`
    <svg
      class="dependency-lines"
      style="top: 0;"
      width="${getDateX(option.calendar.end) + labelWidth}"
      height="${totalHeight + calendarHeight}"
    >
      ${showArrows
        ? svg`<defs>
            <marker
              id="dependency-arrowhead"
              markerWidth="${arrowSize}"
              markerHeight="${arrowSize}"
              refX="${arrowSize}"
              refY="${arrowSize / 2}"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <polygon
                points="0 0, ${arrowSize} ${arrowSize / 2}, 0 ${arrowSize}"
                fill="${colors.dependencyLine}"
                class="dependency-arrowhead-fill"
              />
            </marker>
          </defs>`
        : ''}
      <g transform="translate(0, ${calendarHeight})">
        ${lines}
        ${connectorPreviewLine}
      </g>
    </svg>
  `
}

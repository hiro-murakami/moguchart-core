import { html, render } from 'lit'
import '@/components/gantt-row'
import '@/components/gantt-calendar'
import type {
  GanttTask,
  GanttRow,
  TaskUpdateEventDetail,
  RenderBarContentEventDetail,
} from '@/types'
import { calculateTaskLanes } from '@/utils'

let rows: GanttRow[] = [
  {
    id: '1',
    label: '設計フェーズ',
    tasks: [
      {
        id: '1',
        name: '要件定義',
        start: new Date('2025-12-20'),
        end: new Date('2025-12-25'),
      },
      {
        id: '2',
        name: 'デザイン',
        start: new Date('2025-12-23'), // 重なりを発生させる
        end: new Date('2025-12-28'),
      },
      {
        id: '4',
        name: 'DB設計',
        start: new Date('2025-12-24'), // さらに重なりを発生させる
        end: new Date('2025-12-29'),
      },
    ],
  },
  {
    id: '2',
    label: '開発フェーズ',
    tasks: [
      {
        id: '3',
        name: '実装',
        start: new Date('2026-01-01'),
        end: new Date('2026-01-10'),
      },
    ],
  },
]

const chartStart = new Date('2025-12-15')
const pxPerDay = 28 // 共通のスケール
const totalDays = 60 // 表示する日数
const barHeight = 28
const barMargin = 4
const barCornerRadius = 4
const labelWidth = 150
let dragTargetRowIndex: number | null = null
let draggingTask: { id: string; start: Date; end: Date } | null = null
let isReadOnly = false

const renderApp = () => {
  const option = {
    chartStart,
    barHeight,
    barMargin,
    barCornerRadius,
    labelWidth,
    calendar: {
      pxPerDay,
    },
    readOnly: isReadOnly,
  }

  const template = html`
    <div style="padding: 50px; font-family: sans-serif; color: #333;">
      <h2>Moguchart 2</h2>

      <div style="margin-bottom: 16px;">
        <label>
          <input
            type="checkbox"
            .checked="${isReadOnly}"
            @change="${(e: Event) => {
              isReadOnly = (e.target as HTMLInputElement).checked
              renderApp()
            }}"
          />
          表示専用モード
        </label>
      </div>

      <div
        style="
          display: block;
          width: 100%;
          overflow-x: auto;
          border: 1px solid #e2e8f0;
          background: white;
          box-sizing: border-box;
        "
      >
        <gantt-calendar
          .option="${option}"
          .totalDays="${totalDays}"
        ></gantt-calendar>

        ${rows.map(
          (row, index) => html`
            <gantt-row
              .row="${row}"
              .option="${option}"
              .totalDays="${totalDays}"
              .isDragTarget="${dragTargetRowIndex === index}"
              .draggingTask="${draggingTask}"
              @task-update="${handleTaskUpdate}"
              @render-bar-content="${handleRenderBarContent}"
            />
          `,
        )}
      </div>
    </div>
  `
  render(template, document.getElementById('app')!)
}

// 各行の高さとYオフセットを事前に計算するヘルパー関数
function getRowLayouts() {
  let top = 0
  const layouts = rows.map((row) => {
    const { laneCount } = calculateTaskLanes(row.tasks)
    const height = laneCount * (barHeight + barMargin) + barMargin
    const layout = { top, height }
    top += height
    return layout
  })
  return layouts
}

function handleTaskUpdate(e: CustomEvent<TaskUpdateEventDetail>) {
  const { id, start, end, dy, isDragging } = e.detail

  let sourceRowIndex = -1
  let taskToMove: GanttTask | undefined
  let taskIndexInSource = -1

  rows.find((r, index) => {
    const taskI = r.tasks.findIndex((t) => t.id === id)
    if (taskI !== -1) {
      sourceRowIndex = index
      taskToMove = r.tasks[taskI]
      taskIndexInSource = taskI
      return true
    }
    return false
  })

  if (sourceRowIndex === -1 || !taskToMove) return

  const rowLayouts = getRowLayouts()
  const dragStartRowTop = rowLayouts[sourceRowIndex].top

  // タスクの初期位置（レーン）を考慮して、現在の絶対Y座標（中心）を計算
  const { tasksWithLanes } = calculateTaskLanes(rows[sourceRowIndex].tasks)
  const taskWithLane = tasksWithLanes.find((t) => t.id === id)
  const lane = taskWithLane ? taskWithLane.lane : 0
  const taskInitialY = lane * (barHeight + barMargin) + barMargin
  const currentY = dragStartRowTop + taskInitialY + dy + barHeight / 2

  let targetRowIndex = -1
  for (let i = 0; i < rowLayouts.length; i++) {
    const rowLayout = rowLayouts[i]
    if (
      currentY >= rowLayout.top &&
      currentY < rowLayout.top + rowLayout.height
    ) {
      targetRowIndex = i
      break
    }
  }

  if (isDragging) {
    draggingTask = { id, start, end }
    dragTargetRowIndex = targetRowIndex >= 0 ? targetRowIndex : null
    renderApp()
    return
  }

  // ドロップ時の処理
  draggingTask = null
  dragTargetRowIndex = null

  // 有効な別の行にドロップされた場合
  if (targetRowIndex !== -1 && sourceRowIndex !== targetRowIndex) {
    const [movedTask] = rows[sourceRowIndex].tasks.splice(taskIndexInSource, 1)
    rows[targetRowIndex].tasks.push({ ...movedTask, start, end })
  } else {
    // 同じ行内での移動（日付の更新）
    rows[sourceRowIndex].tasks[taskIndexInSource] = {
      ...taskToMove,
      start,
      end,
    }
  }

  renderApp()
}

function handleRenderBarContent(e: CustomEvent<RenderBarContentEventDetail>) {
  const { container, task } = e.detail

  // サンプル: タスクIDに基づいて擬似的な進捗率を表示
  // 実際には task.progress などのプロパティを使用してください
  const progress = (parseInt(task.id, 10) * 33) % 100

  const progressEl = document.createElement('div')
  progressEl.style.width = `${progress}%`
  progressEl.style.height = '100%'
  progressEl.style.backgroundColor = 'rgba(255, 255, 255, 0.4)'
  progressEl.style.borderRadius = 'inherit'
  container.appendChild(progressEl)

  const textEl = document.createElement('div')
  textEl.textContent = `${progress}%`
  textEl.style.position = 'absolute'
  textEl.style.right = '4px'
  textEl.style.top = '50%'
  textEl.style.transform = 'translateY(-50%)'
  textEl.style.fontSize = '10px'
  textEl.style.color = 'white'
  container.appendChild(textEl)
}

renderApp()

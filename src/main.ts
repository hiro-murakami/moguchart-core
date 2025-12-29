import { html, render } from 'lit'
import './gantt-bar'
import type { GanttTask, GanttRow, TaskWithLane } from './types'

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
const pxPerDay = 30 // 共通のスケール
const totalDays = 30 // 表示する日数
const barColor = '#10b981'
const barHeight = 28
const barMargin = 4
let dragTargetRowIndex: number | null = null

// 日付ラベルの配列を生成
const days = Array.from({ length: totalDays }, (_, i) => {
  const d = new Date(chartStart)
  d.setDate(d.getDate() + i)
  return d
})

/**
 * タスクの重なりを計算し、各タスクが表示されるべき「レーン（段）」を決定します。
 * @param tasks 同じ行にあるタスクの配列
 * @returns レーン番号が追加されたタスクの配列と、その行で必要なレーンの総数
 */
function calculateTaskLanes(tasks: GanttTask[]): {
  tasksWithLanes: TaskWithLane[]
  laneCount: number
} {
  if (!tasks.length) {
    return { tasksWithLanes: [], laneCount: 1 }
  }

  // 開始日でタスクをソート
  const sortedTasks = [...tasks].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  )

  const lanes: Date[] = [] // 各レーンに最後に配置されたタスクの終了日を保持
  const taskLaneMap = new Map<string, number>()

  for (const task of sortedTasks) {
    let assignedLane = -1
    // 既存のレーンに空きがあるか探す
    for (let i = 0; i < lanes.length; i++) {
      if (task.start >= lanes[i]) {
        lanes[i] = task.end // レーンの終了日を更新
        assignedLane = i
        break
      }
    }
    // 空きがなければ新しいレーンを作成
    if (assignedLane === -1) {
      lanes.push(task.end)
      assignedLane = lanes.length - 1
    }
    taskLaneMap.set(task.id, assignedLane)
  }

  // 元の順序を維持したままレーン情報を付与
  const tasksWithLanes = tasks.map((task) => ({
    ...task,
    lane: taskLaneMap.get(task.id) ?? 0,
  }))

  return {
    tasksWithLanes,
    laneCount: lanes.length || 1,
  }
}

const renderApp = () => {
  const template = html`
    <div style="padding: 50px; font-family: sans-serif; color: #333;">
      <h2>Gantt Chart (Perfect Sync)</h2>

      <div
        style="
        display: inline-block;
        border: 1px solid #e2e8f0;
        background: white;
        box-sizing: border-box;
        --label-width: 150px;
      "
      >
        <div
          style="
          display: flex;
          background: #f8fafc;
          border-bottom: 2px solid #e2e8f0;
          box-sizing: border-box;
        "
        >
          <div
            style="width: var(--label-width); flex-shrink: 0; border-right: 1px solid #e2e8f0; box-sizing: border-box;"
          ></div>

          <div
            style="
            display: flex;
            background-image: linear-gradient(90deg, transparent ${pxPerDay -
            1}px, #e2e8f0 ${pxPerDay - 1}px);
            background-size: ${pxPerDay}px 100%;
            background-position: -1px 0; /* 境界線の1px分を補正 */
          "
          >
            ${days.map(
              (day) => html`
                <div
                  style="width: ${pxPerDay}px; text-align: center; font-size: 10px; padding: 8px 0; flex-shrink: 0; box-sizing: border-box;"
                >
                  ${day.getDate() === 1
                    ? html`<b>${day.getMonth() + 1}/</b>`
                    : ''}${day.getDate()}
                </div>
              `,
            )}
          </div>
        </div>

        ${rows.map((row, index) => {
          const { tasksWithLanes, laneCount } = calculateTaskLanes(row.tasks)
          const rowHeight = laneCount * (barHeight + barMargin) + barMargin

          return html`
            <div
              style="
            display: flex;
            border-bottom: 1px solid #f1f5f9;
            height: ${rowHeight}px;
            box-sizing: border-box;
            background-color: ${dragTargetRowIndex === index
                ? '#f0f9ff'
                : 'transparent'};
            transition: height 0.2s ease-out;
          "
            >
              <div
                style="
              width: var(--label-width);
              font-size: 13px;
              padding-left: 15px;
              border-right: 1px solid #e2e8f0;
              display: flex;
              align-items: center;
              flex-shrink: 0;
              box-sizing: border-box;
            "
              >
                ${row.label}
              </div>

              <div
                style="
              flex: 1;
              position: relative;
              background-image: linear-gradient(90deg, transparent ${pxPerDay -
                1}px, #f1f5f9 ${pxPerDay - 1}px);
              background-size: ${pxPerDay}px 100%;
              background-position: -1px 0;
            "
              >
                ${tasksWithLanes.map(
                  (task) => html`
                    <gantt-bar
                      .task="${task}"
                      .chartStart="${chartStart}"
                      .pxPerDay="${pxPerDay}"
                      .color="${barColor}"
                      .barHeight="${barHeight}"
                      .barMargin="${barMargin}"
                      .lane="${task.lane}"
                      @task-update="${handleTaskUpdate}"
                    />
                  `,
                )}
              </div>
            </div>
          `
        })}
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

function handleTaskUpdate(e: CustomEvent<any>) {
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
  const currentY = dragStartRowTop + dy

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
    dragTargetRowIndex = targetRowIndex >= 0 ? targetRowIndex : null

    // ドラッグ中は日付の更新のみを行い、再描画
    rows = rows.map((r) => ({
      ...r,
      tasks: r.tasks.map((t) => (t.id === id ? { ...t, start, end } : t)),
    }))
    renderApp()
    return
  }

  // ドロップ時の処理
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

renderApp()

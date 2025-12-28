import { html, render } from 'lit'
import './gantt-bar'
import { type GanttTask } from './types'

let tasks: GanttTask[] = [
  {
    id: '1',
    name: '要件定義',
    start: new Date('2025-12-20'),
    end: new Date('2025-12-25'),
  },
  {
    id: '2',
    name: 'デザイン',
    start: new Date('2025-12-26'),
    end: new Date('2025-12-30'),
  },
  {
    id: '3',
    name: '実装',
    start: new Date('2026-01-01'),
    end: new Date('2026-01-10'),
  },
]

const chartStart = new Date('2025-12-15')
const pxPerDay = 30 // 共通のスケール
const totalDays = 30 // 表示する日数
const barColor = '#10b981'

// 日付ラベルの配列を生成
const days = Array.from({ length: totalDays }, (_, i) => {
  const d = new Date(chartStart)
  d.setDate(d.getDate() + i)
  return d
})

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

        ${tasks.map(
          (task) => html`
            <div
              style="
            display: flex;
            border-bottom: 1px solid #f1f5f9;
            height: 50px;
            box-sizing: border-box;
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
                ${task.name}
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
                <gantt-bar
                  .task="${task}"
                  .chartStart="${chartStart}"
                  .pxPerDay="${pxPerDay}"
                  .color="${barColor}"
                  @task-update="${(e: CustomEvent<GanttTask>) => {
                    tasks = tasks.map((t) => (t.id === task.id ? e.detail : t))
                    renderApp()
                  }}"
                />
              </div>
            </div>
          `,
        )}
      </div>
    </div>
  `
  render(template, document.getElementById('app')!)
}

renderApp()

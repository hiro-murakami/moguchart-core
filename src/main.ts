import { html, render } from 'lit';
import './gantt-bar';
import { type GanttTask } from './gantt-bar';

// 1. 複数のテストデータ
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
];

const chartStart = new Date('2025-12-15');

// 2. 描画関数
const renderApp = () => {
  const template = html`
    <div style="padding: 50px; font-family: sans-serif;">
      <h2>Multi-Task Gantt Chart</h2>

      <div style="background: #fafafa; border: 1px solid #ddd; position: relative; width: 800px;">
        ${tasks.map(
          (task) => html`
          <div style="display: flex; align-items: center; border-bottom: 1px solid #eee; height: 50px;">
            <div style="width: 150px; font-size: 14px; padding-left: 10px; border-right: 1px solid #eee;">
              ${task.name}
            </div>

            <div style="flex: 1; position: relative;">
              <gantt-bar
                .task="${task}"
                .chartStart="${chartStart}"
                .pxPerDay="${20}"
                @task-update="${(e: CustomEvent<GanttTask>) => {
                  // 配列内の特定のタスクを更新
                  tasks = tasks.map((t) => (t.id === task.id ? e.detail : t));
                  renderApp();
                }}"
              ></gantt-bar>
            </div>
          </div>
        `
        )}
      </div>
    </div>
  `;
  render(template, document.getElementById('app')!);
};

renderApp();

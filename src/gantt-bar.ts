import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

// データ型の定義
export interface GanttTask {
  id: string;
  name: string;
  start: Date;
  end: Date;
}

@customElement('gantt-bar')
export class GanttBar extends LitElement {
  @property({ type: Object }) task!: GanttTask;
  @property({ type: Object }) chartStart!: Date;
  @property({ type: Number }) pxPerDay = 30;

  static styles = css`
    :host {
      display: block;
      height: 40px;
    }
    .bar {
      fill: #3b82f6;
      rx: 4;
    }
    .handle-right {
      fill: transparent;
      cursor: ew-resize;
    }
    .handle-right:hover {
      fill: rgba(255, 255, 255, 0.3);
    }
  `;

  // 日付からX座標を計算するヘルパー
  private getX(date: Date) {
    const diff = date.getTime() - this.chartStart.getTime();
    return (diff / (1000 * 60 * 60 * 24)) * this.pxPerDay;
  }

  private onResizeStart(e: PointerEvent) {
    e.stopPropagation();
    const startX = e.clientX;
    const originalEnd = new Date(this.task.end);

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const daysDiff = Math.round(deltaX / this.pxPerDay);

      const newEnd = new Date(originalEnd);
      newEnd.setDate(originalEnd.getDate() + daysDiff);

      // 開始日より前にならない制限
      if (newEnd > this.task.start) {
        this.dispatchEvent(
          new CustomEvent('task-update', {
            detail: { ...this.task, end: newEnd },
            bubbles: true,
            composed: true,
          })
        );
      }
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }

  // --- 追加: 移動（Move）ロジック ---
  private onMoveStart(e: PointerEvent) {
    e.stopPropagation();
    const startX = e.clientX;
    // 開始時の一時的な日付を保持
    const originalStart = new Date(this.task.start);
    const originalEnd = new Date(this.task.end);

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const daysDiff = Math.round(deltaX / this.pxPerDay);

      const newStart = new Date(originalStart);
      newStart.setDate(originalStart.getDate() + daysDiff);

      const newEnd = new Date(originalEnd);
      newEnd.setDate(originalEnd.getDate() + daysDiff);

      this.dispatchEvent(
        new CustomEvent('task-update', {
          detail: { ...this.task, start: newStart, end: newEnd },
          bubbles: true,
          composed: true,
        })
      );
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }

  render() {
    if (!this.task || !this.chartStart) return html``;

    const x = this.getX(this.task.start);
    const width = this.getX(this.task.end) - x;

    return html`
      <svg width="100%" height="40" style="overflow: visible;">
        <g transform="translate(${x}, 5)">
          <rect
            class="bar"
            width="${width}"
            height="30"
            @pointerdown="${this.onMoveStart}"
          />

          <rect
            class="handle-right"
            x="${width - 10}"
            width="20"
            height="30"
            @pointerdown="${this.onResizeStart}"
          />
        </g>
      </svg>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gantt-bar': GanttBar;
  }
}

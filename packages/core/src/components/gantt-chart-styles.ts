import { css } from 'lit'
import type { ThemeColorPalette } from '../core/types'
import { getThemeColors } from '../core/utils'

/**
 * GanttChartElement の Static CSS スタイル。
 * Shadow DOM 内に適用される固定スタイルです。
 */
export const ganttChartStyles = css`
  :host {
    display: block;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    position: relative;
  }
  :host(:focus-visible) {
    outline: 2px solid #3b82f6;
    outline-offset: -2px;
  }
  .scroll-container {
    width: 100%;
    height: 100%;
    overflow-x: auto;
    overflow-y: auto;
    position: relative;
    overflow-anchor: none;
  }
  .scroll-container.drag-active-valid,
  .scroll-container.drag-active-valid * {
    cursor: grabbing !important;
  }
  .scroll-container.drag-active-invalid,
  .scroll-container.drag-active-invalid * {
    cursor: not-allowed !important;
  }
  .dependency-lines {
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;
    z-index: 10;
  }
  .tooltip {
    position: fixed;
    transform: translate(-50%, -100%);
    padding: 4px 8px;
    border-radius: 4px;
    font-size: calc(11px * var(--moguchart-font-scale, 1));
    white-space: nowrap;
    pointer-events: none;
    z-index: 2000;
    margin-top: -6px;
    text-align: left;
    line-height: 1.4;
    opacity: 0;
    transition: opacity 0.2s ease;
  }
  .tooltip.visible {
    opacity: 1;
  }
  .tooltip-row {
    display: block;
  }
  .tooltip::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    margin-left: -4px;
    border-width: 4px;
    border-style: solid;
  }
  .tooltip.below {
    transform: translate(-50%, 0);
    margin-top: 6px;
  }
  .tooltip.below::after {
    top: auto;
    bottom: 100%;
  }
  .drag-info-overlay {
    position: fixed;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    padding: 10px 20px;
    border-radius: 8px;
    font-size: calc(14px * var(--moguchart-font-scale, 1));
    pointer-events: none;
    z-index: 2000;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    text-align: center;
    opacity: 0;
    transition: opacity 0.2s ease;
  }
  .drag-info-overlay.visible {
    opacity: 1;
  }
  .drag-info-sub {
    font-size: calc(12px * var(--moguchart-font-scale, 1));
  }
  .dependency-line {
    stroke-width: 2;
    fill: none;
    pointer-events: none;
  }
  .dependency-arrow-line {
    stroke-width: 0;
  }
  .dependency-hit-area {
    stroke-width: 16;
    stroke: transparent;
    fill: none;
    pointer-events: stroke;
    cursor: default;
  }
  .dependency-group:hover .dependency-line {
    stroke-width: 3;
    filter: drop-shadow(0 0 3px currentColor);
  }
  .dependency-group:hover .dependency-arrow-line {
    stroke-width: 0;
  }
  .dependency-group:hover .dependency-hit-area ~ .dependency-line {
    opacity: 1;
  }
  .dependency-line.critical-path {
    stroke-width: 3;
  }
  .dependency-group.selected .dependency-line {
    stroke-width: 3.5;
    stroke: var(--marquee-border, #3b82f6);
    filter: drop-shadow(0 0 4px var(--marquee-border, #3b82f6));
  }
  .dependency-delete-btn,
  .dependency-edit-btn {
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.15s ease;
    cursor: pointer;
  }
  .dependency-group:hover .dependency-delete-btn,
  .dependency-group.selected .dependency-delete-btn,
  .dependency-group:hover .dependency-edit-btn,
  .dependency-group.selected .dependency-edit-btn {
    opacity: 1;
    pointer-events: all;
  }
  .dependency-delete-btn *,
  .dependency-edit-btn * {
    pointer-events: all;
  }
  .dependency-delete-btn-hit-area,
  .dependency-edit-btn-hit-area {
    fill: transparent;
    cursor: pointer;
  }
  .dependency-delete-btn-circle {
    fill: #ef4444;
    transition: fill 0.15s ease, filter 0.15s ease, transform 0.15s ease;
  }
  .dependency-delete-btn:hover .dependency-delete-btn-circle {
    fill: #dc2626;
    stroke: #ffffff;
    stroke-width: 1.5;
    transform: scale(1.2);
    filter: drop-shadow(0 0 4px rgba(220, 38, 38, 0.9));
  }
  .dependency-delete-btn-icon {
    stroke: #ffffff;
    stroke-width: 2;
    stroke-linecap: round;
    pointer-events: none;
  }
  .dependency-edit-btn-circle {
    fill: #3b82f6;
    transition: fill 0.15s ease, filter 0.15s ease, transform 0.15s ease;
  }
  .dependency-edit-btn:hover .dependency-edit-btn-circle {
    fill: #2563eb;
    stroke: #ffffff;
    stroke-width: 1.5;
    transform: scale(1.2);
    filter: drop-shadow(0 0 4px rgba(37, 99, 235, 0.9));
  }
  .dependency-edit-btn-icon {
    fill: none;
    stroke: #ffffff;
    stroke-width: 1.6;
    stroke-linejoin: round;
    stroke-linecap: round;
    pointer-events: none;
  }
  .dependency-edit-popover {
    position: fixed;
    z-index: 2100;
    min-width: 268px;
    max-width: 340px;
    border-radius: 8px;
    padding: 12px 14px;
    box-shadow: 0 10px 25px -4px rgba(15, 23, 42, 0.25), 0 4px 10px -2px rgba(15, 23, 42, 0.15);
    font-size: calc(12px * var(--moguchart-font-scale, 1));
    box-sizing: border-box;
    user-select: none;
    -webkit-user-select: none;
  }
  .dependency-popover-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding-bottom: 8px;
    margin-bottom: 10px;
  }
  .dependency-popover-title-wrap {
    min-width: 0;
    flex: 1;
  }
  .dependency-popover-title {
    font-weight: 700;
    font-size: calc(11px * var(--moguchart-font-scale, 1));
    opacity: 0.7;
    margin-bottom: 2px;
  }
  .dependency-popover-route {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .dependency-popover-close {
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    padding: 2px 4px;
    border-radius: 4px;
    opacity: 0.65;
  }
  .dependency-popover-close:hover {
    opacity: 1;
  }
  .dependency-popover-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 10px;
  }
  .dependency-popover-label {
    font-weight: 500;
    opacity: 0.82;
    white-space: nowrap;
  }
  .dependency-type-segment {
    display: inline-flex;
    border-radius: 6px;
    padding: 2px;
    gap: 2px;
  }
  .dependency-type-btn {
    border: none;
    border-radius: 4px;
    padding: 4px 9px;
    font-size: calc(11px * var(--moguchart-font-scale, 1));
    font-weight: 600;
    cursor: pointer;
    background: transparent;
    transition: background-color 0.12s ease, color 0.12s ease;
  }
  .dependency-type-btn.active {
    background: #3b82f6;
    color: #ffffff !important;
  }
  .dependency-lag-controls {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .dependency-lag-step-btn {
    border: none;
    border-radius: 4px;
    padding: 4px 8px;
    font-size: calc(11px * var(--moguchart-font-scale, 1));
    font-weight: 600;
    cursor: pointer;
  }
  .dependency-lag-input {
    width: 60px;
    padding: 3px 6px;
    border-radius: 4px;
    font-size: calc(12px * var(--moguchart-font-scale, 1));
    text-align: center;
    box-sizing: border-box;
    outline: none;
  }
  .dependency-lag-input:focus {
    border-color: #3b82f6 !important;
  }
  .dependency-popover-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding-top: 8px;
    margin-top: 2px;
  }
  .dependency-popover-actions-right {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
  }
  .dependency-popover-btn {
    border-radius: 5px;
    padding: 5px 10px;
    font-size: calc(11px * var(--moguchart-font-scale, 1));
    font-weight: 600;
    cursor: pointer;
    border: 1px solid transparent;
    transition: filter 0.12s ease, background-color 0.12s ease;
  }
  .dependency-popover-btn:hover {
    filter: brightness(0.96);
  }
  .dependency-popover-btn-save {
    background-color: #2563eb;
    color: #ffffff;
  }
  .dependency-popover-btn-delete {
    background-color: rgba(239, 68, 68, 0.12);
    color: #dc2626;
    border-color: rgba(239, 68, 68, 0.3);
  }
  .current-time-line {
    position: absolute;
    width: 2px;
    z-index: 60;
    pointer-events: none;
  }
  .current-time-dot {
    position: absolute;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    z-index: 80;
    pointer-events: none;
    transform: translate(-50%, -50%);
  }
  .milestone-line {
    position: absolute;
    z-index: 59;
    pointer-events: auto;
    transition: opacity 0.2s ease, z-index 0s;
    cursor: default;
  }
  .milestone-line.milestone-hovered {
    z-index: 200;
  }
  .cursor-line {
    position: absolute;
    width: 2px;
    top: 0;
    pointer-events: none;
    z-index: 58;
  }
  .marquee-selection-box {
    position: absolute;
    border: 1px dashed var(--marquee-border, #3b82f6);
    background-color: var(--marquee-bg, rgba(59, 130, 246, 0.15));
    pointer-events: none;
    z-index: 550;
    box-sizing: border-box;
  }
  .plugin-overlay-layer {
    position: absolute;
    pointer-events: none;
    z-index: 65;
  }
  .constraint-drag-guide-layer {
    position: absolute;
    pointer-events: none;
    z-index: 64;
    overflow: visible;
  }
  .grid-footer-row {
    display: flex;
    width: fit-content;
    min-width: 100%;
    box-sizing: border-box;
    position: sticky;
    bottom: 0;
    z-index: 450;
    user-select: none;
    -webkit-user-select: none;
  }
  .grid-footer-header {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    box-sizing: border-box;
    position: sticky;
    left: 0;
    z-index: 100;
    overflow: hidden;
    font-size: calc(12px * var(--moguchart-font-scale, 1));
    font-weight: 700;
  }
  .grid-footer-cells-container {
    display: flex;
    height: 100%;
    box-sizing: border-box;
  }
  .grid-pinned-left {
    position: relative;
    z-index: 3;
    transition: box-shadow 0.15s ease;
  }
  .grid-pinned-left.has-scroll-shadow {
    box-shadow: 4px 0 8px -2px rgba(15, 23, 42, 0.18);
  }
  :host([theme='dark']) .grid-pinned-left.has-scroll-shadow {
    box-shadow: 4px 0 10px -2px rgba(0, 0, 0, 0.45);
  }
  .grid-footer-cell {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    flex-shrink: 0;
  }
  .grid-footer-timeline {
    flex: none;
    position: relative;
    box-sizing: border-box;
  }
  .grid-footer-summary-bar {
    position: absolute;
    height: 8px;
    top: 50%;
    transform: translateY(-50%);
    border-radius: 4px;
    overflow: hidden;
    pointer-events: none;
    opacity: 0.85;
  }
  .grid-footer-summary-bar-progress {
    height: 100%;
    border-radius: 4px 0 0 4px;
  }
`

/**
 * テーマに応じた動的インラインスタイル文字列を生成する。
 * render() 内の <style> タグで使用します。
 */
export function buildDynamicStyles(
  theme: 'light' | 'dark',
  customTheme?: Partial<ThemeColorPalette>,
): string {
  const colors = getThemeColors(theme, customTheme)
  return `
    :host {
      background: ${colors.bg};
      border: 1px solid ${colors.border};
      border-radius: 8px;
      overflow: hidden;
      color: ${colors.text};
      --minimap-bg: ${colors.minimapBg ?? (theme === 'dark' ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.92)')};
      --minimap-border: ${colors.minimapBorder ?? colors.border};
      --minimap-text: ${colors.text};
      --minimap-viewport: ${colors.minimapViewport ?? 'rgba(59, 130, 246, 0.2)'};
      --minimap-viewport-border: ${colors.minimapViewportBorder ?? '#3b82f6'};
      --moguchart-progress-color: ${colors.taskProgress ?? (theme === 'dark' ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.18)')};
      --moguchart-progress-handle: ${colors.taskProgressHandle ?? (theme === 'dark' ? '#60a5fa' : '#2563eb')};
      --marquee-border: ${colors.selectionMarqueeBorder ?? (theme === 'dark' ? 'rgba(96, 165, 250, 0.85)' : 'rgba(59, 130, 246, 0.85)')};
      --marquee-bg: ${colors.selectionMarqueeBg ?? (theme === 'dark' ? 'rgba(96, 165, 250, 0.18)' : 'rgba(59, 130, 246, 0.12)')};
    }
    .tooltip {
      background-color: ${colors.tooltipBg};
      color: ${colors.tooltipText};
    }
    .tooltip::after {
      border-color: ${colors.tooltipBg} transparent transparent transparent;
    }
    .tooltip.below::after {
      border-color: transparent transparent ${colors.tooltipBg} transparent;
    }
    .drag-info-overlay {
      background: ${colors.dragOverlayBg};
      color: ${colors.dragOverlayText};
    }
    .drag-info-sub {
      color: ${colors.dragOverlaySubText};
    }
    .dependency-line {
      stroke: ${colors.dependencyLine};
    }
    .connector-preview-line {
      stroke: ${colors.dependencyLine};
      stroke-width: 2;
      stroke-dasharray: 6 3;
      fill: none;
      opacity: 0.7;
    }
    .dependency-line.critical-path {
      stroke: ${colors.criticalPath ?? colors.dependencyLine};
    }
    .header-resizer {
      width: 4px;
      cursor: col-resize;
      z-index: 510;
      background-color: transparent;
      transition: background-color 0.2s;
      touch-action: none;
      position: relative;
    }
    .header-resizer::before {
      content: '';
      position: absolute;
      top: 0;
      bottom: 0;
      left: -6px;
      right: -6px;
    }
    .header-resizer:hover,
    .header-resizer.resizing {
      background-color: ${colors.border};
    }
    .dependency-edit-popover {
      background-color: ${theme === 'dark' ? '#1e293b' : '#ffffff'};
      color: ${colors.text};
      border: 1px solid ${colors.border};
    }
    .dependency-popover-header {
      border-bottom: 1px solid ${colors.border};
    }
    .dependency-popover-close {
      color: ${colors.text};
    }
    .dependency-type-segment {
      background-color: ${theme === 'dark' ? 'rgba(15, 23, 42, 0.65)' : '#f1f5f9'};
    }
    .dependency-type-btn {
      color: ${colors.text};
    }
    .dependency-lag-step-btn,
    .dependency-popover-btn-cancel {
      background-color: ${theme === 'dark' ? '#334155' : '#f1f5f9'};
      color: ${colors.text};
      border-color: ${colors.border};
    }
    .dependency-lag-input {
      background-color: ${theme === 'dark' ? '#0f172a' : '#ffffff'};
      color: ${colors.text};
      border: 1px solid ${colors.border};
      color-scheme: ${theme === 'dark' ? 'dark' : 'light'};
    }
    .dependency-popover-actions {
      border-top: 1px solid ${colors.border};
    }
    .dependency-popover-btn-delete {
      color: ${theme === 'dark' ? '#f87171' : '#dc2626'};
    }
  `
}

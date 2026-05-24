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
    font-size: 11px;
    white-space: nowrap;
    pointer-events: none;
    z-index: 1000;
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
  .drag-info-overlay {
    position: fixed;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 14px;
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
    font-size: 12px;
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
    cursor: pointer;
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
    transition: opacity 0.2s ease;
    cursor: default;
  }
  .cursor-line {
    position: absolute;
    width: 2px;
    top: 0;
    pointer-events: none;
    z-index: 58;
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
    }
    .tooltip {
      background-color: ${colors.tooltipBg};
      color: ${colors.tooltipText};
    }
    .tooltip::after {
      border-color: ${colors.tooltipBg} transparent transparent transparent;
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
    .header-resizer {
      width: 4px;
      cursor: col-resize;
      z-index: 510;
      background-color: transparent;
      transition: background-color 0.2s;
    }
    .header-resizer:hover,
    .header-resizer.resizing {
      background-color: ${colors.border};
    }
  `
}

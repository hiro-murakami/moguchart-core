/**
 * ガントチャートを SVG または PNG 画像としてエクスポートするユーティリティ。
 *
 * Shadow DOM の cloneNode では内部コンテンツがコピーされないため、
 * rows / option / theme などのデータから SVG を直接描画します。
 */

import html2canvas from 'html2canvas-pro'
import { jsPDF } from 'jspdf'
import type { GanttChartElement } from './gantt-chart'
import { getThemeColors } from '../core/utils'


export interface ExportImageOptions {
  /** ダウンロード時のファイル名（拡張子なし）。省略時は 'gantt-chart' */
  filename?: string
  /** true の場合、自動的にファイルダウンロードを開始する。デフォルト: false */
  download?: boolean
  /** PNG 出力時のスケール倍率（高解像度化）。デフォルト: 2 */
  scale?: number
  /** 画像を指定したピクセル数で縦に分割し、分割位置にカレンダー（ヘッダー）を挿入する。未指定時は分割しない */
  splitHeight?: number
}



/** データURL のファイルダウンロードをトリガーする */
function triggerDownload(dataUrl: string, filename: string): void {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  a.click()
}


/**
 * html2canvas-pro を使用してエクスポートする（Shadow DOMネイティブ対応版）
 */
export async function exportGanttWithHtml2Canvas(
  chartElement: GanttChartElement,
  format: 'png' | 'pdf' = 'png',
  options: ExportImageOptions = {}
): Promise<string | Blob> {
  const { filename = 'gantt-chart', download = false, scale = 2, splitHeight } = options;
  const scrollContainer = chartElement.shadowRoot?.querySelector('.scroll-container') as HTMLElement | null;
  let scrollWidth = scrollContainer ? scrollContainer.scrollWidth : chartElement.scrollWidth;
  let scrollHeight = scrollContainer ? scrollContainer.scrollHeight : chartElement.scrollHeight;

  const targetEl = scrollContainer || chartElement;
  const colors = getThemeColors(chartElement.theme, chartElement.option?.customTheme);
  const bgColor = colors.bg || '#ffffff';

  // html2canvas-pro は Shadow DOM をネイティブにサポートしています
  let canvas = await html2canvas(targetEl, {
    backgroundColor: bgColor,
    scale: scale,
    width: scrollWidth,
    height: scrollHeight,
    windowWidth: scrollWidth,
    windowHeight: scrollHeight,
    scrollX: 0,
    scrollY: 0,
    x: 0,
    y: 0,
    logging: false,
  });

  if (splitHeight && scrollHeight > splitHeight) {
    // ヘッダーの高さを取得
    let calendarHeight = 50;
    const calendarEl = chartElement.shadowRoot?.querySelector('gantt-calendar') as HTMLElement | null;
    if (calendarEl && calendarEl.offsetHeight > 0) {
      calendarHeight = calendarEl.offsetHeight;
    } else if ((chartElement as any).calendarHeight) {
      calendarHeight = (chartElement as any).calendarHeight;
    }

    // Canvasの実際の出力サイズからスケール比率を計算する
    const actualScaleY = canvas.height / scrollHeight;

    // スケール適用前のボディ全体の高さ
    const originalBodyHeight = scrollHeight - calendarHeight;
    // 分割1ブロックあたりの理想的なボディ高さ (スケール適用前)
    const originalBlockBodyHeight = splitHeight - calendarHeight;

    // 行境界位置（ボディ上端からの相対Y座標）を取得
    let rowBottoms: number[] = [];
    if (typeof chartElement.getRowPositions === 'function') {
      const positions = chartElement.getRowPositions();
      rowBottoms = positions.map(p => p.bottom);
    }

    // 分割点（元のボディ座標系での相対Y座標）のリストを計算する
    const splitPoints: number[] = [0]; // 最初はボディの開始 (0)
    let currentBodyY = 0;

    if (originalBlockBodyHeight > 0) {
      while (currentBodyY < originalBodyHeight) {
        const idealNextBodyY = currentBodyY + originalBlockBodyHeight;

        if (idealNextBodyY >= originalBodyHeight) {
          // 残りが理想の高さ以下の場合は、ボディの終端を次の分割点にする
          splitPoints.push(originalBodyHeight);
          break;
        }

        // idealNextBodyY を超えない最大の行境界を探す
        // ただし、currentBodyY より大きいものである必要がある
        let nextBodyY = -1;
        for (let i = 0; i < rowBottoms.length; i++) {
          const bottom = rowBottoms[i];
          if (bottom > currentBodyY && bottom <= idealNextBodyY) {
            nextBodyY = Math.max(nextBodyY, bottom);
          }
        }

        // もし idealNextBodyY を超えない最大の行境界が見つからなかった場合
        // （例えば、ある1行の高さが originalBlockBodyHeight を超えている場合など）
        // その場合は、currentBodyY より大きい最小の行境界（その大きな行の終わり）を選択する
        if (nextBodyY === -1) {
          for (let i = 0; i < rowBottoms.length; i++) {
            const bottom = rowBottoms[i];
            if (bottom > currentBodyY) {
              nextBodyY = bottom;
              break;
            }
          }
        }

        // それでも見つからないか、更新されない場合は安全のために idealNextBodyY を使う
        if (nextBodyY === -1 || nextBodyY === currentBodyY) {
          nextBodyY = idealNextBodyY;
        }

        splitPoints.push(nextBodyY);
        currentBodyY = nextBodyY;
      }
    } else {
      splitPoints.push(originalBodyHeight);
    }

    const numBlocks = splitPoints.length - 1;

    if (numBlocks > 0) {
      const scaledCalendarHeight = Math.floor(calendarHeight * actualScaleY);
      const scaledScrollWidth = canvas.width;

      // 新しいキャンバスの高さを計算する
      let newCanvasHeight = 0;
      const blockHeights: { srcStart: number; srcEnd: number; destHeight: number }[] = [];

      for (let i = 0; i < numBlocks; i++) {
        const startY = splitPoints[i];
        const endY = splitPoints[i + 1];

        // ボディの開始・終了座標をスケール適用後のピクセル座標に変換する
        // 浮動小数点の隙間や重複を防ぐために、上端からの絶対座標に対して丸めを行う
        const srcBodyStartScaled = Math.round((calendarHeight + startY) * actualScaleY);
        const srcBodyEndScaled = Math.round((calendarHeight + endY) * actualScaleY);
        const copyHeightScaled = srcBodyEndScaled - srcBodyStartScaled;

        blockHeights.push({
          srcStart: srcBodyStartScaled,
          srcEnd: srcBodyEndScaled,
          destHeight: copyHeightScaled
        });

        // このブロックの高さ = カレンダーの高さ + ボディの高さ
        newCanvasHeight += scaledCalendarHeight + copyHeightScaled;
      }

      const newCanvas = document.createElement('canvas');
      newCanvas.width = scaledScrollWidth;
      newCanvas.height = newCanvasHeight;
      const ctx = newCanvas.getContext('2d');

      if (ctx) {
        let currentDestY = 0;

        for (let i = 0; i < numBlocks; i++) {
          // 1. カレンダー部分を描画
          ctx.drawImage(
            canvas,
            0, 0, scaledScrollWidth, scaledCalendarHeight,
            0, currentDestY, scaledScrollWidth, scaledCalendarHeight
          );
          currentDestY += scaledCalendarHeight;

          // 2. ボディ部分を描画
          const block = blockHeights[i];
          ctx.drawImage(
            canvas,
            0, block.srcStart, scaledScrollWidth, block.destHeight,
            0, currentDestY, scaledScrollWidth, block.destHeight
          );
          currentDestY += block.destHeight;
        }

        canvas = newCanvas;
        // scrollHeight を更新（以後の PDF 出力などに影響する）
        scrollHeight = newCanvasHeight / actualScaleY;
      } else {
        console.warn('[export] Failed to get 2D context for new canvas. It might be too large.');
      }
    }
  }

  if (format === 'pdf') {
    // PDFの場合はファイルサイズを削減するため、PNGではなくJPEGを使用する
    // 0.9 は高画質を維持しつつサイズを抑える品質指定
    const imgData = canvas.toDataURL('image/jpeg', 0.9);

    // jsPDF で A4横 または 内容に合わせたサイズでPDFを生成
    const orientation = scrollWidth > scrollHeight ? 'l' : 'p';
    const pdf = new jsPDF({
      orientation,
      unit: 'px',
      format: [scrollWidth, scrollHeight],
      compress: true // PDF内部のデータ圧縮を有効化
    });
    
    // 'FAST' を指定することで画像のエンコード処理を最適化・軽量化
    pdf.addImage(imgData, 'JPEG', 0, 0, scrollWidth, scrollHeight, undefined, 'FAST');
    
    if (download) {
      pdf.save(`${filename}.pdf`);
    }
    return pdf.output('blob');
  } else {
    const imgData = canvas.toDataURL('image/png');
    if (download) triggerDownload(imgData, `${filename}.png`);
    return imgData;
  }
}

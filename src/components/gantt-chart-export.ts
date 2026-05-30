/**
 * ガントチャートを SVG または PNG 画像としてエクスポートするユーティリティ。
 *
 * Shadow DOM の cloneNode では内部コンテンツがコピーされないため、
 * rows / option / theme などのデータから SVG を直接描画します。
 */

import html2canvas from 'html2canvas-pro'
import { jsPDF } from 'jspdf'


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
  chartElement: HTMLElement,
  format: 'png' | 'pdf' = 'png',
  options: ExportImageOptions = {}
): Promise<string | Blob> {
  const { filename = 'gantt-chart', download = false, scale = 2, splitHeight } = options;
  const scrollContainer = chartElement.shadowRoot?.querySelector('.scroll-container') as HTMLElement | null;
  let scrollWidth = scrollContainer ? scrollContainer.scrollWidth : chartElement.scrollWidth;
  let scrollHeight = scrollContainer ? scrollContainer.scrollHeight : chartElement.scrollHeight;


  // html2canvas-pro は Shadow DOM をネイティブにサポートしています
  let canvas = await html2canvas(chartElement, {
    backgroundColor: '#ffffff',
    scale: scale,
    width: scrollWidth,
    height: scrollHeight,
    windowWidth: scrollWidth,
    windowHeight: scrollHeight,
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

    const scaledSplitHeight = Math.floor(splitHeight * actualScaleY);
    const scaledCalendarHeight = Math.floor(calendarHeight * actualScaleY);
    const scaledScrollHeight = canvas.height;
    const scaledScrollWidth = canvas.width;

    // ボディ部分の高さ
    const bodyHeight = scaledScrollHeight - scaledCalendarHeight;
    // 分割1ブロックあたりのボディ高さ (スケール適用済み)
    const blockBodyHeight = scaledSplitHeight - scaledCalendarHeight;

    if (blockBodyHeight > 0) {
      // 必要なブロック数を計算
      const numBlocks = Math.ceil(bodyHeight / blockBodyHeight);

      // 新しいキャンバスの高さを計算
      const newCanvasHeight = scaledScrollHeight + (numBlocks - 1) * scaledCalendarHeight;

      const newCanvas = document.createElement('canvas');
      newCanvas.width = scaledScrollWidth;
      newCanvas.height = newCanvasHeight;
      const ctx = newCanvas.getContext('2d');

      if (ctx) {
        // 最初のブロック (ヘッダー含む) をコピー
        ctx.drawImage(
          canvas,
          0, 0, scaledScrollWidth, scaledSplitHeight,
          0, 0, scaledScrollWidth, scaledSplitHeight
        );

        let currentSourceY = scaledSplitHeight;
        let currentDestY = scaledSplitHeight;

        for (let i = 1; i < numBlocks; i++) {
          // ヘッダーを描画
          ctx.drawImage(
            canvas,
            0, 0, scaledScrollWidth, scaledCalendarHeight,
            0, currentDestY, scaledScrollWidth, scaledCalendarHeight
          );
          currentDestY += scaledCalendarHeight;

          // ボディの残りを描画
          const remainingHeight = scaledScrollHeight - currentSourceY;
          const copyHeight = Math.min(blockBodyHeight, remainingHeight);

          ctx.drawImage(
            canvas,
            0, currentSourceY, scaledScrollWidth, copyHeight,
            0, currentDestY, scaledScrollWidth, copyHeight
          );

          currentSourceY += copyHeight;
          currentDestY += copyHeight;
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

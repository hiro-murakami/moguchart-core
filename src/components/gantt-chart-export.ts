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
  filename: string = 'gantt-chart',
  download: boolean = false
): Promise<string | Blob> {
  const scrollWidth = chartElement.scrollWidth;
  const scrollHeight = chartElement.scrollHeight;

  // html2canvas-pro は Shadow DOM をネイティブにサポートしています
  const canvas = await html2canvas(chartElement, {
    backgroundColor: '#ffffff',
    scale: 2,
    width: scrollWidth,
    height: scrollHeight,
    windowWidth: scrollWidth,
    windowHeight: scrollHeight,
  });

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

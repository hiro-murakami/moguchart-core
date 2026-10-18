import type { DependencyEndpoint } from '../core/types'

/**
 * 直角折れ線（角丸）の SVG パスを生成するヘルパー関数。
 * @param startX 接続元 X（バー右端または左端）
 * @param startY 接続元 Y（バー中央）
 * @param endX 接続先 X（バー左端または右端、矢印なし時と共通）
 * @param endY 接続先 Y（バー中央）
 * @param adjustedEndX 矢印表示時の終端 X（矢印サイズ分手前）
 * @param barHeight バー高さ（迂回ルート計算用）
 * @param barMargin バーマージン（迂回ルート計算用）
 * @param r 角丸半径 (px)
 * @param sourceEndpoint 接続元の端点 ('end'=右端 | 'start'=左端、デフォルト: 'end')
 * @param targetEndpoint 接続先の端点 ('start'=左端 | 'end'=右端、デフォルト: 'start')
 */
export function buildOrthogonalPath(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  adjustedEndX: number,
  barHeight: number,
  barMargin: number,
  r: number,
  sourceEndpoint: DependencyEndpoint = 'end',
  targetEndpoint: DependencyEndpoint = 'start',
): { pathD: string; hitPathD: string } {
  const buildPath = (ex: number): string => {
    // ── SS (start -> start): 両方左端から出て左端へ入るコの字パス ──
    if (sourceEndpoint === 'start' && targetEndpoint === 'start') {
      const gap = Math.max(12, r + 4)
      const turnX = Math.min(startX, ex) - gap
      const targetY =
        Math.abs(startY - endY) < 1 ? startY + barHeight + barMargin : endY
      const dy = targetY - startY
      const signY = dy >= 0 ? 1 : -1
      const cr = Math.min(r, Math.max(0, startX - turnX), Math.max(0, ex - turnX), Math.abs(dy) / 2)

      return [
        `M ${startX} ${startY}`,
        `L ${turnX + cr} ${startY}`,
        `Q ${turnX} ${startY} ${turnX} ${startY + signY * cr}`,
        `L ${turnX} ${endY - signY * cr}`,
        `Q ${turnX} ${endY} ${turnX + cr} ${endY}`,
        `L ${ex} ${endY}`,
      ].join(' ')
    }

    // ── FF (end -> end): 両方右端から出て右端へ入る逆コの字パス ──
    if (sourceEndpoint === 'end' && targetEndpoint === 'end') {
      const gap = Math.max(12, r + 4)
      const turnX = Math.max(startX, ex) + gap
      const targetY =
        Math.abs(startY - endY) < 1 ? startY + barHeight + barMargin : endY
      const dy = targetY - startY
      const signY = dy >= 0 ? 1 : -1
      const cr = Math.min(r, Math.max(0, turnX - startX), Math.max(0, turnX - ex), Math.abs(dy) / 2)

      return [
        `M ${startX} ${startY}`,
        `L ${turnX - cr} ${startY}`,
        `Q ${turnX} ${startY} ${turnX} ${startY + signY * cr}`,
        `L ${turnX} ${endY - signY * cr}`,
        `Q ${turnX} ${endY} ${turnX - cr} ${endY}`,
        `L ${ex} ${endY}`,
      ].join(' ')
    }

    // ── SF (start -> end): 左端から出て右端へ入るパス ──
    if (sourceEndpoint === 'start' && targetEndpoint === 'end') {
      if (Math.abs(startY - endY) < 1 && startX > ex) {
        return `M ${startX} ${startY} L ${ex} ${endY}`
      }
      if (startX > ex) {
        const midX = (startX + ex) / 2
        const signY = endY > startY ? 1 : -1
        const cr = Math.min(r, startX - midX, midX - ex, Math.abs(endY - startY) / 2)
        return [
          `M ${startX} ${startY}`,
          `L ${midX + cr} ${startY}`,
          `Q ${midX} ${startY} ${midX} ${startY + signY * cr}`,
          `L ${midX} ${endY - signY * cr}`,
          `Q ${midX} ${endY} ${midX - cr} ${endY}`,
          `L ${ex} ${endY}`,
        ].join(' ')
      } else {
        const gap = Math.max(12, r + 4)
        const turnX1 = startX - gap
        const turnX2 = ex + gap
        const midY = (startY + endY) / 2
        const effectiveMidY =
          Math.abs(startY - endY) < barHeight ? midY + barHeight + barMargin : midY
        const dy1 = effectiveMidY - startY
        const dy2 = endY - effectiveMidY
        const signY1 = dy1 >= 0 ? 1 : -1
        const signY2 = dy2 >= 0 ? 1 : -1
        const dxMid = turnX2 - turnX1
        const signX = dxMid >= 0 ? 1 : -1
        const cr1 = Math.min(r, gap, Math.abs(dy1) / 2)
        const cr2 = Math.min(r, Math.abs(dy1) / 2, Math.abs(dxMid) / 2)
        const cr3 = Math.min(r, Math.abs(dxMid) / 2, Math.abs(dy2) / 2)
        const cr4 = Math.min(r, Math.abs(dy2) / 2, gap)

        return [
          `M ${startX} ${startY}`,
          `L ${turnX1 + cr1} ${startY}`,
          `Q ${turnX1} ${startY} ${turnX1} ${startY + signY1 * cr1}`,
          `L ${turnX1} ${effectiveMidY - signY1 * cr2}`,
          `Q ${turnX1} ${effectiveMidY} ${turnX1 + signX * cr2} ${effectiveMidY}`,
          `L ${turnX2 - signX * cr3} ${effectiveMidY}`,
          `Q ${turnX2} ${effectiveMidY} ${turnX2} ${effectiveMidY + signY2 * cr3}`,
          `L ${turnX2} ${endY - signY2 * cr4}`,
          `Q ${turnX2} ${endY} ${turnX2 - cr4} ${endY}`,
          `L ${ex} ${endY}`,
        ].join(' ')
      }
    }

    // ── FS (end -> start, デフォルト): 右端から出て左端へ入るパス ──
    if (Math.abs(startY - endY) < 1) {
      // 同じ高さ: 単純な水平線（矢印のみ）
      return `M ${startX} ${startY} L ${ex} ${endY}`
    }

    if (startX < ex) {
      // ── 左→右: Z字型（startX → midX 水平 → 縦 → ex 水平） ──
      const midX = (startX + ex) / 2

      const signY = endY > startY ? 1 : -1
      // 使えるコーナー半径（水平セグメント長と垂直差の半分で制限）
      const cr = Math.min(r, midX - startX, ex - midX, Math.abs(endY - startY) / 2)

      // コーナー1: 水平→垂直 (midX, startY)
      // コーナー2: 垂直→水平 (midX, endY)
      return [
        `M ${startX} ${startY}`,
        `L ${midX - cr} ${startY}`,
        `Q ${midX} ${startY} ${midX} ${startY + signY * cr}`,
        `L ${midX} ${endY - signY * cr}`,
        `Q ${midX} ${endY} ${midX + cr} ${endY}`,
        `L ${ex} ${endY}`,
      ].join(' ')
    } else {
      // ── 右→左: コの字型（Uターン）──
      // startX → 右へ gap → 縦移動 → 左へ横移動 → 縦移動 → ex に入る
      const gap = Math.max(12, r + 4)
      const turnX1 = startX + gap // 右側の折り返し X
      const turnX2 = ex - gap // 左側の折り返し X

      const midY = (startY + endY) / 2
      const effectiveMidY =
        Math.abs(startY - endY) < barHeight
          ? midY + barHeight + barMargin
          : midY

      const dy1 = effectiveMidY - startY // 縦移動量1（startY → effectiveMidY）
      const dy2 = endY - effectiveMidY // 縦移動量2（effectiveMidY → endY）
      const signY1 = dy1 >= 0 ? 1 : -1
      const signY2 = dy2 >= 0 ? 1 : -1
      const dxMid = turnX2 - turnX1 // 中間水平移動量（負=左向き）
      const signX = dxMid >= 0 ? 1 : -1

      // 各コーナーで使える半径（その区間の長さの半分以下）
      const cr1 = Math.min(r, gap, Math.abs(dy1) / 2) // コーナー1: 右出口
      const cr2 = Math.min(r, Math.abs(dy1) / 2, Math.abs(dxMid) / 2) // コーナー2: 中間上/下
      const cr3 = Math.min(r, Math.abs(dxMid) / 2, Math.abs(dy2) / 2) // コーナー3: 中間折り返し
      const cr4 = Math.min(r, Math.abs(dy2) / 2, gap) // コーナー4: 左入口

      return [
        `M ${startX} ${startY}`,

        // セグメント1: 右へ gap → コーナー1（H→V, turnX1,startY で折れる）
        `L ${turnX1 - cr1} ${startY}`,
        `Q ${turnX1} ${startY} ${turnX1} ${startY + signY1 * cr1}`,

        // セグメント2: 縦 dy1 → コーナー2（V→H, turnX1,effectiveMidY で折れる）
        `L ${turnX1} ${effectiveMidY - signY1 * cr2}`,
        `Q ${turnX1} ${effectiveMidY} ${turnX1 + signX * cr2} ${effectiveMidY}`,

        // セグメント3: 横 dxMid → コーナー3（H→V, turnX2,effectiveMidY で折れる）
        `L ${turnX2 - signX * cr3} ${effectiveMidY}`,
        `Q ${turnX2} ${effectiveMidY} ${turnX2} ${effectiveMidY + signY2 * cr3}`,

        // セグメント4: 縦 dy2 → コーナー4（V→H, turnX2,endY で折れる）
        `L ${turnX2} ${endY - signY2 * cr4}`,
        `Q ${turnX2} ${endY} ${turnX2 + cr4} ${endY}`,

        // セグメント5: 右へ ex まで
        `L ${ex} ${endY}`,
      ].join(' ')
    }
  }

  return {
    pathD: buildPath(adjustedEndX),
    hitPathD: buildPath(endX),
  }
}

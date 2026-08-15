/**
 * 基本祝日（固定祝日、ハッピーマンデー、春分・秋分）判定
 */
const isBaseHoliday = (date: Date): boolean => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1 // 1-12
  const day = date.getDate()
  const dayOfWeek = date.getDay() // 0: Sun, 1: Mon, ...

  // 固定祝日
  if (month === 1 && day === 1) return true // 元日
  if (month === 2 && day === 11) return true // 建国記念の日
  if (month === 2 && day === 23) return true // 天皇誕生日
  if (month === 4 && day === 29) return true // 昭和の日
  if (month === 5 && day === 3) return true // 憲法記念日
  if (month === 5 && day === 4) return true // みどりの日
  if (month === 5 && day === 5) return true // こどもの日
  if (month === 8 && day === 11) return true // 山の日
  if (month === 11 && day === 3) return true // 文化の日
  if (month === 11 && day === 23) return true // 勤労感謝の日

  // ハッピーマンデー (第2月曜: 8-14日, 第3月曜: 15-21日)
  if (month === 1 && dayOfWeek === 1 && day >= 8 && day <= 14) return true // 成人の日
  if (month === 7 && dayOfWeek === 1 && day >= 15 && day <= 21) return true // 海の日
  if (month === 9 && dayOfWeek === 1 && day >= 15 && day <= 21) return true // 敬老の日
  if (month === 10 && dayOfWeek === 1 && day >= 8 && day <= 14) return true // スポーツの日

  // 春分の日・秋分の日の簡易計算 (1980〜2099年)
  const springEquinox = Math.floor(
    20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4),
  )
  if (month === 3 && day === springEquinox) return true

  const autumnEquinox = Math.floor(
    23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4),
  )
  if (month === 9 && day === autumnEquinox) return true

  return false
}

/**
 * デモ用の簡易祝日判定関数（外部依存なし）
 */
export const isHoliday = (date: Date): boolean => {
  if (isBaseHoliday(date)) return true

  const year = date.getFullYear()
  const month = date.getMonth() + 1 // 1-12
  const day = date.getDate()
  const dayOfWeek = date.getDay() // 0: Sun, 1: Mon, ...

  // 振替休日 (前日が日曜かつ祝日だった月曜日)
  if (dayOfWeek === 1) {
    const yesterday = new Date(year, month - 1, day - 1)
    if (isBaseHoliday(yesterday)) return true
  }

  // 5/6振替休日 (5/3, 5/4, 5/5のいずれかが日曜の場合)
  if (month === 5 && day === 6 && (dayOfWeek === 2 || dayOfWeek === 3)) {
    return true
  }

  // 国民の休日 (祝日に挟まれた平日: 例: 敬老の日と秋分の日に挟まれた9/22など)
  if (month === 9 && dayOfWeek >= 2 && dayOfWeek <= 5) {
    const prevDay = new Date(year, month - 1, day - 1)
    const nextDay = new Date(year, month - 1, day + 1)
    if (isBaseHoliday(prevDay) && isBaseHoliday(nextDay)) return true
  }

  return false
}

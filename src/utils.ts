// ユーティリティ: 日付からX座標を計算
export const dateToX = (date: Date, startDate: Date, pxPerDay: number) => {
  const diffTime = date.getTime() - startDate.getTime()
  const diffDays = diffTime / (1000 * 60 * 60 * 24)
  return diffDays * pxPerDay
}

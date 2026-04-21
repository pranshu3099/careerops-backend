export function getNextCheckDelay(score) {
  if (score > 0.8) return 2 * 24 * 60 * 60 * 1000 // 2 days
  if (score > 0.5) return 5 * 24 * 60 * 60 * 1000 // 5 days

  return 10 * 24 * 60 * 60 * 1000 // 10 days
}
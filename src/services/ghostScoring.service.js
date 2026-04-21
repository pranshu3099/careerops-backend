function diffInDays(a, b) {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24))
}

export function calculateGhostScore(app){
  const now = new Date()
  const daysSinceApply = diffInDays(now, app.appliedAt)

  let score = 0

  if (['REJECTED', 'OFFERED'].includes(app.status)) {
    return 0
  }

  if (daysSinceApply > 7) score += 0.3
  if (daysSinceApply > 14) score += 0.4
  if (daysSinceApply > 21) score += 0.3

  if (!app.lastResponseAt) {
    score += 0.3
  } else {
    const daysSinceResponse = diffInDays(now, app.lastResponseAt)

    if (daysSinceResponse > 5) score += 0.2
    if (daysSinceResponse > 10) score += 0.3
  }

  if (app.status === 'APPLIED') score += 0.2
  if (app.status === 'SHORTLISTED') score += 0.1

  return Math.min(score, 1)
}
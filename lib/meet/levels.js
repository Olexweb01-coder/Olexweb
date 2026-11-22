// Levels and XP (Install 58). XP comes only from things Olexweb Meet counts (meetings hosted, hours, people, badges,
// ratings, streak weeks), so nobody can type their way up. The same maths runs on the server and in the app.
export const LEVELS = [[0, 'Newcomer'], [300, 'Starter'], [800, 'Regular'], [1500, 'Connector'], [2500, 'Host'], [4000, 'Community Builder'], [6000, 'Leader'], [9000, 'Trailblazer'], [13000, 'Icon'], [18000, 'Legend']]
export function xpOf(s) {
  const n = (v) => Math.max(0, Math.floor(Number(v) || 0))
  return n(s.meetings) * 50 + Math.floor(n(s.minutes) / 60) * 20 + n(s.people) * 2 + n(s.badges) * 100 + n(s.ratings) * 10 + n(s.streakWeeks) * 30
}
export function levelOf(xp) {
  let i = 0; while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1][0]) i++
  const [from, title] = LEVELS[i], to = LEVELS[i + 1] ? LEVELS[i + 1][0] : null
  return { level: i + 1, title, xp, from, to, pct: to ? Math.min(99, Math.floor(((xp - from) / (to - from)) * 100)) : 100, toNext: to ? to - xp : 0 }
}

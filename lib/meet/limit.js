// Request limits for Meet's public doors (joining, rating, following…): counted in the database so they hold across
// every server at once. Too many in the window and the request is refused politely; a flood can't wear Meet down.
import 'server-only'
import { headers } from 'next/headers'
import { one, q } from './db'
import { Refused } from '@/lib/admin/content'

export function clientIp() {
  try { const h = headers(); return String(h.get('x-forwarded-for') || h.get('x-real-ip') || '').split(',')[0].trim().slice(0, 64) || 'unknown' } catch { return 'unknown' }
}
// e.g. await limit('join:' + clientIp(), 40, 600): at most 40 in 10 minutes
export async function limit(key, max, seconds) {
  const win = Math.floor(Date.now() / 1000 / seconds) * seconds                // the window's start, in seconds
  const r = await one('insert into meet_limits (k, win) values ($1, $2) on conflict (k, win) do update set n = meet_limits.n + 1 returning n', [String(key).slice(0, 200), win]).catch(() => null)
  if (r && r.n > max) throw new Refused('Too many tries. Please wait a few minutes and try again.', 429)
}
export const tidyLimits = () => q('delete from meet_limits where win < extract(epoch from now())::bigint - 86400').catch(() => {})   // windows older than a day

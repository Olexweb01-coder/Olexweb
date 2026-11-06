// One frequent run at a time (Install 11). Two schedulers (GitHub's runner and cron-job.org), or a slow run plus the next
// call, must never overlap: two runs at once could upload or post the same video twice. The lock lasts `minutes`
// (longer than the 5-minute limit a run has on Vercel), so a run that was cut off frees it again by itself.
import 'server-only'
import { q, one } from '@/lib/admin/db'

export async function withRunLock(name, minutes, fn) {
  const got = await one(`insert into run_locks (name, until, started_at) values ($1, now() + ($2 || ' minutes')::interval, now())
      on conflict (name) do update set until = excluded.until, started_at = now() where run_locks.until < now() returning name`, [name, String(minutes)])
  if (!got) return { run: name, skipped: 'already running' }
  try {
    const r = await fn()
    await q('update run_locks set until = now(), finished_at = now(), last_ok = $2, last_report = $3 where name = $1', [name, !(r && r.errors && r.errors.length), JSON.stringify(r || {}).slice(0, 20000)])
    return r
  } catch (e) {
    await q("update run_locks set until = now(), finished_at = now(), last_ok = false, last_report = $2 where name = $1", [name, JSON.stringify({ error: String(e.message || e) })]).catch(() => {})
    throw e
  }
}
// For the Today tab: when the frequent run last finished, and whether it went cleanly
export async function lastRun(name = 'quick') {
  const r = await one('select started_at, finished_at, last_ok from run_locks where name = $1', [name]).catch(() => null)
  return r ? { startedAt: r.started_at ? r.started_at.toISOString() : null, finishedAt: r.finished_at ? r.finished_at.toISOString() : null, ok: r.last_ok } : null
}

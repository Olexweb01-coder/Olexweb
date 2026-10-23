// Live progress for long jobs (finding ideas, writing a script), kept in the database so the admin can show it to anyone
// who opens the page, even after a refresh or when the daily run started the job. Each stage remembers how long it took
// last time, so the countdown gets more accurate with every run.
import 'server-only'
import { q, one } from '@/lib/admin/db'

const SAVE_EVERY = 600                   // ms between database writes (the admin asks about once a second)

export function tracker(kind, plan) {     // plan: [{ key, label, guess }] guess = seconds if there is no history yet
  const t0 = Date.now()
  const st = { kind, started: t0, stage: null, stageStart: t0, done: 0, total: 0, bytes: 0, rate: 0, note: '', finished: false, error: null, stages: plan.map((p) => ({ ...p, secs: null })) }
  let history = {}, lastSave = 0, lastBytes = 0, lastAt = t0, timer = null
  const ready = one('select history from yt_jobs where kind = $1', [kind]).then((r) => { history = (r && r.history) || {} }).catch(() => {})
  async function save(force) {
    const now = Date.now()
    if (!force && now - lastSave < SAVE_EVERY) { if (!timer) timer = setTimeout(() => { timer = null; save(true) }, SAVE_EVERY); return }
    lastSave = now
    const dt = (now - lastAt) / 1000; if (dt >= 0.5) { st.rate = Math.round(((st.bytes - lastBytes) / dt) * 0.6 + st.rate * 0.4); lastBytes = st.bytes; lastAt = now }   // smoothed bytes per second
    await q(`insert into yt_jobs (kind, started_at, updated_at, state, finished_at) values ($1, to_timestamp($2 / 1000.0), now(), $3, null)
             on conflict (kind) do update set updated_at = now(), state = $3, started_at = to_timestamp($2 / 1000.0), finished_at = case when $4 then now() end`,
      [kind, t0, JSON.stringify({ ...st, eta: eta(now) }), st.finished]).catch(() => {})
  }
  function guessOf(s) { return history[s.key] != null ? history[s.key] : s.guess }
  function eta(now) {                     // seconds left: the current stage from its own pace, stages not yet started from last time
    let left = 0
    for (const s of st.stages) {
      if (s.secs != null) continue                                       // finished
      if (s.key === st.stage) {
        const inStage = (now - st.stageStart) / 1000
        left += st.total > 0 && st.done > 0 ? (inStage / st.done) * (st.total - st.done) : Math.max(1, guessOf(s) - inStage)
      } else left += guessOf(s)
    }
    return Math.max(0, Math.round(left))
  }
  return {
    async begin() { await ready; await save(true) },
    async stage(key, total = 0, note = '') {
      const now = Date.now(), cur = st.stages.find((s) => s.key === st.stage)
      if (cur) cur.secs = Math.round((now - st.stageStart) / 100) / 10
      st.stage = key; st.stageStart = now; st.done = 0; st.total = total; st.note = note
      await save(true)
    },
    async skip(key) { const s = st.stages.find((x) => x.key === key); if (s && s.secs == null) { s.secs = 0; s.skipped = true; await save(true) } },
    tick(n = 1, bytes = 0, note) { st.done += n; st.bytes += bytes; if (note) st.note = note; return save(false) },
    total(n) { st.total = n },
    async end(error) {
      const now = Date.now(), cur = st.stages.find((s) => s.key === st.stage)
      if (cur) { cur.secs = Math.round((now - st.stageStart) / 100) / 10; if (error) cur.failed = true }
      if (timer) { clearTimeout(timer); timer = null }
      st.finished = true; st.error = error ? String(error).slice(0, 300) : null; st.stage = null
      if (!error) for (const s of st.stages) if (s.secs != null && !s.skipped && !s.failed) history[s.key] = Math.round(((history[s.key] ?? s.secs) * 0.3 + s.secs * 0.7) * 10) / 10   // learn, leaning on the latest
      await save(true)
      if (!error) await q('update yt_jobs set history = $2 where kind = $1', [kind, JSON.stringify(history)]).catch(() => {})
    },
  }
}

export async function progressOf(kind) {
  const r = await one('select state, updated_at, finished_at from yt_jobs where kind = $1', [kind])
  if (!r || !r.state) return null
  const s = r.state, age = (Date.now() - new Date(r.updated_at)) / 1000
  // a job that stopped reporting for 6 minutes died with its server (the hard limit is 5); say so instead of spinning forever
  const stale = !s.finished && age > 360
  return { ...s, updatedAgo: Math.round(age * 10) / 10, elapsed: Math.round(((s.finished && r.finished_at ? new Date(r.finished_at) : Date.now()) - s.started) / 1000), stale }
}

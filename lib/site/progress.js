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
  if (s.eta != null && !s.finished && s.kind === 'render') s.eta = Math.max(0, Math.round(s.eta - age))   // the factory reports every few seconds; count down in between
  return { ...s, updatedAgo: Math.round(age * 10) / 10, elapsed: Math.round(((s.finished && r.finished_at ? new Date(r.finished_at) : Date.now()) - s.started) / 1000), stale }
}

// ---------- jobs that run elsewhere (the render factory on GitHub) report in; the same bookkeeping, kept in the database ----------
export async function remoteStart(kind, plan, note = '') {
  const now = Date.now(), first = plan[0].key
  const st = { kind, started: now, stage: first, stageStart: now, done: 0, total: 0, bytes: 0, rate: 0, note, finished: false, error: null, stages: plan.map((p) => ({ ...p, secs: null })), lastAt: now, lastBytes: 0 }
  const h = await one('select history from yt_jobs where kind = $1', [kind]).catch(() => null)
  st.eta = etaOf(st, (h && h.history) || {}, now)
  await q(`insert into yt_jobs (kind, started_at, updated_at, state, finished_at) values ($1, now(), now(), $2, null)
           on conflict (kind) do update set started_at = now(), updated_at = now(), state = $2, finished_at = null`, [kind, JSON.stringify(st)])
}
export function etaOf(st, history, now) {
  let left = 0
  for (const s of st.stages) {
    if (s.secs != null) continue
    const g = history[s.key] != null ? history[s.key] : s.guess
    if (s.key === st.stage) { const inStage = (now - st.stageStart) / 1000; left += st.total > 0 && st.done > 0 ? (inStage / st.done) * (st.total - st.done) : Math.max(1, g - inStage) }
    else left += g
  }
  return Math.max(0, Math.round(left))
}
// r: { stage, done, total, note, bytes, error, finished }
export async function remoteReport(kind, r) {
  const row = await one('select state, history from yt_jobs where kind = $1', [kind])
  if (!row || !row.state || row.state.finished) return false
  const st = row.state, history = row.history || {}, now = Date.now()
  if (r.stage && r.stage !== st.stage && st.stages.some((s) => s.key === r.stage)) {
    const order = st.stages.map((s) => s.key)
    for (const s of st.stages) if (s.secs == null && order.indexOf(s.key) < order.indexOf(r.stage)) s.secs = s.key === st.stage ? Math.round((now - st.stageStart) / 100) / 10 : 0
    st.stage = r.stage; st.stageStart = now; st.done = 0; st.total = 0; st.note = ''
  }
  if (Number.isFinite(r.total)) st.total = Math.max(0, Math.round(r.total))
  if (Number.isFinite(r.done)) st.done = Math.max(0, Math.round(r.done))
  if (typeof r.note === 'string') st.note = r.note.slice(0, 160)
  if (Number.isFinite(r.bytes) && r.bytes > 0) {
    st.bytes += Math.round(r.bytes); const dt = (now - st.lastAt) / 1000
    if (dt >= 0.5) { st.rate = Math.round(((st.bytes - st.lastBytes) / dt) * 0.6 + st.rate * 0.4); st.lastBytes = st.bytes; st.lastAt = now }
  }
  if (r.error || r.finished) {
    const cur = st.stages.find((s) => s.key === st.stage)
    if (cur) { cur.secs = Math.round((now - st.stageStart) / 100) / 10; if (r.error) cur.failed = true }
    st.finished = true; st.error = r.error ? String(r.error).slice(0, 300) : null; st.stage = null
    if (!r.error) for (const s of st.stages) if (s.secs != null && !s.skipped && !s.failed && s.secs > 0) history[s.key] = Math.round(((history[s.key] ?? s.secs) * 0.3 + s.secs * 0.7) * 10) / 10
  }
  st.eta = etaOf(st, history, now)
  await q(`update yt_jobs set state = $2, updated_at = now(), history = $3, finished_at = case when $4 then now() end where kind = $1`, [kind, JSON.stringify(st), JSON.stringify(history), st.finished])
  return true
}

// ---------- The Progress tab: everything not finished yet, in three sections ----------
const lagosTime = (d) => { const t = new Date(new Date(d).getTime() + 3600e3); return String(t.getUTCHours()).padStart(2, '0') + ':' + String(t.getUTCMinutes()).padStart(2, '0') }   // Lagos is UTC+1 all year
const JOB_NAMES = { ideas: 'Finding new ideas', script: 'Writing a script', render: 'Making a video in the factory', upload: 'Uploading to YouTube' }
export async function progressPage() {
  const jobs = {}; for (const k of Object.keys(JOB_NAMES)) jobs[k] = await progressOf(k).catch(() => null)
  const rows = (await q(`select s.id, s.kind, s.part, s.status, s.script, s.render_error, s.render_detail, s.updated_at, s.uploaded_at, s.upload, s.hold_until, coalesce(i.name, 'Long video') as name
    from yt_scripts s left join yt_ideas i on i.id = s.idea_id
    where s.status in ('failed', 'needs_review', 'rendering', 'draft') or s.updated_at > now() - interval '1 day' or s.uploaded_at > now() - interval '1 day'
    order by s.updated_at desc limit 80`)).rows
  const label = (r) => r.kind === 'long' ? `Vol. ${(r.script && r.script.volume) || ''} · Long video` : `${r.part ? 'Part ' + r.part + ' · ' : ''}${r.name}`
  const iso = (d) => d && new Date(d).toISOString()
  const needs = [], doing = [], done = []
  for (const r of rows) {
    if (r.status === 'failed' && Date.now() - new Date(r.updated_at) < 7 * 86400e3) needs.push({ id: r.id, title: label(r), why: r.render_error || 'It stopped without a reason.', at: iso(r.updated_at), action: 'retry' })
    else if (r.status === 'needs_review' && r.hold_until) doing.push({ id: r.id, title: label(r), what: 'Autopilot is fixing it; it goes ahead by itself at ' + lagosTime(r.hold_until) + ' (Lagos)', at: iso(r.updated_at) })
    else if (r.status === 'needs_review') needs.push({ id: r.id, title: label(r), why: 'The script is written and waiting for your review before it can be made.', at: iso(r.updated_at), action: 'review', waiting: true })
    else if (r.status === 'rendering') { const j = jobs.render && jobs.render.script === r.id ? jobs.render : null
      if (j && j.stale) needs.push({ id: r.id, title: label(r), why: 'The factory stopped reporting (it may have crashed or timed out). Sending it again usually fixes it.', at: iso(r.updated_at), action: 'retry' })
      else doing.push({ id: r.id, title: label(r), what: 'In the factory', job: j }) }
    else if (r.status === 'rendered' && Date.now() - new Date(r.updated_at) < 86400e3) done.push({ title: label(r), what: 'Video ready · in Videos', at: iso(r.updated_at), link: '/admin/youtube?view=videos' })
    if (r.uploaded_at && Date.now() - new Date(r.uploaded_at) < 86400e3) done.push({ title: label(r), what: 'Posted to YouTube (' + String((r.upload && r.upload.privacy) || 'private').split(' ')[0] + ')', at: iso(r.uploaded_at), link: '/admin/youtube?view=videos' })
  }
  for (const k of ['ideas', 'script', 'upload']) { const j = jobs[k]; if (!j) continue
    if (!j.finished && !j.stale) doing.push({ title: JOB_NAMES[k], what: j.stages && j.stages.find((s) => s.key === j.stage)?.label || 'Working', job: j })
    else if (j.finished && j.error && Date.now() - j.started < 86400e3) needs.push({ title: JOB_NAMES[k], why: j.error, at: new Date(j.started).toISOString(), action: k === 'ideas' ? 'ideas' : 'look' })
    else if (j.finished && !j.error && Date.now() - j.started < 86400e3 && k === 'ideas') done.push({ title: 'Ideas search', what: j.note || 'Finished', at: new Date(j.started).toISOString(), link: '/admin/youtube?view=ideas' }) }
  done.sort((a, b) => String(b.at).localeCompare(String(a.at)))
  return { needs, doing, done, at: new Date().toISOString() }
}

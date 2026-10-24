// The render factory: approved scripts are rendered into videos by GitHub Actions (repo olexweb-factory).
// The factory repo is PUBLIC, so nothing secret travels in the request that starts a run (anyone can read those).
// Instead every call the worker makes back to the admin is signed with FACTORY_SECRET (an HMAC over the time, method,
// path and a SHA-256 of the body), a secret that lives only in Vercel and in the factory's encrypted GitHub secrets.
// Videos come back in 4 MiB pieces (Vercel accepts at most 4.5 MB per request) and are stored like images.
import 'server-only'
import { createHmac, createHash, timingSafeEqual } from 'node:crypto'
import { q, one } from '@/lib/admin/db'
import { putPiece, getPiece as bucketPiece, deletePiece } from '@/lib/admin/storage'
import { remoteStart, remoteReport } from './progress'
import { SITE_ORIGIN } from './youtube'
import { notify } from '@/lib/assistant/notify'

export const PIECE = Number(process.env.FACTORY_PIECE_BYTES) || 1024 * 1024            // 1 MiB: quick requests even on a slow link; a multiple of 256 KiB, as YouTube requires
const MAX_PIECES = 400                                      // 400 MB at 1 MiB: far beyond a Short or a 10-minute video
export const RENDER_STAGES = [
  { key: 'queued', label: 'Waiting for a GitHub machine', guess: 25 }, { key: 'setup', label: 'Setting up the tools', guess: 70 },
  { key: 'capture', label: 'Filming the site', guess: 25 }, { key: 'voice', label: 'Recording the voice', guess: 25 }, { key: 'music', label: 'Music and sound effects', guess: 8 },
  { key: 'render', label: 'Rendering the video', guess: 180 }, { key: 'upload', label: 'Sending the video back', guess: 15 }]
const GH = () => (process.env.FACTORY_GH_API || 'https://api.github.com').replace(/\/$/, '')
const REPO = () => process.env.FACTORY_REPO || 'Olexweb01-coder/olexweb-factory'
export const factoryReady = () => !!(process.env.FACTORY_GH_TOKEN && process.env.FACTORY_SECRET && process.env.FACTORY_SECRET.length >= 32)

// ---------- signatures ----------
export const bodyHash = (buf) => createHash('sha256').update(buf || Buffer.alloc(0)).digest('hex')
export function sign(secret, ts, method, path, hash) { return createHmac('sha256', secret).update(`${ts}\n${method}\n${path}\n${hash}`).digest('hex') }
// Returns true only for a fresh request signed with FACTORY_SECRET over exactly this method, path and body.
export function verify(request, buf) {
  if (!factoryReady()) return false
  const h = request.headers.get('x-factory-sig') || '', m = /^(\d{10})\.([a-f0-9]{64})$/.exec(h)
  if (!m || Math.abs(Date.now() / 1000 - Number(m[1])) > 300) return false
  const u = new URL(request.url), want = sign(process.env.FACTORY_SECRET, m[1], request.method, u.pathname + u.search, bodyHash(buf))
  return timingSafeEqual(Buffer.from(want), Buffer.from(m[2]))
}

// ---------- starting a render ----------
export async function sendToFactory(scriptId, { by = 'you' } = {}) {
  if (!factoryReady()) throw new Error('The factory isn’t set up yet: add FACTORY_SECRET (32+ characters) in Vercel, and the same value in the factory’s GitHub secrets.')
  const busy = await one("select s.id, i.name from yt_scripts s left join yt_ideas i on i.id = s.idea_id where s.status = 'rendering' limit 1")
  if (busy) throw new Error(`The factory is busy with ${busy.name || 'another video'}. One video at a time keeps it within GitHub’s free limits; this one can go next.`)
  // the part number is given once, when the video is first sent, and kept if it has to be made again
  const s = await one(`update yt_scripts set status = 'rendering', render_error = null, render_started_at = now(), updated_at = now(),
      part = case when kind = 'short' then coalesce(part, (select next_part from yt_settings where id = 1)) else part end
      where id = $1 and status in ('approved', 'failed', 'rendered') returning id, part, idea_id, kind, script`, [Number(scriptId)])
  if (!s) throw new Error('Only an approved script can be sent to the factory.')
  if (s.kind === 'short') await q('update yt_settings set next_part = greatest(next_part, $1 + 1) where id = 1', [s.part])
  const name = s.kind === 'long' ? `Long video, Vol. ${s.script.volume}` : (await one('select name from yt_ideas where id = $1', [s.idea_id]))?.name || 'the video'
  await remoteStart('render', RENDER_STAGES, s.kind === 'long' ? name : `${name} · part ${s.part}`)
  await q('update yt_jobs set state = jsonb_set(state, \'{script}\', to_jsonb($1::int)) where kind = \'render\'', [s.id])
  const r = await fetch(`${GH()}/repos/${REPO()}/actions/workflows/render.yml/dispatches`, { method: 'POST', cache: 'no-store',
    headers: { Authorization: 'Bearer ' + process.env.FACTORY_GH_TOKEN, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: 'main', inputs: { id: String(s.id), api: SITE_ORIGIN() } }) }).catch(() => null)
  if (!r || r.status !== 204) {
    const why = !r ? 'GitHub didn’t answer' : r.status === 401 ? 'GitHub refused FACTORY_GH_TOKEN (expired or wrong)' : r.status === 404 ? 'GitHub can’t find the factory’s render workflow (push the factory code first) or the token can’t see that repo' : r.status === 422 ? 'GitHub refused the start request (is the branch called main?)' : 'GitHub answered ' + r.status
    await fail(s.id, why)
    throw new Error('The factory couldn’t start: ' + why + '.')
  }
  return { id: s.id, part: s.part, by }
}
async function fail(id, why) {
  const d = await one('select render_detail from yt_scripts where id = $1', [id]).catch(() => null)
  if (d && d.render_detail && !/database instead/.test(d.render_detail)) why = why + ' · Reason on the admin side: ' + d.render_detail
  await q("update yt_scripts set status = 'failed', render_error = $2, updated_at = now() where id = $1", [id, String(why).slice(0, 500)])
  await remoteReport('render', { error: why })
}

// ---------- where pieces live: the bucket, or (if the bucket refuses) the database as a backup ----------
const keyOf = (id, n) => `vid/${Number(id)}/${String(n).padStart(3, '0')}.bin`
async function storePiece(id, n, buf) {
  const flag = await one('select render_detail from yt_scripts where id = $1', [id])
  const bucketFailed = flag && /database instead/.test(flag.render_detail || '')           // it already failed for this video: don't wait on it again
  try {
    if (bucketFailed) throw new Error('skipped')
    await putPiece(keyOf(id, n), buf); await q('delete from yt_pieces where script_id = $1 and n = $2', [id, n]); return 'bucket'
  }
  catch (e) {
    await q('insert into yt_pieces (script_id, n, data) values ($1, $2, $3) on conflict (script_id, n) do update set data = $3, saved_at = now()', [id, n, buf])
    if (!bucketFailed) await q("update yt_scripts set render_detail = $2 where id = $1", [id, 'The bucket failed, so the video was kept in the database instead: ' + String(e.message).slice(0, 200)])
    return 'database'
  }
}
// A piece (or part of one), from wherever it was kept. Returns a Response-like object with .body/.arrayBuffer(), or null.
export async function getPiece(key, range) {
  const m = /^vid\/(\d+)\/(\d{3})\.bin$/.exec(key); if (!m) return null
  const row = range ? await one('select substring(data from $3 for $4) as d from yt_pieces where script_id = $1 and n = $2', [Number(m[1]), Number(m[2]), range[0] + 1, range[1] - range[0] + 1])
    : await one('select data as d from yt_pieces where script_id = $1 and n = $2', [Number(m[1]), Number(m[2])])
  if (row && row.d) return new Response(row.d)
  return bucketPiece(key, range)
}

// ---------- what the worker asks for, and tells us ----------
async function current(id) { return one("select s.id, s.kind, s.script, s.package, s.part, s.status, s.video, coalesce(i.name, 'Long video') as name, i.url from yt_scripts s left join yt_ideas i on i.id = s.idea_id where s.id = $1", [Number(id)]) }
export async function jobFor(id) {
  const s = await current(id)
  if (!s || s.status !== 'rendering') return null
  const st = await one('select series, voice, spoken_intro from yt_settings where id = 1')
  await q("update yt_scripts set video = null, render_detail = null where id = $1", [s.id])   // a fresh attempt starts with no pieces
  await q('delete from yt_pieces where script_id = $1', [s.id])
  if (s.kind === 'long') return { id: s.id, kind: 'long', volume: s.script.volume, series: st.series, intro: null, voice: s.script.voice || st.voice, site: s.script.site, scenes: s.script.scenes, chapters: s.script.chapters, title: s.package.title, piece: PIECE }
  return { id: s.id, kind: 'short', part: s.part, series: st.series, intro: st.spoken_intro ? `${st.series}, part ${s.part}.` : null, voice: s.script.voice || st.voice, site: s.script.site, scenes: s.script.scenes, title: s.package.title, piece: PIECE }
}
export async function report(id, r) {
  const s = await current(id); if (!s || s.status !== 'rendering') return false
  if (r.error) { await fail(s.id, 'Factory: ' + String(r.error).slice(0, 260)); await notify('ideas', `The video for ${s.name} failed in the factory: ${String(r.error).slice(0, 90)}`, '/admin/youtube?view=scripts'); return true }
  await remoteReport('render', { stage: r.stage, done: r.done, total: r.total, note: r.note, bytes: r.bytes })
  await q('update yt_scripts set updated_at = now() where id = $1', [s.id])
  return true
}
export async function savePiece(id, n, buf) {
  const s = await current(id); if (!s || s.status !== 'rendering') return false
  if (!Number.isInteger(n) || n < 0 || n >= MAX_PIECES || buf.length === 0 || buf.length > PIECE) return false
  const where = await storePiece(s.id, n, buf)
  await q(`update yt_scripts set video = jsonb_set(coalesce(video, '{"pieces":{}}'::jsonb), array['pieces', $2::text], to_jsonb($3::int)), updated_at = now() where id = $1`, [s.id, String(n), buf.length])
  await remoteReport('render', { stage: 'upload', bytes: buf.length, ...(where === 'database' ? { note: 'kept in the database (the bucket refused)' } : {}) })
  return true
}
// The worker says it's done: every piece must be there, all full-size except the last, adding up to the stated size.
export async function finish(id, f) {
  const s = await current(id); if (!s || s.status !== 'rendering') return { ok: false, why: 'not rendering' }
  const pieces = (s.video && s.video.pieces) || {}, n = Number(f.pieces), bytes = Number(f.bytes)
  const sizes = Array.from({ length: n }, (_, i) => pieces[String(i)])
  const complete = n > 0 && n <= MAX_PIECES && sizes.every((x, i) => (i < n - 1 ? x === PIECE : x > 0 && x <= PIECE)) && sizes.reduce((a, b) => a + b, 0) === bytes && Object.keys(pieces).length === n
  if (!complete) { await fail(s.id, 'The video arrived incomplete (' + Object.keys(pieces).length + ' of ' + n + ' pieces). Make it again.'); return { ok: false, why: 'incomplete' } }
  const chapters = Array.isArray(f.chapters) ? f.chapters.slice(0, 40).filter((c) => c && typeof c.title === 'string' && Number.isFinite(c.start)).map((c) => ({ title: String(c.title).slice(0, 60), start: Math.max(0, Number(c.start)) })) : null
  const video = { pieces: n, piece: PIECE, bytes, seconds: Number(f.seconds) || null, width: Number(f.width) || null, height: Number(f.height) || null, made_at: new Date().toISOString(), ...(chapters ? { chapters } : {}) }
  await q("update yt_scripts set status = 'rendered', video = $2, render_error = null, updated_at = now() where id = $1", [s.id, JSON.stringify(video)])
  await remoteReport('render', { finished: true })
  await notify('ideas', `The video for ${s.name} is ready to watch (${Math.round(video.seconds || 0)}s).`, '/admin/youtube?view=scripts')
  return { ok: true }
}
export async function dropVideo(id) {
  const s = await one('select video from yt_scripts where id = $1', [Number(id)])
  const n = s && s.video ? (s.video.pieces > 0 ? s.video.pieces : Object.keys(s.video.pieces || {}).length) : 0
  for (let i = 0; i < n; i++) await deletePiece(keyOf(id, i))
  await q('delete from yt_pieces where script_id = $1', [Number(id)])
}
// A render that stopped reporting for 25 minutes died with its machine: mark it failed so the next one can go.
export async function sweepStuck() {
  const r = (await q("update yt_scripts set status = 'failed', render_error = 'The factory stopped reporting (the GitHub run may have been cancelled or timed out). Make it again.' where status = 'rendering' and updated_at < now() - interval '25 minutes' returning id")).rows
  if (r.length) await remoteReport('render', { error: 'The factory stopped reporting.' })
  return r.length
}
// Autopilot: the oldest approved script goes to the factory when it's free.
export async function sendNext() {
  if (!factoryReady()) return null
  await sweepStuck()
  if (await one("select 1 from yt_scripts where status = 'rendering'")) return null
  const s = await one("select id from yt_scripts where status = 'approved' order by approved_at nulls last limit 1")
  return s ? sendToFactory(s.id, { by: 'Autopilot' }) : null
}

// ---------- watching the video in the admin: byte ranges across the pieces, at most one piece per answer ----------
export async function videoResponse(id, rangeHeader) {
  const s = await one("select video from yt_scripts where id = $1 and status in ('rendered', 'uploaded')", [Number(id)])
  if (!s || !s.video || !s.video.bytes) return new Response('Not found', { status: 404 })
  const total = s.video.bytes, P = s.video.piece || 4 * 1024 * 1024                // videos made before 1 MiB pieces used 4 MiB
  let start = 0, end = total - 1
  const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader || '')
  if (m) { if (m[1] === '' && m[2]) { start = Math.max(0, total - Number(m[2])) } else { start = Number(m[1] || 0); if (m[2]) end = Math.min(total - 1, Number(m[2])) } }
  if (start >= total || start > end) return new Response('', { status: 416, headers: { 'Content-Range': `bytes */${total}` } })
  const piece = Math.floor(start / P), off = start - piece * P
  end = Math.min(end, piece * P + P - 1)                                  // stay inside one piece: the player simply asks for the next part
  const r = await getPiece(`vid/${Number(id)}/${String(piece).padStart(3, '0')}.bin`, [off, off + (end - start)])
  if (!r) return new Response('Not found', { status: 404 })
  return new Response(r.body, { status: 206, headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(end - start + 1), 'Content-Range': `bytes ${start}-${end}/${total}`, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, no-store' } })
}

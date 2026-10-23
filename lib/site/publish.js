// Publishing: a finished video goes to YouTube with the resumable upload, fed from the 4 MiB pieces in storage (each
// piece is a multiple of 256 KiB, as YouTube requires). If the connection drops, the next try asks YouTube how much
// arrived and carries on from there. Until Google's audit approves the app, YouTube keeps API uploads private, so
// "private" is the default; after the audit, "scheduled" publishes each video at the chosen time (Lagos).
import 'server-only'
import { q, one } from '@/lib/admin/db'
import { tracker } from './progress'
import { accessTokenForUpload } from './youtube'
import { dropVideo, getPiece } from './factory'
import { notify } from '@/lib/assistant/notify'

const UPLOAD = () => (process.env.YT_UPLOAD_BASE || 'https://www.googleapis.com').replace(/\/$/, '') + '/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status'
export const UPLOAD_STAGES = [{ key: 'start', label: 'Telling YouTube a video is coming', guess: 2 }, { key: 'send', label: 'Sending the video', guess: 15 }, { key: 'tidy', label: 'Tidying up', guess: 2 }]

// The next publishing slot at the chosen Lagos time (Lagos is UTC+1 all year), at least 30 minutes from now.
export function nextSlot(hhmm, now = Date.now()) {
  const [h, m] = String(hhmm || '18:00').split(':').map(Number)
  const d = new Date(now); d.setUTCHours(h - 1, m || 0, 0, 0)
  while (d.getTime() < now + 30 * 60e3) d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString()
}
async function settings() { return one('select publish_mode, publish_time, made, mention_every from yt_settings where id = 1') }

export async function uploadVideo(scriptId) {
  const p = tracker('upload', UPLOAD_STAGES); await p.begin()
  try { const r = await upload(Number(scriptId), p); await p.end(); return r } catch (e) { await p.end(e.message); throw e }
}
async function upload(id, p) {
  const s = await one("select s.id, s.idea_id, s.package, s.video, s.part, s.upload, i.name from yt_scripts s left join yt_ideas i on i.id = s.idea_id where s.id = $1 and s.status = 'rendered'", [id])
  if (!s || !s.video || !s.video.bytes) throw new Error('Only a finished video can be uploaded.')
  const st = await settings(), total = s.video.bytes, n = s.video.pieces, PIECE = s.video.piece || 4 * 1024 * 1024
  const token = await accessTokenForUpload()
  await p.stage('start', 0, s.name)
  let up = s.upload && s.upload.url && Date.now() - new Date(s.upload.at).getTime() < 6 * 86400e3 ? s.upload : null    // YouTube keeps a session about a week
  let offset = 0
  if (up) {                                                     // resume: ask how much arrived
    const r = await fetch(up.url, { method: 'PUT', headers: { Authorization: 'Bearer ' + token, 'Content-Range': `bytes */${total}` } })
    if (r.status === 200 || r.status === 201) return done(s, await r.json(), st, p)
    if (r.status === 308) { const m = /bytes=0-(\d+)/.exec(r.headers.get('range') || ''); offset = m ? Number(m[1]) + 1 : 0 } else up = null
  }
  if (!up) {
    const pk = s.package, scheduled = st.publish_mode === 'scheduled'
    const meta = { snippet: { title: String(pk.title).slice(0, 100), description: String(pk.description || '').slice(0, 4900), tags: (pk.hashtags || []).map((t) => t.replace(/^#/, '')).slice(0, 15), categoryId: '28' },
      status: { privacyStatus: 'private', ...(scheduled ? { publishAt: nextSlot(st.publish_time) } : {}), selfDeclaredMadeForKids: false, containsSyntheticMedia: false } }
    const r = await fetch(UPLOAD(), { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': 'video/mp4', 'X-Upload-Content-Length': String(total) }, body: JSON.stringify(meta) })
    if (r.status === 403) { const j = await r.json().catch(() => ({})); const why = JSON.stringify(j); throw new Error(/quota/i.test(why) ? 'YouTube’s daily upload allowance is used up; it resets at midnight Pacific time.' : /insufficient|scope/i.test(why) ? 'The YouTube sign-in doesn’t allow uploads. Connect YouTube again and leave every box ticked.' : 'YouTube refused the upload (' + (j.error && j.error.message || 403) + ').') }
    if (!r.ok || !r.headers.get('location')) throw new Error('YouTube didn’t start the upload (' + r.status + ').')
    up = { url: r.headers.get('location'), at: new Date().toISOString(), publishAt: meta.status.publishAt || null }
    await q('update yt_scripts set upload = $2 where id = $1', [id, JSON.stringify(up)])
  }
  await p.stage('send', n, offset ? 'resuming at ' + (offset / 1048576).toFixed(1) + ' MB' : '')
  for (let i = Math.floor(offset / PIECE); i < n; i++) {
    const start = i * PIECE, skip = Math.max(0, offset - start)
    const res = await getPiece(`vid/${id}/${String(i).padStart(3, '0')}.bin`)
    if (!res) throw new Error('A piece of the video is missing from storage. Make it again in the factory.')
    let buf = Buffer.from(await res.arrayBuffer()); if (skip) buf = buf.subarray(skip)
    const from = start + skip, to = from + buf.length - 1
    const r = await fetch(up.url, { method: 'PUT', headers: { Authorization: 'Bearer ' + token, 'Content-Length': String(buf.length), 'Content-Range': `bytes ${from}-${to}/${total}` }, body: buf })
    if (r.status === 200 || r.status === 201) { await p.tick(1, buf.length); return done(s, await r.json(), st, p) }
    if (r.status !== 308) throw new Error('The upload was interrupted (' + r.status + '). Press Upload again: it carries on where it stopped.')
    await p.tick(1, buf.length, `${((to + 1) / 1048576).toFixed(1)} of ${(total / 1048576).toFixed(1)} MB`)
  }
  throw new Error('YouTube didn’t confirm the upload. Press Upload again: it carries on where it stopped.')
}
async function done(s, v, st, p) {
  await p.stage('tidy')
  const scheduled = !!(s.upload && s.upload.publishAt) || !!(v.status && v.status.publishAt)
  await q("update yt_scripts set status = 'uploaded', yt_video_id = $2, uploaded_at = now(), upload = jsonb_set(coalesce(upload, '{}'::jsonb), '{done}', to_jsonb($3::text)) where id = $1",
    [s.id, v.id, v.status ? v.status.privacyStatus + (v.status.publishAt ? ' until ' + v.status.publishAt : '') : 'private'])
  await q("update yt_ideas set status = 'made' where id = $1", [s.idea_id])
  await q('update yt_settings set made = made + 1 where id = 1')
  await dropVideo(s.id)                                         // YouTube has it now: free the storage
  await notify('ideas', scheduled ? `Part ${s.part} (${s.name}) is uploaded and scheduled.` : `Part ${s.part} (${s.name}) is uploaded to YouTube (private).`, '/admin/youtube?view=scripts')
  return { id: s.id, video: v.id, privacy: v.status && v.status.privacyStatus, publishAt: v.status && v.status.publishAt }
}
// Autopilot: one finished video per run, oldest first.
export async function uploadNext() {
  const s = await one("select id from yt_scripts where status = 'rendered' order by updated_at limit 1")
  return s ? uploadVideo(s.id) : null
}
export async function savePublishSettings({ mode, time }) {
  if (!['private', 'scheduled'].includes(mode) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Choose private or scheduled, and a time like 18:00.')
  return one('update yt_settings set publish_mode = $1, publish_time = $2 where id = 1 returning publish_mode, publish_time', [mode, time])
}

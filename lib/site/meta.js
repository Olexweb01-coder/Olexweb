// Facebook Page Reels through Meta's official API (the "Olexweb Publisher" app, Development mode, own Page only).
// Each Short that goes to YouTube also posts as a Reel on the Page: at most per_day a day, with its guide link.
// Safety: Meta errors that mean a block, an expired sign-in or a missing permission PAUSE posting and notify him.
import 'server-only'
import { q, one } from '@/lib/admin/db'
import { encrypt, decrypt, token as randomToken, sha256 } from '@/lib/admin/crypto'
import { getPiece, dropVideo } from './factory'
import { notify } from '@/lib/assistant/notify'

const V = 'v21.0'
const GRAPH = () => (process.env.META_GRAPH_BASE || 'https://graph.facebook.com') + '/' + V
const DIALOG = () => (process.env.META_DIALOG_BASE || 'https://www.facebook.com') + '/' + V + '/dialog/oauth'
const RUPLOAD = () => (process.env.META_RUPLOAD_BASE || 'https://rupload.facebook.com') + '/video-upload/' + V
export const REDIRECT_PATH = '/admin/api/meta/callback'
export const metaReady = () => !!(process.env.META_APP_ID && process.env.META_APP_SECRET && process.env.META_CONFIG_ID)
export class MetaError extends Error { constructor(m, code, sub) { super(m); this.code = code; this.sub = sub } }

async function graph(path, { method = 'GET', params = {}, token } = {}) {
  const u = new URL(GRAPH() + path), body = new URLSearchParams({ ...params, ...(token ? { access_token: token } : {}) })
  if (method === 'GET') body.forEach((v, k) => u.searchParams.set(k, v))
  const r = await fetch(u, { method, ...(method === 'GET' ? {} : { body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }), signal: AbortSignal.timeout(25000) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || j.error) { const e = j.error || {}; throw new MetaError(e.message || 'Facebook answered ' + r.status, e.code, e.error_subcode) }
  return j
}

// ---------- connecting ----------
export async function connectUrl(origin, userId) {
  if (!metaReady()) throw new MetaError('Add META_APP_ID, META_APP_SECRET and META_CONFIG_ID in Vercel first.')
  const state = randomToken(24)
  await q("delete from meta_oauth_states where created_at < now() - interval '1 day'")
  await q('insert into meta_oauth_states (state_hash, user_id) values ($1, $2)', [sha256(state), userId])
  const p = new URLSearchParams({ client_id: process.env.META_APP_ID, redirect_uri: origin + REDIRECT_PATH, config_id: process.env.META_CONFIG_ID, response_type: 'code', override_default_response_type: 'true', state })
  return DIALOG() + '?' + p.toString()
}
export async function finishConnect(origin, code, state) {
  const s = await one("delete from meta_oauth_states where state_hash = $1 and created_at > now() - interval '15 minutes' returning user_id", [sha256(String(state || ''))])
  if (!s) return { ok: false, why: 'expired' }
  const t = await graph('/oauth/access_token', { params: { client_id: process.env.META_APP_ID, client_secret: process.env.META_APP_SECRET, redirect_uri: origin + REDIRECT_PATH, code: String(code || '') } })
  const long = await graph('/oauth/access_token', { params: { grant_type: 'fb_exchange_token', client_id: process.env.META_APP_ID, client_secret: process.env.META_APP_SECRET, fb_exchange_token: t.access_token } })
  const pages = (await graph('/me/accounts', { params: { fields: 'id,name,access_token,tasks', limit: '50' }, token: long.access_token })).data || []
  const usable = pages.filter((p) => p.access_token && (!p.tasks || p.tasks.includes('CREATE_CONTENT') || p.tasks.includes('MANAGE')))
  if (!usable.length) return { ok: false, why: 'nopages' }
  await q('delete from meta_pages')
  for (const p of usable) await q('insert into meta_pages (page_id, name, token_enc, tasks, selected) values ($1, $2, $3, $4, $5)', [String(p.id), String(p.name).slice(0, 120), encrypt(p.access_token), JSON.stringify(p.tasks || []), usable.length === 1])
  await q('update meta_settings set connected_at = now(), paused_at = null, paused_reason = null where id = 1')
  return { ok: true, pages: usable.length }
}
export async function selectPage(id) { const r = await one('select page_id from meta_pages where page_id = $1', [String(id)]); if (!r) throw new MetaError('Unknown Page.'); await q('update meta_pages set selected = (page_id = $1)', [r.page_id]); return { ok: true } }
export async function disconnect() { await q('delete from meta_pages'); await q('update meta_settings set enabled = false, connected_at = null, paused_at = null, paused_reason = null where id = 1'); return { ok: true } }
export async function setEnabled(on) { await q('update meta_settings set enabled = $1 where id = 1', [on === true]); return { ok: true } }
export async function setPerDay(n) { await q('update meta_settings set per_day = $1 where id = 1', [Math.max(1, Math.min(3, Number(n) || 1))]); return { ok: true } }
export async function resume() { await q('update meta_settings set paused_at = null, paused_reason = null where id = 1'); return { ok: true } }
export async function metaStatus() {
  const s = await one('select enabled, per_day, paused_at, paused_reason, connected_at from meta_settings where id = 1')
  const pages = (await q('select page_id, name, selected from meta_pages order by name')).rows
  const recent = (await q("select s.id, s.fb, coalesce(i.name, 'Long video') as name, s.part from yt_scripts s left join yt_ideas i on i.id = s.idea_id where s.fb is not null order by (s.fb->>'at') desc nulls last limit 8")).rows
  return { ready: metaReady(), enabled: s.enabled, perDay: s.per_day, paused: s.paused_reason ? { reason: s.paused_reason, at: s.paused_at && s.paused_at.toISOString() } : null, pages, page: pages.find((p) => p.selected) || null, recent }
}
// does this upload need to stay in storage for Facebook?
export async function fbWants(s) {
  if (s.kind === 'long' || !metaReady()) return false
  const st = await one('select enabled from meta_settings where id = 1'), p = await one('select 1 from meta_pages where selected')
  return !!(st && st.enabled && p)
}

// ---------- posting ----------
function caption(s, guide) {
  const pk = s.package || {}, tags = (pk.hashtags || []).slice(0, 5).map((t) => '#' + String(t).replace(/^#/, '')).join(' ')
  return [pk.title, guide, tags].filter(Boolean).join('\n\n').slice(0, 2000)
}
async function pause(reason) {
  await q('update meta_settings set paused_at = now(), paused_reason = $1 where id = 1', [reason])
  await notify('facebook', 'Facebook posting paused: ' + reason, '/admin/youtube?view=videos').catch(() => {})
}
function serious(e) {
  if (e.code === 190) return 'the Facebook sign-in expired or was removed. Reconnect the Page.'
  if (e.code === 368 || /temporar(il)?y blocked|spam|restricted/i.test(e.message || '')) return 'Meta reported a block or restriction. Check your Page and account status before resuming.'
  if ([10, 200, 3].includes(e.code)) return 'the app is missing a Facebook permission. Reconnect the Page and allow everything it asks for.'
  return null
}
export async function postNext() {
  if (!metaReady()) return null
  const st = await one('select enabled, per_day, paused_reason from meta_settings where id = 1')
  // keep storage tidy: copies kept for Facebook longer than 4 days (or with Facebook off) are released
  for (const r of (await q("select id from yt_scripts where status = 'uploaded' and fb->>'status' = 'pending' and uploaded_at < now() - interval '4 days'")).rows) { await dropVideo(r.id).catch(() => {}); await q("update yt_scripts set fb = $2 where id = $1", [r.id, JSON.stringify({ status: 'skipped', why: 'kept 4 days without being posted' })]) }
  if (!st || !st.enabled || st.paused_reason) return null
  const page = await one('select page_id, name, token_enc from meta_pages where selected'); if (!page) return null
  const today = (await one("select count(*)::int n from meta_posts where at > now() - interval '24 hours'")).n   // every Reel ever posted is logged here
  if (today >= st.per_day) return null
  const s = await one(`select s.id, s.kind, s.package, s.video, s.idea_id, s.fb from yt_scripts s where s.status = 'uploaded' and s.kind is distinct from 'long' and (s.fb->>'status' = 'pending' or (s.fb->>'status' = 'failed' and coalesce((s.fb->>'tries')::int, 0) < 3))
    and s.video is not null and (s.video->>'bytes') is not null and s.uploaded_at > now() - interval '4 days' order by s.uploaded_at limit 1`)
  if (!s) return null
  const token = decrypt(page.token_enc), tries = ((s.fb && s.fb.tries) || 0) + 1
  try {
    const n = s.video.pieces, parts = []
    for (let i = 0; i < n; i++) { const r = await getPiece(`vid/${s.id}/${String(i).padStart(3, '0')}.bin`); if (!r) throw new MetaError('A piece of the video is missing from storage.'); parts.push(Buffer.from(await r.arrayBuffer())) }
    const buf = Buffer.concat(parts)
    const guide = await one("select slug from dir_entries where idea_id = $1 and status = 'live'", [s.idea_id]).catch(() => null)
    const start = await graph(`/${page.page_id}/video_reels`, { method: 'POST', params: { upload_phase: 'start' }, token })
    const up = await fetch(`${RUPLOAD()}/${start.video_id}`, { method: 'POST', headers: { Authorization: 'OAuth ' + token, offset: '0', file_size: String(buf.length), 'Content-Type': 'application/octet-stream' }, body: buf, signal: AbortSignal.timeout(40000) })
    const uj = await up.json().catch(() => ({})); if (!up.ok || !uj.success) throw new MetaError((uj.error && uj.error.message) || 'The video upload to Facebook failed (' + up.status + ').', uj.error && uj.error.code)
    await graph(`/${page.page_id}/video_reels`, { method: 'POST', params: { upload_phase: 'finish', video_id: start.video_id, video_state: 'PUBLISHED', description: caption(s, guide ? `Full guide (free): https://olexweb.com/tools/${guide.slug}` : '') }, token })
    await q('insert into meta_posts (script_id, video_id) values ($1, $2)', [s.id, String(start.video_id)])
    await q('update yt_scripts set fb = $2 where id = $1', [s.id, JSON.stringify({ status: 'posted', video_id: String(start.video_id), at: new Date().toISOString(), page: page.name })])
    await dropVideo(s.id)                                       // Facebook has it too: free the storage
    return { posted: s.id, video_id: String(start.video_id) }
  } catch (e) {
    const why = serious(e)
    await q('update yt_scripts set fb = $2 where id = $1', [s.id, JSON.stringify({ status: 'failed', error: String(e.message).slice(0, 300), tries, at: null })])
    if (why) await pause(why)
    else if (tries >= 3) { await dropVideo(s.id).catch(() => {}); await notify('facebook', 'A Short couldn’t be posted to Facebook after 3 tries: ' + String(e.message).slice(0, 120), '/admin/youtube?view=videos').catch(() => {}) }
    return { failed: s.id, error: e.message, paused: !!why }
  }
}

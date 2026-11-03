// Facebook Page Reels through Meta's official API (the "Olexweb Publisher" app, Development mode, own Page only).
// Facebook has its OWN posting times and its OWN queue: it picks finished Shorts from the shared library and doesn't wait for
// YouTube (so Reels post publicly while YouTube is still private for the audit). A video's stored copy is kept until both
// YouTube and Facebook have it (Facebook gives up on a video 4 days after YouTube posted it).
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
  return { url: DIALOG() + '?' + p.toString(), state }
}
export async function finishConnect(origin, code, state) {
  const s = await one("delete from meta_oauth_states where state_hash = $1 and created_at > now() - interval '15 minutes' returning user_id", [sha256(String(state || ''))])
  if (!s) return { ok: false, why: 'expired' }
  const owner = await one("select 1 from admin_users where id::text = $1 and role = 'owner'", [String(s.user_id)]); if (!owner) return { ok: false, why: 'expired' }
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
const DEFAULT_TIMES = { 1: ['20:00'], 2: ['13:00', '20:00'], 3: ['12:00', '16:00', '20:00'] }
const okTime = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t || '')
export function fbTimes(st) {                              // the Reel times (Lagos), as many as Reels a day
  const n = Math.max(1, Math.min(3, Number(st && st.per_day) || 1))
  const own = String((st && st.times) || '').split(',').map((t) => t.trim()).filter(okTime)
  return own.length === n ? [...new Set(own)].sort() : DEFAULT_TIMES[n]
}
export async function setPerDay(n) { const k = Math.max(1, Math.min(3, Number(n) || 1)); await q('update meta_settings set per_day = $1, times = $2 where id = 1', [k, DEFAULT_TIMES[k].join(',')]); return { ok: true, times: DEFAULT_TIMES[k] } }
export async function setTimes(list) {
  const t = (Array.isArray(list) ? list : []).map((x) => String(x || '').trim())
  if (!t.length || t.length > 3) throw new MetaError('Choose 1 to 3 Reel times.')
  if (!t.every(okTime)) throw new MetaError('Choose times like 13:00.')
  const u = [...new Set(t)].sort(); if (u.length !== t.length) throw new MetaError('Each Reel time must be different.')
  for (let i = 1; i < u.length; i++) if (toMin(u[i]) - toMin(u[i - 1]) < 120) throw new MetaError('Leave at least 2 hours between Reels.')
  await q('update meta_settings set per_day = $1, times = $2 where id = 1', [u.length, u.join(',')]); return { ok: true, times: u }
}
const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
export async function resume() { await q('update meta_settings set paused_at = null, paused_reason = null where id = 1'); return { ok: true } }
// ---------- the Facebook queue (its own, from the shared library) ----------
const lagosDay = (ms = Date.now()) => new Date(ms + 3600e3).toISOString().slice(0, 10)
const slotMs = (day, hhmm) => Date.parse(`${day}T${hhmm}:00Z`) - 3600e3
const addDays = (day, n) => lagosDay(Date.parse(day + 'T12:00:00Z') - 3600e3 + n * 86400e3)
// A Short Facebook can still post: its copy is in storage (finished and not yet on YouTube, or kept for Facebook after YouTube),
// not posted or skipped, fewer than 3 failed tries, and kept no longer than 4 days after YouTube posted it.
const WAITING = `s.kind is distinct from 'long' and s.video is not null and (s.video->>'bytes') is not null
  and coalesce(s.fb->>'status', '') not in ('posted', 'skipped', 'off') and coalesce((s.fb->>'tries')::int, 0) < 3
  and (s.status = 'rendered' or (s.status = 'uploaded' and s.fb->>'status' in ('pending', 'failed') and s.uploaded_at > now() - interval '4 days'))
  and coalesce((select i.channels->>'facebook' from yt_ideas i where i.id = s.idea_id), 'true') <> 'false'`   // its Facebook tick (Automation → Library)
const ORDER = 'order by coalesce((select i.first from yt_ideas i where i.id = s.idea_id), false) desc, s.part nulls last, s.id'   // Make it next goes first
async function usedToday(times, today) {                 // today's Reel slots already filled
  const rows = (await q("select slot, at from meta_posts where at > now() - interval '2 days' order by at")).rows, used = new Set()
  for (const r of rows) {
    if (r.slot) { used.add(r.slot); continue }
    const d = lagosDay(new Date(r.at).getTime()); if (d !== today) continue      // Reels from before posting times: the day's first free slot
    const t = times.find((x) => !used.has(d + ' ' + x)) || times[times.length - 1]; used.add(d + ' ' + t)
  }
  return used
}
export async function fbQueue(limit = 3) {
  const st = await one('select per_day, times from meta_settings where id = 1'), times = fbTimes(st), now = Date.now(), today = lagosDay(now)
  const used = await usedToday(times, today)
  const rows = (await q(`select s.id, s.part, s.status, coalesce(i.name, 'Short') as name from yt_scripts s left join yt_ideas i on i.id = s.idea_id where ${WAITING} ${ORDER}`)).rows
  const out = []; let k = 0
  for (let d = 0; d < 30 && k < rows.length && out.length < limit; d++) {
    const day = addDays(today, d)
    for (const t of times) { if (k >= rows.length || out.length >= limit) break
      if (used.has(day + ' ' + t) || (d === 0 && slotMs(day, t) < now - 3 * 3600e3)) continue      // a slot missed by hours waits for tomorrow
      out.push({ id: rows[k].id, part: rows[k].part, name: rows[k].name, day, time: t, when: d === 0 ? 'today' : d === 1 ? 'tomorrow' : day }); k++ }
  }
  return { items: out, waiting: rows.length, more: Math.max(0, rows.length - out.length), times, today, todayDone: times.filter((t) => used.has(today + ' ' + t)).length }
}
export async function metaStatus() {
  const s = await one('select enabled, per_day, times, paused_at, paused_reason, connected_at from meta_settings where id = 1')
  const pages = (await q('select page_id, name, selected from meta_pages order by name')).rows
  const recent = (await q("select s.id, s.fb, coalesce(i.name, 'Long video') as name, s.part from yt_scripts s left join yt_ideas i on i.id = s.idea_id where s.fb->>'status' = 'posted' order by (s.fb->>'at') desc nulls last limit 6")).rows
    .map((r) => ({ id: r.id, name: r.name, part: r.part, videoId: r.fb.video_id || null, at: r.fb.at || null }))
  const queue = await fbQueue(3).catch(() => ({ items: [], waiting: 0, more: 0, times: fbTimes(s), todayDone: 0 }))
  return { ready: metaReady(), enabled: s.enabled, perDay: s.per_day, times: fbTimes(s), paused: s.paused_reason ? { reason: s.paused_reason, at: s.paused_at && s.paused_at.toISOString() } : null, pages, page: pages.find((p) => p.selected) || null, recent, queue }
}
// after YouTube has a Short: keep its copy for Facebook only if Facebook is on and hasn't posted it yet
export async function fbWants(s) {
  if (s.kind === 'long' || !metaReady()) return false
  const row = await one('select fb from yt_scripts where id = $1', [s.id]).catch(() => null)
  if (row && row.fb && (['posted', 'skipped', 'off'].includes(row.fb.status) || (row.fb.status === 'failed' && (row.fb.tries || 0) >= 3))) return false
  if (await one("select 1 from yt_ideas where id = $1 and channels->>'facebook' = 'false'", [s.idea_id]).catch(() => null)) return false   // Facebook unticked in the Library
  const st = await one('select enabled from meta_settings where id = 1'), p = await one('select 1 from meta_pages where selected')
  return !!(st && st.enabled && p)
}

// ---------- posting ----------
// Written for Facebook, not copied from YouTube: the hook, one sentence on why it's useful, the free guide, 3 hashtags.
const plain = (t) => String(t || '').replace(/https?:\/\/\S+/g, '').replace(/#[\w-]+/g, '').replace(/\s+/g, ' ').trim()
export function fbCaption(s, guide) {
  const pk = s.package || {}, hook = plain(pk.title)
  const first = (plain(pk.description).match(/^[^.!?]{12,220}[.!?]/) || [''])[0].trim()
  const why = first && first.toLowerCase() !== hook.toLowerCase() ? first : ''
  const tags = (pk.hashtags || []).map((t) => String(t).replace(/^#/, '').replace(/[^\w]/g, '')).filter(Boolean).slice(0, 3).map((t) => '#' + t).join(' ')
  return [hook, why, guide, tags].filter(Boolean).join('\n\n').slice(0, 2000)
}
async function pause(reason) {
  await q('update meta_settings set paused_at = now(), paused_reason = $1 where id = 1', [reason])
  await notify('facebook', 'Facebook posting paused: ' + reason, '/admin/automation/facebook').catch(() => {})
}
function serious(e) {
  if (e.code === 190) return 'the Facebook sign-in expired or was removed. Reconnect the Page.'
  if (e.code === 368 || /temporar(il)?y blocked|spam|restricted/i.test(e.message || '')) return 'Meta reported a block or restriction. Check your Page and account status before resuming.'
  if ([10, 200, 3].includes(e.code)) return 'the app is missing a Facebook permission. Reconnect the Page and allow everything it asks for.'
  return null
}
// free a copy once every channel that wants it has it
// (a Short with YouTube unticked is done once Facebook has it: its copy is freed and its idea counts as made)
async function releaseIfDone(id) {
  const r = await one("select s.status, s.idea_id, coalesce(i.channels->>'youtube', 'true') = 'false' as yt_off from yt_scripts s left join yt_ideas i on i.id = s.idea_id where s.id = $1", [id])
  if (r && (r.status === 'uploaded' || r.yt_off)) await dropVideo(id).catch(() => {})
  if (r && r.yt_off && r.idea_id) await q("update yt_ideas set status = 'made' where id = $1", [r.idea_id]).catch(() => {})
}
export async function postNext() {
  if (!metaReady()) return null
  const st = await one('select enabled, per_day, times, paused_reason from meta_settings where id = 1')
  // storage stays tidy: a copy kept for Facebook more than 4 days after YouTube posted it is released
  for (const r of (await q("select id from yt_scripts where status = 'uploaded' and fb->>'status' in ('pending', 'failed') and uploaded_at < now() - interval '4 days'")).rows) { await dropVideo(r.id).catch(() => {}); await q("update yt_scripts set fb = $2 where id = $1", [r.id, JSON.stringify({ status: 'skipped', why: 'kept 4 days without being posted' })]) }
  if (!st || !st.enabled || st.paused_reason) return null
  const page = await one('select page_id, name, token_enc from meta_pages where selected'); if (!page) return null
  // its own posting times (Lagos): the first of today's slots that has come and isn't filled; never two Reels within the hour
  const times = fbTimes(st), now = Date.now(), today = lagosDay(now), used = await usedToday(times, today)
  const slot = times.find((t) => !used.has(today + ' ' + t) && now >= slotMs(today, t) && now < slotMs(today, t) + 3 * 3600e3)
  if (!slot) return null
  if (await one("select 1 from meta_posts where at > now() - interval '60 minutes'")) return null
  const s = await one(`select s.id, s.kind, s.status, s.package, s.video, s.idea_id, s.fb, s.part from yt_scripts s where ${WAITING} ${ORDER} limit 1`)
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
    await graph(`/${page.page_id}/video_reels`, { method: 'POST', params: { upload_phase: 'finish', video_id: start.video_id, video_state: 'PUBLISHED', description: fbCaption(s, guide ? `Full guide (free): https://olexweb.com/tools/${guide.slug}` : '') }, token })
    const at = today + ' ' + slot
    await q('insert into meta_posts (script_id, video_id, slot) values ($1, $2, $3)', [s.id, String(start.video_id), at])
    await q('update yt_scripts set fb = $2 where id = $1', [s.id, JSON.stringify({ status: 'posted', video_id: String(start.video_id), at: new Date().toISOString(), page: page.name, slot: at })])
    await releaseIfDone(s.id)                                    // YouTube has it too: free the storage (else YouTube frees it later)
    return { posted: s.id, video_id: String(start.video_id), slot: at }
  } catch (e) {
    const why = serious(e)
    await q('update yt_scripts set fb = $2 where id = $1', [s.id, JSON.stringify({ status: 'failed', error: String(e.message).slice(0, 300), tries, at: null })])
    if (why) await pause(why)
    else if (tries >= 3) { await releaseIfDone(s.id); await notify('facebook', 'A Short couldn’t be posted to Facebook after 3 tries: ' + String(e.message).slice(0, 120), '/admin/automation/facebook').catch(() => {}) }
    return { failed: s.id, error: e.message, paused: !!why }
  }
}

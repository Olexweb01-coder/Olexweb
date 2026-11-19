// Install 42: LinkedIn, written for LinkedIn. One post each weekday morning on your own profile, from that day's best
// material (the newest "You build it" video, or the newest article), rewritten the way LinkedIn rewards: a two-line hook
// that earns "see more", short lines, one clear lesson for business owners, a question that invites comments, 3 hashtags,
// the picture, and NO link in the post (links cut reach): the link goes in the first comment, posted by itself.
// Needs LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET (an app with "Sign In with LinkedIn using OpenID Connect" and
// "Share on LinkedIn"). LinkedIn's sign-in lasts about 60 days: you're reminded a week before, and it pauses itself when it ends.
import 'server-only'
import { q, one } from '@/lib/admin/db'
import { encrypt, decrypt, token as randomToken, sha256 } from '@/lib/admin/crypto'
import { askJSON } from '@/lib/assistant/llm'
import { lessonsFor } from '@/lib/assistant/memory'
import { notify } from '@/lib/assistant/notify'
export const LI_REDIRECT = '/admin/api/linkedin/callback'
export const liReady = () => !!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET)
const AUTH = () => process.env.LI_AUTH_BASE || 'https://www.linkedin.com/oauth/v2', API = () => process.env.LI_API_BASE || 'https://api.linkedin.com'
const SITE = () => (process.env.YT_SITE_ORIGIN || 'https://olexweb.com').replace(/\/$/, '')
// LinkedIn's API is versioned by month and each version lives about a year: use the one from two months ago
const version = (back = 2) => { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - back); return d.getUTCFullYear() + String(d.getUTCMonth() + 1).padStart(2, '0') }
class LiError extends Error { constructor(m, status) { super(m); this.status = status } }
async function li(path, { method = 'GET', body, token, raw } = {}) {
  for (let back = 2; back <= 4; back++) {
    const r = await fetch(API() + path, { method, headers: { Authorization: 'Bearer ' + token, 'LinkedIn-Version': version(back), 'X-Restli-Protocol-Version': '2.0.0', ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000) })
    if (r.ok) return raw ? r : (r.status === 201 || r.status === 204 ? { id: r.headers.get('x-restli-id') || r.headers.get('x-linkedin-id') } : r.json())
    const t = await r.text().catch(() => '')
    if (r.status === 426 || /version/i.test(t) && r.status === 400) continue   // that month's version is gone: try an older one
    throw new LiError('LinkedIn answered ' + r.status + ': ' + t.slice(0, 200), r.status)
  }
  throw new LiError('LinkedIn refused every API version.', 426)
}

// ---------- connecting (owner only) ----------
export async function liConnectUrl(origin, userId) {
  if (!liReady()) throw new LiError('Add LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET in Vercel first.')
  const state = randomToken(24)
  await q("delete from li_oauth_states where created_at < now() - interval '1 day'")
  await q('insert into li_oauth_states (state_hash, user_id) values ($1, $2)', [sha256(state), String(userId)])
  const p = new URLSearchParams({ response_type: 'code', client_id: process.env.LINKEDIN_CLIENT_ID, redirect_uri: origin + LI_REDIRECT, state, scope: 'openid profile w_member_social' })
  return { url: AUTH() + '/authorization?' + p.toString(), state }
}
export async function liFinishConnect(origin, code, state) {
  const s = await one("delete from li_oauth_states where state_hash = $1 and created_at > now() - interval '15 minutes' returning user_id", [sha256(String(state || ''))])
  if (!s) return { ok: false, why: 'expired' }
  if (!(await one("select 1 from admin_users where id::text = $1 and role = 'owner'", [s.user_id]))) return { ok: false, why: 'expired' }
  const r = await fetch(AUTH() + '/accessToken', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code: String(code || ''), redirect_uri: origin + LI_REDIRECT, client_id: process.env.LINKEDIN_CLIENT_ID, client_secret: process.env.LINKEDIN_CLIENT_SECRET }), signal: AbortSignal.timeout(20000) })
  const t = await r.json().catch(() => ({})); if (!r.ok || !t.access_token) return { ok: false, why: 'failed' }
  const me = await fetch(API() + '/v2/userinfo', { headers: { Authorization: 'Bearer ' + t.access_token }, signal: AbortSignal.timeout(20000) }).then((x) => x.json()).catch(() => ({}))
  if (!me.sub) return { ok: false, why: 'failed' }
  await q(`update li_settings set token_enc = $1, expires_at = now() + make_interval(secs => $2), person_urn = $3, name = $4, connected_at = now(), paused_reason = null, warned_at = null, enabled = true where id = 1`,
    [encrypt(t.access_token), Number(t.expires_in) || 5184000, 'urn:li:person:' + me.sub, String(me.name || 'You').slice(0, 120)])
  return { ok: true }
}
export async function liDisconnect() { await q('update li_settings set token_enc = null, expires_at = null, person_urn = null, connected_at = null, enabled = false where id = 1'); return { ok: true } }
export async function liSetEnabled(on) { await q('update li_settings set enabled = $1, paused_reason = case when $1 then null else paused_reason end where id = 1', [on === true]); return { ok: true } }

// ---------- what to post: the newest video or article not yet on LinkedIn (videos and articles take turns) ----------
async function nextMaterial() {
  const video = await one(`select s.yt_video_id as ref, coalesce(s.package->>'title', '') as title, s.script->>'topic' as topic, s.script->>'answer' as answer,
      (select string_agg(x->>'line', ' ') from jsonb_array_elements(coalesce(s.script->'scene'->'steps', '[]'::jsonb)) x) as lines
    from yt_scripts s where s.status = 'uploaded' and s.yt_video_id is not null and s.uploaded_at > now() - interval '10 days'
      and not exists (select 1 from li_posts p where p.kind = 'video' and p.ref = s.yt_video_id) order by s.uploaded_at desc limit 1`).catch(() => null)
  const article = await one(`select p.slug as ref, p.title, p.summary, (select left(string_agg(b->>'text', ' '), 3500) from jsonb_array_elements(case when jsonb_typeof(p.body) = 'array' then p.body else '[]'::jsonb end) b) as body
    from posts p where p.status = 'live' and p.published_on > current_date - 21 and not exists (select 1 from li_posts l where l.kind = 'article' and l.ref = p.slug)
    order by p.published_on desc, p.id desc limit 1`).catch(() => null)
  const last = await one("select kind from li_posts where status = 'posted' order by posted_at desc limit 1").catch(() => null)
  const order = last && last.kind === 'video' ? [article && { kind: 'article', ...article }, video && { kind: 'video', ...video }] : [video && { kind: 'video', ...video }, article && { kind: 'article', ...article }]
  return order.find(Boolean) || null
}
const SYSTEM = `You write LinkedIn posts for Olaitan, founder of Olexweb (a web studio in Lagos that builds fast websites, web apps and AI tools for businesses). Readers: business owners, founders and managers in Nigeria and beyond. Voice: a builder who explains how tech really works, plainly, warmly, with authority; first person; no hype, no clichés ("game-changer", "in today's fast-paced world", "let's dive in", "unlock"), no emojis except at most one, never "as an AI".`
const BRIEF = (m) => `Write ONE LinkedIn post from this ${m.kind === 'video' ? `"You build it" video (it explains ${m.answer || m.topic || m.title} by building it one problem at a time). Its lines: ${String(m.lines || m.title).slice(0, 2500)}` : `article: "${m.title}". Summary: ${m.summary || ''}. Text: ${String(m.body || '').slice(0, 3000)}`}

How LinkedIn rewards a post (follow every point):
- Lines 1 and 2 are the hook, under 200 characters together (all people see before "see more"): a surprising fact, a bold claim, or a tiny story. Never start with "I'm excited", "In today's", a question, or the topic's name.
- Then short paragraphs of 1 or 2 lines with an empty line between them. 900 to 1500 characters in all.
- Teach the real thing in plain words (how it works, the chain of problems and fixes), then ONE lesson for a business owner (what it means for their business, website or customers).
- End with one specific question that people can answer from their own experience.
- Then 3 relevant hashtags on the last line.
- NO links and NO URLs anywhere (the link is added as the first comment). Don't say "link in the comments" more than once.
- Facts must be correct. No brands' or companies' names unless the source names them.
Also write "comment": the first comment, one short line that adds something and invites a click, ending with exactly {LINK}.
Answer as JSON: {"text","comment"}`
export function checkPost(t, c) {
  const lines = String(t || '').split('\n').filter((x) => x.trim()), hook = lines.slice(0, 2).join(' ')
  const tags = (String(t).match(/#[A-Za-z]\w+/g) || []).length, emojis = (String(t).match(/\p{Extended_Pictographic}/gu) || []).length
  const out = []
  if (t.length < 700 || t.length > 1900) out.push(`length ${t.length} (900 to 1500)`)
  if (hook.length > 220) out.push('the hook (lines 1 and 2) is over 200 characters')
  if (/https?:\/\/|www\.|\.com\b/i.test(t)) out.push('a link is in the post (it goes in the comment)')
  if (!/\?/.test(lines.slice(-3).join(' '))) out.push('no question at the end')
  if (tags < 2 || tags > 5) out.push(`${tags} hashtags (3)`)
  if (emojis > 2) out.push('too many emojis')
  if (/game[- ]changer|fast-paced world|let's dive|unlock the|as an ai/i.test(t)) out.push('a cliché')
  if (!/\{LINK\}/.test(c || '')) out.push('the comment has no {LINK}')
  return out
}
async function writePost(m) {
  const learned = await lessonsFor('LinkedIn post hook business owners').catch(() => '')
  let best = null
  for (let a = 0; a < 3; a++) {
    const d = await askJSON({ system: SYSTEM + (learned || ''), prompt: BRIEF(m) + (best ? `\n\nYOUR LAST ONE broke these rules; fix them: ${best.bad.join('; ')}` : ''), schema: { type: 'object', properties: { text: { type: 'string' }, comment: { type: 'string' } }, required: ['text', 'comment'] }, temperature: 0.8, kind: 'write' }).catch(() => null)
    if (!d) continue
    const text = String(d.text || '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 2900), comment = String(d.comment || '').trim().slice(0, 600), bad = checkPost(text, comment)
    if (!best || bad.length < best.bad.length) best = { text, comment, bad }
    if (!bad.length) break
  }
  if (!best || best.bad.some((b) => /link is in|length|hook/.test(b))) throw new Error('The LinkedIn post didn’t pass its checks' + (best ? ' (' + best.bad.join(', ') + ')' : '') + '. It tries again later.')
  return best
}

// ---------- posting ----------
async function uploadImage(token, owner, url) {
  try {
    const img = await fetch(url, { signal: AbortSignal.timeout(20000) }); if (!img.ok) return null
    const bytes = Buffer.from(await img.arrayBuffer()); if (bytes.length < 2000) return null
    const init = await li('/rest/images?action=initializeUpload', { method: 'POST', token, body: { initializeUploadRequest: { owner } } })
    const v = init.value || {}; if (!v.uploadUrl || !v.image) return null
    const put = await fetch(v.uploadUrl, { method: 'PUT', headers: { Authorization: 'Bearer ' + token }, body: bytes, signal: AbortSignal.timeout(60000) })
    return put.ok ? v.image : null
  } catch { return null }
}
export async function liPostNow({ force = false } = {}) {
  const s = await one('select * from li_settings where id = 1')
  if (!liReady() || !s || !s.token_enc) return { skipped: 'LinkedIn isn’t connected' }
  if (!force && (!s.enabled || s.paused_reason)) return { skipped: 'LinkedIn posting is off' }
  if (s.expires_at && new Date(s.expires_at) < Date.now()) { await q("update li_settings set paused_reason = 'LinkedIn’s sign-in ended (it lasts about 60 days). Connect again.' where id = 1"); await notify('window', 'LinkedIn’s sign-in ended, so posting paused. Tap Connect LinkedIn to carry on (one click).', '/admin/linkedin').catch(() => {}); return { paused: true } }
  const m = await nextMaterial(); if (!m) return { skipped: 'nothing new to share' }
  const link = m.kind === 'video' ? `https://youtu.be/${m.ref}` : `${SITE()}/insights/${m.ref}`
  const p = await writePost(m), token = decrypt(s.token_enc)
  try {
    const image = await uploadImage(token, s.person_urn, m.kind === 'video' ? `https://i.ytimg.com/vi/${m.ref}/maxresdefault.jpg` : `${SITE()}/og/olexweb.png`)
    const body = { author: s.person_urn, commentary: p.text, visibility: 'PUBLIC', distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] }, lifecycleState: 'PUBLISHED', isReshareDisabledByAuthor: false }
    if (image) body.content = { media: { id: image, altText: String(m.title || m.topic || 'Olexweb').slice(0, 300) } }
    const made = await li('/rest/posts', { method: 'POST', token, body })
    const urn = made.id
    if (urn) await li(`/rest/socialActions/${encodeURIComponent(urn)}/comments`, { method: 'POST', token, body: { actor: s.person_urn, object: urn, message: { text: p.comment.replace('{LINK}', link) } } }).catch(() => null)
    await q('insert into li_posts (kind, ref, urn, text, link) values ($1, $2, $3, $4, $5)', [m.kind, m.ref, urn, p.text, link])
    await notify('window', `On LinkedIn: “${p.text.split('\n')[0].slice(0, 90)}”`, '/admin/linkedin').catch(() => {})
    return { posted: urn, kind: m.kind }
  } catch (e) {
    if (e.status === 401 || e.status === 403) { await q('update li_settings set paused_reason = $1 where id = 1', ['LinkedIn refused the post (' + e.status + '). Connect again.']); await notify('window', 'LinkedIn refused a post, so posting paused. Tap Connect LinkedIn again.', '/admin/linkedin').catch(() => {}) }
    await q("insert into li_posts (kind, ref, status, error) values ($1, $2, 'failed', $3)", [m.kind, m.ref + '#failed-' + Date.now(), String(e.message).slice(0, 300)])
    throw e
  }
}
// called by the frequent run: the weekday post at its time (Lagos), once a day; and the reminder a week before sign-in ends
export async function liTick() {
  const s = await one('select * from li_settings where id = 1').catch(() => null)
  if (!liReady() || !s || !s.token_enc || !s.enabled || s.paused_reason) return null
  if (s.expires_at && new Date(s.expires_at) - Date.now() < 7 * 864e5 && !s.warned_at) { await q('update li_settings set warned_at = now() where id = 1'); await notify('window', 'LinkedIn’s sign-in ends within a week. Tap Connect LinkedIn once to keep posting.', '/admin/linkedin').catch(() => {}) }
  const lagos = new Date(Date.now() + 3600e3), day = lagos.getUTCDay(), hm = lagos.toISOString().slice(11, 16)
  if (!String(s.days).split(',').includes(String(day)) || hm < s.post_time || hm > '20:00') return null
  if (await one("select 1 from li_posts where status = 'posted' and posted_at > date_trunc('day', now() + interval '1 hour') - interval '1 hour'")) return null
  if (await one("select 1 from li_posts where status = 'failed' and posted_at > now() - interval '45 minutes'")) return null
  return liPostNow()
}
export async function liStatus() {
  const s = await one('select enabled, expires_at, name, connected_at, paused_reason, post_time, days, token_enc is not null as connected from li_settings where id = 1').catch(() => null)
  const posts = (await q("select kind, link, left(text, 260) as text, status, error, posted_at from li_posts order by posted_at desc limit 12").catch(() => ({ rows: [] }))).rows
  return { ready: liReady(), ...(s || {}), posts }
}

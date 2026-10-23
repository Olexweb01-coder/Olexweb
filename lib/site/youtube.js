// YouTube: connecting the channel and keeping its numbers in the admin.
// Sign-in is Google's OAuth with PKCE. The refresh token is stored AES-256-GCM encrypted (lib/admin/crypto.js).
// The admin's session cookie is SameSite=Strict, so it is NOT sent when Google sends the browser back.
// The way back is therefore proven by a one-time state instead: made here by the signed-in owner, kept as a
// SHA-256 fingerprint for 10 minutes, matched against a second copy in a short-lived cookie, then deleted.
// Needs YT_CLIENT_ID and YT_CLIENT_SECRET. The YT_*_URL / YT_*_BASE variables exist only so tests can stand in for Google.
import 'server-only'
import { createHash } from 'node:crypto'
import { q, one } from '@/lib/admin/db'
import { token, sha256, encrypt, decrypt } from '@/lib/admin/crypto'
import { audit } from '@/lib/admin/auth'

const AUTH_URL = () => process.env.YT_AUTH_URL || 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = () => process.env.YT_TOKEN_URL || 'https://oauth2.googleapis.com/token'
const REVOKE_URL = () => process.env.YT_REVOKE_URL || 'https://oauth2.googleapis.com/revoke'
const API = () => (process.env.YT_API_BASE || 'https://www.googleapis.com').replace(/\/$/, '')
const ANALYTICS = () => (process.env.YT_ANALYTICS_BASE || 'https://youtubeanalytics.googleapis.com').replace(/\/$/, '')
export const REDIRECT_PATH = '/admin/api/youtube/callback'
// Always the address registered in Google Cloud, so a sign-in started on a preview deployment can't go astray.
export const SITE_ORIGIN = () => (process.env.YT_SITE_ORIGIN || 'https://olexweb.com').replace(/\/$/, '')
export const STATE_COOKIE = 'olex_yt_state'
// Read the channel and its analytics now; upload is asked for now too, so the factory never needs a second sign-in.
const SCOPES = ['https://www.googleapis.com/auth/youtube.readonly', 'https://www.googleapis.com/auth/yt-analytics.readonly', 'https://www.googleapis.com/auth/youtube.upload']
export const ytReady = () => !!(process.env.YT_CLIENT_ID && process.env.YT_CLIENT_SECRET)
const SHORT_MAX = 180                                       // Shorts can run up to 3 minutes
const day = (offset) => new Date(Date.now() + 3600e3 - offset * 86400e3).toISOString().slice(0, 10)   // Lagos dates, like Search Console

export class YtError extends Error { constructor(msg, code) { super(msg); this.code = code } }

// ---------- connecting ----------
export async function startConnect(userId, origin) {
  if (!ytReady()) throw new YtError('YouTube isn’t set up yet: add YT_CLIENT_ID and YT_CLIENT_SECRET in Vercel.', 'not_ready')
  await q('delete from yt_oauth_states where expires_at < now()')
  const state = token(), verifier = token(48)
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  await q("insert into yt_oauth_states (state_hash, user_id, verifier_enc, expires_at) values ($1, $2, $3, now() + interval '10 minutes')", [sha256(state), userId, encrypt(verifier)])
  const p = new URLSearchParams({ client_id: process.env.YT_CLIENT_ID, redirect_uri: origin + REDIRECT_PATH, response_type: 'code', scope: SCOPES.join(' '),
    access_type: 'offline', prompt: 'consent select_account', include_granted_scopes: 'true', state, code_challenge: challenge, code_challenge_method: 'S256' })
  return { url: AUTH_URL() + '?' + p.toString(), state }
}

// Returns { ok: true, title } or { ok: false, code } (codes become friendly messages on the YouTube page).
export async function finishConnect({ state, cookieState, code, error, origin, ip }) {
  if (error) return { ok: false, code: error === 'access_denied' ? 'denied' : 'google' }
  if (!state || !cookieState || state !== cookieState || !code) return { ok: false, code: 'expired' }
  const s = await one('delete from yt_oauth_states where state_hash = $1 and expires_at > now() returning user_id, verifier_enc', [sha256(state)])   // one use only
  if (!s) return { ok: false, code: 'expired' }
  const r = await fetch(TOKEN_URL(), { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, client_id: process.env.YT_CLIENT_ID, client_secret: process.env.YT_CLIENT_SECRET,
      redirect_uri: origin + REDIRECT_PATH, code_verifier: decrypt(s.verifier_enc) }) }).catch(() => null)
  const j = r ? await r.json().catch(() => ({})) : {}
  if (!r || !r.ok || !j.access_token) { console.error('youtube token exchange failed', r && r.status, j.error, j.error_description); return { ok: false, code: 'exchange' } }
  if (!j.refresh_token) return { ok: false, code: 'no_refresh' }
  const granted = String(j.scope || '').split(' ')
  if (!granted.some((x) => x.endsWith('/youtube.readonly')) || !granted.some((x) => x.endsWith('/yt-analytics.readonly'))) return { ok: false, code: 'scopes' }
  const ch = await channelInfo(j.access_token)
  if (!ch) return { ok: false, code: 'no_channel' }
  await q(`update yt_account set channel_id = $1, title = $2, handle = $3, thumb = $4, refresh_enc = $5, scopes = $6, connected_at = now(),
           subscribers = $7, views = $8, videos = $9, last_error = null where id = 1`,
    [ch.id, ch.title, ch.handle, ch.thumb, encrypt(j.refresh_token), granted.join(' '), ch.subscribers, ch.views, ch.videos])
  TOKEN = { value: j.access_token, exp: Date.now() + (Number(j.expires_in) || 3600) * 1000 }
  await audit(s.user_id, 'youtube_connected', { channel: ch.id, title: ch.title }, ip)
  try { await syncYouTube() } catch (e) { console.error('first youtube sync failed', e.message) }      // numbers right away; a failure here doesn't undo the connection
  return { ok: true, title: ch.title }
}

export async function disconnect(userId, ip) {
  const a = await one('select refresh_enc, channel_id from yt_account where id = 1')
  if (a && a.refresh_enc) {
    try { await fetch(REVOKE_URL(), { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: decrypt(a.refresh_enc) }) }) } catch {}
  }
  await q('update yt_account set refresh_enc = null, scopes = null, connected_at = null, last_error = null where id = 1')
  TOKEN = null
  await audit(userId, 'youtube_disconnected', { channel: a && a.channel_id }, ip)
}

// ---------- talking to Google ----------
let TOKEN = null
async function accessToken() {
  if (TOKEN && TOKEN.exp > Date.now() + 60e3) return TOKEN.value
  const a = await one('select refresh_enc from yt_account where id = 1')
  if (!a || !a.refresh_enc) throw new YtError('YouTube isn’t connected.', 'not_connected')
  const r = await fetch(TOKEN_URL(), { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: decrypt(a.refresh_enc), client_id: process.env.YT_CLIENT_ID, client_secret: process.env.YT_CLIENT_SECRET }) })
  const j = await r.json().catch(() => ({}))
  if (j.error === 'invalid_grant') {          // removed in the Google account, password changed, or the app put back in Testing
    await q('update yt_account set refresh_enc = null, connected_at = null where id = 1')
    throw new YtError('Google no longer accepts the YouTube sign-in. Connect YouTube again.', 'revoked')
  }
  if (!r.ok || !j.access_token) throw new YtError('Google didn’t answer the sign-in refresh (' + r.status + '). It will try again on the next sync.', 'refresh')
  TOKEN = { value: j.access_token, exp: Date.now() + (Number(j.expires_in) || 3600) * 1000 }
  return TOKEN.value
}
async function get(base, path, params, bearer) {
  const r = await fetch(base + path + '?' + new URLSearchParams(params).toString(), { cache: 'no-store', headers: { Authorization: 'Bearer ' + (bearer || await accessToken()) } })
  const j = await r.json().catch(() => ({}))
  if (r.status === 403) {
    const reason = (j.error && j.error.errors && j.error.errors[0] && j.error.errors[0].reason) || ''
    if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') throw new YtError('YouTube’s daily allowance for this app is used up. It resets at midnight Pacific time.', 'quota')
    if (/accessNotConfigured|SERVICE_DISABLED/i.test(JSON.stringify(j))) throw new YtError('An API is switched off in Google Cloud: enable the YouTube Data API v3 and the YouTube Analytics API.', 'api_off')
    throw new YtError('YouTube refused the request (' + (reason || 403) + ').', 'forbidden')
  }
  if (!r.ok) throw new YtError('YouTube returned an error (' + r.status + (j.error && j.error.message ? ': ' + j.error.message : '') + ').', 'api')
  return j
}
async function channelInfo(bearer) {
  const j = await get(API(), '/youtube/v3/channels', { part: 'snippet,statistics,contentDetails', mine: 'true' }, bearer)
  const c = j.items && j.items[0]
  if (!c) return null
  const th = c.snippet.thumbnails || {}
  return { id: c.id, title: c.snippet.title, handle: c.snippet.customUrl || '', thumb: (th.medium || th.default || {}).url || '',
    subscribers: c.statistics.hiddenSubscriberCount ? null : Number(c.statistics.subscriberCount || 0), views: Number(c.statistics.viewCount || 0),
    videos: Number(c.statistics.videoCount || 0), uploads: c.contentDetails && c.contentDetails.relatedPlaylists && c.contentDetails.relatedPlaylists.uploads }
}
export function seconds(iso) {          // ISO 8601 duration, e.g. PT1M5S → 65
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(String(iso || ''))
  return m ? Math.round((+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0)) : null
}
const rowsOf = (j) => { const cols = (j.columnHeaders || []).map((c) => c.name); return (j.rows || []).map((r) => Object.fromEntries(cols.map((c, i) => [c, r[i]]))) }

// ---------- the daily sync: channel, videos, analytics ----------
// Costs about 5 + (videos / 50) × 2 units of YouTube's 10,000-a-day allowance, so it can run often.
export async function syncYouTube() {
  try {
    const ch = await channelInfo()
    if (!ch) throw new YtError('That Google account no longer has a YouTube channel.', 'no_channel')
    await q('update yt_account set title = $1, handle = $2, thumb = $3, subscribers = $4, views = $5, videos = $6 where id = 1', [ch.title, ch.handle, ch.thumb, ch.subscribers, ch.views, ch.videos])
    // every upload (newest first, up to 500)
    const ids = []; let page = ''
    if (ch.uploads) for (let n = 0; n < 10; n++) {
      const j = await get(API(), '/youtube/v3/playlistItems', { part: 'contentDetails', playlistId: ch.uploads, maxResults: '50', ...(page ? { pageToken: page } : {}) })
      for (const it of j.items || []) ids.push(it.contentDetails.videoId)
      if (!j.nextPageToken) break; page = j.nextPageToken
    }
    const today = day(0)
    for (let i = 0; i < ids.length; i += 50) {
      const j = await get(API(), '/youtube/v3/videos', { part: 'snippet,contentDetails,statistics,status', id: ids.slice(i, i + 50).join(','), maxResults: '50' })
      for (const v of j.items || []) {
        const sec = seconds(v.contentDetails.duration), th = v.snippet.thumbnails || {}, st = v.statistics || {}
        const views = Number(st.viewCount || 0), likes = Number(st.likeCount || 0), comments = Number(st.commentCount || 0)
        await q(`insert into yt_videos (video_id, title, published_at, duration_s, is_short, thumb, privacy, views, likes, comments, updated_at)
                 values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
                 on conflict (video_id) do update set title = $2, published_at = $3, duration_s = $4, is_short = $5, thumb = $6, privacy = $7, views = $8, likes = $9, comments = $10, updated_at = now()`,
          [v.id, String(v.snippet.title).slice(0, 300), v.snippet.publishedAt || null, sec, sec !== null && sec <= SHORT_MAX, (th.medium || th.default || {}).url || '', v.status && v.status.privacyStatus, views, likes, comments])
        await q('insert into yt_snap (day, video_id, views, likes, comments) values ($1, $2, $3, $4, $5) on conflict (day, video_id) do update set views = $3, likes = $4, comments = $5', [today, v.id, views, likes, comments])
      }
    }
    if (ids.length) await q('delete from yt_videos where not (video_id = any($1))', [ids])      // removed from YouTube → removed here
    // channel per day, last 90 days (YouTube Analytics runs about 2 days behind)
    const daily = rowsOf(await get(ANALYTICS(), '/v2/reports', { ids: 'channel==MINE', startDate: day(92), endDate: day(0), dimensions: 'day', sort: 'day',
      metrics: 'views,estimatedMinutesWatched,averageViewPercentage,subscribersGained,subscribersLost,likes,shares' }))
    for (const r of daily)
      await q(`insert into yt_daily (day, views, minutes, avg_view_pct, subs_gained, subs_lost, likes, shares) values ($1, $2, $3, $4, $5, $6, $7, $8)
               on conflict (day) do update set views = $2, minutes = $3, avg_view_pct = $4, subs_gained = $5, subs_lost = $6, likes = $7, shares = $8`,
        [r.day, Math.round(r.views || 0), Number(r.estimatedMinutesWatched || 0), r.averageViewPercentage == null ? null : Number(r.averageViewPercentage), Math.round(r.subscribersGained || 0), Math.round(r.subscribersLost || 0), Math.round(r.likes || 0), Math.round(r.shares || 0)])
    // each video over its whole life: how much of it people watched, and what it brought in
    if (ids.length) {
      const per = rowsOf(await get(ANALYTICS(), '/v2/reports', { ids: 'channel==MINE', startDate: '2005-04-23', endDate: day(0), dimensions: 'video', sort: '-views', maxResults: '200',
        metrics: 'views,estimatedMinutesWatched,averageViewPercentage,shares,subscribersGained' }))
      for (const r of per)
        await q('update yt_videos set minutes = $2, avg_view_pct = $3, shares = $4, subs_gained = $5 where video_id = $1',
          [r.video, Number(r.estimatedMinutesWatched || 0), r.averageViewPercentage == null ? null : Number(r.averageViewPercentage), Math.round(r.shares || 0), Math.round(r.subscribersGained || 0)])
    }
    await q('delete from yt_snap where day < $1', [day(400)])
    await q('update yt_account set last_sync = now(), last_error = null where id = 1')
    return { videos: ids.length, days: daily.length }
  } catch (e) {
    await q('update yt_account set last_sync = now(), last_error = $1 where id = 1', [String(e.message).slice(0, 400)]).catch(() => {})
    throw e
  }
}
export async function youtubeConnected() { const a = await one('select refresh_enc is not null as connected, last_sync from yt_account where id = 1'); return a || { connected: false, last_sync: null } }

// ---------- what the YouTube page shows ----------
export async function youtubeData(days = 28) {
  const a = await one('select channel_id, title, handle, thumb, refresh_enc is not null as connected, connected_at, subscribers, views, videos, last_sync, last_error from yt_account where id = 1')
  const out = { ready: ytReady(), connected: !!(a && a.connected), account: a ? { ...a, connected: undefined } : null, days }
  if (!a || !a.channel_id) return out
  const sum = async (from, to) => one(`select coalesce(sum(views),0)::int as views, coalesce(sum(minutes),0)::float as minutes, coalesce(sum(subs_gained),0)::int as gained,
      coalesce(sum(subs_lost),0)::int as lost, coalesce(sum(likes),0)::int as likes, coalesce(sum(shares),0)::int as shares,
      case when sum(views) > 0 then sum(avg_view_pct * views) / sum(views) end::float as avg_pct
    from yt_daily where day > $1 and day <= $2`, [from, to])
  out.totals = await sum(day(days + 2), day(0))
  out.before = await sum(day(days * 2 + 2), day(days + 2))
  out.series = (await q('select to_char(day, \'YYYY-MM-DD\') as day, views, subs_gained from yt_daily where day > $1 order by day', [day(days + 2)])).rows
  out.lastDataDay = (await one("select to_char(max(day), 'YYYY-MM-DD') as d from yt_daily")).d
  const vids = (await q(`select video_id, title, published_at, duration_s, is_short, thumb, privacy, views::int as views, likes, comments, minutes, avg_view_pct, shares, subs_gained
                         from yt_videos order by published_at desc nulls last`)).rows
  out.videos = vids.map((v) => ({ ...v, published_at: v.published_at && v.published_at.toISOString() }))
  // the last 24 hours, from the daily snapshots: which videos are moving right now
  const growth = (await q(`select s.video_id, s.views - coalesce(p.views, s.views) as gained from yt_snap s left join yt_snap p on p.video_id = s.video_id and p.day = s.day - 1
                           where s.day = (select max(day) from yt_snap)`)).rows
  out.growth = Object.fromEntries(growth.map((g) => [g.video_id, Number(g.gained)]))
  return out
}

// ---------- is it already covered? (used by Ideas) ----------
// One YouTube search (100 units of the 10,000-a-day allowance) plus one look-up of view counts (1 unit).
// Looks at the last 6 months: videos about it, and how many of those reached 50,000+ views.
export async function coverage(name) {
  const after = new Date(Date.now() - 183 * 86400e3).toISOString()
  const s = await get(API(), '/youtube/v3/search', { part: 'snippet', q: name, type: 'video', maxResults: '15', publishedAfter: after, order: 'relevance', relevanceLanguage: 'en' })
  const want = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '')
  const hits = (s.items || []).filter((it) => want.length < 3 || String(it.snippet.title + ' ' + it.snippet.description).toLowerCase().replace(/[^a-z0-9]+/g, '').includes(want))
  if (!hits.length) return { videos: 0, big: 0, top: 0, topTitle: null, topChannel: null }
  const v = await get(API(), '/youtube/v3/videos', { part: 'statistics,snippet', id: hits.map((h) => h.id.videoId).join(',') })
  const items = (v.items || []).map((x) => ({ views: Number((x.statistics || {}).viewCount || 0), title: x.snippet.title, channel: x.snippet.channelTitle })).sort((a, b) => b.views - a.views)
  return { videos: items.length, big: items.filter((x) => x.views >= 50000).length, top: items[0] ? items[0].views : 0, topTitle: items[0] ? String(items[0].title).slice(0, 140) : null, topChannel: items[0] ? items[0].channel : null }
}
// For uploads (lib/site/publish.js): the same refreshed access, and the upload permission must have been granted.
export async function accessTokenForUpload() {
  const a = await one('select scopes from yt_account where id = 1')
  if (!a || !String(a.scopes || '').includes('youtube.upload')) throw new YtError('The YouTube sign-in doesn’t include uploading. Connect YouTube again and leave every box ticked.', 'scopes')
  return accessToken()
}

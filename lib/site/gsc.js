// Google Search Console (read only): the searches that bring people to olexweb.com, fetched once a day.
// Uses a service account (GSC_CLIENT_EMAIL, GSC_PRIVATE_KEY) that you add to Search Console as a user, and GSC_SITE
// (sc-domain:olexweb.com for a Domain property, or https://olexweb.com/ for a URL-prefix property).
import 'server-only'
import { createSign } from 'node:crypto'
import { q, one } from '@/lib/admin/db'

const TOKEN_URL = () => process.env.GSC_TOKEN_URL || 'https://oauth2.googleapis.com/token'
const API = () => (process.env.GSC_API_BASE || 'https://www.googleapis.com').replace(/\/$/, '')
const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly'
export const gscReady = () => !!(process.env.GSC_CLIENT_EMAIL && process.env.GSC_PRIVATE_KEY && process.env.GSC_SITE)
const b64u = (s) => Buffer.from(s).toString('base64url')
let TOKEN = null

async function accessToken() {
  if (TOKEN && TOKEN.exp > Date.now() + 60e3) return TOKEN.value
  const now = Math.floor(Date.now() / 1000)
  const unsigned = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' + b64u(JSON.stringify({ iss: process.env.GSC_CLIENT_EMAIL, scope: SCOPE, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }))
  const key = process.env.GSC_PRIVATE_KEY.replace(/\\n/g, '\n')
  let sig; try { sig = createSign('RSA-SHA256').update(unsigned).sign(key).toString('base64url') } catch { throw new Error('The private key in GSC_PRIVATE_KEY could not be read. Copy the whole "private_key" value from the key file.') }
  const r = await fetch(TOKEN_URL(), { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: unsigned + '.' + sig }) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || !j.access_token) throw new Error('Google did not accept the service account (' + r.status + (j.error_description ? ': ' + j.error_description : '') + '). Check GSC_CLIENT_EMAIL and GSC_PRIVATE_KEY.')
  TOKEN = { value: j.access_token, exp: Date.now() + (Number(j.expires_in) || 3600) * 1000 }
  return TOKEN.value
}
async function query(body) {
  const url = `${API()}/webmasters/v3/sites/${encodeURIComponent(process.env.GSC_SITE)}/searchAnalytics/query`
  const r = await fetch(url, { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (await accessToken()) }, body: JSON.stringify(body) })
  const j = await r.json().catch(() => ({}))
  if (r.status === 403) throw new Error(`Search Console refused access. Add ${process.env.GSC_CLIENT_EMAIL} as a user of the ${process.env.GSC_SITE} property (Settings, Users and permissions, Restricted is enough).`)
  if (r.status === 404 || r.status === 400) throw new Error(`Search Console doesn’t know the property “${process.env.GSC_SITE}”. Use sc-domain:olexweb.com for a Domain property, or https://olexweb.com/ for a URL-prefix property.`)
  if (!r.ok) throw new Error('Search Console returned an error (' + r.status + ').')
  return j.rows || []
}
const day = (offset) => new Date(Date.now() + 3600e3 - offset * 86400e3).toISOString().slice(0, 10)   // Lagos dates

// Fetch the last 28 days (Google's data runs 2 to 3 days behind). Returns the number of rows saved.
export async function fetchSearchConsole() {
  if (!gscReady()) return 0
  try {
    const range = { startDate: day(29), endDate: day(2) }
    const queries = await query({ ...range, dimensions: ['query'], rowLimit: 100 })
    const pages = await query({ ...range, dimensions: ['page'], rowLimit: 50 })
    const today = day(0)
    await q('delete from gsc_queries where fetched_on = $1 or fetched_on < $2', [today, day(60)])
    for (const [kind, rows] of [['query', queries], ['page', pages]])
      for (const r of rows) await q('insert into gsc_queries (fetched_on, kind, key, clicks, impressions, ctr, position) values ($1, $2, $3, $4, $5, $6, $7) on conflict do nothing',
        [today, kind, String(r.keys[0]).slice(0, 300), Math.round(r.clicks || 0), Math.round(r.impressions || 0), Number(r.ctr || 0), Number(r.position || 0)])
    await q('update gsc_state set last_fetch = now(), last_error = null, rows = $1 where id = 1', [queries.length + pages.length])
    return queries.length + pages.length
  } catch (e) { await q('update gsc_state set last_fetch = now(), last_error = $1 where id = 1', [String(e.message).slice(0, 400)]); throw e }
}
export async function searchData(limit = 20) {
  const s = await one('select last_fetch, last_error, rows from gsc_state where id = 1')
  const latest = await one('select max(fetched_on) as d from gsc_queries')
  const rows = latest && latest.d ? (await q("select kind, key, clicks, impressions, ctr, position from gsc_queries where fetched_on = $1 order by impressions desc, clicks desc", [latest.d])).rows : []
  return { ready: gscReady(), lastFetch: s.last_fetch, error: s.last_error, queries: rows.filter((r) => r.kind === 'query').slice(0, limit), pages: rows.filter((r) => r.kind === 'page').slice(0, limit) }
}

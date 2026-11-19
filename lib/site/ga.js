// Install 40: Google Analytics for Olex AI to read (the GA4 Data API, read-only). Needs GA_PROPERTY_ID (the property's
// number) and a service account given Viewer on it: GA_SA_EMAIL and GA_SA_KEY (its private key). Off without them.
import 'server-only'
import crypto from 'node:crypto'
export const gaReady = () => !!(process.env.GA_PROPERTY_ID && process.env.GA_SA_EMAIL && process.env.GA_SA_KEY)
const B64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url')
let TOKEN = null
async function token() {
  if (TOKEN && TOKEN.exp > Date.now() + 60e3) return TOKEN.v
  const now = Math.floor(Date.now() / 1000), key = String(process.env.GA_SA_KEY).replace(/\\n/g, '\n')
  const head = B64({ alg: 'RS256', typ: 'JWT' }) + '.' + B64({ iss: process.env.GA_SA_EMAIL, scope: 'https://www.googleapis.com/auth/analytics.readonly', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })
  const sig = crypto.createSign('RSA-SHA256').update(head).sign(key).toString('base64url')
  const r = await fetch(process.env.GA_TOKEN_URL || 'https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: head + '.' + sig }) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || !j.access_token) throw new Error('Google Analytics sign-in failed: ' + (j.error_description || j.error || r.status))
  TOKEN = { v: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 }
  return TOKEN.v
}
async function report(body) {
  const base = (process.env.GA_BASE || 'https://analyticsdata.googleapis.com').replace(/\/$/, '')
  const r = await fetch(`${base}/v1beta/properties/${encodeURIComponent(process.env.GA_PROPERTY_ID)}:runReport`, { method: 'POST', headers: { Authorization: 'Bearer ' + (await token()), 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error('Google Analytics answered ' + r.status + ': ' + ((j.error && j.error.message) || '').slice(0, 160))
  return (j.rows || []).map((x) => [...(x.dimensionValues || []).map((d) => d.value), ...(x.metricValues || []).map((m) => Number(m.value))])
}
// the last 28 days: the pages people read most (and how long they stay), and where visitors come from
export async function gaSummary() {
  if (!gaReady()) return null
  const range = [{ startDate: '28daysAgo', endDate: 'yesterday' }]
  const pages = await report({ dateRanges: range, dimensions: [{ name: 'pagePath' }], metrics: [{ name: 'screenPageViews' }, { name: 'averageSessionDuration' }, { name: 'engagementRate' }], orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }], limit: 15 })
  const sources = await report({ dateRanges: range, dimensions: [{ name: 'sessionSource' }], metrics: [{ name: 'sessions' }, { name: 'engagementRate' }], orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 10 })
  return { pages: pages.map(([path, views, secs, eng]) => ({ path, views, secs: Math.round(secs), engaged: Math.round(eng * 100) })), sources: sources.map(([source, sessions, eng]) => ({ source, sessions, engaged: Math.round(eng * 100) })) }
}

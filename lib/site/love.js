// Our Space (love.olexweb.com): the private app for two is its own project (GitHub ourspace, its own Vercel and Neon).
// The Olexweb admin manages it through its admin API, server to server, with US_ADMIN_API_KEY (= its ADMIN_API_KEY).
// No message is ever seen here (they're encrypted on the phones); new spaces start in the app itself, not here.
import 'server-only'
import { Refused } from '@/lib/admin/content'

const base = () => String(process.env.US_APP_URL || '').trim().replace(/\/$/, '')
export const loveReady = () => !!(base() && String(process.env.US_ADMIN_API_KEY || '').length >= 24)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
async function call(path, { method = 'GET', body } = {}) {
  if (!loveReady()) throw new Refused('Our Space isn’t connected: add US_APP_URL and US_ADMIN_API_KEY in Vercel.', 400)
  let r
  try {
    r = await fetch(base() + path, { method, cache: 'no-store', signal: AbortSignal.timeout(15000),
      headers: { Authorization: 'Bearer ' + process.env.US_ADMIN_API_KEY, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined })
  } catch (e) { throw new Refused(`Our Space didn’t answer (${base()}): ${e.name === 'TimeoutError' ? 'it took over 15 seconds' : e.message}.`, 502) }
  const j = await r.json().catch(() => ({}))
  if (r.status === 401) throw new Refused('Our Space refused the key: US_ADMIN_API_KEY here must match ADMIN_API_KEY in the Our Space project.', 502)
  if (r.status === 409 && j.requiredConfirm) return { confirmNeeded: true, ...j }
  if (!r.ok) throw new Refused(j.error || `Our Space answered ${r.status}.`, r.status >= 500 ? 502 : 400)
  return j
}
export const loveUrl = base
export async function loveSpaces() { return call('/api/admin/spaces') }
export async function loveInvite(id, role) { if (!UUID.test(String(id))) throw new Refused('Unknown space.'); return call(`/api/admin/spaces/${id}/invite`, { method: 'POST', body: { role: role === 'host' ? 'host' : 'partner' } }) }
export async function loveBan(id, role, ban) { if (!UUID.test(String(id))) throw new Refused('Unknown space.'); return call(`/api/admin/spaces/${id}`, { method: 'PATCH', body: { action: ban ? 'ban' : 'unban', role: role === 'host' ? 'host' : 'partner' } }) }
export async function loveDelete(id, confirm) { if (!UUID.test(String(id))) throw new Refused('Unknown space.'); return call(`/api/admin/spaces/${id}`, { method: 'DELETE', body: confirm ? { confirm: String(confirm).slice(0, 200) } : undefined }) }

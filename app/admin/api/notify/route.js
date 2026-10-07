// Olex AI notifications for this device: turn on or off, choose kinds, send a test. Owner only.
import { currentUser, sameOrigin, ownerOnly } from '@/lib/admin/auth'
import { respond, refuse, readJson } from '@/lib/admin/respond'
import { Refused } from '@/lib/admin/content'
import { notifyReady, subscribe, unsubscribe, prefsFor, setPrefs, deviceCount, notify } from '@/lib/assistant/notify'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export async function POST(request) {
  if (!sameOrigin(request)) return refuse('Request refused.', 403)
  const u = await currentUser(); if (!u) return refuse('Sign in again.', 401)
  if (!ownerOnly(u)) return refuse('Only Olaitan gets Olex AI notifications.', 403)
  const b = await readJson(request); if (!b) return refuse('Request refused.', 400)
  return respond(async () => {
    if (b.action === 'status') return { ready: notifyReady(), key: process.env.VAPID_PUBLIC_KEY || null, prefs: await prefsFor(u), devices: await deviceCount(u) }
    if (!notifyReady()) throw new Refused('Notifications aren’t set up yet: add VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY (run npm run notify:keys).')
    if (b.action === 'subscribe') { try { await subscribe(u, b.subscription, b.device) } catch (e) { throw new Refused(e.message) } return { ok: true, devices: await deviceCount(u) } }
    if (b.action === 'unsubscribe') { await unsubscribe(u, b.endpoint); return { ok: true, devices: await deviceCount(u) } }
    if (b.action === 'prefs') return { prefs: await setPrefs(u, b.prefs) }
    if (b.action === 'test') { const sent = await notify('run', 'Notifications are working. This is how Olex AI will reach you.', '/admin/assistant'); return { sent } }
    throw new Refused('Unknown action.')
  })
}

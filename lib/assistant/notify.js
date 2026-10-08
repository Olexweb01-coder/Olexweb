// Olex AI notifications (Web Push). Only to the owner, only for the kinds switched on, encrypted for each device,
// and only ever sent to the real push services. Without VAPID keys set, nothing is sent (and nothing breaks).
import 'server-only'
import webpush from 'web-push'
import { q, one } from '@/lib/admin/db'

export const KINDS = { published: 'A post went live', draft: 'A new draft is waiting', research: 'Research is done', run: 'The daily run is done', busy: 'Gemini was busy', review: 'A new review is waiting', lead: 'A new enquiry' }
const PUSH_HOSTS = [/(^|\.)fcm\.googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)notify\.windows\.com$/]
const TEST_HOSTS = (process.env.ASSISTANT_TEST_HOSTS || '').split(',').filter(Boolean)
export const notifyReady = () => !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
export function pushEndpointOk(endpoint) {
  let u; try { u = new URL(endpoint) } catch { return false }
  if (TEST_HOSTS.includes(u.host)) return true
  return u.protocol === 'https:' && PUSH_HOSTS.some((r) => r.test(u.hostname))
}

async function deliver(sub, payload) {
  const d = webpush.generateRequestDetails({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify(payload), {
    vapidDetails: { subject: process.env.VAPID_SUBJECT || 'mailto:info@olexweb.com', publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY },
    TTL: 24 * 3600, urgency: payload.urgency || 'normal' })
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 10000)
  try {
    const r = await fetch(d.endpoint, { method: d.method, headers: d.headers, body: d.body, cache: 'no-store', signal: ctl.signal })
    if (r.status === 404 || r.status === 410) { await q('delete from push_subscriptions where id = $1', [sub.id]); return false }   // the device is gone
    if (r.ok) { await q('update push_subscriptions set last_ok = now(), failures = 0 where id = $1', [sub.id]); return true }
  } catch {} finally { clearTimeout(timer) }
  await q('update push_subscriptions set failures = failures + 1 where id = $1', [sub.id])
  await q('delete from push_subscriptions where id = $1 and failures > 8', [sub.id])
  return false
}

// Send one notification to the owner's devices, if that kind is switched on. Never throws.
export async function notify(kind, body, url = '/admin') {
  try {
    if (!notifyReady() || !KINDS[kind]) return 0
    const subs = (await q(`select s.id, s.endpoint, s.keys from push_subscriptions s join admin_users u on u.id = s.user_id
      left join notify_prefs p on p.user_id = u.id where u.role = 'owner' and u.disabled_at is null and coalesce((p.prefs ->> $1)::boolean, true)`, [kind])).rows
    let sent = 0
    for (const s of subs) if (pushEndpointOk(s.endpoint) && (await deliver(s, { title: 'Olex AI', body: String(body).slice(0, 180), url: /^\/admin(\/|$|\?)/.test(url) ? url : '/admin', tag: kind }))) sent++
    return sent
  } catch (e) { console.error('notify failed', e); return 0 }
}

export async function subscribe(u, sub, device) {
  if (!sub || !pushEndpointOk(sub.endpoint) || !sub.keys || !/^[A-Za-z0-9_-]{40,200}$/.test(sub.keys.p256dh || '') || !/^[A-Za-z0-9_-]{10,60}$/.test(sub.keys.auth || '')) throw new Error('That notification subscription isn’t valid.')
  await q(`insert into push_subscriptions (user_id, endpoint, keys, device) values ($1, $2, $3, $4)
           on conflict (endpoint) do update set user_id = excluded.user_id, keys = excluded.keys, device = excluded.device, failures = 0`, [u.id, sub.endpoint, JSON.stringify({ p256dh: sub.keys.p256dh, auth: sub.keys.auth }), String(device || '').slice(0, 80)])
  await q('insert into notify_prefs (user_id) values ($1) on conflict do nothing', [u.id])
}
export const unsubscribe = (u, endpoint) => q('delete from push_subscriptions where user_id = $1 and endpoint = $2', [u.id, String(endpoint || '')])
export async function prefsFor(u) { const r = await one('select prefs from notify_prefs where user_id = $1', [u.id]); return { ...Object.fromEntries(Object.keys(KINDS).map((k) => [k, true])), ...((r && r.prefs) || {}) } }
export async function setPrefs(u, prefs) {
  const clean = Object.fromEntries(Object.keys(KINDS).map((k) => [k, (prefs || {})[k] !== false]))
  await q('insert into notify_prefs (user_id, prefs) values ($1, $2) on conflict (user_id) do update set prefs = excluded.prefs', [u.id, JSON.stringify(clean)])
  return clean
}
export async function deviceCount(u) { return (await one('select count(*)::int as n from push_subscriptions where user_id = $1', [u.id])).n }

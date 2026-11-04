// Olexweb Mail: delivery reports from the pipes. A permanent bounce (the address doesn't exist) or a spam complaint puts
// the address on the do-not-send list and marks the message; temporary bounces (a full mailbox) are only noted.
//   resend  — signed by Resend (Svix): svix-id, svix-timestamp, svix-signature with RESEND_WEBHOOK_SECRET (whsec_…);
//             reports older than 5 minutes are refused, so an old one can't be replayed.
//   mailjet — Mailjet doesn't sign: its report address carries MAIL_EVENTS_TOKEN (?token=…), compared in constant time.
//   own     — your mail server, with its OWN_MAIL_TOKEN.
import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { q } from '@/lib/admin/db'

const same = (a, b) => { const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || '')); return x.length === y.length && x.length > 0 && timingSafeEqual(x, y) }
export function resendSigned(body, headers, secret = process.env.RESEND_WEBHOOK_SECRET) {
  const id = headers.get('svix-id'), ts = headers.get('svix-timestamp'), sigs = String(headers.get('svix-signature') || '')
  if (!secret || !id || !ts || !sigs) return false
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false                                  // older than 5 minutes: refused
  const key = Buffer.from(String(secret).replace(/^whsec_/, ''), 'base64')
  const want = createHmac('sha256', key).update(`${id}.${ts}.${body}`).digest('base64')
  return sigs.split(' ').some((s) => s.startsWith('v1,') && same(s.slice(3), want))
}
export const tokenOk = (given, env) => same(given, process.env[env])

// one report: { email, kind: 'bounce' | 'complaint' | 'soft', providerId, pipe, detail }
async function record({ email, kind, providerId, pipe, detail }) {
  const e = String(email || '').trim().toLowerCase(); if (!e.includes('@')) return
  if (kind === 'bounce' || kind === 'complaint') {
    await q(`insert into mail_suppressions (email, reason, note) values ($1, $2, $3) on conflict (email) do update set reason = case when mail_suppressions.reason = 'manual' then mail_suppressions.reason else excluded.reason end, note = excluded.note`,
      [e, kind, String(detail || '').slice(0, 200) || null])
    if (providerId) await q("update mail_messages set status = $3, error = $4 where pipe = $1 and provider_id = $2", [pipe, String(providerId), kind === 'bounce' ? 'bounced' : 'complained', String(detail || '').slice(0, 300) || null])
  } else if (providerId) await q("update mail_messages set error = $3 where pipe = $1 and provider_id = $2 and status = 'sent'", [pipe, String(providerId), 'delayed: ' + String(detail || '').slice(0, 280)])
}
export async function resendEvent(ev) {
  const d = ev.data || {}, to = Array.isArray(d.to) ? d.to : [d.to]
  if (ev.type === 'email.complained') for (const t of to) await record({ email: t, kind: 'complaint', providerId: d.email_id, pipe: 'resend', detail: 'marked as spam' })
  if (ev.type === 'email.bounced') {
    const b = d.bounce || {}, hard = !b.type || b.type === 'Permanent'
    for (const t of to) await record({ email: t, kind: hard ? 'bounce' : 'soft', providerId: d.email_id, pipe: 'resend', detail: [b.subType, b.message].filter(Boolean).join(': ') })
  }
  if (ev.type === 'email.delivery_delayed') for (const t of to) await record({ email: t, kind: 'soft', providerId: d.email_id, pipe: 'resend', detail: 'delivery delayed' })
}
export async function mailjetEvents(list) {
  for (const ev of Array.isArray(list) ? list : [list]) {
    if (!ev || !ev.email) continue
    const id = ev.MessageID || ev.mj_message_id
    if (ev.event === 'spam') await record({ email: ev.email, kind: 'complaint', providerId: id, pipe: 'mailjet', detail: 'marked as spam' })
    else if (ev.event === 'bounce' || ev.event === 'blocked') await record({ email: ev.email, kind: ev.hard_bounce === false ? 'soft' : 'bounce', providerId: id, pipe: 'mailjet', detail: [ev.event, ev.error_related_to, ev.error].filter(Boolean).join(': ') })
  }
}
export async function ownEvents(list) {
  for (const ev of Array.isArray(list) ? list : [list]) if (ev && ev.email) await record({ email: ev.email, kind: ev.kind === 'complaint' ? 'complaint' : ev.kind === 'soft' ? 'soft' : 'bounce', providerId: ev.id, pipe: 'own', detail: ev.detail })
}

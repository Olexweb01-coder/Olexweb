// Olex Sales: reads the outreach Gmail's inbox (IMAP, the same App Password) and acts on each new message.
//  - Bounces ("not delivered" notices): the address is marked invalid and never used again; if more than 5% of the last
//    50 emails bounced (at least 10 sent), sending pauses itself until Olaitan resumes it.
//  - Opt-outs ("no thanks", "unsubscribe", "remove me"…): plain code, not AI: never contacted again, waiting emails cancelled.
//  - Out-of-office: follow-ups wait 5 more days.
//  - Real replies (Install 19): converse.js reads the whole conversation and picks the next move (answer, book, later,
//    referral, handover to Olaitan, stop); it sends by itself only when "send without asking me" is on.
// Tests read a stand-in inbox (SALES_TEST_BASE/gmail/inbox).
import 'server-only'
import { createHmac } from 'node:crypto'
import { q, one } from '@/lib/admin/db'
import { notify } from '@/lib/assistant/notify'
import { planCompany } from './tier'
import { respond } from './converse'

const T = () => String(process.env.SALES_TEST_BASE || '').replace(/\/$/, '')
const OPT_OUT = /\b(unsubscribe|remove me|take me off|stop (emailing|contacting|sending)|no,? thanks?|not interested|do not (email|contact)|don'?t (email|contact)|please stop|opt(ed)? out)\b/i
const OPT_OUT_FR = /(non,? merci|pas int[ée]ress[ée]|d[ée]sinscri|retirez[- ]moi|ne (m'|me )?(contactez|[ée]crivez) plus|arr[êe]tez de m|stop)/i   // French businesses (Install 18)
const PRICE_ASK = /\b(how much|price|pricing|cost|costs|rates?|quote|budget|fees?|prix|tarifs?|combien|co[uû]t|devis)\b/i
const AUTO = /^(automatic reply|auto(matic)?[- ]?reply|out of (the )?office|ooo|away from|i am away|i'm away|on leave|on vacation|auto:|r[ée]ponse automatique|absence|absent|en cong[ée]s?|je suis absent)/i
const BOUNCE_FROM = /mailer-daemon|postmaster|mail delivery (subsystem|system)/i
const meetBase = () => String(process.env.MEET_ORIGIN || 'https://meet.olexweb.com').replace(/\/$/, '')
export const bookToken = (companyId) => `${companyId}.${createHmac('sha256', String(process.env.AUTH_SECRET || '')).update('book:' + companyId).digest('base64url').slice(0, 16)}`
export function companyFromToken(t) { const [id, sig] = String(t || '').split('.'); return id && sig && bookToken(id) === `${id}.${sig}` ? Number(id) : null }
export const bookLink = (companyId) => `${meetBase()}/book?t=${bookToken(companyId)}`

async function fetchNew(since) {
  if (T()) { const r = await fetch(`${T()}/gmail/inbox?since=${since}`); return r.ok ? r.json() : [] }
  const { ImapFlow } = await import('imapflow'), { simpleParser } = await import('mailparser')
  const client = new ImapFlow({ host: 'imap.gmail.com', port: 993, secure: true, auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }, logger: false })
  const out = []
  await client.connect()
  try {
    const lock = await client.getMailboxLock('INBOX')
    try {
      for await (const m of client.fetch(`${since + 1}:*`, { uid: true, source: true }, { uid: true })) {
        if (m.uid <= since) continue
        const p = await simpleParser(m.source)
        out.push({ uid: m.uid, from: (p.from && p.from.value[0] && p.from.value[0].address) || '', fromName: (p.from && p.from.value[0] && p.from.value[0].name) || '', subject: p.subject || '',
          text: String(p.text || '').slice(0, 20000), messageId: p.messageId || null, inReplyTo: p.inReplyTo || null, references: [].concat(p.references || []),
          auto: !!(p.headers.get('auto-submitted') && String(p.headers.get('auto-submitted')) !== 'no') })
        if (out.length >= 30) break
      }
    } finally { lock.release() }
  } finally { await client.logout().catch(() => {}) }
  return out
}
// the visible new part of a reply (above "On … wrote:" and quoted lines)
export const freshPart = (t) => String(t || '').split(/\n\s*On .{5,200}wrote:\s*\n|\n-{2,}\s*Original Message|\nFrom: .+\nSent: /i)[0].split('\n').filter((l) => !/^\s*>/.test(l)).join('\n').trim().slice(0, 4000)

export async function checkInbox() {
  const S = await one('select * from sales_settings where id = 1')
  const msgs = await fetchNew(Number(S.imap_uid) || 0), done = []
  for (const m of msgs) {
    try { done.push(await handle(m, S)) } catch (e) { done.push({ uid: m.uid, error: e.message }) }
    await q('update sales_settings set imap_uid = greatest(imap_uid, $1) where id = 1', [m.uid])
  }
  return done
}

async function handle(m, S) {
  // a bounce: find which of our addresses failed
  if (BOUNCE_FROM.test(m.from) || /delivery status notification|undeliverable|undelivered mail|delivery has failed|address not found/i.test(m.subject)) {
    const addrs = (await q("select k.id, lower(k.email) as email, k.company_id from sales_contacts k join sales_outbox o on o.contact_id = k.id where o.status = 'sent' and o.sent_at > now() - interval '14 days'")).rows
    const hit = addrs.find((a) => m.text.toLowerCase().includes(a.email)); if (!hit) return { uid: m.uid, kind: 'bounce-unmatched' }
    await q("update sales_contacts set email_status = 'bounced' where id = $1", [hit.id])
    await q('insert into sales_dnc (entry, reason) values ($1, $2) on conflict (entry) do nothing', [hit.email, 'bounced'])
    await q("update sales_outbox set status = 'cancelled', error = 'The address bounced' where contact_id = $1 and status in ('waiting', 'approved', 'held')", [hit.id])
    await q("update sales_companies set status = 'bounced' where id = $1", [hit.company_id])
    await q("insert into sales_replies (company_id, contact_id, from_email, subject, body, intent, summary, handled) values ($1, $2, $3, $4, $5, 'bounce', 'The email bounced', true)", [hit.company_id, hit.id, m.from, m.subject, m.text.slice(0, 2000)])
    const r = await one("select count(*) filter (where k.email_status = 'bounced')::int as b, count(*)::int as n from (select contact_id from sales_outbox where status = 'sent' order by sent_at desc limit 50) o join sales_contacts k on k.id = o.contact_id")
    if (r.n >= 10 && r.b / r.n > 0.05) {
      await q("update sales_settings set paused_reason = $1 where id = 1", [`Paused: ${r.b} of the last ${r.n} emails bounced (over 5%). Check the list before resuming.`])
      notify('sales', `Olex Sales paused itself: ${r.b} of ${r.n} recent emails bounced.`, '/admin/sales#settings')
    }
    return { uid: m.uid, kind: 'bounce', email: hit.email }
  }
  // which conversation it belongs to: the thread first, then the sender's address
  const ids = [m.inReplyTo, ...(m.references || [])].filter(Boolean)
  let sent = ids.length ? await one("select o.*, k.email from sales_outbox o join sales_contacts k on k.id = o.contact_id where o.message_id = any($1) order by o.id desc limit 1", [ids]) : null
  if (!sent) sent = await one("select o.*, k.email from sales_outbox o join sales_contacts k on k.id = o.contact_id where lower(k.email) = lower($1) and o.status = 'sent' order by o.id desc limit 1", [m.from])
  if (!sent) return { uid: m.uid, kind: 'not-ours' }
  const c = await one('select * from sales_companies where id = $1', [sent.company_id]), text = freshPart(m.text)
  const save = (intent, summary, handled) => q('insert into sales_replies (company_id, contact_id, outbox_id, from_email, subject, body, intent, summary, message_id, handled) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
    [c.id, sent.contact_id, sent.id, m.from, m.subject, text, intent, summary, m.messageId, handled])
  if (m.auto || AUTO.test(m.subject) || AUTO.test(text.slice(0, 80))) {
    await q("update sales_companies set next_touch_after = now() + interval '5 days' where id = $1", [c.id]); await save('auto_reply', 'An automatic reply (out of office)', true)
    return { uid: m.uid, kind: 'auto' }
  }
  await q("update sales_outbox set status = 'cancelled', error = 'They replied' where company_id = $1 and status in ('waiting', 'approved', 'held')", [c.id])   // anything not yet sent is out of date now (the agent answers the newest message)
  if (OPT_OUT.test(text) || (c.country === 'FR' && OPT_OUT_FR.test(text))) {
    await q('update sales_contacts set opted_out_at = now() where id = $1', [sent.contact_id])
    await q('insert into sales_dnc (entry, reason) values ($1, $2) on conflict (entry) do nothing', [String(sent.email).toLowerCase(), 'asked not to be contacted'])
    await q("update sales_outbox set status = 'cancelled', error = 'They opted out' where company_id = $1 and status in ('waiting', 'approved', 'held')", [c.id])
    await q("update sales_companies set status = 'opted_out' where id = $1", [c.id]); await save('opt_out', 'Asked not to be contacted: done, they won’t be emailed again', true)
    return { uid: m.uid, kind: 'opt_out' }
  }
  // Install 19: the agent reads the whole thread and picks the next move (converse.js); the plain-code checks above came first
  await q("update sales_companies set status = 'replied' where id = $1 and status not in ('booked', 'won')", [c.id]); await save('other', 'A reply arrived', false)
  await planCompany(c.id, text).catch(() => {})                       // what they wrote can raise the price level (never lowers it)
  const r = await respond(c, sent, m, text)
  return { uid: m.uid, kind: 'reply', intent: r.intent, move: r.move }
}


// Olexweb Mail's pipes: the ways an email can leave. Each is switched on just by its settings in Vercel, and each answers
// the same way: { id } when the email was accepted, or an error with .soft (try the next pipe now) or .hard (the address
// itself is bad, e.g. rejected; no pipe will do better).
//   own     — Olaitan's own mail server (OWN_MAIL_URL, OWN_MAIL_TOKEN): its small private sending API (scripts/mailserver)
//   resend  — RESEND_API_KEY
//   mailjet — MAILJET_API_KEY, MAILJET_SECRET_KEY
// Tests point every pipe at a stand-in with MAIL_TEST_BASE.
import 'server-only'

const T = () => String(process.env.MAIL_TEST_BASE || '').replace(/\/$/, '')
const num = (v, d) => (Number.isFinite(Number(v)) && Number(v) >= 0 && String(v).trim() !== '' ? Number(v) : d)
export class PipeError extends Error { constructor(msg, { soft = true, hard = false, status = 0 } = {}) { super(msg); Object.assign(this, { soft, hard, status }) } }

async function post(url, init, name) {
  let r
  try { r = await fetch(url, { ...init, method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(15000) }) }
  catch { throw new PipeError(`${name} didn’t answer`) }
  const body = await r.text().catch(() => '')
  let j = null; try { j = JSON.parse(body) } catch {}
  if (r.ok) return j || {}
  // 4xx about the address (rejected recipient) is hard; rate limits, auth and 5xx are soft (another pipe may work)
  const msg = `${name} ${r.status}: ${(j && (j.message || j.error || (j.Messages && JSON.stringify(j.Messages[0] && j.Messages[0].Errors)))) || body}`.slice(0, 300)
  const hard = r.status === 422 && /recipient|address|email/i.test(msg)
  throw new PipeError(msg, { soft: !hard, hard, status: r.status })
}
const split = (from) => { const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(from || ''); return m ? { name: m[1].replace(/^"|"$/g, ''), email: m[2] } : { name: '', email: String(from || '').trim() } }

export const PIPES = {
  own: {
    name: 'Your mail server', ready: () => !!(process.env.OWN_MAIL_URL && process.env.OWN_MAIL_TOKEN),
    day: () => num(process.env.OWN_MAIL_DAILY_LIMIT, 1000), month: () => num(process.env.OWN_MAIL_MONTHLY_LIMIT, 1_000_000),   // the daily limit grows as the server warms up
    async send(m) {
      const base = T() ? T() + '/own' : String(process.env.OWN_MAIL_URL).replace(/\/$/, '')
      const j = await post(base + '/send', { headers: { Authorization: 'Bearer ' + process.env.OWN_MAIL_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: m.from, to: m.to, reply_to: m.replyTo, subject: m.subject, html: m.html, text: m.text }) }, 'Your mail server')
      return { id: j.id || null }
    },
  },
  resend: {
    name: 'Resend', ready: () => !!process.env.RESEND_API_KEY,
    day: () => num(process.env.RESEND_DAILY_LIMIT, 80), month: () => num(process.env.RESEND_MONTHLY_LIMIT, 3000),   // the free plan: 100 a day, shared with other projects
    async send(m) {
      const j = await post((T() ? T() + '/resend' : 'https://api.resend.com') + '/emails', { headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: m.from, to: [m.to], reply_to: m.replyTo || undefined, subject: m.subject, html: m.html, text: m.text }) }, 'Resend')
      return { id: j.id || null }
    },
  },
  mailjet: {
    name: 'Mailjet', ready: () => !!(process.env.MAILJET_API_KEY && process.env.MAILJET_SECRET_KEY),
    day: () => num(process.env.MAILJET_DAILY_LIMIT, 200), month: () => num(process.env.MAILJET_MONTHLY_LIMIT, 6000),   // the free plan
    async send(m) {
      const f = split(m.from), auth = Buffer.from(process.env.MAILJET_API_KEY + ':' + process.env.MAILJET_SECRET_KEY).toString('base64')
      const j = await post((T() ? T() + '/mailjet' : 'https://api.mailjet.com') + '/v3.1/send', { headers: { Authorization: 'Basic ' + auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ Messages: [{ From: { Email: f.email, Name: f.name }, To: [{ Email: m.to }], ...(m.replyTo ? { ReplyTo: { Email: split(m.replyTo).email } } : {}),
          Subject: m.subject, HTMLPart: m.html, TextPart: m.text, TrackOpens: 'disabled', TrackClicks: 'disabled' }] }) }, 'Mailjet')
      const r = j.Messages && j.Messages[0]
      if (!r || r.Status !== 'success') throw new PipeError('Mailjet refused: ' + JSON.stringify(r && r.Errors).slice(0, 200))
      return { id: (r.To && r.To[0] && String(r.To[0].MessageID || r.To[0].MessageUUID)) || null }
    },
  },
}
// the order emails try them in: your own server first
export const ORDER = ['own', 'resend', 'mailjet']

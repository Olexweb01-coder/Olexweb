// Olexweb Mail bounce reader: Postfix runs it for each bounce notice that comes back to bounces+<id>@mail.olexweb.com.
// It reads the notice (a delivery status report), and tells the site: permanent failures (5.x.x) block the address,
// temporary ones (4.x.x) are only noted. Settings: /etc/olexweb-mail.env (MAIL_TOKEN, SITE_URL).
import { readFileSync } from 'node:fs'

export function parseBounce(raw, recipientArg = '') {
  const id = (/bounces\+([a-z0-9.]+)@/i.exec(recipientArg + '\n' + raw) || [])[1] || null
  const out = []
  const blocks = raw.split(/\r?\n\r?\n/)
  for (const b of blocks) {
    const rcpt = /^Final-Recipient:\s*rfc822;\s*(\S+)/im.exec(b), status = /^Status:\s*([245]\.\d{1,3}\.\d{1,3})/im.exec(b), action = /^Action:\s*(\S+)/im.exec(b)
    if (!rcpt || !status) continue
    const diag = (/^Diagnostic-Code:\s*(?:smtp;\s*)?(.+)$/im.exec(b) || [])[1] || ''
    const kind = status[1].startsWith('5') && (!action || /failed/i.test(action[1])) ? 'bounce' : 'soft'
    out.push({ email: rcpt[1].toLowerCase(), kind, id, detail: (status[1] + ' ' + diag).trim().slice(0, 200) })
  }
  return out
}
async function main() {
  const raw = readFileSync(0, 'utf8'), events = parseBounce(raw, process.argv[2] || '')
  if (!events.length) return
  const r = await fetch(String(process.env.SITE_URL || 'https://olexweb.com').replace(/\/$/, '') + '/api/mail/events/own', { method: 'POST',
    headers: { Authorization: 'Bearer ' + process.env.MAIL_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify(events) })
  if (!r.ok) { console.error('site refused bounce report: ' + r.status); process.exit(75) }        // 75 = try again later (Postfix keeps it)
}
if (process.argv[1] && process.argv[1].endsWith('bounce.mjs')) main().catch((e) => { console.error(e.message); process.exit(75) })

// Olexweb Mail relay: runs on Olaitan's own mail server (127.0.0.1:8025, behind Caddy's HTTPS at https://mail.olexweb.com).
// POST /send { from, to, reply_to, subject, html, text } with "Authorization: Bearer <OWN_MAIL_TOKEN>" → builds a proper
// email (both HTML and plain text) and hands it to Postfix, which signs it (DKIM) and delivers it. Answers { id }.
// GET /health → { ok }. No packages needed: plain Node. Settings: /etc/olexweb-mail.env (MAIL_TOKEN, MAIL_HOST).
import http from 'node:http'
import { spawn } from 'node:child_process'
import { randomBytes, timingSafeEqual } from 'node:crypto'

const TOKEN = process.env.MAIL_TOKEN || '', HOST = process.env.MAIL_HOST || 'mail.olexweb.com', SENDMAIL = process.env.SENDMAIL || '/usr/sbin/sendmail'
if (TOKEN.length < 32) { console.error('MAIL_TOKEN must be at least 32 characters'); process.exit(1) }
const same = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y) }
const EMAIL = /^[^\s@<>",]{1,64}@[^\s@<>",]{1,190}\.[a-z]{2,24}$/i
const header = (s) => String(s || '').replace(/[\r\n]+/g, ' ').trim()                                  // no header injection
const encWord = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : '=?UTF-8?B?' + Buffer.from(s, 'utf8').toString('base64') + '?=')
const b64lines = (s) => Buffer.from(s, 'utf8').toString('base64').replace(/.{76}/g, '$&\r\n')
function addr(v) { const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(header(v)); const name = m ? m[1].replace(/^"|"$/g, '') : '', email = m ? m[2] : header(v); if (!EMAIL.test(email)) return null; return { name, email, full: name ? `${encWord(name)} <${email}>` : email } }

export function buildMessage({ from, to, reply_to, subject, html, text }, id) {
  const f = addr(from), t = addr(to), r = reply_to ? addr(reply_to) : null
  if (!f || !t) throw new Error('bad address')
  const boundary = 'olex-' + randomBytes(12).toString('hex')
  const lines = [`From: ${f.full}`, `To: ${t.full}`, ...(r ? [`Reply-To: ${r.full}`] : []), `Subject: ${encWord(header(subject))}`, `Date: ${new Date().toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: <${id}@${HOST}>`, 'MIME-Version: 1.0', `Content-Type: multipart/alternative; boundary="${boundary}"`, '',
    `--${boundary}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', b64lines(text || ''),
    `--${boundary}`, 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', b64lines(html || ''), `--${boundary}--`, '']
  return { raw: lines.join('\r\n'), envelopeFrom: `bounces+${id}@${HOST}`, rcpt: t.email }       // bounces come back to this server, with the id
}
function sendmail(m) {
  return new Promise((ok, no) => {
    const p = spawn(SENDMAIL, ['-i', '-f', m.envelopeFrom, '--', m.rcpt]); let err = ''
    p.stderr.on('data', (d) => (err += d)); p.on('error', no); p.on('close', (c) => (c === 0 ? ok() : no(new Error('sendmail ' + c + ': ' + err.slice(0, 200)))))
    p.stdin.end(m.raw)
  })
}
const json = (res, code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)) }
export const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') return json(res, 200, { ok: true })
  if (req.method !== 'POST' || req.url !== '/send') return json(res, 404, { error: 'not found' })
  if (!same(String(req.headers.authorization || ''), 'Bearer ' + TOKEN)) return json(res, 401, { error: 'not allowed' })
  let body = '', size = 0
  req.on('data', (c) => { size += c.length; if (size > 2_000_000) { req.destroy() } else body += c })
  req.on('end', async () => {
    let j; try { j = JSON.parse(body) } catch { return json(res, 400, { error: 'not JSON' }) }
    const id = Date.now().toString(36) + '.' + randomBytes(6).toString('hex')
    let m; try { m = buildMessage(j, id) } catch { return json(res, 422, { error: 'invalid recipient email address' }) }
    try { await sendmail(m); json(res, 200, { id }) } catch (e) { console.error(e.message); json(res, 503, { error: 'the mail server couldn’t take it right now' }) }
  })
})
if (process.argv[1] && process.argv[1].endsWith('relay.mjs')) server.listen(Number(process.env.PORT || 8025), '127.0.0.1', () => console.log('Olexweb Mail relay on 127.0.0.1:' + (process.env.PORT || 8025)))

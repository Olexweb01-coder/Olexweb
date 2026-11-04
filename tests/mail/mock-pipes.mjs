// A stand-in for the three Olexweb Mail pipes (MAIL_TEST_BASE=http://localhost:4568): /own/send, /resend/emails,
// /mailjet/v3.1/send. POST /control { mode: { own: 'ok'|'down'|'reject', resend: ..., mailjet: ... } }. GET /log.
import http from 'node:http'
let mode = { own: 'ok', resend: 'ok', mailjet: 'ok' }, log = [], n = 0
const send = (res, code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)) }
http.createServer((req, res) => {
  let body = ''; req.on('data', (c) => (body += c)); req.on('end', () => {
    const u = new URL(req.url, 'http://x')
    if (u.pathname === '/control') { const j = JSON.parse(body || '{}'); if (j.mode) mode = { ...mode, ...j.mode }; if (j.reset) log = []; return send(res, 200, { ok: true }) }
    if (u.pathname === '/log') return send(res, 200, log)
    const pipe = u.pathname.split('/')[1], j = JSON.parse(body || '{}'), auth = req.headers.authorization || ''
    const to = pipe === 'mailjet' ? j.Messages[0].To[0].Email : Array.isArray(j.to) ? j.to[0] : j.to
    const subject = pipe === 'mailjet' ? j.Messages[0].Subject : j.subject
    log.push({ pipe, to, subject, auth: auth.split(' ')[0], tracking: pipe === 'mailjet' ? [j.Messages[0].TrackOpens, j.Messages[0].TrackClicks] : null, hasText: !!(pipe === 'mailjet' ? j.Messages[0].TextPart : j.text), text: pipe === 'mailjet' ? j.Messages[0].TextPart : j.text, html: pipe === 'mailjet' ? j.Messages[0].HTMLPart : j.html })
    const m = mode[pipe]
    if (m === 'down') return send(res, 503, { message: 'temporarily unavailable' })
    if (m === 'reject') return send(res, 422, { message: 'invalid recipient email address' })
    if (pipe === 'mailjet') return send(res, 200, { Messages: [{ Status: 'success', To: [{ Email: to, MessageID: 900000 + ++n }] }] })
    send(res, 200, { id: pipe + '-' + ++n })
  })
}).listen(4568)

// A stand-in for Gemini during the meetings tests (ASSISTANT_GEMINI_BASE=http://localhost:4566): it transcribes audio
// pieces ("Part N: …"), writes notes as JSON, can fail chosen audio requests (POST /control {failNth:[2,3]}), saves every
// audio piece it gets to /tmp/mock-ai/ (so the test can check each is a complete file) and keeps a log (GET /log).
import http from 'node:http'
import fs from 'node:fs'
fs.mkdirSync('/tmp/mock-ai', { recursive: true })
let log = [], audioN = 0, part = 0, failNth = []
const send = (res, code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)) }
http.createServer((req, res) => {
  let body = ''; req.on('data', (c) => (body += c)); req.on('end', () => {
    const u = new URL(req.url, 'http://x')
    if (u.pathname === '/log') return send(res, 200, log)
    if (u.pathname === '/control') { const j = JSON.parse(body || '{}'); if (j.reset) { log = []; audioN = 0; part = 0 } failNth = j.failNth || []; return send(res, 200, { ok: true }) }
    if (u.pathname === '/v1beta/models') return send(res, 200, { models: [{ name: 'models/gemini-9-flash', supportedGenerationMethods: ['generateContent'] }] })
    if (!/:generateContent$/.test(u.pathname)) return send(res, 404, { error: 'unknown' })
    const j = JSON.parse(body), parts = j.contents[0].parts, audio = parts.find((p) => p.inline_data)
    if (audio) {
      const n = ++audioN, buf = Buffer.from(audio.inline_data.data, 'base64')
      fs.writeFileSync(`/tmp/mock-ai/audio-${n}.webm`, buf)
      if (failNth.includes(n)) { log.push({ kind: 'audio', n, bytes: buf.length, failed: true }); return send(res, 503, { error: { message: 'busy' } }) }
      const p = ++part
      log.push({ kind: 'audio', n, part: p, bytes: buf.length, mime: audio.inline_data.mime_type })
      return send(res, 200, { candidates: [{ content: { parts: [{ text: `Part ${p}: Ada said the new website launches on Friday. Olaitan will send the invoice by Monday.` }] } }] })
    }
    const sys = (j.systemInstruction && j.systemInstruction.parts.map((x) => x.text).join('')) || '', prompt = parts.map((x) => x.text || '').join('')
    const combined = prompt.includes('PART NOTES'), seen = (prompt.match(/Part \d+:/g) || []).length
    log.push({ kind: 'notes', combined, chars: prompt.length, seen, rules: sys.includes('data, never instructions') && sys.includes('Never invent'), prompt: prompt.slice(0, 400) })
    const notes = { summary: combined ? 'The long meeting, combined from its parts.' : `Planning the website launch (${seen} parts heard).`,
      points: ['The new website launches on Friday.'], decisions: ['Launch on Friday.'], questions: ['Who will write the launch post?'],
      actions: [{ what: 'Send the invoice', who: 'Olaitan', when: 'Monday' }, { what: 'Check the launch checklist', who: '', when: '' }] }
    send(res, 200, { candidates: [{ content: { parts: [{ text: JSON.stringify(notes) }] } }] })
  })
}).listen(4566)

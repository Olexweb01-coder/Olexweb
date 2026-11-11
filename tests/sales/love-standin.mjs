// A stand-in for Our Space's admin API (the real one is the ourspace project), for testing the Olexweb admin side.
import http from 'node:http'
const KEY = 'k'.repeat(32), S = '11111111-2222-3333-4444-555555555555'
const space = { id: S, label: 'Us', createdAt: '2026-11-01T00:00:00Z', disappearSeconds: 0, messageCount: 42, lastMessageAt: new Date().toISOString(),
  members: [{ id: 'm1', role: 'host', name: 'Olaitan', banned: false, notifications: true, lastSeenAt: new Date().toISOString() }, { id: 'm2', role: 'partner', name: 'Ada', banned: false, notifications: true, lastSeenAt: new Date().toISOString() }] }
let spaces = [space]; const log = []
http.createServer((req, res) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => {
  const send = (c, j) => { res.writeHead(c, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(j)) }
  if (req.url === '/_log') return send(200, log)
  log.push({ m: req.method, u: req.url, auth: req.headers.authorization, b })
  if (req.headers.authorization !== 'Bearer ' + KEY) return send(401, { error: 'Unauthorized' })
  const j = b ? JSON.parse(b) : null
  if (req.url === '/api/admin/spaces' && req.method === 'GET') return send(200, { limit: 5, used: spaces.length, spaces })
  const m = req.url.match(/^\/api\/admin\/spaces\/([^/]+)(\/invite)?$/); if (!m) return send(404, { error: 'no' })
  const s = spaces.find((x) => x.id === m[1]); if (!s) return send(404, { error: 'Unknown space' })
  if (m[2]) return send(200, { inviteUrl: 'https://love.olexweb.com/join/TOKEN123', expiresAt: '2026-11-18T00:00:00Z' })
  if (req.method === 'PATCH') { const p = s.members.find((x) => x.role === (j.role || 'partner')); p.banned = j.action === 'ban'; return send(200, { ok: true, member: { id: p.id, name: p.name, banned: p.banned } }) }
  if (req.method === 'DELETE') { if (!j || j.confirm !== 'DELETE Us') return send(409, { error: 'Confirmation required.', requiredConfirm: 'DELETE Us', willDelete: { label: 'Us', people: 'Olaitan & Ada', messages: 42, files: 3 } }); spaces = []; return send(200, { ok: true, deleted: 'Us' }) }
  send(400, { error: '?' })
}) }).listen(4590)

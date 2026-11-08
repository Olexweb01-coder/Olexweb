// A small stand-in for LiveKit's room service (Twirp JSON), for checking the host and co-host calls where the real
// livekit-server isn't available. It keeps participants in memory and logs every call (GET /log, POST /add).
import http from 'node:http'
const people = new Map(), log = []
const send = (res, code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)) }
http.createServer((req, res) => {
  let raw = ''; req.on('data', (c) => (raw += c)); req.on('end', () => {
    const b = raw ? JSON.parse(raw) : {}
    if (req.url === '/log') return send(res, 200, log)
    if (req.url === '/add') { people.set(b.identity, { identity: b.identity, name: b.name || '', attributes: {}, permission: { canSubscribe: true, canPublish: !!b.canPublish, canPublishData: true }, tracks: b.tracks || [] }); return send(res, 200, {}) }
    const m = req.url.match(/\/twirp\/livekit\.RoomService\/(\w+)/); if (!m) return send(res, 404, {})
    const fn = m[1]; log.push({ fn, ...b })
    if (fn === 'CreateRoom') return send(res, 200, { name: b.room || b.name })
    const p = people.get(b.identity)
    if (['GetParticipant', 'UpdateParticipant', 'RemoveParticipant', 'MutePublishedTrack'].includes(fn) && !p) return send(res, 404, { code: 'not_found', msg: 'participant does not exist' })
    if (fn === 'GetParticipant') return send(res, 200, p)
    if (fn === 'UpdateParticipant') { if (b.permission) p.permission = b.permission; if (b.attributes) Object.assign(p.attributes, b.attributes); return send(res, 200, p) }
    if (fn === 'RemoveParticipant') { people.delete(b.identity); return send(res, 200, {}) }
    if (fn === 'MutePublishedTrack') { const t = p.tracks.find((x) => x.sid === b.trackSid); if (t) t.muted = true; return send(res, 200, { track: t }) }
    send(res, 200, {})
  })
}).listen(7880)

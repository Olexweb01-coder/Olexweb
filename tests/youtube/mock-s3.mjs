// Stand-in for the S3-compatible bucket: PUT, GET (with byte ranges), DELETE. Signatures are not checked here.
import http from 'node:http'
const store = new Map(), log = [], S = { rejectPut: 0, failNext: 0, hang: 0 }
http.createServer(async (req, res) => {
  const key = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  if (key === '/_set') { const q = new URL(req.url, 'http://x').searchParams; for (const [k, v] of q) S[k] = Number(v); res.writeHead(200); return res.end('ok') }
  if (key === '/_list') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ keys: [...store.keys()].map((k) => [k, store.get(k).length]), log, hung: S.hung || 0 })) }
  log.push(req.method + ' ' + key + (req.headers.range ? ' ' + req.headers.range : '') + (req.headers.authorization ? ' signed' : ' UNSIGNED'))
  if (req.method === 'PUT' && S.hang) { S.hung = (S.hung || 0) + 1; return }          // like the real bucket did: take the upload, never answer
  if (req.method === 'PUT' && S.rejectPut) { for await (const c of req) {} res.writeHead(S.rejectPut); return res.end('<Error>Refused</Error>') }
  if (req.method === 'PUT' && S.failNext > 0) { S.failNext--; for await (const c of req) {} res.writeHead(500); return res.end('busy') }
  if (req.method === 'PUT') { const chunks = []; for await (const c of req) chunks.push(c); store.set(key, Buffer.concat(chunks)); res.writeHead(200); return res.end() }
  if (req.method === 'DELETE') { store.delete(key); res.writeHead(204); return res.end() }
  const b = store.get(key); if (!b) { res.writeHead(404); return res.end() }
  const m = /^bytes=(\d+)-(\d+)$/.exec(req.headers.range || '')
  if (m) { const s = +m[1], e = Math.min(b.length - 1, +m[2]); res.writeHead(206, { 'Content-Range': `bytes ${s}-${e}/${b.length}`, 'Content-Length': e - s + 1 }); return res.end(b.subarray(s, e + 1)) }
  res.writeHead(200, { 'Content-Length': b.length }); res.end(b)
}).listen(4560, () => console.log('mock s3 on 4560'))

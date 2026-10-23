// Stand-in for the S3-compatible bucket: PUT, GET (with byte ranges), DELETE. Signatures are not checked here.
import http from 'node:http'
const store = new Map(), log = []
http.createServer(async (req, res) => {
  const key = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  if (key === '/_list') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ keys: [...store.keys()].map((k) => [k, store.get(k).length]), log })) }
  log.push(req.method + ' ' + key + (req.headers.range ? ' ' + req.headers.range : '') + (req.headers.authorization ? ' signed' : ' UNSIGNED'))
  if (req.method === 'PUT') { const chunks = []; for await (const c of req) chunks.push(c); store.set(key, Buffer.concat(chunks)); res.writeHead(200); return res.end() }
  if (req.method === 'DELETE') { store.delete(key); res.writeHead(204); return res.end() }
  const b = store.get(key); if (!b) { res.writeHead(404); return res.end() }
  const m = /^bytes=(\d+)-(\d+)$/.exec(req.headers.range || '')
  if (m) { const s = +m[1], e = Math.min(b.length - 1, +m[2]); res.writeHead(206, { 'Content-Range': `bytes ${s}-${e}/${b.length}`, 'Content-Length': e - s + 1 }); return res.end(b.subarray(s, e + 1)) }
  res.writeHead(200, { 'Content-Length': b.length }); res.end(b)
}).listen(4560, () => console.log('mock s3 on 4560'))

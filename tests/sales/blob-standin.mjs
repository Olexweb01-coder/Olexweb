// A stand-in for Vercel Blob (the API that @vercel/blob calls, and the private file URLs), for testing private apps.
import http from 'node:http'
const files = new Map(), TOKEN = 'Bearer vercel_blob_rw_teststore_secret0123456789'; let deletes = 0
http.createServer((req, res) => { const parts = []; req.on('data', (c) => parts.push(c)); req.on('end', () => {
  const u = new URL(req.url, 'http://x'), send = (c, j) => { res.writeHead(c, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(j)) }
  if (u.pathname === '/_state') return send(200, { files: files.size, deletes, paths: [...files.keys()].slice(0, 5) })
  if (req.headers.authorization !== TOKEN) return send(403, { error: { code: 'forbidden', message: 'bad token' } })
  if (req.method === 'PUT' && u.pathname === '/') {
    const p = u.searchParams.get('pathname'); if (req.headers['x-vercel-blob-access'] !== 'private') return send(400, { error: { code: 'bad_request', message: 'must be private' } })
    files.set(p, Buffer.concat(parts)); const url = 'http://localhost:4591/f/' + p
    return send(200, { url, downloadUrl: url + '?download=1', pathname: p, contentType: 'application/octet-stream', contentDisposition: 'attachment', etag: '"x"' })
  }
  if (req.method === 'POST' && u.pathname === '/delete') { const { urls } = JSON.parse(Buffer.concat(parts).toString()); for (const x of urls) { files.delete(x.replace('http://localhost:4591/f/', '')); deletes++ } return send(200, {}) }
  if (req.method === 'GET' && u.pathname.startsWith('/f/')) { const b = files.get(u.pathname.slice(3)); if (!b) return send(404, {}); res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': b.length }); return res.end(b) }
  send(404, { error: { code: 'not_found' } })
}) }).listen(4591)

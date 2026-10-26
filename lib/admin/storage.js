// The private image bucket (Neon Object Storage, S3-compatible). Server only: the keys never reach a browser.
import 'server-only'
import { AwsClient } from 'aws4fetch'

export const KEY_RE = /^img\/[a-f0-9]{24}\.webp$/
const client = () => (globalThis.__olexS3 ||= new AwsClient({ accessKeyId: process.env.STORAGE_ACCESS_KEY_ID, secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY, region: process.env.STORAGE_REGION, service: 's3' }))
const url = (key) => process.env.STORAGE_ENDPOINT.replace(/\/$/, '') + '/' + process.env.STORAGE_BUCKET + '/' + key

export async function putImage(key, body) {
  if (!KEY_RE.test(key)) throw new Error('bad key')
  const r = await client().fetch(url(key), { cache: 'no-store', method: 'PUT', body, headers: { 'content-type': 'image/webp' } })
  if (!r.ok) throw new Error('storage refused the upload (' + r.status + ')')
}
export async function getImage(key) {
  if (!KEY_RE.test(key)) return null
  const r = await client().fetch(url(key), { cache: 'no-store' })
  return r.ok ? r : null
}
export async function deleteImage(key) {
  if (!KEY_RE.test(key)) return
  await client().fetch(url(key), { cache: 'no-store', method: 'DELETE' })
}

// ---------- videos from the factory: stored in 4 MiB pieces (each under Vercel's 4.5 MB request limit) ----------
export const VID_RE = /^vid\/\d{1,9}\/\d{3}\.bin$/
export async function putPiece(key, body) {          // 2 tries, each with a deadline: a bucket that doesn't answer must not hang the request
  if (!VID_RE.test(key)) throw new Error('bad key')
  const limit = Number(process.env.STORAGE_TIMEOUT_MS) || 15000
  let last
  for (let i = 0; i < 2; i++) {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), limit)
    try {
      const r = await client().fetch(url(key), { cache: 'no-store', method: 'PUT', body, signal: ctl.signal, headers: { 'content-type': 'application/octet-stream' } })
      if (r.ok) return
      last = new Error('storage refused the upload (' + r.status + ')')
      if (r.status === 403 || r.status === 400) break                                  // a refusal, not a hiccup: no point repeating
    } catch (e) { last = new Error(ctl.signal.aborted ? `storage didn’t answer within ${limit / 1000} seconds` : 'storage could not be reached (' + e.message + ')') }
    finally { clearTimeout(timer) }
    if (i === 0) await new Promise((res) => setTimeout(res, 500))
  }
  throw last
}
export async function getPiece(key, range) {           // range: [start, end] within the piece, inclusive
  if (!VID_RE.test(key)) return null
  const r = await client().fetch(url(key), { cache: 'no-store', headers: range ? { Range: `bytes=${range[0]}-${range[1]}` } : {} })
  return r.ok ? r : null
}
export async function deletePiece(key) {
  if (!VID_RE.test(key)) return
  await client().fetch(url(key), { cache: 'no-store', method: 'DELETE' }).catch(() => {})
}

// ---------- audio for Pages & links (uploaded in pieces through the admin, streamed back with Range support) ----------
export const AUD_RE = /^aud\/[a-f0-9]{24}\/\d{1,4}$/
export async function putAudioPiece(key, body) {
  if (!AUD_RE.test(key)) throw new Error('bad key')
  const limit = Number(process.env.STORAGE_TIMEOUT_MS) || 15000
  let last
  for (let i = 0; i < 2; i++) {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), limit)
    try { const r = await client().fetch(url(key), { cache: 'no-store', method: 'PUT', body, signal: ctl.signal, headers: { 'content-type': 'application/octet-stream' } }); if (r.ok) return
      last = new Error('storage refused the upload (' + r.status + ')'); if (r.status === 403 || r.status === 400) break }
    catch (e) { last = new Error(ctl.signal.aborted ? `storage didn’t answer within ${limit / 1000} seconds` : 'storage could not be reached (' + e.message + ')') }
    finally { clearTimeout(timer) }
    if (i === 0) await new Promise((res) => setTimeout(res, 500))
  }
  throw last
}
export async function getAudioPiece(key, range) { if (!AUD_RE.test(key)) return null; const r = await client().fetch(url(key), { cache: 'no-store', headers: range ? { Range: `bytes=${range[0]}-${range[1]}` } : {} }); return r.ok ? r : null }
export async function deleteAudioPiece(key) { if (!AUD_RE.test(key)) return; await client().fetch(url(key), { cache: 'no-store', method: 'DELETE' }).catch(() => {}) }

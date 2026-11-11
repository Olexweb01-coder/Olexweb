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

// ---------- private apps (installers for approved people only; uploaded in 4 MiB pieces through the admin) ----------
export const APP_RE = /^app\/[a-z0-9-]{2,40}\/\d{1,9}\/\d{4}\.bin$/
export async function putAppPiece(key, body) {
  if (!APP_RE.test(key)) throw new Error('bad key')
  const limit = Math.max(30000, Number(process.env.STORAGE_TIMEOUT_MS) || 0)      // a busy moment at the storage shouldn't fail a piece
  let last
  for (let i = 0; i < 2; i++) {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), limit)
    try {
      const r = await client().fetch(url(key), { cache: 'no-store', method: 'PUT', body, signal: ctl.signal, headers: { 'content-type': 'application/octet-stream' } })
      if (r.ok) return
      last = new Error('storage refused the upload (' + r.status + ')' + (r.status === 501 ? '. The Neon bucket doesn’t take these files: connect a private Vercel Blob store to the Olexweb project (Vercel → Storage → Create → Blob), redeploy, and upload again' : ''))
      if (r.status === 403 || r.status === 400 || r.status === 501) break
    } catch (e) { last = new Error(ctl.signal.aborted ? `storage didn’t answer within ${limit / 1000} seconds` : 'storage could not be reached (' + e.message + ')') }
    finally { clearTimeout(timer) }
    if (i === 0) await new Promise((res) => setTimeout(res, 500))
  }
  throw last
}
export async function getAppPiece(key) { if (!APP_RE.test(key)) return null; const r = await client().fetch(url(key), { cache: 'no-store' }); return r.ok ? r : null }
export async function deleteAppPiece(key) { if (!APP_RE.test(key)) return; await client().fetch(url(key), { cache: 'no-store', method: 'DELETE' }).catch(() => {}) }

// Private apps in Vercel Blob (a private store connected to the Olexweb project: BLOB_READ_WRITE_TOKEN). The Neon bucket
// refuses these uploads (501), so when the Blob store is there, it's used; the refs kept are the private file URLs.
export const appStoreName = () => (process.env.BLOB_READ_WRITE_TOKEN ? 'Vercel Blob' : 'the Neon bucket')
export async function storeAppPiece(key, body) {
  if (!APP_RE.test(key)) throw new Error('bad key')
  if (!process.env.BLOB_READ_WRITE_TOKEN) { await putAppPiece(key, body); return key }
  const { put } = await import('@vercel/blob')
  let last
  for (let i = 0; i < 3; i++) {
    try { const b = await put(key, Buffer.from(body), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/octet-stream' }); return b.url }
    catch (e) { last = e; await new Promise((res) => setTimeout(res, 700 * (i + 1))) }
  }
  throw new Error('Vercel Blob refused it: ' + (last && last.message ? last.message : 'unknown error'))
}
export async function readAppPiece(ref) {
  if (!/^https?:\/\//.test(String(ref || ''))) return getAppPiece(ref)
  const r = await fetch(ref, { cache: 'no-store', headers: { authorization: 'Bearer ' + process.env.BLOB_READ_WRITE_TOKEN } })
  return r.ok ? r : null
}
export async function dropAppPieces(refs) {
  const urls = (refs || []).filter((x) => /^https?:\/\//.test(String(x || ''))), keys = (refs || []).filter((x) => x && !/^https?:\/\//.test(String(x)))
  for (const k of keys) await deleteAppPiece(k)
  if (urls.length && process.env.BLOB_READ_WRITE_TOKEN) { const { del } = await import('@vercel/blob'); for (let i = 0; i < urls.length; i += 500) await del(urls.slice(i, i + 500)).catch(() => {}) }
}

// Audio files for Pages & links: uploaded in 3 MB pieces (each under Vercel's request limit), stored in the private bucket,
// and streamed back with byte ranges so phones can seek, pause and resume. Same proven method as the factory's videos.
import 'server-only'
import { randomBytes } from 'node:crypto'
import { q, one } from '@/lib/admin/db'
import { putAudioPiece, getAudioPiece, deleteAudioPiece } from '@/lib/admin/storage'

export const PIECE = 3 * 1024 * 1024
const TYPES = { 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/m4a': 'm4a', 'audio/aac': 'aac', 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/ogg': 'ogg', 'audio/webm': 'webm' }
export class FileError extends Error {}
export async function startFile({ name, mime, bytes }) {
  const m = String(mime || '').toLowerCase(), n = Number(bytes)
  if (!TYPES[m]) throw new FileError('Upload an audio file (m4a, mp3, aac, wav or ogg).')
  if (!(n > 0) || n > 300 * 1024 * 1024) throw new FileError('Audio files can be up to 300 MB.')
  const id = randomBytes(12).toString('hex'), pieces = Math.ceil(n / PIECE)
  await q('insert into page_files (id, name, mime, bytes, pieces, piece_size) values ($1, $2, $3, $4, $5, $6)', [id, String(name || 'audio').slice(0, 160), m, n, pieces, PIECE])
  return { id, pieces, pieceSize: PIECE }
}
export async function putPiece(id, n, body) {
  const f = await one('select * from page_files where id = $1', [String(id)]); if (!f) throw new FileError('Unknown upload.')
  if (!(Number.isInteger(n) && n >= 0 && n < f.pieces)) throw new FileError('Bad piece.')
  const want = n === f.pieces - 1 ? Number(f.bytes) - n * f.piece_size : f.piece_size
  if (body.byteLength !== want) throw new FileError(`That piece arrived incomplete (${body.byteLength} of ${want} bytes). It will be sent again.`)
  await putAudioPiece(`aud/${f.id}/${n}`, body)
  const r = await one('update page_files set got = (select array_agg(distinct x) from unnest(got || $2::int) x), ready = (select count(distinct x) from unnest(got || $2::int) x) = pieces where id = $1 returning ready', [f.id, n])
  return { ok: true, ready: r.ready, url: r.ready ? `/media/a/${f.id}.${TYPES[f.mime]}` : null }
}
export async function fileResponse(name, rangeHeader) {
  const m = /^([a-f0-9]{24})\.[a-z0-9]{2,4}$/.exec(String(name || '')); if (!m) return new Response('Not found', { status: 404 })
  const f = await one('select * from page_files where id = $1 and ready', [m[1]]); if (!f) return new Response('Not found', { status: 404 })
  const total = Number(f.bytes), rm = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader || '')
  let start = 0, end = total - 1
  if (rm) { if (rm[1] === '' && rm[2] !== '') { start = Math.max(0, total - Number(rm[2])) } else { start = Number(rm[1] || 0); if (rm[2] !== '') end = Math.min(total - 1, Number(rm[2])) } }
  if (start >= total || start > end) return new Response('', { status: 416, headers: { 'Content-Range': `bytes */${total}` } })
  const head = { 'Content-Type': f.mime, 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' }
  if (!rm) {                                               // the whole file (downloads): every piece, in order
    let i = 0
    const stream = new ReadableStream({ async pull(ctl) {
      if (i >= f.pieces) { ctl.close(); return }
      const r = await getAudioPiece(`aud/${f.id}/${i++}`); if (!r) { ctl.error(new Error('missing piece')); return }
      ctl.enqueue(new Uint8Array(await r.arrayBuffer())) } })
    return new Response(stream, { status: 200, headers: { ...head, 'Content-Length': String(total) } })
  }
  const n = Math.floor(start / f.piece_size), off = start - n * f.piece_size, pieceEnd = Math.min(f.piece_size - 1, off + (end - start))   // at most one piece per answer
  end = start + (pieceEnd - off)
  const r = await getAudioPiece(`aud/${f.id}/${n}`, [off, pieceEnd]); if (!r) return new Response('Not found', { status: 404 })
  return new Response(r.body, { status: 206, headers: { ...head, 'Content-Length': String(end - start + 1), 'Content-Range': `bytes ${start}-${end}/${total}` } })
}
export async function dropUnfinished() {                 // housekeeping: half-uploaded files older than a day
  const old = (await q("select id, pieces from page_files where not ready and created_at < now() - interval '1 day'")).rows
  for (const f of old) { for (let i = 0; i < f.pieces; i++) await deleteAudioPiece(`aud/${f.id}/${i}`); await q('delete from page_files where id = $1', [f.id]) }
  return old.length
}

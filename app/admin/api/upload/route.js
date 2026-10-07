// Image upload: signed-in admin users only. Every image is re-encoded here (rotated upright, resized,
// converted to WebP, all hidden data such as location removed), so nothing but clean pixels is stored.
import { NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import sharp from 'sharp'
import { currentUser, sameOrigin, audit, clientIp } from '@/lib/admin/auth'
import { q, one } from '@/lib/admin/db'
import { putImage } from '@/lib/admin/storage'

export const dynamic = 'force-dynamic'
// Never let Next.js cache outside requests made here (it caches fetch in some routes by default).
export const fetchCache = 'force-no-store'
const MAX_BYTES = 4 * 1024 * 1024
const OK_FORMATS = ['jpeg', 'png', 'webp', 'gif', 'avif', 'heif', 'tiff']
const SHAPES = { screenshot: { width: 1600, height: 12000, fit: 'inside' }, photo: { width: 2000, height: 2000, fit: 'inside' } }

export async function POST(request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Request refused.' }, { status: 403 })
  const u = await currentUser()
  if (!u) return NextResponse.json({ error: 'Sign in again.' }, { status: 401 })
  const recent = await one("select count(*)::int as n from media where created_by = $1 and created_at > now() - interval '1 hour'", [u.id])
  if (recent.n >= 60) return NextResponse.json({ error: 'That’s a lot of uploads in an hour. Try again later.' }, { status: 429 })
  let form; try { form = await request.formData() } catch { return NextResponse.json({ error: 'No image received.' }, { status: 400 }) }
  const file = form.get('file'), shape = SHAPES[form.get('kind')] || SHAPES.photo
  if (!file || typeof file === 'string') return NextResponse.json({ error: 'No image received.' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'That image is too large. Try a smaller one.' }, { status: 413 })
  const input = Buffer.from(await file.arrayBuffer())
  let out, info
  try {
    const img = sharp(input, { limitInputPixels: 60_000_000, failOn: 'error' })
    const meta = await img.metadata()
    if (!OK_FORMATS.includes(meta.format)) throw new Error('not an image')
    ;({ data: out, info } = await img.rotate().resize({ ...shape, withoutEnlargement: true }).webp({ quality: 78, effort: 4 }).toBuffer({ resolveWithObject: true }))
  } catch { return NextResponse.json({ error: 'That file isn’t an image we can use. Try a JPG, PNG or WebP.' }, { status: 415 }) }
  const key = 'img/' + randomBytes(12).toString('hex') + '.webp'
  try { await putImage(key, out) } catch { return NextResponse.json({ error: 'Storage didn’t accept the image. Try again.' }, { status: 502 }) }
  await q('insert into media (key, mime, bytes, width, height, created_by) values ($1, $2, $3, $4, $5, $6)', [key, 'image/webp', out.length, info.width, info.height, u.id])
  await audit(u.id, 'image_uploaded', { key, bytes: out.length }, clientIp())
  return NextResponse.json({ url: '/media/' + key, width: info.width, height: info.height, bytes: out.length })
}

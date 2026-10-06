// Serves images from the private bucket. Only images registered in the database can be fetched.
// Each answer is marked "keep for a year": Vercel's cache then serves it worldwide and the bucket is rarely touched.
import { one } from '@/lib/admin/db'
import { getImage, KEY_RE } from '@/lib/admin/storage'

export const dynamic = 'force-dynamic'
const notFound = () => new Response('Not found', { status: 404, headers: { 'Cache-Control': 'public, max-age=60' } })

export async function GET(_request, { params }) {
  const key = (params.key || []).join('/')
  if (!KEY_RE.test(key)) return notFound()
  const known = await one('select mime from media where key = $1', [key])
  if (!known) return notFound()
  const r = await getImage(key)
  if (!r) return notFound()
  return new Response(r.body, { headers: {
    'Content-Type': 'image/webp',
    'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'",
  } })
}

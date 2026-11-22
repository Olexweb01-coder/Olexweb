// A person's uploaded photo or banner (Install 58). Shown publicly only for public profiles and hosts who sell on Meet.
import { currentMeetUser } from '@/lib/meet/auth'
import { picture, imageType } from '@/lib/meet/home'
export const dynamic = 'force-dynamic'
export async function GET(request, { params }) {
  const banner = new URL(request.url).searchParams.has('b')
  const buf = await picture(params.id, banner, await currentMeetUser().catch(() => null)).catch(() => null)
  if (!buf) return new Response('Not found', { status: 404 })
  return new Response(buf, { headers: { 'Content-Type': imageType(buf) || 'image/jpeg', 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'" } })
}

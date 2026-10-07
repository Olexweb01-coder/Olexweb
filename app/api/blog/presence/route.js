// "Reading now" check-ins. Answers with the count only when it has passed the owner's threshold.
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { sameOrigin, clientIp } from '@/lib/admin/auth'
import { checkIn } from '@/lib/site/engage'
import { one } from '@/lib/admin/db'
export const dynamic = 'force-dynamic'
export async function POST(request) {
  if (!sameOrigin(request)) return NextResponse.json({ reading: null }, { status: 403 })
  let b; try { b = await request.json() } catch { return NextResponse.json({ reading: null }, { status: 400 }) }
  const n = await checkIn(b.slug, clientIp(), headers().get('user-agent') || '')
  const s = await one('select reading_from from blog_settings where id = 1')
  return NextResponse.json({ reading: n !== null && n >= s.reading_from ? n : null }, { headers: { 'Cache-Control': 'no-store' } })
}

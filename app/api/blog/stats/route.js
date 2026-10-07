// The numbers readers may see: already filtered by the owner's thresholds. Cached for a few seconds.
import { NextResponse } from 'next/server'
import { publicStats } from '@/lib/site/engage'
export const dynamic = 'force-dynamic'
export async function GET(request) {
  const raw = new URL(request.url).searchParams.get('slugs') || ''
  const slugs = raw ? raw.split(',').filter((s) => /^[a-z0-9-]{1,90}$/.test(s)).slice(0, 60) : null
  try { return NextResponse.json(await publicStats(slugs), { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=15, stale-while-revalidate=60' } }) }
  catch { return NextResponse.json({ posts: {}, monthReaders: null }, { status: 503 }) }
}

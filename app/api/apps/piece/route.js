// One piece of a private app's installer, only for an approved browser (lib/site/apps.js)
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { Refused } from '@/lib/admin/content'
import { pieceFor, appOk, COOKIE } from '@/lib/site/apps'
export const dynamic = 'force-dynamic'
export async function GET(request) {
  const u = new URL(request.url), app = u.searchParams.get('app'), rel = Number(u.searchParams.get('r')), n = Number(u.searchParams.get('n'))
  if (!appOk(app) || !Number.isInteger(rel) || !Number.isInteger(n)) return NextResponse.json({ error: 'Request refused.' }, { status: 400 })
  try {
    const r = await pieceFor(app, rel, cookies().get(COOKIE(app))?.value, n)
    return new Response(r.body, { headers: { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' } })
  } catch (e) { return NextResponse.json({ error: e instanceof Refused ? e.message : 'Something went wrong. Try again.' }, { status: e instanceof Refused ? e.status : 500 }) }
}

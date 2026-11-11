// Private apps (lib/site/apps.js): GET ?app= → this browser's status; POST { action: 'request' | 'done', app, … }
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { sameOrigin, clientIp } from '@/lib/admin/auth'
import { Refused } from '@/lib/admin/content'
import { statusOf, requestAccess, downloaded, appOk, COOKIE } from '@/lib/site/apps'
export const dynamic = 'force-dynamic'
const fail = (e) => NextResponse.json({ error: e instanceof Refused ? e.message : 'Something went wrong. Try again.' }, { status: e instanceof Refused ? e.status : 500 })
const NOSTORE = { 'Cache-Control': 'no-store' }
export async function GET(request) {
  const app = new URL(request.url).searchParams.get('app')
  try { return NextResponse.json(await statusOf(app, appOk(app) ? cookies().get(COOKIE(app))?.value : null), { headers: NOSTORE }) } catch (e) { return fail(e) }
}
export async function POST(request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Request refused.' }, { status: 403 })
  const b = await request.json().catch(() => null); if (!b || !appOk(b.app)) return NextResponse.json({ error: 'Request refused.' }, { status: 400 })
  try {
    if (b.action === 'done') return NextResponse.json(await downloaded(b.app, cookies().get(COOKIE(b.app))?.value))
    if (b.action !== 'request') return NextResponse.json({ error: 'Request refused.' }, { status: 400 })
    const r = await requestAccess(b.app, b, clientIp())
    const res = NextResponse.json({ status: r.status }, { headers: NOSTORE })
    if (r.token) res.cookies.set(COOKIE(b.app), r.token, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 400 * 86400 })
    return res
  } catch (e) { return fail(e) }
}

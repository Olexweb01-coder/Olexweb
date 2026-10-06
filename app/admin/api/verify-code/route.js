import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { checkSecondStep, sameOrigin, clientIp, PENDING_COOKIE, SESSION_COOKIE } from '@/lib/admin/auth'

export const dynamic = 'force-dynamic'
export async function POST(request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Request refused.' }, { status: 403 })
  let body = {}; try { body = await request.json() } catch { return NextResponse.json({ error: 'Request refused.' }, { status: 400 }) }
  const r = await checkSecondStep(cookies().get(PENDING_COOKIE)?.value, body.code, clientIp(), request.headers.get('user-agent'))
  if (r.error) {
    const res = NextResponse.json({ error: r.error, restart: !!r.restart }, { status: 401 })
    if (r.restart) res.cookies.delete(PENDING_COOKIE)
    return res
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.delete(PENDING_COOKIE)
  res.cookies.set(SESSION_COOKIE, r.session, { httpOnly: true, secure: true, sameSite: 'strict', path: '/', maxAge: r.maxAge })
  return res
}

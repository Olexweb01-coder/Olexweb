import { NextResponse } from 'next/server'
import { checkPassword, sameOrigin, clientIp, PENDING_COOKIE } from '@/lib/admin/auth'

export const dynamic = 'force-dynamic'
export async function POST(request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Request refused.' }, { status: 403 })
  let body = {}; try { body = await request.json() } catch { return NextResponse.json({ error: 'Request refused.' }, { status: 400 }) }
  const r = await checkPassword(body.email, body.password, clientIp())
  if (r.error) return NextResponse.json({ error: r.error }, { status: 401 })
  const res = NextResponse.json({ next: 'code' })
  res.cookies.set(PENDING_COOKIE, r.pending, { httpOnly: true, secure: true, sameSite: 'strict', path: '/', maxAge: 300 })
  return res
}

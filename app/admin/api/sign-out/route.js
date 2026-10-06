import { NextResponse } from 'next/server'
import { currentUser, endSession, sameOrigin, audit, clientIp, SESSION_COOKIE } from '@/lib/admin/auth'

export const dynamic = 'force-dynamic'
export async function POST(request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Request refused.' }, { status: 403 })
  const u = await currentUser()
  if (u) { await endSession(u.sessionHash); await audit(u.id, 'signed_out', {}, clientIp()) }
  const res = NextResponse.json({ ok: true })
  res.cookies.delete(SESSION_COOKIE)
  return res
}

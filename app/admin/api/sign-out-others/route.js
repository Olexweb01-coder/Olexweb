import { NextResponse } from 'next/server'
import { currentUser, endOtherSessions, sameOrigin, audit, clientIp } from '@/lib/admin/auth'

export const dynamic = 'force-dynamic'
export async function POST(request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Request refused.' }, { status: 403 })
  const u = await currentUser()
  if (!u) return NextResponse.json({ error: 'Sign in again.' }, { status: 401 })
  const n = await endOtherSessions(u.id, u.sessionHash)
  await audit(u.id, 'signed_out_other_devices', { count: n }, clientIp())
  return NextResponse.json({ ok: true, count: n })
}

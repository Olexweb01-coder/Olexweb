// Install 38: the red dots and the app-icon number (read), and "I've seen this section" (write)
import { NextResponse } from 'next/server'
import { currentUser, sameOrigin, ownerOnly } from '@/lib/admin/auth'
import { attention, markSeen } from '@/lib/admin/attention'
export const dynamic = 'force-dynamic'
export async function GET() {
  const u = await currentUser(); if (!u) return NextResponse.json({ error: 'Sign in again.' }, { status: 401 })
  if (!ownerOnly(u)) return NextResponse.json({ sections: {}, total: 0 })
  return NextResponse.json(await attention())
}
export async function POST(request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Request refused.' }, { status: 403 })
  const u = await currentUser(); if (!u) return NextResponse.json({ error: 'Sign in again.' }, { status: 401 })
  if (!ownerOnly(u)) return NextResponse.json({ ok: true })
  let b; try { b = await request.json() } catch { return NextResponse.json({ error: 'Request refused.' }, { status: 400 }) }
  await markSeen(b.section)
  return NextResponse.json(await attention())
}

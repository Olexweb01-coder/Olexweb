// Who's signed in to Meet (GET), and signing out (POST { action: 'sign-out' }). Same-site only.
import { NextResponse } from 'next/server'
import { sameOrigin } from '@/lib/admin/auth'
import { currentMeetUser, providers, signOut, SESSION_COOKIE } from '@/lib/meet/auth'
export const dynamic = 'force-dynamic'
export async function GET() { return NextResponse.json({ user: await currentMeetUser(), providers: providers() }, { headers: { 'Cache-Control': 'no-store' } }) }
export async function POST(request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Request refused.' }, { status: 403 })
  const b = await request.json().catch(() => null)
  if (!b || b.action !== 'sign-out') return NextResponse.json({ error: 'Request refused.' }, { status: 400 })
  await signOut()
  const res = NextResponse.json({ ok: true }); res.cookies.set({ name: SESSION_COOKIE, value: '', httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 }); return res
}

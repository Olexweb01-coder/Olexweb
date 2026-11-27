// Who's signed in to Meet (GET), and signing out (POST { action: 'sign-out' }). Same-site only.
// Install 63: POST { action: 'delete-check' } says what stops deleting the account; { action: 'delete', confirm: 'DELETE' } deletes it.
import { NextResponse } from 'next/server'
import { sameOrigin } from '@/lib/admin/auth'
import { currentMeetUser, providers, signOut, SESSION_COOKIE } from '@/lib/meet/auth'
import { deleteBlockers, deleteAccount } from '@/lib/meet/account'
import { Refused } from '@/lib/admin/content'
import { limit, clientIp } from '@/lib/meet/limit'
export const dynamic = 'force-dynamic'
export async function GET() { return NextResponse.json({ user: await currentMeetUser(), providers: providers() }, { headers: { 'Cache-Control': 'no-store' } }) }
export async function POST(request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Request refused.' }, { status: 403 })
  const b = await request.json().catch(() => null)
  if (b && (b.action === 'delete-check' || b.action === 'delete')) {
    const user = await currentMeetUser()
    if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
    try {
      await limit('delete:' + clientIp(), 20, 600)
      if (b.action === 'delete-check') return NextResponse.json({ blockers: await deleteBlockers(user) }, { headers: { 'Cache-Control': 'no-store' } })
      await deleteAccount(user, b.confirm)
    } catch (e) {
      if (e instanceof Refused) return NextResponse.json({ error: e.message }, { status: e.status || 400 })
      console.error('meet delete account', e); return NextResponse.json({ error: 'Something went wrong. Nothing was deleted. Try again.' }, { status: 500 })
    }
    const res = NextResponse.json({ ok: true }); res.cookies.set({ name: SESSION_COOKIE, value: '', httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 }); return res
  }
  if (!b || b.action !== 'sign-out') return NextResponse.json({ error: 'Request refused.' }, { status: 400 })
  await signOut()
  const res = NextResponse.json({ ok: true }); res.cookies.set({ name: SESSION_COOKIE, value: '', httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 }); return res
}

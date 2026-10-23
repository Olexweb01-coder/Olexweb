// Starts connecting the YouTube channel (owner only): sends the browser to Google with a one-time state.
import { NextResponse } from 'next/server'
import { currentUser, ownerOnly } from '@/lib/admin/auth'
import { startConnect, STATE_COOKIE, SITE_ORIGIN, YtError } from '@/lib/site/youtube'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
const back = (code) => NextResponse.redirect(SITE_ORIGIN() + '/admin/youtube?yt=' + code, 303)
export async function GET() {
  const u = await currentUser(); if (!u) return NextResponse.redirect(SITE_ORIGIN() + '/admin/login', 303)
  if (!ownerOnly(u)) return back('owner')
  try {
    const { url, state } = await startConnect(u.id, SITE_ORIGIN())
    const res = NextResponse.redirect(url, 303)
    // Lax (not Strict) so it comes back with Google's redirect; it only holds the state, never a session.
    res.cookies.set(STATE_COOKIE, state, { httpOnly: true, secure: SITE_ORIGIN().startsWith('https:'), sameSite: 'lax', path: '/admin/api/youtube', maxAge: 600 })
    return res
  } catch (e) {
    if (e instanceof YtError) return back(e.code)
    console.error('youtube connect failed', e); return back('error')
  }
}

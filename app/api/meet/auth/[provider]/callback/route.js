// Back from the sign-in provider: checks it, signs the person in, and returns them to where they were (lib/meet/auth.js).
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { finishSignIn, sessionCookie, clearStateCookie, stateCookieName, PROVIDERS, AuthError } from '@/lib/meet/auth'
import { meetOrigin, meetHome } from '@/lib/meet/origin'
export const dynamic = 'force-dynamic'
export async function GET(request, { params }) {
  const p = String(params.provider || ''), origin = meetOrigin(request), home = meetHome(request)
  if (!PROVIDERS[p]) return new NextResponse('Not found', { status: 404 })
  try {
    const r = await finishSignIn(p, origin, new URL(request.url).searchParams, cookies().get(stateCookieName)?.value)
    const to = r.next === '/' ? home : (home === '/meet' && !r.next.startsWith('/meet') ? '/meet' + r.next : r.next)
    const res = NextResponse.redirect(origin + to, 302); res.cookies.set(sessionCookie(r.token)); res.cookies.set(clearStateCookie()); return res
  } catch (e) {
    const msg = e instanceof AuthError ? e.message : 'Sign-in didn’t work. Try again.'
    if (!(e instanceof AuthError)) console.error('meet sign-in', e)
    const res = NextResponse.redirect(`${origin}${home}?signin=${encodeURIComponent(msg)}`, 302); res.cookies.set(clearStateCookie()); return res
  }
}

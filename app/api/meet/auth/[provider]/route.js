// Sign in to Meet: GET /api/meet/auth/google?next=/ sends the person to that provider (lib/meet/auth.js).
import { NextResponse } from 'next/server'
import { startSignIn, PROVIDERS } from '@/lib/meet/auth'
import { meetOrigin, meetHome } from '@/lib/meet/origin'
export const dynamic = 'force-dynamic'
export async function GET(request, { params }) {
  const p = String(params.provider || '')
  if (!PROVIDERS[p]) return new NextResponse('Not found', { status: 404 })
  const origin = meetOrigin(request)
  try {
    const s = startSignIn(p, origin, new URL(request.url).searchParams.get('next'))
    const res = NextResponse.redirect(s.url, 302); res.cookies.set(s.cookie); return res
  } catch (e) { return NextResponse.redirect(`${origin}${meetHome(request)}?signin=${encodeURIComponent(e.message)}`, 302) }
}

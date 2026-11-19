// Install 42: start connecting LinkedIn (owner only): off to LinkedIn's sign-in with an unguessable state. The state is also put in a
// short-lived Lax cookie, because the admin's (Strict) session cookie isn't sent when LinkedIn sends the browser back.
import { NextResponse } from 'next/server'
import { currentUser, ownerOnly } from '@/lib/admin/auth'
import { liConnectUrl as connectUrl } from '@/lib/site/linkedin'
import { SITE_ORIGIN } from '@/lib/site/youtube'
export const dynamic = 'force-dynamic'
export async function GET(request) {
  const u = await currentUser(); if (!u || !ownerOnly(u)) return NextResponse.redirect(new URL('/admin/login', request.url))
  try {
    const { url, state } = await connectUrl(SITE_ORIGIN(), u.id), res = NextResponse.redirect(url)
    res.cookies.set('olex_li_state', state, { httpOnly: true, secure: SITE_ORIGIN().startsWith('https:'), sameSite: 'lax', path: '/admin/api/linkedin', maxAge: 900 })
    return res
  } catch (e) { console.error('linkedin connect', e.message); return NextResponse.redirect(new URL('/admin/linkedin?li=' + (/LINKEDIN_CLIENT_ID/.test(e.message) ? 'notready' : 'failed'), request.url)) }
}

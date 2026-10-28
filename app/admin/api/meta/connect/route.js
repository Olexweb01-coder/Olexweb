// Start connecting the Facebook Page (owner only): off to Meta's login with an unguessable state. The state is also put in a
// short-lived Lax cookie, because the admin's (Strict) session cookie isn't sent when Meta sends the browser back.
import { NextResponse } from 'next/server'
import { currentUser, ownerOnly } from '@/lib/admin/auth'
import { connectUrl } from '@/lib/site/meta'
import { SITE_ORIGIN } from '@/lib/site/youtube'
export const dynamic = 'force-dynamic'
export async function GET(request) {
  const u = await currentUser(); if (!u || !ownerOnly(u)) return NextResponse.redirect(new URL('/admin/login', request.url))
  try {
    const { url, state } = await connectUrl(SITE_ORIGIN(), u.id), res = NextResponse.redirect(url)
    res.cookies.set('olex_meta_state', state, { httpOnly: true, secure: SITE_ORIGIN().startsWith('https:'), sameSite: 'lax', path: '/admin/api/meta', maxAge: 900 })
    return res
  } catch (e) { console.error('meta connect', e.message); return NextResponse.redirect(new URL('/admin/automation/facebook?fb=' + (/META_APP_ID/.test(e.message) ? 'notready' : 'failed'), request.url)) }
}

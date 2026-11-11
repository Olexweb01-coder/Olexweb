// The email link (lib/site/apps.js openLink): lets this device in, then opens the app's page, which downloads at once
import { NextResponse } from 'next/server'
import { openLink, COOKIE } from '@/lib/site/apps'
export const dynamic = 'force-dynamic'
export async function GET(request) {
  const u = new URL(request.url), r = await openLink(u.searchParams.get('t')).catch(() => null)
  const origin = String(process.env.MAIN_ORIGIN || u.origin).replace(/\/$/, '')
  if (!r) return NextResponse.redirect(origin + '/tools/graceville-fast-bible?link=expired', 303)
  const res = NextResponse.redirect(`${origin}/tools/${r.app}?ready=1`, 303)
  res.cookies.set(COOKIE(r.app), r.token, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 400 * 86400 })
  return res
}

// A host's tracked link (Install 58): counts the open, remembers the link for 7 days (so a sale is credited to it),
// then goes to what it's for. Unknown links go to Meet's home.
import { NextResponse } from 'next/server'
import { openLink, COOKIE } from '@/lib/meet/links'
import { meetBase } from '@/lib/site/meet'
export const dynamic = 'force-dynamic'
export async function GET(request, { params }) {
  const url = new URL(request.url)
  const l = await openLink(params.slug).catch(() => null)
  const res = NextResponse.redirect(new URL(l ? l.to : (meetBase() ? '/' : '/meet'), url.origin), 302)
  if (l) res.cookies.set(COOKIE, String(l.id), { httpOnly: true, secure: url.protocol === 'https:', sameSite: 'lax', path: '/', maxAge: 7 * 86400 })
  return res
}

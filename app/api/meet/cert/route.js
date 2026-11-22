// "Get your certificate" (the link at the end of a meeting carries a key the server made when they joined, so only that
// person can get theirs). Install 58: each certificate has its own page and code; a paid one goes to checkout first.
import { NextResponse } from 'next/server'
import { getCert } from '@/lib/meet/certs'
import { meetHost } from '@/lib/site/meet'
export const dynamic = 'force-dynamic'
export async function GET(request) {
  const url = new URL(request.url), u = url.searchParams
  const onMeet = !!meetHost() && (request.headers.get('x-forwarded-host') || request.headers.get('host') || '') === meetHost()
  let c; try { c = await getCert(u.get('code'), u.get('id'), u.get('k')) } catch (e) { return new Response(e.message || 'Not available', { status: e.status || 403, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }) }
  const q = new URLSearchParams({ code: u.get('code') || '', id: u.get('id') || '', k: u.get('k') || '' })
  const to = c.serial ? (onMeet ? '/v/' : '/meet/v/') + c.serial : '/meet/v/get?' + q
  return NextResponse.redirect(new URL(to, url.origin), 303)
}

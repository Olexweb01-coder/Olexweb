// Start connecting the Facebook Page (owner only): off to Meta's login, with an unguessable state.
import { NextResponse } from 'next/server'
import { currentUser, ownerOnly } from '@/lib/admin/auth'
import { connectUrl } from '@/lib/site/meta'
export const dynamic = 'force-dynamic'
export async function GET(request) {
  const u = await currentUser(); if (!u || !ownerOnly(u)) return NextResponse.redirect(new URL('/admin/login', request.url))
  const origin = new URL(request.url).origin
  try { return NextResponse.redirect(await connectUrl(origin, u.id)) } catch (e) { console.error('meta connect', e.message); return NextResponse.redirect(new URL('/admin/youtube?view=videos&fb=' + (/META_APP_ID/.test(e.message) ? 'notready' : 'failed'), request.url)) }
}

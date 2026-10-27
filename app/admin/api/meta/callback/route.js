// Meta sends him back here after he allows the app: swap the code for the Page's posting key (stored encrypted).
import { NextResponse } from 'next/server'
import { currentUser, ownerOnly } from '@/lib/admin/auth'
import { finishConnect } from '@/lib/site/meta'
export const dynamic = 'force-dynamic'
export async function GET(request) {
  const url = new URL(request.url), back = (k) => NextResponse.redirect(new URL('/admin/youtube?view=videos&fb=' + k, request.url))
  const u = await currentUser(); if (!u || !ownerOnly(u)) return NextResponse.redirect(new URL('/admin/login', request.url))
  if (url.searchParams.get('error')) return back('cancelled')
  try { const r = await finishConnect(url.origin, url.searchParams.get('code'), url.searchParams.get('state')); return back(r.ok ? 'connected' : r.why) } catch (e) { console.error('meta connect', e.message); return back('failed') }
}

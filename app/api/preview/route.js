// The mock-up page reports a real look ('view', after a moment on screen) or a tap on "Talk to Olaitan" ('click').
// Olaitan's own visits (signed in to the admin) don't count.
import { NextResponse } from 'next/server'
import { currentUser, sameOrigin } from '@/lib/admin/auth'
import { seen, TOKEN_RE } from '@/lib/sales/preview'
export const dynamic = 'force-dynamic'
export async function POST(request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Request refused.' }, { status: 403 })
  const b = await request.json().catch(() => null)
  if (!b || !TOKEN_RE.test(String(b.token || '')) || !['view', 'click'].includes(b.what)) return NextResponse.json({ error: 'Request refused.' }, { status: 400 })
  if (await currentUser().catch(() => null)) return NextResponse.json({ ok: true, owner: true })
  if (/bot|crawl|spider|preview|scanner|headless|slurp|facebookexternalhit|linkedinbot|outlook|safelinks/i.test(request.headers.get('user-agent') || '')) return NextResponse.json({ ok: true })
  try { return NextResponse.json(await seen(b.token, b.what)) } catch { return NextResponse.json({ ok: false }) }
}

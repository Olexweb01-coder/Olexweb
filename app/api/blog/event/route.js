// Readers' actions on an article: view, read, like, unlike, save, unsave, share. No cookies; see lib/site/engage.js.
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { sameOrigin, clientIp } from '@/lib/admin/auth'
import { record } from '@/lib/site/engage'
export const dynamic = 'force-dynamic'
export async function POST(request) {
  if (!sameOrigin(request)) return NextResponse.json({ ok: false }, { status: 403 })
  let b; try { b = await request.json() } catch { return NextResponse.json({ ok: false }, { status: 400 }) }
  const r = await record({ slug: b.slug, type: b.type, app: b.app, ref: String(b.ref || '').slice(0, 500), utm: String(b.utm || '').slice(0, 40) }, clientIp(), headers().get('user-agent') || '')
  return NextResponse.json({ ok: r.ok }, { status: r.ok ? 200 : r.reason === 'slow down' ? 429 : 400 })
}

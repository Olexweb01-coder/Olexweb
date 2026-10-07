// The owner's "What readers see" thresholds.
import { NextResponse } from 'next/server'
import { currentUser, sameOrigin, ownerOnly, audit, clientIp } from '@/lib/admin/auth'
import { saveSettings } from '@/lib/site/engage'
export const dynamic = 'force-dynamic'
export async function POST(request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Request refused.' }, { status: 403 })
  const u = await currentUser(); if (!u) return NextResponse.json({ error: 'Sign in again.' }, { status: 401 })
  if (!ownerOnly(u)) return NextResponse.json({ error: 'Only Olaitan can change this.' }, { status: 403 })
  let b; try { b = await request.json() } catch { return NextResponse.json({ error: 'Request refused.' }, { status: 400 }) }
  try { await saveSettings(b) } catch (e) { return NextResponse.json({ error: e.message }, { status: 400 }) }
  await audit(u.id, 'blog_settings_changed', {}, clientIp())
  return NextResponse.json({ ok: true })
}

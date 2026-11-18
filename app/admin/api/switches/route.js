// Install 31: the automation's on/off switches (owner only)
import { NextResponse } from 'next/server'
import { currentUser, sameOrigin, ownerOnly, clientIp, audit } from '@/lib/admin/auth'
import { switchesData, setSwitch } from '@/lib/site/switches'
export const dynamic = 'force-dynamic'
export async function POST(request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Request refused.' }, { status: 403 })
  const u = await currentUser(); if (!u) return NextResponse.json({ error: 'Sign in again.' }, { status: 401 })
  if (!ownerOnly(u)) return NextResponse.json({ error: 'Only the owner can change these.' }, { status: 403 })
  let b; try { b = await request.json() } catch { return NextResponse.json({ error: 'Request refused.' }, { status: 400 }) }
  try { await setSwitch(String(b.key || ''), b.on === true); await audit(u.id, 'switch_changed', { key: b.key, on: b.on === true }, clientIp()).catch(() => {}); return NextResponse.json({ ok: true, switches: await switchesData() }) }
  catch (e) { return NextResponse.json({ error: e.message }, { status: 400 }) }
}

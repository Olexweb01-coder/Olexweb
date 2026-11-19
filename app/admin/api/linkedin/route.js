// Install 42: LinkedIn's switches (owner only): on/off, post now, disconnect
import { NextResponse } from 'next/server'
import { currentUser, sameOrigin, ownerOnly } from '@/lib/admin/auth'
import { liSetEnabled, liPostNow, liDisconnect, liStatus } from '@/lib/site/linkedin'
export const dynamic = 'force-dynamic'
export const maxDuration = 120
export async function POST(request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Request refused.' }, { status: 403 })
  const u = await currentUser(); if (!u || !ownerOnly(u)) return NextResponse.json({ error: 'Only the owner can do this.' }, { status: 403 })
  let b; try { b = await request.json() } catch { return NextResponse.json({ error: 'Request refused.' }, { status: 400 }) }
  try {
    if (b.action === 'enable') await liSetEnabled(!!b.on)
    else if (b.action === 'post') { const r = await liPostNow({ force: true }); if (r.skipped) return NextResponse.json({ error: 'Nothing to post: ' + r.skipped + '.' }, { status: 400 }) }
    else if (b.action === 'disconnect') await liDisconnect()
    else return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
    return NextResponse.json(JSON.parse(JSON.stringify(await liStatus())))
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 400 }) }
}

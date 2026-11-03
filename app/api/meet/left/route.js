// A guest's browser says it left (sent as it closes). Needs the key the server gave that guest, so nobody can mark others gone.
import { NextResponse } from 'next/server'
import { leftByKey } from '@/lib/meet/guests'
export const dynamic = 'force-dynamic'
export async function POST(request) {
  const b = await request.json().catch(() => null)
  const ok = b ? await leftByKey(String(b.identity || '').slice(0, 40), String(b.key || '').slice(0, 100)).catch(() => false) : false
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 })
}

// A tap on a WhatsApp button (anonymous daily totals per page).
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { sameOrigin, clientIp } from '@/lib/admin/auth'
import { recordClick } from '@/lib/site/leads'
export const dynamic = 'force-dynamic'
export async function POST(request) {
  if (!sameOrigin(request)) return NextResponse.json({ ok: false }, { status: 403 })
  let b = {}; try { b = JSON.parse(await request.text() || '{}') } catch {}
  await recordClick(b, clientIp(), headers().get('user-agent') || '')
  return NextResponse.json({ ok: true })
}

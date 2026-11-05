// "Book a call with Olaitan": GET → open slots; POST → book one. Same-site only for booking. lib/sales/book.js.
import { NextResponse } from 'next/server'
import { sameOrigin, clientIp } from '@/lib/admin/auth'
import { refuse, readJson } from '@/lib/admin/respond'
import { Refused } from '@/lib/admin/content'
import { slots, book } from '@/lib/sales/book'
export const dynamic = 'force-dynamic'
export async function GET() { return NextResponse.json({ slots: await slots() }, { headers: { 'Cache-Control': 'no-store' } }) }
export async function POST(request) {
  if (!sameOrigin(request)) return refuse('Request refused.', 403)
  const b = await readJson(request); if (!b) return refuse('Request refused.', 400)
  try { return NextResponse.json(await book(b, clientIp())) }
  catch (e) { if (e instanceof Refused) return refuse(e.message, e.status || 400); console.error('booking', e); return refuse('Something went wrong. Try again.', 500) }
}

// olexweb.com/me → your WhatsApp chat, with the message you set in the admin (Course & links). Every tap is counted.
import { NextResponse } from 'next/server'
import { linkTarget } from '@/lib/site/aoc'
export const dynamic = 'force-dynamic'
export async function GET() {
  let to = null
  try { to = await linkTarget('me') } catch (e) { console.error('me link failed', e) }
  return NextResponse.redirect(to || 'https://olexweb.com/', { status: 302, headers: { 'Cache-Control': 'no-store' } })
}

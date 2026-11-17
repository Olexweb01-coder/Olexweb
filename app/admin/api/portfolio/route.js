// Install 28: a portfolio project from a link. Signed-in admin users only (same rights as adding a project by hand).
import { NextResponse } from 'next/server'
import { currentUser, sameOrigin, clientIp } from '@/lib/admin/auth'
import { Refused } from '@/lib/admin/content'
import { fromLink, shotsFor, retryShots } from '@/lib/site/portfolio'
export const dynamic = 'force-dynamic'
export const maxDuration = 120
export async function POST(request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Request refused.' }, { status: 403 })
  const u = await currentUser(); if (!u) return NextResponse.json({ error: 'Sign in again.' }, { status: 401 })
  let b; try { b = await request.json() } catch { return NextResponse.json({ error: 'Request refused.' }, { status: 400 }) }
  try {
    if (b.action === 'from-link') return NextResponse.json(await fromLink(u, clientIp(), b.url))
    if (b.action === 'shots') return NextResponse.json(await shotsFor(b.id))
    if (b.action === 'retry-shots') return NextResponse.json(await retryShots(u, b.id))
    return NextResponse.json({ error: 'Request refused.' }, { status: 400 })
  } catch (e) {
    if (e instanceof Refused) return NextResponse.json({ error: e.message }, { status: e.status })
    console.error('portfolio from link failed', e)
    return NextResponse.json({ error: /busy|No AI|model/i.test(String(e.message)) ? 'The AI is busy. Try again in a minute.' : 'Something went wrong. Try again.' }, { status: 500 })
  }
}

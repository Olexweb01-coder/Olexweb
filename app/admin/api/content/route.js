import { NextResponse } from 'next/server'
import { currentUser, sameOrigin, clientIp } from '@/lib/admin/auth'
import { run, Refused } from '@/lib/admin/content'

export const dynamic = 'force-dynamic'
export async function POST(request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Request refused.' }, { status: 403 })
  const u = await currentUser()
  if (!u) return NextResponse.json({ error: 'Sign in again.' }, { status: 401 })
  let body; try { body = await request.json() } catch { return NextResponse.json({ error: 'Request refused.' }, { status: 400 }) }
  try { return NextResponse.json(await run(u, clientIp(), body || {})) }
  catch (e) {
    if (e instanceof Refused) return NextResponse.json({ error: e.message }, { status: e.status })
    console.error('content action failed', e)
    return NextResponse.json({ error: 'Something went wrong while saving. Try again.' }, { status: 500 })
  }
}

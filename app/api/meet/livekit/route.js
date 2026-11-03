// LiveKit's events (set in LiveKit: Settings → Webhooks → https://meet.olexweb.com/api/meet/livekit). Each is signed with
// the API key and secret; anything not signed by LiveKit is refused. Used for when people join and leave (attendance).
import { NextResponse } from 'next/server'
import { livekitEvent } from '@/lib/meet/guests'
export const dynamic = 'force-dynamic'
export async function POST(request) {
  const body = await request.text()
  try { return NextResponse.json(await livekitEvent(body, request.headers.get('authorization') || '')) }
  catch { return NextResponse.json({ error: 'Not a LiveKit event.' }, { status: 401 }) }
}

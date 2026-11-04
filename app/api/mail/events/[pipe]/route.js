// Olexweb Mail delivery reports: /api/mail/events/resend (signed), /api/mail/events/mailjet?token=…, /api/mail/events/own
// (Bearer OWN_MAIL_TOKEN). Anything not proven genuine is refused. lib/mail/events.js.
import { NextResponse } from 'next/server'
import * as Ev from '@/lib/mail/events'
export const dynamic = 'force-dynamic'
const no = () => NextResponse.json({ error: 'Not a genuine report.' }, { status: 401 })
export async function POST(request, { params }) {
  const body = await request.text(); let j = null; try { j = JSON.parse(body) } catch {}
  if (!j) return NextResponse.json({ error: 'Not JSON.' }, { status: 400 })
  if (params.pipe === 'resend') { if (!Ev.resendSigned(body, request.headers)) return no(); await Ev.resendEvent(j) }
  else if (params.pipe === 'mailjet') { if (!Ev.tokenOk(new URL(request.url).searchParams.get('token'), 'MAIL_EVENTS_TOKEN')) return no(); await Ev.mailjetEvents(j) }
  else if (params.pipe === 'own') { if (!Ev.tokenOk(String(request.headers.get('authorization') || '').replace(/^Bearer /, ''), 'OWN_MAIL_TOKEN')) return no(); await Ev.ownEvents(j) }
  else return NextResponse.json({ error: 'Unknown pipe.' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

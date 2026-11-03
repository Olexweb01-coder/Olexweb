// Joining a meeting (public): GET ?code= says whether it has started (the waiting screen asks every few seconds);
// POST { code, name } returns a signed join token. Signed in as the owner = the host. Same-site requests only.
import { currentUser, sameOrigin } from '@/lib/admin/auth'
import { respond, refuse, readJson } from '@/lib/admin/respond'
import { meetingState, joinMeeting, calendarFile } from '@/lib/site/meet'
export const dynamic = 'force-dynamic'
export async function GET(request) {
  const sp = new URL(request.url).searchParams, code = sp.get('code')
  if (sp.get('calendar') === '1') {                                       // the guest's "Add to calendar" file
    try { const text = await calendarFile(code, new URL(request.url).origin); return new Response(text, { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'attachment; filename="meeting.ics"', 'Cache-Control': 'no-store' } }) }
    catch (e) { return refuse(e.message || 'No calendar for this meeting.', e.status || 404) }
  }
  const u = await currentUser().catch(() => null), host = !!(u && u.role === 'owner')   // opened from WhatsApp, the page load had no cookie; this fetch does
  return respond(async () => ({ ...(await meetingState(code)), host, hostName: host ? u.name : '' }))
}
export async function POST(request) {
  if (!sameOrigin(request)) return refuse('Request refused.', 403)
  const b = await readJson(request); if (!b) return refuse('Request refused.', 400)
  const u = await currentUser().catch(() => null)
  return respond(() => joinMeeting(b.code, b.name, u))
}

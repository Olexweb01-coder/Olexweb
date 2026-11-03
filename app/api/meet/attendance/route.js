// The attendance list, for the meeting's host only, after it ends. GET ?code= (JSON) or ?code=&format=csv (download);
// POST { code, action: 'delete' } deletes it now. Olaitan (admin) or the Meet account that hosts it.
import { NextResponse } from 'next/server'
import { currentUser, sameOrigin } from '@/lib/admin/auth'
import { respond, refuse, readJson } from '@/lib/admin/respond'
import { currentMeetUser } from '@/lib/meet/auth'
import { mustHost } from '@/lib/site/meet'
import { attendance, attendanceCsv, deleteAttendance } from '@/lib/meet/guests'
export const dynamic = 'force-dynamic'
export async function GET(request) {
  const sp = new URL(request.url).searchParams, code = String(sp.get('code') || '')
  const u = await currentUser().catch(() => null), mu = await currentMeetUser()
  if (sp.get('format') !== 'csv') return respond(async () => { await mustHost(code, u, mu); return attendance(code) })
  try {
    await mustHost(code, u, mu); const a = await attendance(code)
    const name = (a.title.replace(/[^\w\- ]+/g, '').trim().slice(0, 50) || 'Meeting') + ' attendance.csv'
    return new NextResponse(attendanceCsv(a), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}"`, 'Cache-Control': 'no-store' } })
  } catch (e) { return refuse(e.message || 'Not available.', e.status || 400) }
}
export async function POST(request) {
  if (!sameOrigin(request)) return refuse('Request refused.', 403)
  const b = await readJson(request); if (!b || b.action !== 'delete') return refuse('Request refused.', 400)
  const u = await currentUser().catch(() => null), mu = await currentMeetUser()
  return respond(async () => { await mustHost(b.code, u, mu); return deleteAttendance(b.code) })
}

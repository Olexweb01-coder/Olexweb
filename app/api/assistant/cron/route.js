// Called by Vercel's scheduler (vercel.json) twice a day, and optionally every few minutes by a free pinger
// (?run=due) so review windows and reminders happen on time. Only you and Vercel know CRON_SECRET.
import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { dailyRun, quickRun } from '@/lib/assistant/autopilot'
export const dynamic = 'force-dynamic'
// Never let Next.js cache outside requests made here (it caches fetch in some routes by default).
export const fetchCache = 'force-no-store'
export const maxDuration = 300
export async function GET(request) {
  const want = 'Bearer ' + (process.env.CRON_SECRET || ''), got = request.headers.get('authorization') || ''
  if (!process.env.CRON_SECRET || got.length !== want.length || !timingSafeEqual(Buffer.from(got), Buffer.from(want))) return NextResponse.json({ error: 'Not allowed.' }, { status: 401 })
  const which = new URL(request.url).searchParams.get('run')
  if (which === 'due') return NextResponse.json(await quickRun())            // every few minutes: reminders, review windows, scheduled items
  return NextResponse.json(await dailyRun({ retry: which === 'retry' }))
}

// Called by Vercel's scheduler (vercel.json) twice a day, and optionally every few minutes by a free pinger
// (?run=due) so review windows and reminders happen on time. Only you and Vercel know CRON_SECRET.
import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { waitUntil } from '@vercel/functions'
import { dailyRun, quickRun } from '@/lib/assistant/autopilot'
import { withRunLock } from '@/lib/assistant/runlock'
export const dynamic = 'force-dynamic'
// Never let Next.js cache outside requests made here (it caches fetch in some routes by default).
export const fetchCache = 'force-no-store'
export const maxDuration = 300
export async function GET(request) {
  const want = 'Bearer ' + (process.env.CRON_SECRET || ''), got = request.headers.get('authorization') || ''
  if (!process.env.CRON_SECRET || got.length !== want.length || !timingSafeEqual(Buffer.from(got), Buffer.from(want))) return NextResponse.json({ error: 'Not allowed.' }, { status: 401 })
  const url = new URL(request.url), which = url.searchParams.get('run')
  if (which === 'due') {                                                      // every few minutes: reminders, review windows, scheduled items
    const run = () => withRunLock('quick', 6, quickRun)                       // never two at once (two schedulers, or a slow run)
    if (url.searchParams.get('bg') === '1') {                                 // schedulers that hang up after 30 s (cron-job.org): answer now,
      waitUntil(run().catch(() => {}))                                        // and keep working in the background (up to maxDuration)
      return NextResponse.json({ ok: true, started: true }, { status: 202 })
    }
    return NextResponse.json(await run())
  }
  return NextResponse.json(await dailyRun({ retry: which === 'retry' }))
}

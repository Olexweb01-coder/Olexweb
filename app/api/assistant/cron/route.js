// Called once a day by Vercel's scheduler (vercel.json). Only Vercel knows CRON_SECRET.
import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { dailyRun } from '@/lib/assistant/autopilot'
export const dynamic = 'force-dynamic'
// Never let Next.js cache outside requests made here (it caches fetch in some routes by default).
export const fetchCache = 'force-no-store'
export const maxDuration = 300
export async function GET(request) {
  const want = 'Bearer ' + (process.env.CRON_SECRET || ''), got = request.headers.get('authorization') || ''
  if (!process.env.CRON_SECRET || got.length !== want.length || !timingSafeEqual(Buffer.from(got), Buffer.from(want))) return NextResponse.json({ error: 'Not allowed.' }, { status: 401 })
  return NextResponse.json(await dailyRun({ retry: new URL(request.url).searchParams.get('run') === 'retry' }))
}

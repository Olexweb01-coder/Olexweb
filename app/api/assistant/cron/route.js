// Called once a day by Vercel's scheduler (vercel.json). Only Vercel knows CRON_SECRET.
import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { dailyRun } from '@/lib/assistant/autopilot'
export const dynamic = 'force-dynamic'
export const maxDuration = 300
export async function GET(request) {
  const want = 'Bearer ' + (process.env.CRON_SECRET || ''), got = request.headers.get('authorization') || ''
  if (!process.env.CRON_SECRET || got.length !== want.length || !timingSafeEqual(Buffer.from(got), Buffer.from(want))) return NextResponse.json({ error: 'Not allowed.' }, { status: 401 })
  return NextResponse.json(await dailyRun())
}

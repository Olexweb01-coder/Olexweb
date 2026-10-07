// The version of the admin that is live now, so an open app can tell when a newer one has been deployed.
import { NextResponse } from 'next/server'
import { currentUser } from '@/lib/admin/auth'
import { adminVersion } from '@/lib/admin/version'
export const dynamic = 'force-dynamic'
export async function GET() {
  if (!(await currentUser())) return NextResponse.json({ error: 'Sign in again.' }, { status: 401 })
  return NextResponse.json({ v: adminVersion() }, { headers: { 'Cache-Control': 'no-store' } })
}

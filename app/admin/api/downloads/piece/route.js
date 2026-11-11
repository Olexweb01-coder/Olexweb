// Admin → Downloads: one 4 MiB piece of a new version's installer (raw bytes; ?id=<release>&n=<piece>)
import { currentUser, sameOrigin, ownerOnly } from '@/lib/admin/auth'
import { respond, refuse } from '@/lib/admin/respond'
import { putReleasePiece } from '@/lib/site/apps'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
export async function POST(request) {
  if (!sameOrigin(request)) return refuse('Request refused.', 403)
  const u = await currentUser(); if (!u) return refuse('Sign in again.', 401)
  if (!ownerOnly(u)) return refuse('Only the owner can do this.', 403)
  const p = new URL(request.url).searchParams, id = Number(p.get('id')), n = Number(p.get('n'))
  if (!Number.isInteger(id) || !Number.isInteger(n)) return refuse('Request refused.', 400)
  const body = new Uint8Array(await request.arrayBuffer())
  return respond(() => putReleasePiece(id, n, body))
}

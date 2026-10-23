// Plays a finished video in the admin (owner only). The player asks for byte ranges; each answer is at most one 4 MiB piece.
import { currentUser, ownerOnly } from '@/lib/admin/auth'
import { videoResponse } from '@/lib/site/factory'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export async function GET(request) {
  const u = await currentUser(); if (!u || !ownerOnly(u)) return new Response('Not allowed', { status: 401 })
  const id = Number(new URL(request.url).searchParams.get('id'))
  if (!Number.isInteger(id) || id < 1) return new Response('Bad request', { status: 400 })
  return videoResponse(id, request.headers.get('range'))
}

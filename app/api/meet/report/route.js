// Reporting a meeting (anyone in it). Same-site only; limited per address (only a hash of it is kept).
import { sameOrigin, clientIp } from '@/lib/admin/auth'
import { respond, refuse, readJson } from '@/lib/admin/respond'
import { report } from '@/lib/meet/guests'
export const dynamic = 'force-dynamic'
export async function POST(request) {
  if (!sameOrigin(request)) return refuse('Request refused.', 403)
  const b = await readJson(request); if (!b) return refuse('Request refused.', 400)
  return respond(() => report(String(b.code || ''), { reason: b.reason, note: b.note, name: b.name }, clientIp()))
}

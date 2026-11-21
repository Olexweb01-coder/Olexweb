// Signing up for a scheduled meeting (name and email) to get reminders and, if the host chose it, the notes after.
import { sameOrigin } from '@/lib/admin/auth'
import { respond, refuse, readJson } from '@/lib/admin/respond'
import { register } from '@/lib/meet/pro'
export const dynamic = 'force-dynamic'
export async function POST(request) {
  if (!sameOrigin(request)) return refuse('Request refused.', 403)
  const b = await readJson(request); if (!b) return refuse('Request refused.', 400)
  return respond(() => register(b))
}

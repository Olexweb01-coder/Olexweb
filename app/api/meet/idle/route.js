// Install 61: quiet meetings end by themselves. POST { code, action: 'talk' | 'check' | 'end', as, seat, who? } from anyone in the meeting
// (their seat key proves who they are). 'talk' is only kept when they really have an open mic or a shared screen; 'end'
// only works after 30 quiet minutes (lib/site/meet.js idleAction). Same-site only.
import { sameOrigin } from '@/lib/admin/auth'
import { respond, refuse, readJson } from '@/lib/admin/respond'
import { idleAction } from '@/lib/site/meet'
export const dynamic = 'force-dynamic'
export async function POST(request) {
  if (!sameOrigin(request)) return refuse('Request refused.', 403)
  const b = await readJson(request); if (!b) return refuse('Request refused.', 400)
  return respond(() => idleAction(String(b.code || ''), b.action, b.as, b.seat, b.who))
}

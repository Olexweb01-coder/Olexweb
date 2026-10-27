// Facebook posting settings (owner only): choose the Page, on/off, Reels a day, resume after a pause, disconnect.
import { currentUser, sameOrigin, ownerOnly } from '@/lib/admin/auth'
import { respond, refuse, readJson } from '@/lib/admin/respond'
import { Refused } from '@/lib/admin/content'
import * as M from '@/lib/site/meta'
export const dynamic = 'force-dynamic'
export async function POST(request) {
  if (!sameOrigin(request)) return refuse('Request refused.', 403)
  const u = await currentUser(); if (!u) return refuse('Sign in again.', 401)
  if (!ownerOnly(u)) return refuse('Only Olaitan can do this.', 403)
  const b = await readJson(request); if (!b) return refuse('Request refused.', 400)
  return respond(async () => {
    try {
      if (b.action === 'select') return await M.selectPage(b.page)
      if (b.action === 'enable') return await M.setEnabled(b.on === true)
      if (b.action === 'per-day') return await M.setPerDay(b.n)
      if (b.action === 'resume') return await M.resume()
      if (b.action === 'disconnect') { if (b.confirm !== 'DISCONNECT') throw new M.MetaError('Type DISCONNECT to confirm.'); return await M.disconnect() }
      throw new M.MetaError('Unknown action.')
    } catch (e) { if (e instanceof M.MetaError) throw new Refused(e.message); throw e }
  })
}

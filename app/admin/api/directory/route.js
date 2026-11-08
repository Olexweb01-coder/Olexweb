// Directory (owner only): write the next pages now, publish/unpublish, rewrite, delete, settings.
import { currentUser, sameOrigin, ownerOnly } from '@/lib/admin/auth'
import { respond, refuse, readJson } from '@/lib/admin/respond'
import { Refused } from '@/lib/admin/content'
import * as D from '@/lib/site/directory'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
export async function POST(request) {
  if (!sameOrigin(request)) return refuse('Request refused.', 403)
  const u = await currentUser(); if (!u) return refuse('Sign in again.', 401)
  if (!ownerOnly(u)) return refuse('Only Olaitan can do this.', 403)
  const b = await readJson(request); if (!b) return refuse('Request refused.', 400)
  const id = () => { if (!Number.isInteger(b.id)) throw new D.DirError('Request refused.'); return b.id }
  return respond(async () => {
    try {
      switch (b.action) {
        case 'run': return await D.directoryRun({ max: 2, deadlineMs: 45000 })
        case 'publish': return await D.setStatus(id(), 'live')
        case 'unpublish': return await D.setStatus(id(), 'draft')
        case 'rewrite': return await D.rewrite(id())
        case 'delete': return await D.removeEntry(id())
        case 'settings': return await D.saveSettings(b)
        case 'linked': return await D.markLinked(id())
        case 'simple-settings': return await D.saveSimpleSettings(b)        // Install 16: the simple screen's controls
        case 'publish-now': { const r = await D.publishNow(); if (!r) throw new D.DirError('Nothing is ready to publish yet. The next one is being written.'); return r }
        default: throw new D.DirError('Unknown action.')
      }
    } catch (e) { if (e instanceof D.DirError) throw new Refused(e.message); throw e }
  })
}

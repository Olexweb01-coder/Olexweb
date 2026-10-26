// Pages & links (owner only): create, edit, publish pages; AI drafts and suggestions; short links; sign-ups.
import { currentUser, sameOrigin, ownerOnly } from '@/lib/admin/auth'
import { respond, refuse, readJson } from '@/lib/admin/respond'
import { Refused } from '@/lib/admin/content'
import * as P from '@/lib/site/pages'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
export async function POST(request) {
  if (!sameOrigin(request)) return refuse('Request refused.', 403)
  const u = await currentUser(); if (!u) return refuse('Sign in again.', 401)
  if (!ownerOnly(u)) return refuse('Only Olaitan can do this.', 403)
  const b = await readJson(request); if (!b) return refuse('Request refused.', 400)
  const id = () => { if (!Number.isInteger(b.id)) throw new P.PageError('Request refused.'); return b.id }
  return respond(async () => {
    try {
      switch (b.action) {
        case 'create': return await P.createPage(b.type)
        case 'save': return await P.savePage(id(), b)
        case 'publish': return await P.publishPage(id(), true)
        case 'unpublish': return await P.publishPage(id(), false)
        case 'delete': return await P.deletePage(id())
        case 'accepting': return await P.setAccepting(id(), b.on)
        case 'remove-signup': if (!Number.isInteger(b.signup)) throw new P.PageError('Request refused.'); return await P.removeSignup(id(), b.signup)
        case 'slug-check': return await P.slugFree(b.slug, { pageId: Number.isInteger(b.id) ? b.id : null })
        case 'ai-draft': return await P.aiDraft(b.type, b.notes)
        case 'ai-suggest': return await P.aiSuggest(b.type, b.field, b.page, b.extra)
        case 'link-save': return await P.saveLink(b)
        case 'link-delete': return await P.deleteLink(String(b.slug || ''))
        default: throw new P.PageError('Unknown action.')
      }
    } catch (e) { if (e instanceof P.PageError) throw new Refused(e.message); throw e }
  })
}

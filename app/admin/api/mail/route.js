// Admin → Mail (Olaitan only): the pipes, the message log, the do-not-send list, and a test send. lib/mail.
import { currentUser, sameOrigin, ownerOnly } from '@/lib/admin/auth'
import { respond, refuse, readJson } from '@/lib/admin/respond'
import { Refused } from '@/lib/admin/content'
import * as Mail from '@/lib/mail'
export const dynamic = 'force-dynamic'
export async function POST(request) {
  if (!sameOrigin(request)) return refuse('Request refused.', 403)
  const u = await currentUser().catch(() => null)
  if (!u) return refuse('Sign in first.', 401)
  if (!ownerOnly(u)) return refuse('Only Olaitan can use Mail.', 403)
  const b = await readJson(request); if (!b) return refuse('Request refused.', 400)
  return respond(async () => {
    if (b.action === 'overview') return Mail.mailOverview()
    if (b.action === 'log') return { messages: await Mail.mailLog({ search: b.search }) }
    if (b.action === 'suppressions') return { list: await Mail.suppressions() }
    if (b.action === 'suppress') return Mail.suppress(b.email, 'manual', b.note)
    if (b.action === 'unsuppress') return Mail.unsuppress(b.email)
    if (b.action === 'test') {
      try {
        const r = await Mail.sendMail({ to: b.to || u.email, kind: 'system', source: 'admin-test', subject: 'Olexweb Mail test',
          html: '<p style="font-family:system-ui,sans-serif;font-size:16px">This is a test from <b>Olexweb Mail</b>. If you’re reading it, sending works.</p>',
          text: 'This is a test from Olexweb Mail. If you’re reading it, sending works.' })
        return r
      } catch (e) { throw new Refused(e.message) }
    }
    throw new Refused('Unknown action.')
  })
}

import { requireUser, ownerOnly } from '@/lib/admin/auth'
import { q, one } from '@/lib/admin/db'
import AssistantBoard from '@/components/admin/Assistant'
import { chatSpeed } from '@/lib/assistant/chat'
import { status, anyProvider } from '@/lib/assistant/pool'
export const metadata = { title: 'Olex Assistant' }
const iso = (d) => (d ? new Date(d).toISOString() : null)
export default async function Assistant() {
  const u = await requireUser()
  if (!ownerOnly(u)) return (<><div className="top"><h1 className="d">Olex Assistant</h1></div><div className="empty">Only Olaitan can use Olex AI.</div></>)
  const s = await one('select mode, pace, topics, socials, model, last_run, paused_until from assistant_settings where id = 1')
  const pending = (await q('select id, run_at, kind, label from scheduled_changes where done_at is null order by run_at limit 50')).rows
  const paused = s.paused_until && new Date(s.paused_until) > new Date() ? iso(s.paused_until) : null
  const speed = await chatSpeed()
  const research = (await q("select id, topic, why, searches, sources, found_on from research_items where used_by is null and found_on > current_date - 14 order by found_on desc, id limit 20")).rows
  const drafts = (await q("select id, title, status, auto_publish_at, claims from posts where origin = 'assistant' and status in ('draft', 'waiting') order by id desc limit 20")).rows
  const published = (await q("select id, title, slug, published_on from posts where origin = 'assistant' and status = 'live' order by published_on desc limit 10")).rows
  const providers = await status()
  return <AssistantBoard ready={anyProvider()} providers={providers} scheduled={!!process.env.CRON_SECRET}
    settings={{ ...s, last_run: iso(s.last_run), paused_until: iso(s.paused_until) }}
    pending={pending.map((r) => ({ ...r, run_at: iso(r.run_at) }))} pausedUntil={paused} speed={{ ...speed, slowest: speed.slowest.map((x) => ({ ...x, at: iso(x.at) })) }}
    research={research.map((r) => ({ ...r, found_on: iso(r.found_on) }))} drafts={drafts.map((d) => ({ ...d, auto_publish_at: iso(d.auto_publish_at) }))}
    published={published.map((p) => ({ ...p, published_on: iso(p.published_on) }))} />
}

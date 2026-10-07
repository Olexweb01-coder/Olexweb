import { requireUser, ownerOnly } from '@/lib/admin/auth'
import { q, one } from '@/lib/admin/db'
import AssistantBoard from '@/components/admin/Assistant'
export const metadata = { title: 'Assistant' }
const iso = (d) => (d ? new Date(d).toISOString() : null)
export default async function Assistant() {
  const u = await requireUser()
  if (!ownerOnly(u)) return (<><div className="top"><h1 className="d">Assistant</h1></div><div className="empty">Only Olaitan can use the assistant.</div></>)
  const s = await one('select mode, pace, topics, socials, model, last_run from assistant_settings where id = 1')
  const chatList = (await q('select id, title, updated_at from assistant_chats order by updated_at desc limit 100')).rows
  const messages = chatList.length ? (await q('select id, chat_id, role, text, post_id, action, action_state, created_at from assistant_messages where chat_id = $1 order by id limit 300', [chatList[0].id])).rows : []
  const research = (await q("select id, topic, why, searches, sources, found_on from research_items where used_by is null and found_on > current_date - 14 order by found_on desc, id limit 20")).rows
  const drafts = (await q("select id, title, status, auto_publish_at, claims from posts where origin = 'assistant' and status in ('draft', 'waiting') order by id desc limit 20")).rows
  const published = (await q("select id, title, slug, published_on from posts where origin = 'assistant' and status = 'live' order by published_on desc limit 10")).rows
  return <AssistantBoard ready={!!process.env.GEMINI_API_KEY} scheduled={!!process.env.CRON_SECRET}
    settings={{ ...s, last_run: iso(s.last_run) }} messages={messages.map((m) => ({ ...m, created_at: iso(m.created_at) }))}
    chats={chatList.map((c) => ({ ...c, updated_at: iso(c.updated_at) }))} chatId={chatList.length ? chatList[0].id : null}
    research={research.map((r) => ({ ...r, found_on: iso(r.found_on) }))} drafts={drafts.map((d) => ({ ...d, auto_publish_at: iso(d.auto_publish_at) }))}
    published={published.map((p) => ({ ...p, published_on: iso(p.published_on) }))} />
}

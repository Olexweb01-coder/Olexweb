// The admin home: Olex AI's chat for the owner (like a chat app: a new chat, or the one in ?c=), the Overview for editors.
import { requireUser, ownerOnly } from '@/lib/admin/auth'
import { one, q } from '@/lib/admin/db'
import Overview, { greeting } from '@/components/admin/Overview'
import ChatHome from '@/components/admin/ChatHome'
import { anyProvider } from '@/lib/assistant/pool'
import { ensureMemory } from '@/lib/assistant/memory'
import { ensureDocs } from '@/lib/assistant/docs'
export const metadata = { title: 'Olex AI' }
const iso = (d) => (d ? new Date(d).toISOString() : null)
export default async function Home({ searchParams }) {
  const u = await requireUser()
  if (!ownerOnly(u)) return <Overview u={u} />
  const id = Number(searchParams && searchParams.c)
  const chat = Number.isInteger(id) && id > 0 ? await one('select id, title from assistant_chats where id = $1', [id]) : null
  const messages = chat ? (await ensureMemory(), await ensureDocs(), await q('select id, chat_id, role, text, post_id, action, action_state, created_at, ms_first, ms_total, written_by, rating, memory, docs from assistant_messages where chat_id = $1 order by id limit 300', [chat.id])).rows : []
  return <ChatHome key="chat" chatId={chat ? chat.id : null} title={chat ? chat.title : null} first={u.name.split(' ')[0]} greet={greeting()}
    ready={anyProvider()}
    messages={messages.map((m) => ({ ...m, created_at: iso(m.created_at) }))} />
}

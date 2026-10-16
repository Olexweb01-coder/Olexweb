import { requireUser, ownerOnly } from '@/lib/admin/auth'
import { listLessons, feedbackStats } from '@/lib/assistant/memory'
import Memory from '@/components/admin/Memory'
export const metadata = { title: 'Memory' }
const iso = (d) => (d ? new Date(d).toISOString() : null)
export default async function MemoryPage() {
  const u = await requireUser()
  if (!ownerOnly(u)) return (<><div className="top"><h1 className="d">Memory</h1></div><div className="empty">Only Olaitan can see what Olex AI has learned.</div></>)
  const lessons = await listLessons(), stats = await feedbackStats()
  return <Memory lessons={lessons.map((l) => ({ ...l, created_at: iso(l.created_at), updated_at: iso(l.updated_at) }))} stats={{ ...stats, recent: stats.recent.map((r) => ({ ...r, created_at: iso(r.created_at) })) }} />
}

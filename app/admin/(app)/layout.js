// Every page in here needs a valid, unexpired session, checked against the database before anything renders.
import Shell from '@/components/admin/Shell'
import { requireUser } from '@/lib/admin/auth'
import { one } from '@/lib/admin/db'
export const dynamic = 'force-dynamic'
export default async function AppLayout({ children }) {
  const u = await requireUser()
  const w = await one("select count(*)::int as n from testimonials where status = 'waiting'")
  return <Shell name={u.name} waiting={w ? w.n : 0}>{children}</Shell>
}

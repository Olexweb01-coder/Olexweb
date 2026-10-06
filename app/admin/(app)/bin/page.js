import { redirect } from 'next/navigation'
import { requireUser, ownerOnly } from '@/lib/admin/auth'
import { q } from '@/lib/admin/db'
import { purgeOldBin } from '@/lib/admin/content'
import BinList from '@/components/admin/Bin'
export const metadata = { title: 'Bin' }
export default async function Bin() {
  const u = await requireUser()
  if (!ownerOnly(u)) redirect('/admin/more')
  await purgeOldBin()
  const rows = (await q(`select 'project' as type, id, name, binned_at from projects where status = 'bin'
                         union all select 'post', id, title, binned_at from posts where status = 'bin'
                         union all select 'venture', id, name, binned_at from ventures where status = 'bin' order by binned_at desc`)).rows
  return <BinList items={rows.map((r) => ({ ...r, binned_at: r.binned_at.toISOString() }))} />
}

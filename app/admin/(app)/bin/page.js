import { redirect } from 'next/navigation'
import { requireUser, ownerOnly } from '@/lib/admin/auth'
import { q } from '@/lib/admin/db'
import { purgeOldBin } from '@/lib/admin/content'
import BinList from '@/components/admin/Bin'
export const metadata = { title: 'Bin' }
export default async function Bin() {
  const u = await requireUser()
  if (!ownerOnly(u)) redirect('/admin/more')
  // anything put in the bin without a date (older code paths) gets today's, so it's counted down and cleared like the rest
  await q("update projects set binned_at = now() where status = 'bin' and binned_at is null"); await q("update posts set binned_at = now() where status = 'bin' and binned_at is null"); await q("update ventures set binned_at = now() where status = 'bin' and binned_at is null")
  await purgeOldBin()
  const rows = (await q(`select 'project' as type, id, name, binned_at from projects where status = 'bin'
                         union all select 'post', id, title, binned_at from posts where status = 'bin'
                         union all select 'venture', id, name, binned_at from ventures where status = 'bin' order by binned_at desc`)).rows
  return <BinList items={rows.map((r) => ({ ...r, binned_at: new Date(r.binned_at || Date.now()).toISOString() }))} />
}

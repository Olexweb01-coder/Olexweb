import { redirect } from 'next/navigation'
import { requireUser, can, ownerOnly } from '@/lib/admin/auth'
import { q } from '@/lib/admin/db'
import VenturesBoard from '@/components/admin/Ventures'
export const metadata = { title: 'Ventures' }
export default async function Ventures() {
  const u = await requireUser()
  if (!can(u, 'ventures')) redirect('/admin/more')
  const rows = (await q("select id, slug, name, line, kind, summary, text, url, image, status from ventures where status <> 'bin' order by sort, id")).rows
  return <VenturesBoard items={rows} isOwner={ownerOnly(u)} />
}

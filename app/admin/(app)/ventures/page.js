// Ventures (Install E): the businesses that make money (owner only). The public ventures list for the website lives
// in Projects now, so anyone else who could edit it is sent there.
import { redirect } from 'next/navigation'
import { requireUser, can, ownerOnly } from '@/lib/admin/auth'
import { business } from '@/lib/admin/business'
import Business from '@/components/admin/Business'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Ventures' }
export default async function Ventures() {
  const u = await requireUser()
  if (!ownerOnly(u)) redirect(can(u, 'ventures') ? '/admin/projects#ventures' : '/admin/more')
  return <Business initial={JSON.parse(JSON.stringify(await business()))} />
}

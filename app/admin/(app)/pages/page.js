import { redirect } from 'next/navigation'
import { requireUser, ownerOnly } from '@/lib/admin/auth'
import { listPages } from '@/lib/site/pages'
import AdminPages from '@/components/admin/AdminPages'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Pages & links' }
export default async function Page() {
  const u = await requireUser(); if (!ownerOnly(u)) redirect('/admin/more')
  return <AdminPages data={JSON.parse(JSON.stringify(await listPages()))} />
}

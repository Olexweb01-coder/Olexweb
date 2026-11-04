import { redirect } from 'next/navigation'
import { requireUser, ownerOnly } from '@/lib/admin/auth'
import AdminMail from '@/components/admin/AdminMail'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Mail' }
export default async function Page() {
  const u = await requireUser(); if (!ownerOnly(u)) redirect('/admin/more')
  return <AdminMail me={u.email} />
}

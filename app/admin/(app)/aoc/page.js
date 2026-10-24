import { redirect } from 'next/navigation'
import { requireUser, ownerOnly } from '@/lib/admin/auth'
import { adminData } from '@/lib/site/aoc'
import AdminAoc from '@/components/admin/AdminAoc'
export const metadata = { title: 'Course & links' }
export const dynamic = 'force-dynamic'
export default async function Page() {
  const u = await requireUser(); if (!ownerOnly(u)) redirect('/admin/more')
  return <AdminAoc data={JSON.parse(JSON.stringify(await adminData()))} />
}

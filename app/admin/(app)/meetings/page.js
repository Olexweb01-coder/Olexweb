import { redirect } from 'next/navigation'
import { requireUser, ownerOnly } from '@/lib/admin/auth'
import { listMeetings } from '@/lib/site/meet'
import AdminMeetings from '@/components/admin/AdminMeetings'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Meetings' }
export default async function Page() {
  const u = await requireUser(); if (!ownerOnly(u)) redirect('/admin/more')
  return <AdminMeetings data={JSON.parse(JSON.stringify(await listMeetings()))} />
}

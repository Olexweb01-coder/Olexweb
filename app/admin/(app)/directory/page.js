import { redirect } from 'next/navigation'
import { requireUser, ownerOnly } from '@/lib/admin/auth'
import { adminList, directoryToday } from '@/lib/site/directory'
import AdminDirectory from '@/components/admin/AdminDirectory'
import DirectorySimple from '@/components/admin/DirectorySimple'
import SimpleSwitch from '@/components/admin/SimpleSwitch'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Directory' }
// Install 16: Simple first (today's times, what's ready, visits, a few big controls); the full list one tap away
export default async function Page() {
  const u = await requireUser(); if (!ownerOnly(u)) redirect('/admin/more')
  const [list, today] = await Promise.all([adminList(), directoryToday()])
  return <SimpleSwitch k="directory" simple={<DirectorySimple data={JSON.parse(JSON.stringify(today))} />} detailed={<AdminDirectory data={JSON.parse(JSON.stringify(list))} />} />
}

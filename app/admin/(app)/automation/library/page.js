import { redirect } from 'next/navigation'
import { requireUser, ownerOnly } from '@/lib/admin/auth'
import { libraryData } from '@/lib/site/library'
import AutomationHead from '@/components/admin/AutomationTabs'
import AutomationLibrary from '@/components/admin/AutomationLibrary'
export const metadata = { title: 'Library · Automation' }
export const dynamic = 'force-dynamic'
export default async function LibraryPage() {
  const u = await requireUser(); if (!ownerOnly(u)) redirect('/admin/more')
  const data = await libraryData()
  return (<><AutomationHead current="library" /><AutomationLibrary data={JSON.parse(JSON.stringify(data))} /></>)
}

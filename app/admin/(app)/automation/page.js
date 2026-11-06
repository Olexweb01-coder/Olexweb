import { redirect } from 'next/navigation'
import { requireUser, ownerOnly } from '@/lib/admin/auth'
import { todayData } from '@/lib/site/automation'
import AutomationHead from '@/components/admin/AutomationTabs'
import AutomationToday from '@/components/admin/AutomationToday'
export const metadata = { title: 'Automation · Today' }
export const dynamic = 'force-dynamic'
export default async function AutomationPage() {
  const u = await requireUser(); if (!ownerOnly(u)) redirect('/admin/more')
  const data = await todayData()
  return (<><AutomationHead current="overview" /><AutomationToday data={JSON.parse(JSON.stringify(data))} /></>)
}

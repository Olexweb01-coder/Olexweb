import { redirect } from 'next/navigation'
import { requireUser, ownerOnly } from '@/lib/admin/auth'
import { overviewData } from '@/lib/site/automation'
import AutomationHead from '@/components/admin/AutomationTabs'
import AutomationOverview from '@/components/admin/AutomationOverview'
export const metadata = { title: 'Automation' }
export const dynamic = 'force-dynamic'
export default async function AutomationPage() {
  const u = await requireUser(); if (!ownerOnly(u)) redirect('/admin/more')
  const data = await overviewData()
  return (<><AutomationHead current="overview" /><AutomationOverview data={JSON.parse(JSON.stringify(data))} /></>)
}

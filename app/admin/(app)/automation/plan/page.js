import { redirect } from 'next/navigation'
import { requireUser, ownerOnly } from '@/lib/admin/auth'
import { planData } from '@/lib/site/plan'
import AutomationHead from '@/components/admin/AutomationTabs'
import PlanBoard from '@/components/admin/PlanBoard'
export const metadata = { title: 'Plan · Automation' }
export const dynamic = 'force-dynamic'
export default async function PlanPage() {
  const u = await requireUser(); if (!ownerOnly(u)) redirect('/admin/more')
  const data = await planData()
  return (<><AutomationHead current="plan" /><PlanBoard data={JSON.parse(JSON.stringify(data))} /></>)
}

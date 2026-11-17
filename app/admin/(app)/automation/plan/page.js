import { redirect } from 'next/navigation'
import { requireUser, ownerOnly } from '@/lib/admin/auth'
import { planData } from '@/lib/site/plan'
import { storiesData } from '@/lib/site/fbstory'
import AutomationHead from '@/components/admin/AutomationTabs'
import PlanBoard from '@/components/admin/PlanBoard'
export const metadata = { title: 'Plan · Automation' }
export const dynamic = 'force-dynamic'
export default async function PlanPage() {
  const u = await requireUser(); if (!ownerOnly(u)) redirect('/admin/more')
  const [data, stories] = await Promise.all([planData(), storiesData().catch(() => null)])
  return (<><AutomationHead current="plan" /><PlanBoard data={JSON.parse(JSON.stringify(data))} stories={stories ? JSON.parse(JSON.stringify(stories)) : null} /></>)
}

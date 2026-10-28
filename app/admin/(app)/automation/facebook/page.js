import { redirect } from 'next/navigation'
import { requireUser, ownerOnly } from '@/lib/admin/auth'
import { metaStatus } from '@/lib/site/meta'
import AutomationHead from '@/components/admin/AutomationTabs'
import AutomationFacebook from '@/components/admin/AutomationFacebook'
export const metadata = { title: 'Facebook · Automation' }
export const dynamic = 'force-dynamic'
export default async function FacebookPage() {
  const u = await requireUser(); if (!ownerOnly(u)) redirect('/admin/more')
  const data = await metaStatus()
  return (<><AutomationHead current="facebook" /><AutomationFacebook data={JSON.parse(JSON.stringify(data))} /></>)
}

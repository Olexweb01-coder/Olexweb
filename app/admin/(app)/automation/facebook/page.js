import { redirect } from 'next/navigation'
import { requireUser, ownerOnly } from '@/lib/admin/auth'
import { metaStatus } from '@/lib/site/meta'
import AutomationHead from '@/components/admin/AutomationTabs'
import AutomationFacebook from '@/components/admin/AutomationFacebook'
import FacebookSimple from '@/components/admin/FacebookSimple'
import SimpleSwitch from '@/components/admin/SimpleSwitch'
export const metadata = { title: 'Facebook · Automation' }
export const dynamic = 'force-dynamic'
export default async function FacebookPage({ searchParams }) {
  const u = await requireUser(); if (!ownerOnly(u)) redirect('/admin/more')
  const data = await metaStatus()
  const plain = JSON.parse(JSON.stringify(data))
  // connected and set up, and not just back from Facebook: the simple view first (Install 15)
  if (plain.ready && plain.page && !(searchParams && searchParams.fb)) return (<><AutomationHead current="facebook" /><SimpleSwitch k="facebook" simple={<FacebookSimple data={plain} />} detailed={<AutomationFacebook data={plain} />} /></>)
  return (<><AutomationHead current="facebook" /><AutomationFacebook data={plain} /></>)
}

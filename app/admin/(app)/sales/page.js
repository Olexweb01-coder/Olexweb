import { redirect } from 'next/navigation'
import { requireUser, ownerOnly } from '@/lib/admin/auth'
import AdminSales from '@/components/admin/AdminSales'
import SalesSimple from '@/components/admin/SalesSimple'
import SimpleSwitch from '@/components/admin/SimpleSwitch'
import { simpleData } from '@/lib/sales'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Sales' }
// Install 18: Simple first (the agent, the pipeline, who's worth your time, documents); everything else one tap away
export default async function Page() {
  const u = await requireUser(); if (!ownerOnly(u)) redirect('/admin/more')
  const data = JSON.parse(JSON.stringify(await simpleData()))
  return <SimpleSwitch k="sales" simple={<SalesSimple data={data} />} detailed={<AdminSales />} />
}

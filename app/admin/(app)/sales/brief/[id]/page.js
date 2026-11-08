import { redirect, notFound } from 'next/navigation'
import { requireUser, ownerOnly } from '@/lib/admin/auth'
import { one } from '@/lib/admin/db'
import SalesBrief from '@/components/admin/SalesBrief'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Call brief', robots: { index: false } }
// Install 19: the one-page brief before a sales call (lib/sales/brief.js)
export default async function Page({ params }) {
  const u = await requireUser(); if (!ownerOnly(u)) redirect('/admin/more')
  const id = Number(params.id); if (!Number.isInteger(id) || id < 1) notFound()
  const c = await one('select id, name, brief from sales_companies where id = $1', [id]); if (!c) notFound()
  return <SalesBrief id={c.id} name={c.name} brief={c.brief ? JSON.parse(JSON.stringify(c.brief)) : null} />
}

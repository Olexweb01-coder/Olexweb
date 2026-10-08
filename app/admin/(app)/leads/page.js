import { redirect } from 'next/navigation'
import { requireUser, ownerOnly } from '@/lib/admin/auth'
import { leadsList, leadSummary } from '@/lib/site/leads'
import LeadsBoard from '@/components/admin/Leads'
export const metadata = { title: 'Leads' }
export default async function Leads({ searchParams }) {
  const u = await requireUser(); if (!ownerOnly(u)) redirect('/admin/more')
  const status = (searchParams && searchParams.status) || 'all'
  const [rows, sum] = await Promise.all([leadsList(status), leadSummary()])
  return <LeadsBoard leads={rows.map((r) => ({ ...r, created_at: r.created_at.toISOString() }))} summary={sum} status={status} />
}

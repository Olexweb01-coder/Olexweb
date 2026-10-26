import { redirect, notFound } from 'next/navigation'
import { requireUser, ownerOnly } from '@/lib/admin/auth'
import { pageAdmin } from '@/lib/site/pages'
import PageEditor from '@/components/admin/PageEditor'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Edit page' }
export default async function Page({ params }) {
  const u = await requireUser(); if (!ownerOnly(u)) redirect('/admin/more')
  const d = await pageAdmin(params.id).catch(() => null); if (!d) notFound()
  return <PageEditor data={JSON.parse(JSON.stringify(d))} />
}

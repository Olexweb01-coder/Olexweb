import { redirect } from 'next/navigation'
import { requireUser, ownerOnly } from '@/lib/admin/auth'
import { adminList } from '@/lib/site/directory'
import AdminDirectory from '@/components/admin/AdminDirectory'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Directory' }
export default async function Page() { const u = await requireUser(); if (!ownerOnly(u)) redirect('/admin/more'); return <AdminDirectory data={JSON.parse(JSON.stringify(await adminList()))} /> }

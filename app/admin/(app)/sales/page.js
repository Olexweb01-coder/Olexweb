import { redirect } from 'next/navigation'
import { requireUser, ownerOnly } from '@/lib/admin/auth'
import AdminSales from '@/components/admin/AdminSales'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Sales' }
export default async function Page() { const u = await requireUser(); if (!ownerOnly(u)) redirect('/admin/more'); return <AdminSales /> }

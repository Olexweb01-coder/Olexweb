import { requireUser, ownerOnly } from '@/lib/admin/auth'
import { redirect } from 'next/navigation'
import { adminData } from '@/lib/site/apps'
import DownloadsBoard from '@/components/admin/Downloads'
export const metadata = { title: 'Downloads' }
export const dynamic = 'force-dynamic'
export default async function Downloads() {
  const u = await requireUser(); if (!ownerOnly(u)) redirect('/admin/overview')
  return <DownloadsBoard initial={await adminData()} />
}

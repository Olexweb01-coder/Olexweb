import { requireUser, ownerOnly } from '@/lib/admin/auth'
import { redirect } from 'next/navigation'
import { loveReady, loveUrl } from '@/lib/site/love'
import LoveBoard from '@/components/admin/Love'
export const metadata = { title: 'Our Space' }
export const dynamic = 'force-dynamic'
export default async function Love() {
  const u = await requireUser(); if (!ownerOnly(u)) redirect('/admin/overview')
  return <LoveBoard ready={loveReady()} url={loveUrl()} />
}

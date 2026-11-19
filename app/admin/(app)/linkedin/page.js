import { redirect } from 'next/navigation'
import { requireUser, ownerOnly } from '@/lib/admin/auth'
import { liStatus } from '@/lib/site/linkedin'
import LinkedInPanel from '@/components/admin/LinkedInPanel'
export const metadata = { title: 'LinkedIn' }
export const dynamic = 'force-dynamic'
export default async function LinkedInPage({ searchParams }) {
  const u = await requireUser(); if (!ownerOnly(u)) redirect('/admin/more')
  return <LinkedInPanel data={JSON.parse(JSON.stringify(await liStatus()))} back={searchParams && searchParams.li} />
}

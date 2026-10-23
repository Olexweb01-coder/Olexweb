import { redirect } from 'next/navigation'
import { requireUser, ownerOnly } from '@/lib/admin/auth'
import { youtubeData } from '@/lib/site/youtube'
import YouTube from '@/components/admin/YouTube'
export const metadata = { title: 'YouTube' }
export const dynamic = 'force-dynamic'
export default async function YouTubePage({ searchParams }) {
  const u = await requireUser(); if (!ownerOnly(u)) redirect('/admin/more')
  const days = [7, 28, 90].includes(Number(searchParams && searchParams.days)) ? Number(searchParams.days) : 28
  const data = await youtubeData(days)
  const note = typeof (searchParams && searchParams.yt) === 'string' ? searchParams.yt.slice(0, 20) : null
  return <YouTube data={JSON.parse(JSON.stringify(data))} note={note} />
}

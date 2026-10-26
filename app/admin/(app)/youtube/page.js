import { redirect } from 'next/navigation'
import { requireUser, ownerOnly } from '@/lib/admin/auth'
import { youtubeData } from '@/lib/site/youtube'
import { ideasData } from '@/lib/site/ideas'
import { scriptsData } from '@/lib/site/scripts'
import YouTube from '@/components/admin/YouTube'
import YouTubeIdeas, { YouTubeTabs } from '@/components/admin/YouTubeIdeas'
import YouTubeScripts from '@/components/admin/YouTubeScripts'
import YouTubeVideos from '@/components/admin/YouTubeVideos'
import { videosData } from '@/lib/site/publish'
export const metadata = { title: 'YouTube' }
export const dynamic = 'force-dynamic'
export default async function YouTubePage({ searchParams }) {
  const u = await requireUser(); if (!ownerOnly(u)) redirect('/admin/more')
  const sp = searchParams || {}
  if (sp.view === 'videos') {
    const data = await videosData()
    return (<><div className="top"><h1 className="d">YouTube</h1></div><YouTubeTabs current="videos" /><YouTubeVideos data={JSON.parse(JSON.stringify(data))} /></>)
  }
  if (sp.view === 'scripts') {
    const data = await scriptsData()
    return (<><div className="top"><h1 className="d">YouTube</h1></div><YouTubeTabs current="scripts" /><YouTubeScripts data={JSON.parse(JSON.stringify(data))} /></>)
  }
  if (sp.view === 'ideas') {
    const data = await ideasData(typeof sp.status === 'string' ? sp.status : 'new')
    return (<><div className="top"><h1 className="d">YouTube</h1></div><YouTubeTabs current="ideas" /><YouTubeIdeas data={JSON.parse(JSON.stringify(data))} /></>)
  }
  const days = [7, 28, 90].includes(Number(sp.days)) ? Number(sp.days) : 28
  const data = await youtubeData(days)
  const note = typeof sp.yt === 'string' ? sp.yt.slice(0, 20) : null
  return <YouTube data={JSON.parse(JSON.stringify(data))} note={note} />
}

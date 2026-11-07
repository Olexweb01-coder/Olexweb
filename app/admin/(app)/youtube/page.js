import { redirect } from 'next/navigation'
import { requireUser, ownerOnly } from '@/lib/admin/auth'
import { youtubeData } from '@/lib/site/youtube'
import { ideasData } from '@/lib/site/ideas'
import { scriptsData } from '@/lib/site/scripts'
import YouTube from '@/components/admin/YouTube'
import AutomationHead from '@/components/admin/AutomationTabs'
import YouTubeIdeas, { YouTubeTabs } from '@/components/admin/YouTubeIdeas'
import YouTubeScripts from '@/components/admin/YouTubeScripts'
import YouTubeVideos from '@/components/admin/YouTubeVideos'
import YouTubeProgress from '@/components/admin/YouTubeProgress'
import { progressPage } from '@/lib/site/progress'
import { videosData } from '@/lib/site/publish'
import { youtubeSimpleData } from '@/lib/site/automation'
import YouTubeSimple from '@/components/admin/YouTubeSimple'
import SimpleSwitch from '@/components/admin/SimpleSwitch'
export const metadata = { title: 'YouTube · Automation' }
export const dynamic = 'force-dynamic'
export default async function YouTubePage({ searchParams }) {
  const u = await requireUser(); if (!ownerOnly(u)) redirect('/admin/more')
  const sp = searchParams || {}
  if (sp.view === 'progress') {
    const data = await progressPage()
    return (<><AutomationHead current="youtube" /><YouTubeTabs current="progress" /><YouTubeProgress data={JSON.parse(JSON.stringify(data))} /></>)
  }
  if (sp.view === 'videos') {
    const data = await videosData()
    return (<><AutomationHead current="youtube" /><YouTubeTabs current="videos" /><YouTubeVideos data={JSON.parse(JSON.stringify(data))} /></>)
  }
  if (sp.view === 'scripts') {
    const data = await scriptsData()
    return (<><AutomationHead current="youtube" /><YouTubeTabs current="scripts" /><YouTubeScripts data={JSON.parse(JSON.stringify(data))} /></>)
  }
  if (sp.view === 'ideas') {
    const data = await ideasData(typeof sp.status === 'string' ? sp.status : 'new')
    return (<><AutomationHead current="youtube" /><YouTubeTabs current="ideas" /><YouTubeIdeas data={JSON.parse(JSON.stringify(data))} /></>)
  }
  const days = [7, 28, 90].includes(Number(sp.days)) ? Number(sp.days) : 28
  const data = await youtubeData(days)
  const note = typeof sp.yt === 'string' ? sp.yt.slice(0, 20) : null
  // connected, and not just back from Google: the simple view first (Install 15), the numbers one tap away
  if (!note && data.connected && data.account && data.account.channel_id) {
    const plain = JSON.parse(JSON.stringify(data)), extra = JSON.parse(JSON.stringify(await youtubeSimpleData()))
    return (<><AutomationHead current="youtube" /><SimpleSwitch k="youtube" simple={<YouTubeSimple data={plain} extra={extra} />} detailed={<YouTube data={plain} noHead />} /></>)
  }
  return <YouTube data={JSON.parse(JSON.stringify(data))} note={note} />
}

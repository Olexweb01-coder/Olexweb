import { searchData } from '@/lib/site/gsc'
import BlogAnalytics from '@/components/admin/BlogAnalytics'
import { analytics } from '@/lib/site/engage'
import { requireUser, can, ownerOnly } from '@/lib/admin/auth'
import { q } from '@/lib/admin/db'
import BlogBoard from '@/components/admin/Blog'
import BlogAuto from '@/components/admin/BlogAuto'
export const metadata = { title: 'Blog' }
export default async function Blog({ searchParams }) {
  if (searchParams && searchParams.view === 'analytics') {
    const u = await requireUser()
    const search = await searchData(25)
    return <BlogAnalytics data={await analytics(searchParams.days)} isOwner={ownerOnly(u)} search={{ ...search, lastFetch: search.lastFetch ? search.lastFetch.toISOString() : null }} />
  }
  const u = await requireUser()
  const rows = (await q("select id, slug, title, summary, body, seo, to_char(published_on, 'YYYY-MM-DD') as published_on, minutes, status, origin, claims, evidence, sources, checks, auto_publish_at, written_by from posts where status <> 'bin' order by published_on desc nulls first, id desc")).rows
  const set = (await q('select mode, review_hours from assistant_settings where id = 1').catch(() => ({ rows: [] }))).rows[0] || {}   // Install 37: the Blog's own switch
  const waiting = rows.filter((r) => r.status === 'waiting').length
  return <><BlogAuto on={set.mode === 'autopilot'} hours={set.review_hours || 24} waiting={waiting} isOwner={ownerOnly(u)} /><BlogBoard items={rows.map((r) => ({ ...r, auto_publish_at: r.auto_publish_at ? r.auto_publish_at.toISOString() : null }))} canPublish={can(u, 'publish')} isOwner={ownerOnly(u)} /></>
}

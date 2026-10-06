import { requireUser, can, ownerOnly } from '@/lib/admin/auth'
import { q } from '@/lib/admin/db'
import BlogBoard from '@/components/admin/Blog'
export const metadata = { title: 'Blog' }
export default async function Blog() {
  const u = await requireUser()
  const rows = (await q("select id, slug, title, summary, body, seo, to_char(published_on, 'YYYY-MM-DD') as published_on, minutes, status from posts where status <> 'bin' order by published_on desc nulls first, id desc")).rows
  return <BlogBoard items={rows} canPublish={can(u, 'publish')} isOwner={ownerOnly(u)} />
}

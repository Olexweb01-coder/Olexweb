import { requireUser, can, ownerOnly } from '@/lib/admin/auth'
import { q } from '@/lib/admin/db'
import ProjectsBoard from '@/components/admin/Projects'
export const metadata = { title: 'Projects' }
export default async function Projects() {
  const u = await requireUser()
  const rows = (await q("select id, slug, name, kind, role, text, built, result, url, image, status from projects where status <> 'bin' order by sort, id")).rows
  return <ProjectsBoard items={rows} canPublish={can(u, 'publish')} isOwner={ownerOnly(u)} />
}

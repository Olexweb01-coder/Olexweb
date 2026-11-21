import { requireUser, can, ownerOnly } from '@/lib/admin/auth'
import { q } from '@/lib/admin/db'
import ProjectsBoard from '@/components/admin/Projects'
import VenturesBoard from '@/components/admin/Ventures'
export const metadata = { title: 'Projects' }
export default async function Projects() {
  const u = await requireUser()
  const rows = (await q("select id, slug, name, kind, role, text, built, result, url, image, status from projects where status <> 'bin' order by sort, id")).rows
  // Install E: the public ventures list (olexweb.com/ventures) is managed here, next to the projects
  const ventures = can(u, 'ventures') ? (await q("select id, slug, name, line, kind, summary, text, url, image, status from ventures where status <> 'bin' order by sort, id")).rows : null
  return (<>
    <ProjectsBoard items={rows} canPublish={can(u, 'publish')} isOwner={ownerOnly(u)} />
    {ventures ? <div id="ventures" style={{ marginTop: 48 }}><VenturesBoard items={ventures} isOwner={ownerOnly(u)} title="Ventures on your website" /></div> : null}
  </>)
}

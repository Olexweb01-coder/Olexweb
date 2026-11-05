import { cookies } from 'next/headers'
import { adminVersion } from '@/lib/admin/version'
// Every page in here needs a valid, unexpired session, checked against the database before anything renders.
import Shell from '@/components/admin/Shell'
import { requireUser, ownerOnly, can } from '@/lib/admin/auth'
import { one, q } from '@/lib/admin/db'
export const dynamic = 'force-dynamic'
const STYLES = ['glass', 'clay', 'neu']
export default async function AppLayout({ children }) {
  const u = await requireUser()
  const owner = ownerOnly(u)
  const c = await one(`select (select count(*) from testimonials where status = 'waiting')::int as waiting,
    (select count(*) from leads where status = 'new')::int as leads`)
  const chats = owner ? (await q('select id, title, updated_at from assistant_chats order by updated_at desc limit 60')).rows.map((x) => ({ id: x.id, title: x.title })) : []
  // Sections, filtered by what this person may open (each page checks again on the server)
  const nav = [
    ['/admin/overview', 'home', 'Overview'],
    owner && ['/admin/assistant', 'assistant', 'Olex Assistant'],
    owner && ['/admin/memory', 'memory', 'Memory'],
    ['/admin/blog', 'blog', 'Olex Blog'],
    owner && ['/admin/automation', 'youtube', 'Automation', 0, ['/admin/youtube']],
    owner && ['/admin/meetings', 'video', 'Meetings'],
    owner && ['/admin/mail', 'mail', 'Mail'],
    owner && ['/admin/sales', 'sales', 'Sales'],
    owner && ['/admin/pages', 'link', 'Pages & links'],
    owner && ['/admin/directory', 'link', 'Directory'],
    ['/admin/projects', 'work', 'Projects'],
    ['/admin/reviews', 'reviews', 'Reviews', c.waiting],
    owner && ['/admin/leads', 'leads', 'Leads', c.leads],
    can(u, 'ventures') && ['/admin/ventures', 'ventures', 'Ventures'],
    owner && ['/admin/people', 'person', 'People'],
    owner && ['/admin/bin', 'bin', 'Bin'],
    ['/admin/more', 'gear', 'Settings'],
  ].filter(Boolean)
  const jar = cookies(), style = STYLES.includes(jar.get('olex_style')?.value) ? jar.get('olex_style').value : 'glass'
  const mode = ['light', 'dark', 'system'].includes(jar.get('olex_mode')?.value) ? jar.get('olex_mode').value : 'dark'
  return <Shell name={u.name} owner={owner} nav={nav} chats={chats} style={style} mode={mode} collapsed={jar.get('olex_side')?.value === 'closed'} version={adminVersion()}>{children}</Shell>
}

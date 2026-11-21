import { cookies } from 'next/headers'
import { adminVersion } from '@/lib/admin/version'
// Every page in here needs a valid, unexpired session, checked against the database before anything renders.
import Shell from '@/components/admin/Shell'
import { requireUser, ownerOnly, can } from '@/lib/admin/auth'
import { one, q } from '@/lib/admin/db'
import { attention } from '@/lib/admin/attention'
export const dynamic = 'force-dynamic'
const STYLES = ['glass', 'clay', 'neu']
export default async function AppLayout({ children }) {
  const u = await requireUser()
  const owner = ownerOnly(u)
  const c = await one(`select (select count(*) from testimonials where status = 'waiting')::int as waiting,
    (select count(*) from leads where status = 'new')::int as leads,
    (select count(*) from app_access where status = 'waiting')::int as downloads`).catch(() => one(`select (select count(*) from testimonials where status = 'waiting')::int as waiting, (select count(*) from leads where status = 'new')::int as leads, 0 as downloads`))
  const chats = owner ? (await q('select id, title, updated_at from assistant_chats order by updated_at desc limit 60')).rows.map((x) => ({ id: x.id, title: x.title })) : []
  // Sections, filtered by what this person may open (each page checks again on the server)
  // Install 39: the sections, grouped (each group opens to show its pages); filtered by what this person may open
  const G = (id, label, ic, items) => { const list = items.filter(Boolean); return list.length ? { group: id, label, ic, items: list } : null }
  const nav = [
    ['/admin/overview', 'home', 'Overview'],
    G('ai', 'Olex AI', 'assistant', [owner && ['/admin/assistant', 'assistant', 'Olex Assistant'], owner && ['/admin/memory', 'memory', 'Memory']]),
    G('content', 'Content & automation', 'youtube', [
      owner && ['/admin/automation', 'today', 'Automation today', 0, [], ['/admin/automation/facebook']],
      owner && ['/admin/youtube', 'youtube', 'YouTube'],
      owner && ['/admin/automation/facebook', 'facebook', 'Facebook'],
      owner && ['/admin/linkedin', 'linkedin', 'LinkedIn'],
      ['/admin/blog', 'blog', 'Blog'],
      owner && ['/admin/directory', 'grid', 'Directory'],
    ]),
    G('sales', 'Clients & sales', 'sales', [
      owner && ['/admin/sales', 'sales', 'Sales'],
      owner && ['/admin/leads', 'leads', 'Leads', c.leads],
      owner && ['/admin/mail', 'mail', 'Mail'],
      ['/admin/reviews', 'reviews', 'Reviews', c.waiting],
      owner && ['/admin/people', 'person', 'People'],
    ]),
    G('ventures', 'Ventures', 'ventures', [                                   // Install E: the businesses that make money
      owner && ['/admin/ventures', 'ventures', 'All ventures'],
      owner && ['/admin/meetings', 'video', 'Olexweb Meet'],
    ]),
    G('site', 'Website & work', 'work', [
      owner && ['/admin/pages', 'link', 'Pages & links'],
      ['/admin/projects', 'work', 'Projects'],
      owner && ['/admin/downloads', 'download', 'Downloads', c.downloads],
    ]),
    owner && process.env.US_APP_URL && ['/admin/love', 'heart', 'Our Space'],
    owner && ['/admin/bin', 'bin', 'Bin'],
    ['/admin/more', 'gear', 'Settings'],
  ].filter(Boolean)
  const jar = cookies(), style = STYLES.includes(jar.get('olex_style')?.value) ? jar.get('olex_style').value : 'glass'
  const mode = ['light', 'dark', 'system'].includes(jar.get('olex_mode')?.value) ? jar.get('olex_mode').value : 'dark'
  const att = owner ? await attention().catch(() => null) : null   // Install 38: red dots and the app-icon number
  return <Shell att={att} name={u.name} owner={owner} nav={nav} chats={chats} style={style} mode={mode} collapsed={jar.get('olex_side')?.value === 'closed'} version={adminVersion()}>{children}</Shell>
}

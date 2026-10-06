import { requireUser } from '@/lib/admin/auth'
import { q } from '@/lib/admin/db'
import { Icon } from '@/components/admin/icons'
export const metadata = { title: 'Blog' }
const fmt = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : 'Not published'
export default async function Blog() {
  await requireUser()
  const rows = (await q("select slug, title, published_on, minutes, status from posts where status <> 'bin' order by published_on desc nulls first, id desc")).rows
  return (<>
    <div className="top"><h1 className="d">Blog</h1></div>
    <p className="read-only">Your articles are in the database. Writing and the Search panel arrive in the next update.</p>
    <ul className="rows">{rows.map((p) => (<li key={p.slug} className="row"><span className="ic">{Icon.pen}</span>
      <span><span className="row-t">{p.title}</span><span className="row-s">{fmt(p.published_on)}, {p.minutes}-minute read</span></span>
      <span className={'pill ' + (p.status === 'live' ? 'live' : 'draft')}>{p.status === 'live' ? 'Live' : 'Draft'}</span></li>))}</ul>
  </>)
}

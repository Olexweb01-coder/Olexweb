import { requireUser } from '@/lib/admin/auth'
import { q } from '@/lib/admin/db'
export const metadata = { title: 'Projects' }
export default async function Projects() {
  await requireUser()
  const rows = (await q("select slug, name, kind, image, status from projects where status <> 'bin' order by sort, id")).rows
  return (<>
    <div className="top"><h1 className="d">Projects</h1></div>
    <p className="read-only">Your projects are in the database. Adding, editing and reordering arrive in the next update.</p>
    <ul className="rows">{rows.map((p) => (<li key={p.slug} className="row">
      <img className="thumb" src={p.image.replace('-full.webp', '.webp')} alt="" width="64" height="44" />
      <span><span className="row-t">{p.name}</span><span className="row-s">{p.kind}</span></span>
      <span className={'pill ' + (p.status === 'live' ? 'live' : 'draft')}>{p.status === 'live' ? 'Live' : p.status === 'hidden' ? 'Hidden' : 'Draft'}</span></li>))}</ul>
  </>)
}

import Link from 'next/link'
import { requireUser } from '@/lib/admin/auth'
import { one, q } from '@/lib/admin/db'
import { InstallNote } from '@/components/admin/Actions'
import { Icon } from '@/components/admin/icons'

export const metadata = { title: 'Home' }
const LABEL = { signed_in: ['lock', 'Signed in'], signed_out: ['lock', 'Signed out'], sign_in_failed: ['lock', 'Blocked a failed sign-in'], signed_out_other_devices: ['lock', 'Signed out other devices'], owner_created: ['person', 'Admin set up'] }
const ago = (d) => { const m = Math.round((Date.now() - new Date(d)) / 60000); return m < 1 ? 'Just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago` }

export default async function Home() {
  const u = await requireUser()
  const c = await one(`select (select count(*) from projects where status = 'live')::int as projects, (select count(*) from posts where status = 'live')::int as posts,
                              (select count(*) from testimonials where status = 'waiting')::int as waiting, (select coalesce(sum(bytes), 0) from media)::bigint as bytes`)
  const acts = (await q('select action, at from audit_log where user_id = $1 or user_id is null order by at desc limit 5', [u.id])).rows
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Africa/Lagos' }).format(new Date()))
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const mb = Number(c.bytes) / 1048576, pct = Math.min(100, (mb / 5120) * 100)
  return (<>
    <div className="top"><h1 className="d">{greet}, {u.name.split(' ')[0]}.</h1></div>
    <InstallNote />
    <div className="status">
      <Link href="/admin/reviews" className="stat act" style={{ textDecoration: 'none' }}><strong className="d">{c.waiting}</strong><span>{c.waiting === 1 ? 'review is' : 'reviews are'} waiting for approval</span></Link>
      <div className="stat"><strong className="d">{c.projects}</strong><span>projects live</span></div>
      <div className="stat"><strong className="d">{c.posts}</strong><span>articles live</span></div>
    </div>
    <div className="stat" style={{ marginTop: 12 }}><span>Image storage</span><div className="meter"><i style={{ width: Math.max(pct, 0.6) + '%' }} /></div><span>{mb < 1 ? '0' : mb.toFixed(0)} MB of 5 GB used</span></div>
    <h2 className="section-t">Recent activity</h2>
    <ul className="rows act-list">{acts.length ? acts.map((a, i) => { const [ic, label] = LABEL[a.action] || ['pen', a.action.replace(/_/g, ' ')]; return (<li key={i} className="row"><span className="ic">{Icon[ic]}</span><span className="row-t" style={{ fontWeight: 600 }}>{label}</span><span className="when">{ago(a.at)}</span></li>) }) : <li className="row"><span className="row-s">Nothing yet.</span></li>}</ul>
  </>)
}

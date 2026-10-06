import Link from 'next/link'
import { requireUser } from '@/lib/admin/auth'
import { one, q } from '@/lib/admin/db'
import { InstallNote } from '@/components/admin/Actions'
import { Icon } from '@/components/admin/icons'

export const metadata = { title: 'Home' }
const LABEL = { signed_in: ['lock', 'Signed in'], signed_out: ['lock', 'Signed out'], sign_in_failed: ['lock', 'Blocked a failed sign-in'], signed_out_other_devices: ['lock', 'Signed out other devices'], owner_created: ['person', 'Admin set up'], image_uploaded: ['work', 'Uploaded an image'], assistant_drafted: ['assistant', 'The assistant drafted an article'], assistant_published: ['assistant', 'Autopilot published an article'], assistant_held_back: ['assistant', 'Autopilot held an article back'], assistant_settings_changed: ['assistant', 'Changed the assistant\u2019s settings'], review_received: ['reviews', 'A client sent a review'], review_approved: ['reviews', 'Approved a review'], review_rejected: ['reviews', 'Rejected a review'], review_unpublished: ['reviews', 'Unpublished a review'], testimonial_added: ['reviews', 'Added a testimonial'], review_link_created: ['reviews', 'Made a new review link'], review_link_switched_off: ['reviews', 'Switched the review link off'], editor_invited: ['person', 'Invited an editor'], editor_joined: ['person', 'An editor joined'], editor_permissions_changed: ['person', 'Changed an editor’s permissions'], editor_removed: ['person', 'Removed an editor’s access'], invite_cancelled: ['person', 'Cancelled an invite'] }
const KIND = { project: ['work', 'project'], post: ['blog', 'article'], venture: ['ventures', 'venture'] }
const VERB = { created: 'Added a', edited: 'Edited a', published: 'Published a', sent_for_approval: 'Sent for approval: a', hidden: 'Took off the site: a', reordered: 'Reordered the', moved_to_bin: 'Moved to bin: a', restored: 'Restored a', deleted_for_good: 'Deleted for good: a' }
function describe(action) {
  if (LABEL[action]) return LABEL[action]
  const [type, ...rest] = action.split('_'), verb = VERB[rest.join('_')], k = KIND[type]
  return k && verb ? [k[0], verb === 'Reordered the' ? 'Reordered the ' + k[1] + 's' : verb + ' ' + k[1]] : ['pen', action.replace(/_/g, ' ')]
}
const ago = (d) => { const m = Math.round((Date.now() - new Date(d)) / 60000); return m < 1 ? 'Just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago` }

export default async function Home() {
  const u = await requireUser()
  const c = await one(`select (select count(*) from projects where status = 'live')::int as projects, (select count(*) from posts where status = 'live')::int as posts,
                              (select count(*) from testimonials where status = 'waiting')::int as waiting, (select count(*) from posts where origin = 'assistant' and status = 'waiting')::int as drafts, (select coalesce(sum(bytes), 0) from media)::bigint as bytes`)
  const acts = (await q("select action, at from audit_log where user_id = $1 or user_id is null or user_id in (select id from admin_users where role = 'assistant') order by at desc limit 6", [u.id])).rows
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
    {c.drafts ? <Link href="/admin/blog" className="stat act" style={{ textDecoration: 'none', display: 'block', marginTop: 12 }}><strong className="d">{c.drafts}</strong><span>{c.drafts === 1 ? 'draft from the assistant is' : 'drafts from the assistant are'} waiting for you</span></Link> : null}
    <div className="stat" style={{ marginTop: 12 }}><span>Image storage</span><div className="meter"><i style={{ width: Math.max(pct, 0.6) + '%' }} /></div><span>{mb < 1 ? '0' : mb.toFixed(0)} MB of 5 GB used</span></div>
    <h2 className="section-t">Recent activity</h2>
    <ul className="rows act-list">{acts.length ? acts.map((a, i) => { const [ic, label] = describe(a.action); return (<li key={i} className="row"><span className="ic">{Icon[ic]}</span><span className="row-t" style={{ fontWeight: 600 }}>{label}</span><span className="when">{ago(a.at)}</span></li>) }) : <li className="row"><span className="row-s">Nothing yet.</span></li>}</ul>
  </>)
}

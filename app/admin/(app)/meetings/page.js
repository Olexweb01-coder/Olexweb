import { redirect } from 'next/navigation'
import { requireUser, ownerOnly } from '@/lib/admin/auth'
import { listMeetings } from '@/lib/site/meet'
import AdminMeetings from '@/components/admin/AdminMeetings'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Meetings' }
export default async function Page() {
  const u = await requireUser(); if (!ownerOnly(u)) redirect('/admin/more')
  let data
  try { data = await listMeetings() } catch (e) {
    // Meet's database can't be reached (most often a mistyped setting in Vercel): say which, instead of a blank error page
    console.error('meetings', e)
    return (<div className="mg-box" style={{ maxWidth: 720 }}><h1 className="d" style={{ marginTop: 0 }}>Meetings</h1>
      <p><b>Meetings can’t reach their database right now.</b></p>
      <p className="mg-dim" style={{ lineHeight: 1.6 }}>{String(e && e.message || '').includes('isn’t a valid database address') ? e.message : 'Check MEET_DATABASE_URL in Vercel (Settings → Environment Variables): it must start with postgresql:// and have no quotation marks. Then redeploy.'}</p>
      <p className="mg-dim">Everything else in the admin keeps working.</p></div>)
  }
  return <AdminMeetings data={JSON.parse(JSON.stringify(data))} />
}

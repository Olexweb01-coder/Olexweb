import { inviteFor } from '@/lib/admin/people'
import JoinFlow from '@/components/admin/JoinFlow'
export const metadata = { title: 'Join' }
export const dynamic = 'force-dynamic'
export default async function Join({ params }) {
  const i = await inviteFor(params.token)
  if (!i) return (<main className="auth"><div className="auth-box"><div className="auth-mark"><img src="/studio/mark.png" alt="" width="26" height="30" />Olexweb</div>
    <h1 className="d">This invite has ended.</h1><p className="lead">Invites work once, for 48 hours. Ask Olaitan for a new one.</p></div></main>)
  return <JoinFlow token={params.token} email={i.email} />
}

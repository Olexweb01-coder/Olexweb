import { requireUser } from '@/lib/admin/auth'
import { q } from '@/lib/admin/db'
import { SignOut, SignOutOthers } from '@/components/admin/Actions'
import Appearance from '@/components/admin/Appearance'
export const metadata = { title: 'Settings' }
const when = (d) => new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' })
const device = (ua = '') => /iphone/i.test(ua) ? 'iPhone' : /ipad/i.test(ua) ? 'iPad' : /android/i.test(ua) ? 'Android phone' : /windows/i.test(ua) ? 'Windows computer' : /mac os/i.test(ua) ? 'Mac' : 'Browser'

export default async function More() {
  const u = await requireUser()
  const sessions = (await q('select id_hash, last_seen, user_agent from sessions where user_id = $1 and expires_at > now() order by last_seen desc', [u.id])).rows
  const signins = (await q("select action, at from audit_log where user_id = $1 and action in ('signed_in', 'sign_in_failed') order by at desc limit 6", [u.id])).rows
  const r = (await q('select coalesce(array_length(recovery_hashes, 1), 0) as n from admin_users where id = $1', [u.id])).rows[0]
  return (<>
    <div className="top"><h1 className="d">Settings</h1></div>
    <Appearance />
    <h2 className="section-t">Security</h2>
    <div className="sec-row"><span><b>Two-step sign-in</b><span>A code from your authenticator app is needed every time you sign in</span></span><span className="ok">On</span></div>
    <div className="sec-row"><span><b>Signed-in devices</b><span>{sessions.map((s) => device(s.user_agent) + (s.id_hash === u.sessionHash ? ' (this device)' : '')).join(', ') || 'None'}</span></span><SignOutOthers /></div>
    <div className="sec-row"><span><b>Recent sign-ins</b><span>{signins.length ? signins.map((s) => `${when(s.at)} ${s.action === 'signed_in' ? 'signed in' : 'failed attempt blocked'}`).join('; ') : 'None yet'}</span></span></div>
    <div className="sec-row"><span><b>Recovery codes</b><span>One-time codes for when your phone is lost. {r.n} left.</span></span></div>
    <div style={{ marginTop: 28 }}><SignOut /></div>
  </>)
}

import { redirect } from 'next/navigation'
import { requireUser, ownerOnly } from '@/lib/admin/auth'
import AutomationHead from '@/components/admin/AutomationTabs'
import { ChIcon, CSS } from '@/components/admin/automationShared'
export const metadata = { title: 'Instagram · Automation' }
export const dynamic = 'force-dynamic'
// Off on purpose: the Instagram account had on-off suspensions, so it waits until it has been stable for about 2 weeks.
export default async function InstagramPage() {
  const u = await requireUser(); if (!ownerOnly(u)) redirect('/admin/more')
  return (<><AutomationHead current="instagram" /><div className="au"><section className="au-box">
    <div className="au-ch" style={{ marginBottom: 12 }}>{ChIcon.instagram}<b>Instagram</b><span className="au-pill">Off</span></div>
    <p className="au-note">Waiting until your Instagram account has been stable for 2 weeks. Then: switch it to a Business account, link it to the Olexweb Page in Meta’s settings, and come back here to turn it on with one switch. Reels will pick from the same library as Facebook.</p>
  </section><style dangerouslySetInnerHTML={{ __html: CSS }} /></div></>)
}

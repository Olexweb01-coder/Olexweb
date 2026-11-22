// A paid certificate (Install 58): the person's own link from the meeting, then Paystack, then their certificate page.
import { redirect } from 'next/navigation'
import { getCert } from '@/lib/meet/certs'
import { meetBase } from '@/lib/site/meet'
import PubTop from '@/components/meet/PubTop'
import PayForm from '@/components/meet/PayForm'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Your certificate', robots: { index: false } }
export default async function GetCert({ searchParams }) {
  const sp = searchParams || {}, code = String(sp.code || ''), id = String(sp.id || ''), k = String(sp.k || '')
  let c = null, err = ''
  try { c = await getCert(code, id, k) } catch (e) { err = e.message || 'That certificate link isn’t valid.' }
  if (c && c.serial) redirect((meetBase() ? '/v/' : '/meet/v/') + c.serial)
  return (<div className="pb"><PubTop />
    <main className="pb-main pb-narrow pb-stack">
      {err ? <div className="pb-ok pb-bad"><b>!</b><div><h1 className="pb-h2" style={{ margin: 0 }}>Not available</h1><p className="pb-dim" style={{ margin: '4px 0 0' }}>{err}</p></div></div> : <>
        <h1 className="pb-h1">Your certificate</h1>
        <section className="pb-card pb-stack">
          <p style={{ margin: 0 }}><b>{c.name}</b>, for “{c.title}”, hosted by {c.host}.</p>
          <div className="pb-price">₦{Number(c.price).toLocaleString('en-NG')}</div>
          <p className="pb-dim" style={{ margin: 0 }}>The host charges for certificates. You pay this price and nothing more. Once paid, your certificate opens with its own code and a link anyone can check.</p>
          <PayForm action="cert-buy" payload={{ code, id, k }} label={`Pay ₦${Number(c.price).toLocaleString('en-NG')} and get it`} note="Secure payment by Paystack: card, bank transfer or USSD." />
        </section></>}
    </main></div>)
}

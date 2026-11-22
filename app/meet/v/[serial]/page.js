// Checking a certificate (Install 58): /meet/v/<code>, and meet.olexweb.com/v/<code>. Shows the certificate and confirms,
// from our own records, who it was given to, for which meeting, by whom, and when.
import QRCode from 'qrcode'
import { notFound } from 'next/navigation'
import { verify } from '@/lib/meet/certs'
import { meetHost } from '@/lib/site/meet'
import Certificate from '@/components/meet/Certificate'
import CertFit, { PrintButton } from '@/components/meet/CertFit'
import PubTop from '@/components/meet/PubTop'
import '../cert.css'
export const dynamic = 'force-dynamic'
export async function generateMetadata({ params }) {
  const c = await verify(params.serial).catch(() => null)
  return c ? { title: { absolute: `${c.name}: Certificate of ${c.award} | Olexweb Meet` }, description: `Issued through Olexweb Meet for “${c.title}”, hosted by ${c.host}. Code ${c.serial}.`, robots: { index: false } }
    : { title: 'Certificate not found', robots: { index: false } }
}
export default async function VerifyCert({ params }) {
  const c = await verify(params.serial).catch(() => null)
  if (!c) notFound()
  const qr = await QRCode.toString(c.url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#12130fff', light: '#ffffffff' } })
  const site = meetHost() || 'olexweb.com/meet'
  const day = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' })
  return (<div className="pb">
    <PubTop />
    <main className="pb-main pb-stack">
      {c.revoked ? <div className="pb-ok pb-bad"><b>!</b><div><h1 className="pb-h2" style={{ margin: 0 }}>This certificate was withdrawn</h1><p className="pb-dim" style={{ margin: '4px 0 0' }}>The host or Olexweb withdrew it. It isn’t valid.</p></div></div>
        : <div className="pb-ok"><b>✓</b><div><h1 className="pb-h2" style={{ margin: 0 }}>This certificate is real</h1><p className="pb-dim" style={{ margin: '4px 0 0' }}>Issued through Olexweb Meet and checked against our records just now.</p></div></div>}
      <CertFit><Certificate c={c} qr={qr} site={site} /></CertFit>
      <div className="pb-two">
        <section className="pb-card"><dl className="pb-dl">
          <dt>Awarded to</dt><dd>{c.name}</dd><dt>Award</dt><dd>Certificate of {c.award}</dd><dt>For</dt><dd>{c.title}</dd>
          <dt>Host</dt><dd>{c.handle ? <a href={`/meet/h/${c.handle}`}>{c.host}</a> : c.host}{c.org ? ` · ${c.org}` : ''}</dd>
          {c.minutes ? <><dt>Time in the meeting</dt><dd>{c.minutes} minutes (counted by Olexweb Meet)</dd></> : null}
          <dt>Date</dt><dd>{day(c.date)}</dd><dt>Code</dt><dd>{c.serial}</dd></dl></section>
        <section className="pb-card pb-stack"><p className="pb-dim" style={{ margin: 0 }}>Anyone can check this certificate at this page, by its link or its QR code.</p>
          <div className="pb-row"><PrintButton />{c.handle ? <a className="pb-btn" href={`/meet/h/${c.handle}`}>Host’s profile</a> : null}</div></section>
      </div>
    </main>
  </div>)
}

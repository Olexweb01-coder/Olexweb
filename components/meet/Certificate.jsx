// A certificate in one of the five designs (Install 58). Plain markup, so it renders on the server, prints to A4 landscape
// and needs no script. Everything shown comes from our records (lib/meet/certs.js verify()); drawings are fixed artwork.
import { CORNER, TROPHY, WREATH, BIGWREATH } from './certArt'

const WHAT = { Attendance: 'for attending', Participation: 'for taking part in', Completion: 'for completing', Achievement: 'for outstanding achievement in', Excellence: 'for excellent work in' }
const svg = (cls, viewBox, html, extra = {}) => <svg className={cls} viewBox={viewBox} aria-hidden="true" {...extra} dangerouslySetInnerHTML={{ __html: html }} />
const corners = () => ['tl', 'tr', 'bl', 'br'].map((k) => svg('cn ' + k, '0 0 120 120', CORNER, { key: k, fill: 'none', stroke: '#c9a44a', strokeWidth: 2, strokeLinecap: 'round' }))

export default function Certificate({ c, qr, site }) {
  const v = ['c1', 'c2', 'c3', 'c4', 'c5'].includes(c.variant) ? c.variant : 'c1'
  const day = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' })
  const org = (c.org || c.host || 'Olexweb Meet').toUpperCase()
  const n = String(c.name || ''), nameStyle = n.length > 34 ? { fontSize: 46 } : n.length > 24 ? { fontSize: 58 } : undefined   // long names still fit
  const what = <>{WHAT[c.award] || WHAT.Attendance} <b>{c.title}</b>{c.minutes ? <>, <b>{c.minutes} minutes</b> live</> : null}, {day(c.date)}.</>
  const trophy = svg('trophy', '0 0 120 140', TROPHY)
  const foot = (<div className="foot">
    <div className="sig">{c.signature ? <img className="sigsvg" src={c.signature} alt="" /> : <span className="sigsvg" />}<i></i><b>{c.host}</b><span>Host</span></div>
    <div className="seal">{svg('wreath', '-100 -100 200 200', WREATH)}<div className="medal"><div className="min"><small>OLEXWEB</small><b>✓</b><small>VERIFIED</small></div></div><span className="tail l"></span><span className="tail r"></span></div>
    <div className="ver"><div className="qr" dangerouslySetInnerHTML={{ __html: qr }} /><b>{c.serial}</b>Verify at {site}/v/{c.serial}<br />Issued {day(c.issued)}
      <div className="pw"><img src="/meet/logo-96.png" alt="" /><span>Powered by <b>Olexweb Meet</b></span></div></div>
  </div>)
  const bg = v !== 'c3' ? <img className="bg" src={`/meet/cert/bg-${v}.svg`} alt="" /> : null
  if (v === 'c3') return (<div className="cert c3"><div className="bar"></div>
    <div className="top3"><div className="org">{org}</div><span className="yr">{new Date(c.date).getUTCFullYear()}</span></div>
    <div className="t3"><div><div className="eyebrow">Certificate of</div><div className="ttl">{c.award}</div></div>{trophy}</div>
    <div className="lead">Awarded to</div><div className="name" style={nameStyle}>{c.name}</div><div className="what">{what}</div>{foot}</div>)
  if (v === 'c4') return (<div className="cert c4">{corners()}{bg}<div className="fr"></div>
    <div className="org">{org}</div><div className="banner"><span>Certificate of {c.award}</span></div><div className="lead">This certificate is proudly presented to</div>
    <div className="wreathname">{svg('bigwreath', '-460 -110 920 220', BIGWREATH)}<div className="name" style={nameStyle}>{c.name}</div></div><div className="what">{what}</div>{foot}</div>)
  if (v === 'c5') return (<div className="cert c5">{bg}<div className="rib a"></div><div className="rib b"></div><div className="fr"></div>
    <div className="g5"><div className="left5">{trophy}<div className="stars">★ ★ ★</div></div>
      <div className="right5"><div className="org">{org}</div><div className="eyebrow">Certificate of</div><div className="ttl">{c.award}</div><div className="lead">Proudly presented to</div>
        <div className="name" style={nameStyle}>{c.name}</div><div className="rule" style={{ marginLeft: 0 }}></div><div className="what">{what}</div></div></div>{foot}</div>)
  return (<div className={'cert ' + v}>{corners()}{bg}<div className="fr"></div>
    <div className="org">{org}</div>{trophy}<div className="eyebrow">Certificate of</div><div className="ttl">{c.award}</div>
    <div className="lead">This certificate is proudly presented to</div><div className="name" style={nameStyle}>{c.name}</div><div className="rule"></div><div className="what">{what}</div>{foot}</div>)
}

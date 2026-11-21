// Install 44: the picture for each LinkedIn post, designed for that post (1080 × 1350, the tall size LinkedIn shows biggest).
// Eight layouts (a statement, a list, myth vs truth, a chain of problems and fixes, a note, a terminal, a question, an
// invitation), chosen by the kind of post, always in Olexweb's brand colours: the design changes, never the colours.
// Only the site itself fetches it (to upload to LinkedIn): the link carries a key made from the post and AUTH_SECRET.
import { ImageResponse } from 'next/og'
import { one } from '@/lib/admin/db'
import { MARK_PNG } from '@/lib/brandMark'
import fs from 'node:fs'
import path from 'node:path'
let FONTS = null
const fonts = () => (FONTS ||= [500, 800].map((w) => ({ name: 'Inter', data: fs.readFileSync(path.join(process.cwd(), 'lib/fonts', `inter-latin-${w}-normal.woff`)), weight: w, style: 'normal' })))   // Inter (SIL Open Font License)
export const dynamic = 'force-dynamic'
import { cardKey } from '@/lib/site/licard'
const W = 1080, H = 1350
// Olexweb's brand, always: warm white (most days) or near-black, with Olexweb green. The design changes, never the colours.
const LIGHT = { bg: '#f7f5f0', fg: '#0a0b0a', soft: 'rgba(10,11,10,.6)', acc: '#8fe36a', onAcc: '#0a0b0a', acc2: '#e8e4d9', card: '#ffffff' }
const DARK = { bg: '#0a0b0a', fg: '#f2efe9', soft: 'rgba(242,239,233,.62)', acc: '#8fe36a', onAcc: '#0a0b0a', acc2: '#161a15', card: '#121512' }
const LAYOUT = { story: 'note', lesson: 'note', struggle: 'note', journey: 'steps', win: 'quote', behind: 'terminal', explain: 'steps', myth: 'myth', tips: 'list', take: 'quote', question: 'question', offer: 'offer', intro: 'quote' }
const fit = (t, big, small, n) => (String(t || '').length > n ? small : big)
export async function GET(request, { params }) {
  const id = Number(params.id), k = new URL(request.url).searchParams.get('k')
  if (!id || k !== cardKey(id)) return new Response('Not found', { status: 404 })
  const p = await one('select id, day, format, kind, card from li_posts where id = $1', [id]).catch(() => null)
  if (!p) return new Response('Not found', { status: 404 })
  const c = p.card || {}, title = String(c.title || '').slice(0, 110), pts = (Array.isArray(c.points) ? c.points : []).map((x) => String(x).slice(0, 80)).slice(0, 5)
  const P = (p.day || 0) % 3 === 0 ? DARK : LIGHT /* white most days, dark every third */, lay = (p.format === 'tips' && pts.length < 2) ? 'quote' : (LAYOUT[p.format] || 'quote')
  const badge = p.kind === 'intro' ? 'Day 0 · I’m back' : p.day ? `Day ${p.day}/100` : 'Building in public'
  const head = (<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <div style={{ display: 'flex', padding: '12px 26px', borderRadius: 999, background: P.acc, color: P.onAcc, fontSize: 30, fontWeight: 800 }}>{badge}</div>
    <div style={{ display: 'flex', fontSize: 26, color: P.soft, letterSpacing: 2 }}>{String(c.kicker || 'RAW TRUTH').toUpperCase().slice(0, 28)}</div></div>)
  const foot = (<div style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 30, color: P.fg }}>
    <img src={MARK_PNG} width={42} height={48} alt="" /><div style={{ display: 'flex', flexDirection: 'column' }}><b style={{ fontSize: 30 }}>Olaitan Adebayo</b><span style={{ fontSize: 24, color: P.soft }}>Founder, Olexweb · #100DaysOfBuilding</span></div></div>)
  const sn = Number(new URL(request.url).searchParams.get('s') || 0), slides = Array.isArray(c.slides) ? c.slides : []
  if (sn && slides.length) {                                            // Install 45: one page of a carousel
    const total = slides.length + 2, page = (<div style={{ display: 'flex', fontSize: 26, color: P.soft }}>{sn}/{total}</div>)
    let inner
    if (sn === 1) inner = (<div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}><div style={{ fontSize: fit(title, 92, 74, 45), fontWeight: 800, lineHeight: 1.02, letterSpacing: -2 }}>{title}</div>
      <div style={{ display: 'flex', alignSelf: 'flex-start', padding: '22px 40px', borderRadius: 999, background: P.acc, color: P.onAcc, fontSize: 34, fontWeight: 800 }}>Swipe</div></div>)
    else if (sn === total) inner = (<div style={{ display: 'flex', flexDirection: 'column', gap: 34 }}><div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05 }}>{p.day && p.day < 100 ? `Day ${p.day + 1} is tomorrow.` : 'Thanks for reading.'}</div>
      <div style={{ fontSize: 40, color: P.soft, lineHeight: 1.3 }}>Follow Olaitan Adebayo for the raw truth about building a business online.</div>
      <div style={{ display: 'flex', alignSelf: 'flex-start', padding: '22px 40px', borderRadius: 999, border: `4px solid ${P.fg}`, fontSize: 34, fontWeight: 800 }}>olexweb.com</div></div>)
    else { const x = slides[sn - 2] || {}; inner = (<div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}><div style={{ display: 'flex', fontSize: 150, fontWeight: 800, lineHeight: 0.9, color: P.acc }}>{String(sn - 1).padStart(2, '0')}</div>
      <div style={{ fontSize: fit(x.title, 70, 58, 40), fontWeight: 800, lineHeight: 1.08 }}>{String(x.title || '')}</div><div style={{ fontSize: 40, color: P.soft, lineHeight: 1.35 }}>{String(x.body || '')}</div></div>) }
    return new ImageResponse((<div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 80, background: P.bg, color: P.fg, fontFamily: 'Inter', fontWeight: 500 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>{head.props.children[0]}{page}</div>{inner}{foot}</div>), { width: W, height: H, fonts: fonts() })
  }
  let body
  if (lay === 'list') body = (<div style={{ display: 'flex', flexDirection: 'column', gap: 34 }}>
    <div style={{ fontSize: fit(title, 72, 58, 50), fontWeight: 800, lineHeight: 1.05, letterSpacing: -1 }}>{title}</div>
    {pts.map((x, i) => <div key={i} style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}><div style={{ display: 'flex', width: 64, height: 64, borderRadius: 18, background: P.acc, color: P.onAcc, fontSize: 34, fontWeight: 800, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</div><div style={{ fontSize: 38, lineHeight: 1.25, paddingTop: 6 }}>{x}</div></div>)}</div>)
  else if (lay === 'myth') body = (<div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
    <div style={{ display: 'flex', flexDirection: 'column', padding: 44, borderRadius: 32, background: P.card, gap: 16 }}><div style={{ fontSize: 30, color: P.soft, fontWeight: 800, letterSpacing: 3 }}>MYTH</div><div style={{ fontSize: 50, lineHeight: 1.15, textDecoration: 'line-through', color: P.soft }}>{pts[0] || title}</div></div>
    <div style={{ display: 'flex', flexDirection: 'column', padding: 44, borderRadius: 32, background: P.acc, color: P.onAcc, gap: 16 }}><div style={{ fontSize: 30, fontWeight: 800, letterSpacing: 3 }}>RAW TRUTH</div><div style={{ fontSize: 54, lineHeight: 1.12, fontWeight: 800 }}>{pts[1] || title}</div></div></div>)
  else if (lay === 'steps') body = (<div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
    <div style={{ fontSize: fit(title, 64, 52, 45), fontWeight: 800, lineHeight: 1.05, marginBottom: 18 }}>{title}</div>
    {pts.map((x, i) => <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}><div style={{ display: 'flex', width: '100%', padding: '24px 34px', borderRadius: 24, background: P.card, border: `3px solid ${i === pts.length - 1 ? P.acc : 'transparent'}`, fontSize: 36, gap: 18, alignItems: 'center' }}><span style={{ display: 'flex', width: 46, height: 46, borderRadius: 23, background: i === pts.length - 1 ? P.acc : P.acc2, color: P.onAcc, alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, flexShrink: 0 }}>{i + 1}</span><span>{x}</span></div>{i < pts.length - 1 ? <div style={{ display: 'flex', width: 0, height: 0, margin: '10px 0', borderLeft: '18px solid transparent', borderRight: '18px solid transparent', borderTop: `22px solid ${P.acc}` }} /> : null}</div>)}</div>)
  else if (lay === 'note') body = (<div style={{ display: 'flex', justifyContent: 'center' }}><div style={{ display: 'flex', flexDirection: 'column', width: 860, padding: '70px 64px', background: P.acc, color: P.onAcc, transform: 'rotate(-2deg)', boxShadow: '0 30px 60px rgba(0,0,0,.35)', gap: 26 }}>
    <div style={{ fontSize: 30, letterSpacing: 2, fontWeight: 800, opacity: 0.6 }}>{p.format === 'lesson' ? 'LESSON LEARNED' : p.format === 'struggle' ? 'REAL TALK' : 'NOTE TO SELF'}</div>
    <div style={{ fontSize: fit(title, 64, 52, 60), lineHeight: 1.15, fontWeight: 800 }}>{title}</div>
    {pts[0] ? <div style={{ fontSize: 36, lineHeight: 1.3 }}>{pts[0]}</div> : null}</div></div>)
  else if (lay === 'terminal') body = (<div style={{ display: 'flex', flexDirection: 'column', borderRadius: 28, background: P.card, overflow: 'hidden', border: `2px solid ${P.acc2}` }}>
    <div style={{ display: 'flex', gap: 14, padding: '22px 28px', background: P.acc2 }}>{[P.acc, P.soft, P.acc2].map((x, i) => <div key={i} style={{ display: 'flex', width: 22, height: 22, borderRadius: 11, background: x, border: `2px solid ${P.soft}` }} />)}<span style={{ fontSize: 24, color: P.soft, marginLeft: 16 }}>olaitan@olexweb: ~/building</span></div>
    <div style={{ display: 'flex', flexDirection: 'column', padding: '40px 40px 54px', gap: 22, fontFamily: 'monospace' }}><div style={{ display: 'flex', fontSize: 44, color: P.fg, lineHeight: 1.2 }}><span style={{ color: P.acc, marginRight: 18 }}>$</span><span>{title}</span></div>
    {pts.map((x, i) => <div key={i} style={{ fontSize: 32, color: i === pts.length - 1 ? P.acc : P.soft, lineHeight: 1.3 }}>{(i === pts.length - 1 ? '[done] ' : '> ') + x}</div>)}</div></div>)
  else if (lay === 'question') body = (<div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}><div style={{ fontSize: 300, fontWeight: 800, lineHeight: 0.8, color: P.acc }}>?</div><div style={{ fontSize: fit(title, 76, 60, 60), fontWeight: 800, lineHeight: 1.08 }}>{title}</div>{pts[0] ? <div style={{ fontSize: 36, color: P.soft, lineHeight: 1.3 }}>{pts[0]}</div> : null}</div>)
  else if (lay === 'offer') body = (<div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}><div style={{ fontSize: fit(title, 74, 60, 50), fontWeight: 800, lineHeight: 1.05 }}>{title}</div>
    {pts.slice(0, 4).map((x, i) => <div key={i} style={{ display: 'flex', gap: 20, fontSize: 38, alignItems: 'center' }}><span style={{ display: 'flex', width: 50, height: 50, borderRadius: 25, background: P.acc, color: P.bg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><span style={{ display: 'flex', width: 12, height: 22, marginTop: -4, borderRight: `5px solid ${P.onAcc}`, borderBottom: `5px solid ${P.onAcc}`, transform: 'rotate(45deg)' }} /></span><span>{x}</span></div>)}
    <div style={{ display: 'flex', marginTop: 20, padding: '24px 40px', borderRadius: 999, border: `4px solid ${P.fg}`, fontSize: 36, fontWeight: 800, alignSelf: 'flex-start' }}>Send me a message</div></div>)
  else body = (<div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}><div style={{ fontSize: 220, lineHeight: 0.6, color: P.acc, fontWeight: 800 }}>“</div><div style={{ fontSize: fit(title, 86, 66, 55), fontWeight: 800, lineHeight: 1.05, letterSpacing: -1.5 }}>{title}</div>{pts[0] ? <div style={{ fontSize: 38, color: P.soft, lineHeight: 1.3 }}>{pts[0]}</div> : null}</div>)
  return new ImageResponse((<div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 80, background: P.bg, color: P.fg, fontFamily: 'Inter', fontWeight: 500 }}>{head}{body}{foot}</div>), { width: W, height: H, fonts: fonts() })
}

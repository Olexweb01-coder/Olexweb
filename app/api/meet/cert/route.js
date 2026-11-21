// A certificate of attendance (PNG, A4 landscape) for someone who stayed at least half the meeting. The link carries a
// key the server made when they joined, so only that person can get theirs.
import { ImageResponse } from 'next/og'
import fs from 'node:fs'
import path from 'node:path'
import { certificate } from '@/lib/meet/pro'
import { MARK_PNG } from '@/lib/brandMark'
export const dynamic = 'force-dynamic'
let FONTS = null
const fonts = () => (FONTS ||= [500, 800].map((w) => ({ name: 'Inter', data: fs.readFileSync(path.join(process.cwd(), 'lib/fonts', `inter-latin-${w}-normal.woff`)), weight: w, style: 'normal' })))
export async function GET(request) {
  const u = new URL(request.url).searchParams
  let c; try { c = await certificate(u.get('code'), u.get('id'), u.get('k')) } catch (e) { return new Response(e.message || 'Not available', { status: e.status || 403, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }) }
  const date = new Date(c.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' })
  const W = 1600, H = 1131, name = String(c.name).slice(0, 50)
  const img = new ImageResponse((<div style={{ width: W, height: H, display: 'flex', padding: 40, background: '#f7f5f0', fontFamily: 'Inter' }}>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '70px 90px', border: '6px solid #0a0b0a', borderRadius: 24, color: '#0a0b0a' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}><img src={MARK_PNG} width={38} height={44} alt="" /><div style={{ display: 'flex', fontSize: 30, fontWeight: 800 }}>Olexweb Meet</div></div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
        <div style={{ display: 'flex', fontSize: 30, letterSpacing: 8, color: 'rgba(10,11,10,.55)' }}>CERTIFICATE OF ATTENDANCE</div>
        <div style={{ display: 'flex', fontSize: 30, color: 'rgba(10,11,10,.6)' }}>This certifies that</div>
        <div style={{ display: 'flex', fontSize: name.length > 28 ? 72 : 92, fontWeight: 800, letterSpacing: -2, textAlign: 'center' }}>{name}</div>
        <div style={{ display: 'flex', width: 180, height: 8, borderRadius: 4, background: '#8fe36a' }} />
        <div style={{ display: 'flex', fontSize: 30, color: 'rgba(10,11,10,.7)' }}>attended</div>
        <div style={{ display: 'flex', fontSize: 46, fontWeight: 800, textAlign: 'center', maxWidth: 1200 }}>{String(c.title).slice(0, 90)}</div>
      </div>
      <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', fontSize: 26, color: 'rgba(10,11,10,.7)' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontWeight: 800, color: '#0a0b0a' }}>{String(c.host).slice(0, 40)}</span><span>Host</span></div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}><span style={{ fontWeight: 800, color: '#0a0b0a' }}>{date}</span><span>{c.minutes} minutes · {c.code}</span></div>
      </div>
    </div>
  </div>), { width: W, height: H, fonts: fonts() })
  return new Response(img.body, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, no-store', 'Content-Disposition': `attachment; filename="certificate-${c.code}.png"` } })
}

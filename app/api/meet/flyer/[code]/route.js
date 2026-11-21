// A meeting's flyer (1200 × 630): the picture WhatsApp and other apps show when a Pro meeting's link is shared, and a
// download hosts can post anywhere. Olexweb Meet's colours; the meeting's own title, time and host.
import { ImageResponse } from 'next/og'
import fs from 'node:fs'
import path from 'node:path'
import { flyer } from '@/lib/meet/pro'
import { MARK_PNG } from '@/lib/brandMark'
export const dynamic = 'force-dynamic'
let FONTS = null
const fonts = () => (FONTS ||= [500, 800].map((w) => ({ name: 'Inter', data: fs.readFileSync(path.join(process.cwd(), 'lib/fonts', `inter-latin-${w}-normal.woff`)), weight: w, style: 'normal' })))
export async function GET(request, { params }) {
  const f = await flyer(String(params.code || '').toLowerCase()).catch(() => null)
  if (!f) return new Response('Not found', { status: 404 })
  const when = f.startsAt ? new Date(f.startsAt).toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' }) + ' · Lagos time' : 'Join with the link'
  const title = String(f.title).slice(0, 90), big = title.length > 42 ? 58 : 72
  const img = new ImageResponse((<div style={{ width: 1200, height: 630, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 70, background: 'radial-gradient(circle at 100% 30%, #2f5529 0%, #142114 40%, #0a0b0a 75%)', color: '#f2efe9', fontFamily: 'Inter' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}><img src={MARK_PNG} width={42} height={48} alt="" /><div style={{ display: 'flex', fontSize: 30, fontWeight: 800 }}>Olexweb<span style={{ color: '#8fe36a', marginLeft: 10 }}>Meet</span></div></div>
      <div style={{ display: 'flex', padding: '10px 22px', borderRadius: 999, border: '2px solid rgba(143,227,106,.6)', color: '#8fe36a', fontSize: 24, fontWeight: 800 }}>{f.mode === 'audio' ? 'AUDIO CALL' : 'VIDEO MEETING'}{f.locked ? ' · ENCRYPTED' : ''}</div>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', fontSize: big, fontWeight: 800, lineHeight: 1.08, letterSpacing: -1.5 }}>{title}</div>
      <div style={{ display: 'flex', fontSize: 30, color: 'rgba(242,239,233,.75)' }}>{when}</div>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>{f.picture ? <img src={f.picture} width={64} height={64} style={{ borderRadius: 32 }} /> : <div style={{ display: 'flex', width: 64, height: 64, borderRadius: 32, background: '#1d261c', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 800, color: '#8fe36a' }}>{(f.host || 'O').slice(0, 1)}</div>}
        <div style={{ display: 'flex', flexDirection: 'column' }}><div style={{ display: 'flex', fontSize: 22, color: 'rgba(242,239,233,.6)' }}>Hosted by</div><div style={{ display: 'flex', fontSize: 30, fontWeight: 800 }}>{String(f.host).slice(0, 40)}</div></div></div>
      <div style={{ display: 'flex', fontSize: 24, color: 'rgba(242,239,233,.7)' }}>Free · no account needed to join</div>
    </div>
  </div>), { width: 1200, height: 630, fonts: fonts() })
  const dl = new URL(request.url).searchParams.has('download')
  return new Response(img.body, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=300', ...(dl ? { 'Content-Disposition': `attachment; filename="flyer-${params.code}.png"` } : {}) } })
}

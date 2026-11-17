// Install 29: the pictures of the daily Facebook story (1080 × 1350, Facebook's tall feed size), one per slide. Facebook
// fetches them when the story is posted; each address carries a key, so slides can't be listed by guessing.
import { ImageResponse } from 'next/og'
import { storyForImage, SERIES } from '@/lib/site/fbstory'
import { FONTS } from '@/lib/storyFonts'
import { MARK_PNG } from '@/lib/brandMark'
export const dynamic = 'force-dynamic'
const LOOK = {
  tayo: { bg: '#f2efe9', ink: '#0a0b0a', dim: 'rgba(10,11,10,.55)', acc: '#8fe36a', accInk: '#0e1a0b' },
  true: { bg: '#0a0b0a', ink: '#f2efe9', dim: 'rgba(242,239,233,.55)', acc: '#ffd166', accInk: '#2a1d00' },
  turnaround: { bg: '#0f2a1a', ink: '#f2efe9', dim: 'rgba(242,239,233,.6)', acc: '#8fe36a', accInk: '#0e1a0b' },
}
export async function GET(request, { params }) {
  const k = new URL(request.url).searchParams.get('k') || '', n = Number(params.n)
  const s = Number.isInteger(n) && n >= 0 && n < 8 ? await storyForImage(params.id, n, k).catch(() => null) : null
  if (!s) return new Response('Not found', { status: 404 })
  // the font has no naira sign or emoji: write naira the way people type it (N2,000), drop emoji
  const L = LOOK[s.series] || LOOK.tayo, cover = n === 0, last = n === s.of - 1, t = String(s.text).replace(/₦/g, 'N').replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '').replace(/[→←]/g, '').trim()
  const size = cover ? (t.length > 80 ? 78 : 92) : t.length > 120 ? 58 : t.length > 70 ? 66 : 76
  return new ImageResponse((
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '72px 76px', background: L.bg, color: L.ink, fontFamily: 'Mona' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', padding: '12px 26px', borderRadius: 999, background: L.acc, color: L.accInk, fontSize: 30, fontWeight: 800, letterSpacing: 2 }}>
          {(SERIES[s.series] || SERIES.tayo).badge}{s.series === 'tayo' && s.episode ? ` · EP ${s.episode}` : ''}</div>
        <div style={{ display: 'flex', fontSize: 30, fontWeight: 800, color: L.dim }}>{n + 1}/{s.of}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 34 }}>
        {cover && s.series === 'tayo' ? <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ width: 120, height: 120, borderRadius: 999, border: `14px solid ${L.acc}`, display: 'flex' }} /><div style={{ width: 34, height: 12, background: L.acc, display: 'flex' }} />
          <div style={{ width: 120, height: 120, borderRadius: 999, border: `14px solid ${L.acc}`, display: 'flex' }} /></div> : null}
        {!cover ? <div style={{ width: 90, height: 12, borderRadius: 6, background: L.acc, display: 'flex' }} /> : null}
        <div style={{ display: 'flex', fontSize: size, fontWeight: 800, lineHeight: 1.1, letterSpacing: -1 }}>{t}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 32, fontWeight: 800 }}><img src={MARK_PNG} width={35} height={40} alt="" />Olexweb</div>
        <div style={{ display: 'flex', fontSize: 28, fontWeight: 500, color: L.dim }}>{last ? 'A new story every day' : cover ? 'Swipe for the story' : 'Keep swiping'}</div>
      </div>
    </div>), { width: 1080, height: 1350, fonts: FONTS(), headers: { 'Cache-Control': 'public, max-age=86400' } })
}

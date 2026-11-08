// The share picture for every Directory post (Install 16): what WhatsApp, Facebook and X show when someone shares a link.
import { ImageResponse } from 'next/og'
import { entryBySlug } from '@/lib/site/directory'
import { MARK_PNG } from '@/lib/brandMark'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
const LABEL = { tool: 'Tool', update: 'Tech update', guide: 'How-to', alert: 'Safety alert' }
const COLOR = { tool: '#8fe36a', update: '#7cc4ff', guide: '#8fe36a', alert: '#ff8a70' }
export const shareImage = (kind) => async function Image({ params }) {
  const e = await entryBySlug(params.slug, kind).catch(() => null)
  const title = e ? String((e.content && e.content.title) || e.name) : 'The Olexweb Directory'
  const line = e ? String((e.content && e.content.oneLiner) || '') : 'Useful tools, tech updates, how-tos and safety alerts.'
  return new ImageResponse((
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 64, background: '#0a0b0a', color: '#f2efe9' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ display: 'flex', padding: '10px 22px', borderRadius: 999, background: COLOR[kind], color: '#0a0b0a', fontSize: 28, fontWeight: 800 }}>{LABEL[kind]}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div style={{ fontSize: title.length > 50 ? 62 : 74, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1 }}>{title.slice(0, 90)}</div>
        {line ? <div style={{ fontSize: 30, color: 'rgba(242,239,233,.7)', lineHeight: 1.3 }}>{line.slice(0, 130)}</div> : null}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 30, fontWeight: 700 }}>
        <img src={MARK_PNG} width={35} height={40} alt="" />olexweb.com
      </div>
    </div>), size)
}

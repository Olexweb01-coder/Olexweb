// An achievement card (Install 58), 1080×1350, to save or share. ?b=<badge> for your own (signed in), or
// ?b=<badge>&h=<handle> for someone's public profile. Only badges the person really earned are drawn.
import { ImageResponse } from 'next/og'
import fs from 'node:fs'
import path from 'node:path'
import { one } from '@/lib/meet/db'
import { currentMeetUser } from '@/lib/meet/auth'
import { BADGES } from '@/lib/meet/community'
export const dynamic = 'force-dynamic'
let FONTS = null
const fonts = () => (FONTS ||= [500, 800].map((w) => ({ name: 'Inter', data: fs.readFileSync(path.join(process.cwd(), 'lib/fonts', `inter-latin-${w}-normal.woff`)), weight: w, style: 'normal' })))
export async function GET(request) {
  const u = new URL(request.url).searchParams, b = BADGES.find((x) => x.id === u.get('b'))
  if (!b) return new Response('Not found', { status: 404 })
  let who = null
  if (u.get('h')) who = await one('select id, name from meet_users where lower(handle) = lower($1) and public and banned_at is null', [String(u.get('h')).slice(0, 40)])
  else { const me = await currentMeetUser(); if (me) who = { id: me.id, name: me.name } }
  const had = who && await one('select earned_at from meet_badges where user_id = $1 and badge = $2', [who.id, b.id])
  if (!had) return new Response('Not found', { status: 404 })
  const date = had.earned_at.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' })
  const logo = 'data:image/png;base64,' + fs.readFileSync(path.join(process.cwd(), 'public/meet/logo-96.png')).toString('base64')
  const img = new ImageResponse((<div style={{ width: 1080, height: 1350, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 90, fontFamily: 'Inter', color: '#f2efe9',
    background: 'linear-gradient(160deg, #1d4426, #0a0b0a)' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}><img src={logo} width={72} height={72} style={{ borderRadius: 20 }} alt="" /><div style={{ display: 'flex', fontSize: 40, fontWeight: 800 }}>Olexweb Meet</div></div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
      <div style={{ display: 'flex', width: 230, height: 230, borderRadius: 70, alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #f6e3a6, #c9a44a)', color: '#3a2a00' }}><svg width="130" height="130" viewBox="0 0 24 24"><path d="M12 2l3 6.6 7.2.8-5.4 4.9 1.5 7.1L12 17.8 5.7 21.4l1.5-7.1L1.8 9.4 9 8.6z" fill="#3a2a00" /></svg></div>
      <div style={{ display: 'flex', fontSize: 34, letterSpacing: 8, color: '#e9c46a', fontWeight: 800 }}>ACHIEVEMENT UNLOCKED</div>
      <div style={{ display: 'flex', fontSize: 104, fontWeight: 800, lineHeight: 1.02 }}>{b.name}</div>
      <div style={{ display: 'flex', fontSize: 40, color: 'rgba(242,239,233,0.75)' }}>{b.desc}</div></div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: 34 }}><div style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontWeight: 800 }}>{String(who.name).slice(0, 40)}</span><span style={{ color: 'rgba(242,239,233,0.65)' }}>{date}</span></div>
      <div style={{ display: 'flex', color: '#8fe36a', fontWeight: 800 }}>meet.olexweb.com</div></div>
  </div>), { width: 1080, height: 1350, fonts: fonts() })
  return new Response(img.body, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=600', 'Content-Disposition': `inline; filename="olexweb-meet-${b.id}.png"` } })
}

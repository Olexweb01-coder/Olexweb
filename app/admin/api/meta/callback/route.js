// Meta sends the browser back here. The admin's session cookie is SameSite=Strict and isn't sent on this hop, so the
// one-time state proves the request instead (stored for 15 minutes, made by the owner, and matching this browser's state
// cookie). Then a tiny page moves on to the admin from this site itself, so the session cookie travels again.
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { finishConnect } from '@/lib/site/meta'
import { SITE_ORIGIN } from '@/lib/site/youtube'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export async function GET(request) {
  const p = new URL(request.url).searchParams, jar = cookies(), mine = jar.get('olex_meta_state')?.value
  let k = 'failed'
  try {
    if (p.get('error')) k = 'cancelled'
    else if (!mine || mine !== p.get('state')) k = 'expired'                   // not the browser that started it
    else { const r = await finishConnect(SITE_ORIGIN(), p.get('code'), p.get('state')); k = r.ok ? 'connected' : r.why }
  } catch (e) { console.error('meta callback', e.message); k = 'failed' }
  const next = '/admin/automation/facebook?fb=' + encodeURIComponent(k)
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="0;url=${next}"><title>Facebook</title><meta name="robots" content="noindex">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0f1012;color:#f2efe9;font:16px/1.5 system-ui,sans-serif}a{color:#8fe36a}</style></head>
<body><p>${k === 'connected' ? 'Facebook connected.' : 'Returning to the admin.'} <a href="${next}">Continue</a></p></body></html>`
  const res = new NextResponse(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })
  res.cookies.set('olex_meta_state', '', { httpOnly: true, secure: SITE_ORIGIN().startsWith('https:'), sameSite: 'lax', path: '/admin/api/meta', maxAge: 0 })
  return res
}

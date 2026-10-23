// Google sends the browser back here after you approve. The admin's session cookie is SameSite=Strict and is not
// sent on this hop, so the one-time state proves the request instead (see lib/site/youtube.js). Then a tiny page
// moves you on to the YouTube section from this site itself, so your session cookie travels again.
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { clientIp } from '@/lib/admin/auth'
import { finishConnect, STATE_COOKIE, SITE_ORIGIN } from '@/lib/site/youtube'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export async function GET(request) {
  const p = new URL(request.url).searchParams, jar = cookies()
  let result
  try {
    result = await finishConnect({ state: p.get('state'), cookieState: jar.get(STATE_COOKIE)?.value, code: p.get('code'), error: p.get('error'), origin: SITE_ORIGIN(), ip: clientIp() })
  } catch (e) { console.error('youtube callback failed', e); result = { ok: false, code: 'error' } }
  const next = '/admin/youtube?yt=' + (result.ok ? 'connected' : result.code)
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="0;url=${next}"><title>YouTube</title><meta name="robots" content="noindex">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0f1012;color:#f2efe9;font:16px/1.5 system-ui,sans-serif}a{color:#8fe36a}</style></head>
<body><p>${result.ok ? 'YouTube connected.' : 'Returning to the admin.'} <a href="${next}">Continue</a></p></body></html>`
  const res = new NextResponse(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })
  res.cookies.set(STATE_COOKIE, '', { httpOnly: true, secure: SITE_ORIGIN().startsWith('https:'), sameSite: 'lax', path: '/admin/api/youtube', maxAge: 0 })
  return res
}

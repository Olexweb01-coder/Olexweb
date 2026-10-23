// The render factory (GitHub Actions, repo olexweb-factory) calls these. No session: every request must carry a fresh
// signature made with FACTORY_SECRET over its method, path and body (see lib/site/factory.js). Anything else gets 401.
import { NextResponse } from 'next/server'
import { verify, jobFor, report, savePiece, finish } from '@/lib/site/factory'
import { q } from '@/lib/admin/db'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const maxDuration = 60
const no = (status, error) => NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } })
export async function POST(request, { params }) {
  const action = params.action
  if (!['job', 'report', 'upload', 'finish'].includes(action)) return no(404, 'Not found.')
  const buf = Buffer.from(await request.arrayBuffer())
  if (buf.length > 4.4 * 1024 * 1024) return no(413, 'Too large.')
  if (!verify(request, buf)) return no(401, 'Not allowed.')
  const sp = new URL(request.url).searchParams, id = Number(sp.get('id'))
  if (!Number.isInteger(id) || id < 1) return no(400, 'Bad request.')
  try {
    if (action === 'upload') return (await savePiece(id, Number(sp.get('n')), buf)) ? NextResponse.json({ ok: true }) : no(409, 'Not accepting pieces for this video.')
    let body = {}; try { body = buf.length ? JSON.parse(buf.toString('utf8')) : {} } catch { return no(400, 'Bad request.') }
    if (action === 'job') { const j = await jobFor(id); return j ? NextResponse.json(j) : no(409, 'This video isn’t waiting for the factory.') }
    if (action === 'report') return (await report(id, body)) ? NextResponse.json({ ok: true }) : no(409, 'This video isn’t being rendered.')
    const f = await finish(id, body); return f.ok ? NextResponse.json({ ok: true }) : no(409, f.why)
  } catch (e) {
    console.error('factory call failed', action, e)
    // the reason stays private (the admin shows it to you); the public GitHub log only sees "500"
    await q('update yt_scripts set render_detail = $2 where id = $1', [id, (action + ': ' + String(e && e.message || e)).slice(0, 300)]).catch(() => {})
    return no(500, 'Something went wrong.')
  }
}

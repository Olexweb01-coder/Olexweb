// Audio upload for Pages & links (owner only): POST {start} as JSON, then each 3 MB piece as raw bytes (?id=…&n=…).
import { currentUser, sameOrigin, ownerOnly } from '@/lib/admin/auth'
import { startFile, putPiece, FileError } from '@/lib/site/pagefiles'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
const json = (o, s = 200) => Response.json(o, { status: s })
export async function POST(request) {
  if (!sameOrigin(request)) return json({ error: 'Request refused.' }, 403)
  const u = await currentUser(); if (!u) return json({ error: 'Sign in again.' }, 401)
  if (!ownerOnly(u)) return json({ error: 'Only Olaitan can do this.' }, 403)
  const sp = new URL(request.url).searchParams
  try {
    if (!sp.get('id')) { const b = await request.json().catch(() => null); if (!b) return json({ error: 'Request refused.' }, 400); return json(await startFile(b)) }
    const body = new Uint8Array(await request.arrayBuffer())
    if (body.byteLength > 3.2 * 1024 * 1024) return json({ error: 'Piece too large.' }, 413)
    return json(await putPiece(sp.get('id'), Number(sp.get('n')), body))
  } catch (e) { if (e instanceof FileError) return json({ error: e.message }, 400); return json({ error: 'Storage didn’t accept it. It will retry. (' + e.message + ')' }, 502) }
}

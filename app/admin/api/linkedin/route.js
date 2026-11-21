// Install 42: LinkedIn's switches (owner only): on/off, post now, disconnect
import { NextResponse } from 'next/server'
import { currentUser, sameOrigin, ownerOnly } from '@/lib/admin/auth'
import { liSetEnabled, liPostNow, liDisconnect, liStatus, liDraftNext, liSaveDraft, liApprove, liSkip, liSetVoice, liAddNote, liPhotoPost, liAddLibraryPhoto, liRemovePhoto, liPhotoBytes, liReset } from '@/lib/site/linkedin'
export const dynamic = 'force-dynamic'
export const maxDuration = 120
// a photo from your library, for its thumbnail on the LinkedIn page (owner only)
export async function GET(request) {
  const u = await currentUser(); if (!u || !ownerOnly(u)) return new Response('Not found', { status: 404 })
  const p = await liPhotoBytes(new URL(request.url).searchParams.get('photo')); if (!p) return new Response('Not found', { status: 404 })
  return new Response(p.bytes, { headers: { 'Content-Type': p.type, 'Cache-Control': 'private, max-age=3600' } })
}
export async function POST(request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Request refused.' }, { status: 403 })
  const u = await currentUser(); if (!u || !ownerOnly(u)) return NextResponse.json({ error: 'Only the owner can do this.' }, { status: 403 })
  if ((request.headers.get('content-type') || '').startsWith('multipart/form-data')) {   // Install 46: your photo and its idea
    try { const f = await request.formData()
      if (f.get('mode') === 'library') { for (const file of f.getAll('photos').slice(0, 10)) if (file && typeof file.arrayBuffer === 'function') await liAddLibraryPhoto(Buffer.from(await file.arrayBuffer()), file.type) }   // Install 48
      else { const file = f.get('photo'); await liPhotoPost(f.get('idea'), file && typeof file.arrayBuffer === 'function' ? Buffer.from(await file.arrayBuffer()) : null, file && file.type) }
      return NextResponse.json(JSON.parse(JSON.stringify(await liStatus()))) }
    catch (e) { return NextResponse.json({ error: e.message }, { status: 400 }) }
  }
  let b; try { b = await request.json() } catch { return NextResponse.json({ error: 'Request refused.' }, { status: 400 }) }
  try {
    if (b.action === 'enable') await liSetEnabled(!!b.on)
    else if (b.action === 'post') { const r = await liPostNow({ force: true, id: b.id }); if (r.skipped) return NextResponse.json({ error: 'Nothing to post: ' + r.skipped + '.' }, { status: 400 }) }
    else if (b.action === 'write') { const r = await liDraftNext(); if (!r) return NextResponse.json({ error: 'A post is already written and waiting (change it, post it or skip it first).' }, { status: 400 }) }
    else if (b.action === 'save') await liSaveDraft(b.id, b.text, b.comment)
    else if (b.action === 'approve') await liApprove(b.id)
    else if (b.action === 'skip') await liSkip(b.id)
    else if (b.action === 'voice') await liSetVoice(b.voice)
    else if (b.action === 'note') await liAddNote(b.note)
    else if (b.action === 'removePhoto') await liRemovePhoto(b.id)
    else if (b.action === 'reset') await liReset()
    else if (b.action === 'disconnect') await liDisconnect()
    else return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
    return NextResponse.json(JSON.parse(JSON.stringify(await liStatus())))
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 400 }) }
}

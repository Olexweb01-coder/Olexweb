// AI notes in the Meet app, for a meeting's host. POST (form: audio, code) turns one 5-minute piece into text with the
// voice pool; POST { action: 'notes', code, transcript } writes the notes (lib/site/meet.js makeNotes); GET ?code= reads them.
// Free: the first 60 minutes of each meeting (12 pieces), counted here on the server; Olaitan's meetings have no limit.
import { NextResponse } from 'next/server'
import { currentUser, sameOrigin } from '@/lib/admin/auth'
import { respond, refuse } from '@/lib/admin/respond'
import { currentMeetUser } from '@/lib/meet/auth'
import { one } from '@/lib/meet/db'
import { mustHost, makeNotes, getNotes } from '@/lib/site/meet'
import { transcribe, voiceReady } from '@/lib/assistant/voice'
import { Busy } from '@/lib/assistant/llm'
export const dynamic = 'force-dynamic'
export const maxDuration = 300
const MAX_BYTES = 4 * 1024 * 1024, FREE_PIECES = 12
const LIMIT = 'Free AI notes cover the first 60 minutes of a meeting. Longer notes will come with paid plans.'
async function who(request, code) {
  const u = await currentUser().catch(() => null), mu = await currentMeetUser()
  return mustHost(code, u, mu)                                            // throws for anyone who isn't this meeting's host
}
export async function GET(request) {
  const code = String(new URL(request.url).searchParams.get('code') || '')
  return respond(async () => { await who(request, code); return getNotes(code) })
}
export async function POST(request) {
  if (!sameOrigin(request)) return refuse('Request refused.', 403)
  if (String(request.headers.get('content-type') || '').startsWith('multipart/')) {
    let form; try { form = await request.formData() } catch { return refuse('No recording received.', 400) }
    const code = String(form.get('code') || ''), file = form.get('audio')
    let h; try { h = await who(request, code) } catch (e) { return refuse(e.message, e.status || 403) }
    if (!voiceReady()) return refuse('AI notes aren’t set up yet.', 503)
    if (!file || typeof file === 'string' || !file.size) return refuse('No recording received.', 400)
    if (file.size > MAX_BYTES) return refuse('That piece of the recording is too big.', 413)
    if (!/^(audio|video)\/(webm|mp4|ogg|mpeg|wav|x-m4a|m4a|aac)/.test(file.type || '')) return refuse('That recording format isn’t supported.', 415)
    if (!h.owner) {                                                         // the free hour, claimed before the work so it can't be raced
      const ok = await one('update meetings set notes_pieces = notes_pieces + 1 where code = $1 and notes_pieces < $2 returning notes_pieces', [code, FREE_PIECES])
      if (!ok) return refuse(LIMIT, 402)
    }
    try { return NextResponse.json(await transcribe(file)) }
    catch (e) {
      if (!h.owner) await one('update meetings set notes_pieces = greatest(notes_pieces - 1, 0) where code = $1 returning 1', [code]).catch(() => {})   // a failed piece doesn't count
      if (!(e instanceof Busy)) console.error('meet notes transcribe', e)
      return refuse(e.message || 'Speech couldn’t be turned into text. Try again.', e instanceof Busy ? 503 : 500)
    }
  }
  const b = await request.json().catch(() => null)
  if (!b || b.action !== 'notes') return refuse('Request refused.', 400)
  return respond(async () => { await who(request, b.code); return makeNotes(b.code, String(b.transcript || '').slice(0, 300_000)) })
}

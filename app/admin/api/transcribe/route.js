// Voice to text for Olex AI's message box. Owner only (like the chat), same-site requests only, short recordings only.
import { NextResponse } from 'next/server'
import { currentUser, sameOrigin, ownerOnly } from '@/lib/admin/auth'
import { transcribe, voiceReady } from '@/lib/assistant/voice'
import { Busy } from '@/lib/assistant/llm'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const maxDuration = 60
const MAX_BYTES = 4 * 1024 * 1024
const no = (error, status) => NextResponse.json({ error }, { status })
export async function POST(request) {
  if (!sameOrigin(request)) return no('Request refused.', 403)
  const u = await currentUser(); if (!u) return no('Sign in again.', 401)
  if (!ownerOnly(u)) return no('Only Olaitan can use Olex AI.', 403)
  if (!voiceReady()) return no('Voice needs GROQ_API_KEY or GEMINI_API_KEY.', 503)
  let form; try { form = await request.formData() } catch { return no('No recording received.', 400) }
  const file = form.get('audio')
  if (!file || typeof file === 'string' || !file.size) return no('No recording received.', 400)
  if (file.size > MAX_BYTES) return no('That recording is too long. Keep it under 3 minutes.', 413)
  if (!/^(audio|video)\/(webm|mp4|ogg|mpeg|wav|x-m4a|m4a|aac)/.test(file.type || '')) return no('That recording format isn’t supported.', 415)
  try { return NextResponse.json(await transcribe(file)) }
  catch (e) { if (!(e instanceof Busy)) console.error('transcribe failed', e); return no(e.message || 'Olex AI couldn’t turn that into text. Try again.', e instanceof Busy ? 503 : 500) }
}

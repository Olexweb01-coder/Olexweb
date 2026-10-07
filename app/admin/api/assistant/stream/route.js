// Olex AI chat, streamed: words arrive as they are written. Owner only, same checks as the rest of Olex AI.
import { currentUser, sameOrigin, ownerOnly } from '@/lib/admin/auth'
import { refuse, readJson } from '@/lib/admin/respond'
import { handleMessage } from '@/lib/assistant/chat'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const maxDuration = 120
export async function POST(request) {
  if (!sameOrigin(request)) return refuse('Request refused.', 403)
  const u = await currentUser(); if (!u) return refuse('Sign in again.', 401)
  if (!ownerOnly(u)) return refuse('Only Olaitan can use Olex AI.', 403)
  const b = await readJson(request); if (!b) return refuse('Request refused.', 400)
  const text = String(b.text || '').trim(); if (!text) return refuse('Write a message first.', 400)
  const chatId = Number.isInteger(Number(b.chatId)) && Number(b.chatId) > 0 ? Number(b.chatId) : null
  const enc = new TextEncoder()
  const body = new ReadableStream({
    async start(c) {
      const send = (event, data) => { try { c.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)) } catch {} }
      try { const r = await handleMessage(chatId, text, (chunk) => send('delta', { text: chunk })); send('done', r) }
      catch (e) { send('error', { error: e && e.message ? e.message : 'Something went wrong. Try again.' }) }
      c.close()
    },
  })
  return new Response(body, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store, no-transform', 'X-Accel-Buffering': 'no' } })
}

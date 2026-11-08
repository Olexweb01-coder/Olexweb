// Install 20: the chat on olexweb.com (public, from this site only). lib/site/chat.js
import { headers } from 'next/headers'
import { sameOrigin, clientIp } from '@/lib/admin/auth'
import { respond, refuse, readJson } from '@/lib/admin/respond'
import { Refused } from '@/lib/admin/content'
import { startChat, sendChat, pollChat, chatStamp } from '@/lib/site/chat'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
export async function GET() { return Response.json({ stamp: chatStamp() }, { headers: { 'Cache-Control': 'no-store' } }) }
export async function POST(request) {
  if (!sameOrigin(request)) return refuse('Request refused.', 403)
  const b = await readJson(request); if (!b) return refuse('Request refused.', 400)
  const country = headers().get('x-vercel-ip-country') || null                     // set by Vercel: prices in their currency
  return respond(() => {
    if (b.action === 'start') return startChat({ page: b.page, stamp: b.stamp, website: b.website, country }, clientIp())
    if (b.action === 'send') return sendChat({ token: b.token, text: b.text, after: b.after }, clientIp())
    if (b.action === 'poll') return pollChat({ token: b.token, after: b.after })
    throw new Refused('Request refused.')
  })
}

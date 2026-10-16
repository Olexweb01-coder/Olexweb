// Saves the text the browser took out of a document, so the chat can use it. Owner only.
import { NextResponse } from 'next/server'
import { currentUser, sameOrigin, ownerOnly } from '@/lib/admin/auth'
import { saveDoc } from '@/lib/assistant/docs'
export const dynamic = 'force-dynamic'
const no = (error, status) => NextResponse.json({ error }, { status })
export async function POST(request) {
  if (!sameOrigin(request)) return no('Request refused.', 403)
  const u = await currentUser(); if (!u) return no('Sign in again.', 401)
  if (!ownerOnly(u)) return no('Only Olaitan can use Olex AI.', 403)
  let b; try { b = await request.json() } catch { return no('That document is too large to send. Try a smaller one, or split it.', 413) }
  try { return NextResponse.json(await saveDoc(b || {})) } catch (e) { return no(e.message || 'That document couldn’t be saved.', 400) }
}

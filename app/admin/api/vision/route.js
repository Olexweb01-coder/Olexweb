// Turns a scanned page or a photo into text for Olex AI. Owner only; the picture is not stored.
import { NextResponse } from 'next/server'
import { currentUser, sameOrigin, ownerOnly } from '@/lib/admin/auth'
import { readImage } from '@/lib/assistant/vision'
export const dynamic = 'force-dynamic'
export const maxDuration = 90
const no = (error, status) => NextResponse.json({ error }, { status })
export async function POST(request) {
  if (!sameOrigin(request)) return no('Request refused.', 403)
  const u = await currentUser(); if (!u) return no('Sign in again.', 401)
  if (!ownerOnly(u)) return no('Only Olaitan can use Olex AI.', 403)
  let b; try { b = await request.json() } catch { return no('That image is too large.', 413) }
  try { return NextResponse.json(await readImage(b && b.image, b && b.purpose === 'ocr' ? 'ocr' : 'describe')) } catch (e) { return no(e.message || 'The image couldn’t be read.', 503) }
}

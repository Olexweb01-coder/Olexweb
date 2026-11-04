// Email sign-in for Olexweb Meet (lib/meet/emailauth.js): signup, code (sign-in or reset), verify, password. Same-site only.
import { NextResponse } from 'next/server'
import { sameOrigin, clientIp } from '@/lib/admin/auth'
import { refuse, readJson } from '@/lib/admin/respond'
import { Refused } from '@/lib/admin/content'
import { sessionCookie } from '@/lib/meet/auth'
import * as E from '@/lib/meet/emailauth'
import { MailError } from '@/lib/mail'
export const dynamic = 'force-dynamic'
export async function POST(request) {
  if (!sameOrigin(request)) return refuse('Request refused.', 403)
  if (!E.emailSignInReady()) return refuse('Email sign-in isn’t available yet. Use Google for now.', 503)
  const b = await readJson(request); if (!b) return refuse('Request refused.', 400)
  const ip = clientIp()
  try {
    let r
    if (b.action === 'signup') r = await E.startSignUp({ name: b.name, email: b.email, password: b.password }, ip)
    else if (b.action === 'code') r = await E.sendCode({ email: b.email, purpose: b.purpose }, ip)
    else if (b.action === 'verify') r = await E.verifyCode({ email: b.email, code: b.code, password: b.password })
    else if (b.action === 'password') r = await E.passwordSignIn({ email: b.email, password: b.password }, ip)
    else return refuse('Unknown action.', 400)
    if (r.token) { const res = NextResponse.json({ ok: true, created: !!r.created }); res.cookies.set(sessionCookie(r.token)); return res }
    return NextResponse.json(r)
  } catch (e) {
    if (e instanceof Refused || e instanceof MailError) return refuse(e.message, e.status || 400)   // (class names are shortened in production builds: compare types, not names)
    console.error('meet email sign-in', e); return refuse('Something went wrong. Try again.', 500)
  }
}

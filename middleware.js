// Runs before every /admin request: strict security headers with a fresh nonce, and no session means no admin page.
// (The session itself is fully checked against the database on the server; this is the fast first gate.)
import { NextResponse } from 'next/server'

const OPEN = ['/admin/login', '/admin/api/sign-in', '/admin/api/verify-code', '/admin/manifest.webmanifest', '/admin/join', '/admin/api/join', '/admin/sw.js']
const PUBLIC = ['/review', '/api/review']      // clients' review pages: strict headers, no sign-in

export function middleware(request) {
  const { pathname } = request.nextUrl
  const nonce = btoa(crypto.randomUUID())
  const dev = process.env.NODE_ENV === 'development'
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self'",                                   // the notification helper (/admin/sw.js), from this site only
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'none'",
    "object-src 'none'",
  ].join('; ')

  const signedIn = request.cookies.has('__Host-olex_sess')
  let response
  const open = [...OPEN, ...PUBLIC].some((p) => pathname === p || pathname.startsWith(p + '/'))
  if (!signedIn && !open) {
    response = pathname.startsWith('/admin/api/')
      ? NextResponse.json({ error: 'Sign in again.' }, { status: 401 })      // the admin's screens handle this and go to sign-in
      : NextResponse.redirect(new URL('/admin/login', request.url))
  } else {
    const h = new Headers(request.headers)
    h.set('x-nonce', nonce); h.set('Content-Security-Policy', csp)   // Next.js puts the nonce on its own scripts
    response = NextResponse.next({ request: { headers: h } })
  }
  response.headers.set('Content-Security-Policy', csp)
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'no-referrer')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()')
  response.headers.set('Cache-Control', 'no-store')
  response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  if (!dev) response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains')
  return response
}
export const config = { matcher: ['/admin', '/admin/:path*', '/review/:path*', '/api/review'] }

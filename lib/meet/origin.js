// The address Meet is served from: MEET_ORIGIN once meet.olexweb.com is set up, else the address of this request.
// Sign-in return addresses use it, so they match exactly what's registered with Google, Microsoft, GitHub and Facebook.
import 'server-only'
export function meetOrigin(request) {
  const set = String(process.env.MEET_ORIGIN || '').trim().replace(/\/$/, '')
  if (set) return set
  const h = request.headers, host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3000'
  const proto = h.get('x-forwarded-proto') || (/^(localhost|127\.|[\w-]+\.localhost)/.test(host) ? 'http' : 'https')
  return `${proto}://${host}`
}
// where Meet's own pages are: / on meet.olexweb.com, /meet on the main site (before the Meet address is set up)
export const meetHome = (request) => (String(request.headers.get('x-forwarded-host') || request.headers.get('host') || '').startsWith('meet.') ? '/' : '/meet')

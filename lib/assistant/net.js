// Fetching web pages safely (news, sources). HTTPS only; private and internal addresses are refused (also after
// redirects), so the server can never be tricked into visiting its own network; size and time are limited.
import 'server-only'
import dns from 'node:dns/promises'
import net from 'node:net'

const PRIVATE = [/^10\./, /^127\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^0\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, /^::1$/, /^f[cd][0-9a-f]{2}:/i, /^fe80:/i, /^::ffff:(10|127|169\.254|192\.168)\./i]
const isPrivate = (ip) => PRIVATE.some((r) => r.test(ip))
const TEST_HOSTS = (process.env.ASSISTANT_TEST_HOSTS || '').split(',').filter(Boolean)   // automated tests only

export async function checkUrl(raw) {
  let u; try { u = new URL(raw) } catch { return null }
  const testHost = TEST_HOSTS.includes(u.host)
  if (u.protocol !== 'https:' && !testHost) return null
  if (u.username || u.password) return null
  if (testHost) return u
  if (net.isIP(u.hostname)) return isPrivate(u.hostname) ? null : u
  try { const addrs = await dns.lookup(u.hostname, { all: true }); if (!addrs.length || addrs.some((a) => isPrivate(a.address))) return null } catch { return null }
  return u
}
export async function safeFetch(raw, { maxBytes = 1_500_000, timeoutMs = 9000, accept = 'text/html,application/xml,application/json;q=0.9,*/*;q=0.5' } = {}) {
  let url = raw
  for (let hop = 0; hop < 4; hop++) {
    const u = await checkUrl(url); if (!u) throw new Error('address not allowed')
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), timeoutMs)
    let r
    try { r = await fetch(u, { redirect: 'manual', signal: ctl.signal, headers: { 'User-Agent': 'OlexwebAssistant/1.0 (+https://olexweb.com)', Accept: accept } }) } finally { clearTimeout(timer) }
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) { url = new URL(r.headers.get('location'), u).toString(); continue }
    const reader = r.body ? r.body.getReader() : null, chunks = []; let size = 0
    if (reader) for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > maxBytes) { reader.cancel(); break } chunks.push(value) }
    return { status: r.status, url: u.toString(), type: r.headers.get('content-type') || '', text: Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8') }
  }
  throw new Error('too many redirects')
}
// The readable text of a page: scripts, styles, navigation and markup removed.
export function pageText(html) {
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || ''
  const body = html.replace(/<(script|style|noscript|svg|nav|header|footer|form|iframe)[\s\S]*?<\/\1>/gi, ' ').replace(/<br\s*\/?>|<\/(p|h[1-6]|li|div|section|article)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim()
  return { title: title.replace(/\s+/g, ' ').trim().slice(0, 200), text: body.slice(0, 9000) }
}

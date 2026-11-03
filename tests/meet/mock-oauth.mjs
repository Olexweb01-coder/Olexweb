// A stand-in for Google, Microsoft, GitHub and Facebook sign-in during the Meet tests (MEET_OAUTH_TEST_BASE=http://localhost:4567).
// Like the real ones: the consent page sends the browser back with a code and the same state; the token exchange checks
// the client secret, the return address, and (Google, Microsoft) the PKCE proof. Who signs in is set by the test:
// POST /control { as: { google: { sub, email, email_verified, name }, ... } }. GET /log shows what happened.
import http from 'node:http'
import { createHash } from 'node:crypto'
let as = {}, codes = new Map(), log = [], n = 0
const send = (res, code, body, type = 'application/json') => { res.writeHead(code, { 'Content-Type': type }); res.end(typeof body === 'string' ? body : JSON.stringify(body)) }
const PATHS = { google: ['/o/oauth2/v2/auth', '/token', '/v1/userinfo'], microsoft: ['/common/oauth2/v2.0/authorize', '/common/oauth2/v2.0/token', '/oidc/userinfo'],
  github: ['/login/oauth/authorize', '/login/oauth/access_token', '/user'], facebook: ['/v21.0/dialog/oauth', '/v21.0/oauth/access_token', '/v21.0/me'] }
http.createServer((req, res) => {
  let body = ''; req.on('data', (c) => (body += c)); req.on('end', () => {
    const u = new URL(req.url, 'http://x'), [, provider, ...rest] = u.pathname.split('/'), path = '/' + rest.join('/')
    if (u.pathname === '/control') { const j = JSON.parse(body || '{}'); if (j.as) as = j.as; if (j.reset) log = []; return send(res, 200, { ok: true }) }
    if (u.pathname === '/log') return send(res, 200, log)
    const P = PATHS[provider]; if (!P) return send(res, 404, { error: 'unknown' })
    if (path === P[0]) {                                                          // the consent page: says yes at once
      const p = u.searchParams, code = 'c' + (++n)
      codes.set(code, { provider, redirect: p.get('redirect_uri'), challenge: p.get('code_challenge'), client: p.get('client_id') })
      log.push({ step: 'authorize', provider, scope: p.get('scope'), pkce: !!p.get('code_challenge'), method: p.get('code_challenge_method') })
      if (as.cancel) { res.writeHead(302, { Location: p.get('redirect_uri') + '?error=access_denied&state=' + encodeURIComponent(p.get('state')) }); return res.end() }
      res.writeHead(302, { Location: `${p.get('redirect_uri')}?code=${code}&state=${encodeURIComponent(as.badState ? 'forged' : p.get('state'))}` }); return res.end()
    }
    if (path === P[1]) {                                                          // the token exchange
      const f = new URLSearchParams(body), c = codes.get(f.get('code'))
      const pkceOk = !c || !c.challenge || createHash('sha256').update(f.get('code_verifier') || '').digest('base64url') === c.challenge
      const ok = c && c.provider === provider && f.get('client_secret') === 'test-secret' && f.get('redirect_uri') === c.redirect && pkceOk
      log.push({ step: 'token', provider, ok: !!ok, pkceOk })
      if (!ok) return send(res, 400, { error: 'invalid_grant' })
      codes.delete(f.get('code'))                                                 // a code works once
      return send(res, 200, { access_token: 'tok-' + provider + '-' + f.get('code'), token_type: 'bearer' })
    }
    const who = as[provider] || {}, auth = req.headers.authorization || ''
    if (!auth.startsWith('Bearer tok-' + provider)) return send(res, 401, { error: 'no token' })
    if (path === P[2] && provider === 'google') return send(res, 200, { sub: who.sub, email: who.email, email_verified: who.email_verified, name: who.name, picture: 'https://example.com/a.png' })
    if (path === P[2] && provider === 'microsoft') return send(res, 200, { sub: who.sub, email: who.email, name: who.name })
    if (path === '/user' && provider === 'github') return send(res, 200, { id: who.id, login: who.login, name: who.name, avatar_url: 'https://example.com/g.png' })
    if (path === '/user/emails' && provider === 'github') return send(res, 200, who.emails || [])
    if (path === P[2] && provider === 'facebook') return send(res, 200, { id: who.id, name: who.name, email: who.email })
    send(res, 404, { error: 'unknown' })
  })
}).listen(4567)

// npm run assistant:check: confirms the assistant is ready, without changing anything.
import fs from 'node:fs'
const ok = (s) => console.log('  \u2713 ' + s), no = (s) => { console.log('  \u2717 ' + s); process.exitCode = 1 }
const f = '.env.local'
if (fs.existsSync(f)) for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) { const m = line.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*)\s*$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') }
console.log('Olexweb assistant check\n')
const key = process.env.GEMINI_API_KEY, BASE = process.env.ASSISTANT_GEMINI_BASE || 'https://generativelanguage.googleapis.com'
if (!key) no('GEMINI_API_KEY is missing from .env.local'); else ok('GEMINI_API_KEY is set')
process.env.CRON_SECRET && process.env.CRON_SECRET.length >= 32 ? ok('CRON_SECRET is set (the daily run is protected)') : no('CRON_SECRET is missing or shorter than 32 characters')
if (key) {
  const r = await fetch(BASE + '/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': key } }).catch(() => null)
  if (!r || !r.ok) no('Google did not accept the key' + (r ? ' (' + r.status + ')' : ' (no connection)'))
  else {
    const names = ((await r.json()).models || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent')).map((m) => m.name.replace('models/', ''))
    const PREFER = [/^gemini-3\.8-flash$/, /^gemini-3\.\d+-flash$/, /^gemini-3\.\d+-flash-lite$/, /^gemini-\d+(\.\d+)?-flash$/, /^gemini-\d+(\.\d+)?-flash-lite$/]
    const models = process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : [...new Set(PREFER.flatMap((re) => names.filter((n) => re.test(n)).sort().reverse()))].slice(0, 3)
    if (!models.length) no('No suitable Gemini model is available for this key'); else {
      ok('Key accepted. Models it can use, best first: ' + models.join(', '))
      let worked = null, busy = false, notes = []
      for (const model of models) {
        const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 45000)
        try {
          const g = await fetch(`${BASE}/v1beta/models/${model}:generateContent`, { method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
            body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Reply with {"ok": true}' }] }], generationConfig: { responseMimeType: 'application/json' } }) })
          const j = await g.json().catch(() => ({}))
          if (g.ok) { worked = model; break }
          if (g.status === 503 || g.status === 500 || g.status === 429) busy = true
          notes.push(model + ': ' + g.status + (j.error ? ' ' + j.error.message : ''))
        } catch { busy = true; notes.push(model + ': no answer within 45 seconds') } finally { clearTimeout(timer) }
      }
      if (worked) ok('A test request worked (' + worked + ')')
      else if (busy) console.log('  \u26A0 Gemini is busy right now. Temporary: the assistant waits, retries and switches models by itself.\n    ' + notes.join('\n    '))
      else no('A test request failed:\n    ' + notes.join('\n    '))
    }
  }
}
// The backup: Cloudflare Workers AI
const cfId = process.env.CLOUDFLARE_ACCOUNT_ID, cfToken = process.env.CLOUDFLARE_AI_TOKEN
if (!cfId && !cfToken) console.log('  \u2013 Cloudflare backup not set up (optional: CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_AI_TOKEN)')
else if (!cfId || !cfToken) no('Cloudflare backup: both CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_AI_TOKEN are needed')
else {
  const CF = (process.env.ASSISTANT_CF_BASE || 'https://api.cloudflare.com').replace(/\/$/, '')
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 45000)
  try {
    const r = await fetch(`${CF}/client/v4/accounts/${encodeURIComponent(cfId)}/ai/run/@cf/meta/llama-3.3-70b-instruct-fp8-fast`, { method: 'POST', signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfToken }, body: JSON.stringify({ messages: [{ role: 'user', content: 'Reply with {"ok": true}' }], max_tokens: 20, response_format: { type: 'json_object' } }) })
    const j = await r.json().catch(() => ({})), msg = ((j.errors || [])[0] || {}).message || ''
    if (r.ok) ok('Cloudflare backup works (Llama 3.3 70B)')
    else if (r.status === 401 || r.status === 403) no('Cloudflare did not accept the token (' + r.status + (msg ? ': ' + msg : '') + '). Create a Workers AI token and check the Account ID.')
    else if (r.status === 429 || r.status >= 500) console.log('  \u26A0 The Cloudflare backup is busy or its daily allowance is used. Temporary. ' + r.status + (msg ? ' ' + msg : ''))
    else no('Cloudflare test request failed (' + r.status + (msg ? ': ' + msg : '') + ')')
  } catch { console.log('  \u26A0 The Cloudflare backup didn\u2019t answer within 45 seconds. Temporary.') } finally { clearTimeout(timer) }
}
// Search Console (optional)
if (!process.env.GSC_CLIENT_EMAIL && !process.env.GSC_PRIVATE_KEY) console.log('  \u2013 Search Console not connected (optional: GSC_CLIENT_EMAIL, GSC_PRIVATE_KEY, GSC_SITE)')
else {
  try {
    const { createSign } = await import('node:crypto'); const now = Math.floor(Date.now() / 1000), b = (x) => Buffer.from(JSON.stringify(x)).toString('base64url')
    const u = b({ alg: 'RS256', typ: 'JWT' }) + '.' + b({ iss: process.env.GSC_CLIENT_EMAIL, scope: 'https://www.googleapis.com/auth/webmasters.readonly', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })
    const sig = createSign('RSA-SHA256').update(u).sign((process.env.GSC_PRIVATE_KEY || '').replace(/\\n/g, '\n')).toString('base64url')
    const t = await fetch(process.env.GSC_TOKEN_URL || 'https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: u + '.' + sig }) }).then((r) => r.json())
    if (!t.access_token) no('Search Console: Google did not accept the service account' + (t.error_description ? ' (' + t.error_description + ')' : ''))
    else {
      const site = process.env.GSC_SITE || ''; const d = (o) => new Date(Date.now() - o * 86400e3).toISOString().slice(0, 10)
      const r = await fetch(`${(process.env.GSC_API_BASE || 'https://www.googleapis.com')}/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t.access_token }, body: JSON.stringify({ startDate: d(29), endDate: d(2), dimensions: ['query'], rowLimit: 1 }) })
      if (r.ok) ok('Search Console connected (' + site + ')')
      else if (r.status === 403) no('Search Console: add ' + process.env.GSC_CLIENT_EMAIL + ' as a user of ' + site + ' (Settings, Users and permissions)')
      else no('Search Console: the property "' + site + '" was not found (' + r.status + '). Use sc-domain:olexweb.com or https://olexweb.com/')
    }
  } catch (e) { no('Search Console: the private key could not be read. Copy the whole private_key value.') }
}
for (const [name, url] of [['Google search suggestions', 'https://suggestqueries.google.com/complete/search?client=firefox&hl=en&q=website'], ['Google News', 'https://news.google.com/rss/search?q=web&hl=en-US&gl=US&ceid=US:en'], ['Hacker News', 'https://hn.algolia.com/api/v1/search?query=web&tags=story&hitsPerPage=1'], ['dev.to', 'https://dev.to/api/articles?per_page=1']]) {
  const r = await fetch(url, { headers: { 'User-Agent': 'OlexwebAssistant/1.0' } }).catch(() => null)
  r && r.ok ? ok(name + ' is reachable') : no(name + ' could not be reached')
}
console.log(process.exitCode ? '\nFix the items marked \u2717, then run this again.' : '\nAll done. The assistant is ready.')

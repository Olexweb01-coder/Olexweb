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
for (const [name, url] of [['Google search suggestions', 'https://suggestqueries.google.com/complete/search?client=firefox&hl=en&q=website'], ['Google News', 'https://news.google.com/rss/search?q=web&hl=en-US&gl=US&ceid=US:en'], ['Hacker News', 'https://hn.algolia.com/api/v1/search?query=web&tags=story&hitsPerPage=1'], ['dev.to', 'https://dev.to/api/articles?per_page=1']]) {
  const r = await fetch(url, { headers: { 'User-Agent': 'OlexwebAssistant/1.0' } }).catch(() => null)
  r && r.ok ? ok(name + ' is reachable') : no(name + ' could not be reached')
}
console.log(process.exitCode ? '\nFix the items marked \u2717, then run this again.' : '\nAll done. The assistant is ready.')

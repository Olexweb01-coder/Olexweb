// npm run assistant:check: confirms the assistant is ready, without changing anything.
import fs from 'node:fs'
const ok = (s) => console.log('  \u2713 ' + s), no = (s) => { console.log('  \u2717 ' + s); process.exitCode = 1 }
const f = '.env.local'
if (fs.existsSync(f)) for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) { const m = line.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*)\s*$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') }
console.log('Olexweb assistant check\n')
const key = process.env.GEMINI_API_KEY, BASE = 'https://generativelanguage.googleapis.com'
if (!key) no('GEMINI_API_KEY is missing from .env.local'); else ok('GEMINI_API_KEY is set')
process.env.CRON_SECRET && process.env.CRON_SECRET.length >= 32 ? ok('CRON_SECRET is set (the daily run is protected)') : no('CRON_SECRET is missing or shorter than 32 characters')
if (key) {
  const r = await fetch(BASE + '/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': key } }).catch(() => null)
  if (!r || !r.ok) no('Google did not accept the key' + (r ? ' (' + r.status + ')' : ' (no connection)'))
  else {
    const names = ((await r.json()).models || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent')).map((m) => m.name.replace('models/', ''))
    const PREFER = [/^gemini-3\.8-flash$/, /^gemini-3\.\d+-flash$/, /^gemini-3\.\d+-flash-lite$/, /^gemini-\d+(\.\d+)?-flash$/]
    const model = process.env.GEMINI_MODEL || PREFER.map((re) => names.filter((n) => re.test(n)).sort().reverse()[0]).find(Boolean)
    if (!model) no('No suitable Gemini model is available for this key'); else {
      ok('Key accepted. Model: ' + model)
      const g = await fetch(`${BASE}/v1beta/models/${model}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Reply with {"ok": true}' }] }], generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 50 } }) })
      if (g.status === 429) no('The free daily limit is used up right now. Try again tomorrow.')
      else if (!g.ok) no('A test request failed (' + g.status + ')')
      else ok('A test request worked')
    }
  }
}
for (const [name, url] of [['Google search suggestions', 'https://suggestqueries.google.com/complete/search?client=firefox&hl=en&q=website'], ['Google News', 'https://news.google.com/rss/search?q=web&hl=en-US&gl=US&ceid=US:en'], ['Hacker News', 'https://hn.algolia.com/api/v1/search?query=web&tags=story&hitsPerPage=1'], ['dev.to', 'https://dev.to/api/articles?per_page=1']]) {
  const r = await fetch(url, { headers: { 'User-Agent': 'OlexwebAssistant/1.0' } }).catch(() => null)
  r && r.ok ? ok(name + ' is reachable') : no(name + ' could not be reached')
}
console.log(process.exitCode ? '\nFix the items marked \u2717, then run this again.' : '\nAll done. The assistant is ready.')

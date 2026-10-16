// Reading pictures: scanned pages and photos become text. Gemini first, then free vision models on OpenRouter and Z.ai.
import 'server-only'
import { Busy } from './llm'

const PROMPTS = {
  ocr: 'This is a scanned page. Transcribe all of its text exactly, in reading order, keeping headings, lists and tables (tables as Markdown). Reply with only the text.',
  describe: 'Describe this image clearly for someone who can’t see it: what it shows, any people (without guessing who they are), colours and layout. Then transcribe any text in it exactly. If it is a screenshot of an app, a website, an error or code, transcribe that fully. Reply in plain Markdown.',
}
async function timed(url, init, ms = 60000) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms)
  try { return await fetch(url, { ...init, cache: 'no-store', signal: ctl.signal }) } catch { return null } finally { clearTimeout(t) }
}
async function gemini(mime, b64, prompt) {
  if (!process.env.GEMINI_API_KEY) return null
  let model; try { const { pickModel } = await import('./llm'); model = process.env.GEMINI_VISION_MODEL || await pickModel() } catch { return null }
  const base = (process.env.ASSISTANT_GEMINI_BASE || 'https://generativelanguage.googleapis.com').replace(/\/$/, '')
  const r = await timed(`${base}/v1beta/models/${model}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ inline_data: { mime_type: mime, data: b64 } }, { text: prompt }] }], generationConfig: { temperature: 0 } }) })
  if (!r || !r.ok) return null
  const j = await r.json().catch(() => null); const t = j && (((j.candidates || [])[0] || {}).content || {}).parts?.map((p) => (p.thought ? '' : p.text || '')).join('')
  return t ? { text: t.trim(), by: 'Gemini' } : null
}
async function openaiStyle(base, key, models, mime, b64, prompt, label, extra = {}) {
  if (!key) return null
  for (const model of models) {
    const r = await timed(base + '/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key, ...extra },
      body: JSON.stringify({ model, temperature: 0, max_tokens: 4000, messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } }] }] }) })
    if (!r || !r.ok) continue
    const j = await r.json().catch(() => null), t = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content
    if (t) return { text: String(t).replace(/<think>[\s\S]*?<\/think>/g, '').trim(), by: label + ': ' + model }
  }
  return null
}
export async function readImage(dataUrl, purpose = 'describe') {
  const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''))
  if (!m) throw new Error('That isn’t an image we can read.')
  const [, mime, b64] = m, prompt = PROMPTS[purpose] || PROMPTS.describe
  const out = await gemini(mime, b64, prompt)
    || await openaiStyle(process.env.OLEX_BASE_OPENROUTER || 'https://openrouter.ai/api/v1', process.env.OPENROUTER_API_KEY, ['qwen/qwen3.8-27b:free', 'google/gemma-4-27b-it:free', 'openrouter/free'], mime, b64, prompt, 'OpenRouter', { 'HTTP-Referer': 'https://olexweb.com', 'X-Title': 'Olex AI' })
    || await openaiStyle(process.env.OLEX_BASE_ZAI || 'https://api.z.ai/api/paas/v4', process.env.ZAI_API_KEY, ['glm-4.6v-flash'], mime, b64, prompt, 'Z.ai')
  if (!out) throw new Busy('No image reader is available right now. Try again in a moment.')
  return out
}

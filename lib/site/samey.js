// "Has this already been posted?" One place that answers it for the blog, the Directory and anything else that publishes.
// Two titles are too close when they share most of their meaningful words (the same story from two news feeds, the same
// topic picked twice). Plain code, no AI: it can't be talked out of it. The AI gets the same lists as well, to catch
// repeats that use different words (lib/assistant/research.js, lib/site/dirnews.js).
const STOP = new Set(('a an the and or but of to in on for with at by from into over after before about as is are was were be been being it its this that these those you your we our they their he she his her i me my ' +
  'how what why when where which who whom can could should would will may might must do does did done not no yes so if then than too very more most less just only also still now new latest today here there out up down off ' +
  'guide guides practical tips tip way ways thing things explained explainer need needs know known what\'s get gets getting got make makes making made use uses using used step steps best top free vs versus ' +
  'update updates updated alert alerts safety warning news report reports says said say announces announced launch launches launched rolls rolling rollout users user people everyone ' +
  'small business businesses 2024 2025 2026 2027').split(/\s+/))
const SHORT = new Set(['ai', '3d', 'js', 'ui', 'ux', 'vr', 'ar', 'tv', 'pc'])   // short words that still carry the topic
// a rough root, so "flaws" matches "flaw" and "fixed" matches "fix"
const root = (w) => (w.length > 5 && w.endsWith('ing') ? w.slice(0, -3) : w.length > 4 && w.endsWith('ed') ? w.slice(0, -2) : w.length > 4 && w.endsWith('es') ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)
export function words(text) {
  const out = new Set()
  for (const raw of String(text || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9.]+/g, ' ').split(/\s+/)) {
    const w = raw.replace(/^\.+|\.+$/g, ''); if (!w || STOP.has(w)) continue
    if (/^\d+(\.\d+)*$/.test(w)) { out.add(w); continue }                       // version numbers and model numbers count (11, 27.2.1, 365)
    if (w.length < 3 && !SHORT.has(w)) continue
    const r = root(w.replace(/\./g, '')); if (!STOP.has(r)) out.add(r)
  }
  return out
}
// how alike two titles are: the share of the shorter one's meaningful words that the other also has
export function closeness(a, b) {
  const A = a instanceof Set ? a : words(a), B = b instanceof Set ? b : words(b)
  if (!A.size || !B.size) return { share: 0, shared: 0 }
  let n = 0; for (const w of A) if (B.has(w)) n++
  return { share: n / Math.min(A.size, B.size), shared: n }
}
// too close = at least 3 meaningful words in common, and they're at least 60% of the shorter title
export function tooClose(a, b, { share = 0.6, shared = 3 } = {}) { const c = closeness(a, b); return c.shared >= shared && c.share >= share }
// the first earlier item this one repeats (items: [{ title, ... }]); null when it's new
export function findRepeat(title, items, opts) {
  const W = words(title); if (W.size < 2) return null
  for (const it of items) if (it && it.title && tooClose(W, it.title, opts)) return it
  return null
}
// every pair of repeats in a list (for the admin's clean-up list); the earlier one (first in the list) is "keep"
export function repeatPairs(items, opts) {
  const sets = items.map((x) => words(x.title)), out = [], taken = new Set()
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    if (taken.has(j) || taken.has(i)) continue
    if (tooClose(sets[i], sets[j], opts)) { out.push({ keep: items[i], repeat: items[j] }); taken.add(j) }
  }
  return out
}

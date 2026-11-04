// A database address from Vercel or .env.local, tidied: values are easy to paste with extras that .env files forgive but
// Vercel keeps as-is (quotes, the name in front, Neon's "psql '...'" wrapper, a second line). If what's left still isn't a
// database address, the error names the exact setting, so the cause is obvious in the logs (no bare "Invalid URL").
export function tidyDbUrl(value, name) {
  let s = String(value || '').split(/\r?\n/)[0].trim()
  s = s.replace(/^export\s+/, '').replace(/^[A-Z][A-Z0-9_]*\s*=\s*/, '').replace(/^psql\s+/, '').trim()
  s = s.replace(/^['"`]+|['"`]+$/g, '').trim()
  const bad = () => new Error(`${name} isn’t a valid database address. In Vercel it must start with postgresql:// and have no quotation marks.`)
  if (!/^postgres(ql)?:\/\/\S+$/.test(s)) throw bad()
  try { return new URL(s) } catch { throw bad() }
}

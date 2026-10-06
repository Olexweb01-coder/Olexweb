// The 8-point Search checklist. Shared by the admin's Search panel and the assistant, so they always agree.
// Links written as [words](address) count as their words.
export const plain = (t) => String(t || '').replace(/\[([^\]]{1,120})\]\(([^)\s]{1,400})\)/g, '$1')
export function seoChecks({ keyword, title, description, body }) {
  const kw = (keyword || '').trim().toLowerCase(), st = title || '', sd = description || ''
  const blocks = (body || []).map((b) => ({ type: b.type, text: plain(b.text) }))
  const text = blocks.map((b) => b.text).join(' '), words = text.split(/\s+/).filter(Boolean).length
  const first = (blocks.find((b) => b.type === 'p') || {}).text || '', heads = blocks.filter((b) => b.type === 'h').map((b) => b.text.toLowerCase())
  const hits = kw ? text.toLowerCase().split(kw).length - 1 : 0, density = words ? (hits * kw.split(/\s+/).length) / words * 100 : 0
  return [
    [!!kw, 'A focus keyword is chosen'],
    [!!kw && st.toLowerCase().includes(kw), 'The keyword is in the search title'],
    [!!kw && first.toLowerCase().includes(kw), 'The keyword is in the first paragraph'],
    [!!kw && heads.some((h) => h.includes(kw)), 'The keyword is in at least one heading'],
    [st.length >= 30 && st.length <= 60, 'Search title is 30 to 60 characters'],
    [sd.length >= 110 && sd.length <= 155, 'Search description is 110 to 155 characters'],
    [words >= 600, `At least 600 words (now ${words})`],
    [words >= 300 && density <= 3, words < 300 ? 'Keyword use is checked once the article reaches 300 words' : density > 3 ? 'The keyword is overused: Google penalises stuffing' : 'The keyword is not overused', words >= 300 && density > 3],
  ]
}
export const checksPass = (c) => c.every(([ok, , warn]) => ok && !warn)

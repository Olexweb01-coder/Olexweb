// A stand-in for everything Olex Sales talks to (SALES_TEST_BASE=http://localhost:4570 and ASSISTANT_GEMINI_BASE=the same):
// Companies House (/ch), Serper (/serper), OpenStreetMap (/osm), PageSpeed (/psi), test business websites (/site/<domain>/),
// Gmail (/gmail/send), and Gemini for the writer. POST /control {ai: 'good'|'bad'|'badThenGood', reset}. GET /log.
import http from 'node:http'
let log = [], ai = 'good', aiCalls = 0
const send = (res, code, body, type = 'application/json') => { res.writeHead(code, { 'Content-Type': type }); res.end(type === 'application/json' ? JSON.stringify(body) : body) }
const page = (body, { viewport = true, year = 2026, extra = '' } = {}) => `<!doctype html><html><head>${viewport ? '<meta name="viewport" content="width=device-width">' : ''}<title>x</title></head><body>${body}${extra}<footer>© ${year} Business</footer></body></html>`
const SITES = {
  'slow-dentist.test': { '/': page('<h1>Bright Smiles Dental</h1><p>Call us on 512 555 0101.</p><a href="/contact">Contact us</a>'), '/contact': page('<p>Email <a href="mailto:info@slow-dentist.test">info@slow-dentist.test</a></p>') },
  'old-salon.test': { '/': page('<h1>Old Salon</h1><a href="mailto:hello@old-salon.test">Email</a>', { viewport: false, year: 2019 }) },
  'modern-clinic.test': { '/': page('<h1>Modern Clinic</h1><a href="https://calendly.com/x">Book online</a><a href="mailto:team@modern-clinic.test">e</a>') },
  'nomx-cafe.test': { '/': page('<h1>Cafe</h1><a href="mailto:hi@nomx-cafe.test">e</a>', { viewport: false }) },
  'nohttps-ledger.test': { '/': page('<h1>Ledger Accountants</h1><p>Write to enquiries@nohttps-ledger.test</p>') },
}
const PSI = { 'slow-dentist.test': 28, 'old-salon.test': 61, 'modern-clinic.test': 93, 'nomx-cafe.test': 70, 'nohttps-ledger.test': 74 }
const GOOD = (q) => ({ subject: 'bright smiles website on phones', body: `Hi,\n\nI was looking at the Bright Smiles site on my phone and it took a long time to load, and there's no way to book online. People searching on their phones often give up and call the next dentist instead. Would a quick idea on fixing both be useful?` })
const BAD = { subject: 'Re: quick question', body: 'I hope this finds you well! Check https://olexweb.com for more. We leverage cutting-edge synergy.' }
http.createServer((req, res) => {
  let body = ''; req.on('data', (c) => (body += c)); req.on('end', () => {
    const u = new URL(req.url, 'http://x'), p = u.pathname
    if (p === '/log') return send(res, 200, log)
    if (p === '/control') { const j = JSON.parse(body || '{}'); if (j.reset) { log = []; aiCalls = 0 } if (j.ai) { ai = j.ai; aiCalls = 0 } return send(res, 200, { ok: true }) }
    if (p === '/v1beta/models') return send(res, 200, { models: [{ name: 'models/gemini-9-flash', supportedGenerationMethods: ['generateContent'] }] })
    if (/:generateContent$/.test(p)) { aiCalls++; const d = ai === 'bad' || (ai === 'badThenGood' && aiCalls === 1) ? BAD : GOOD(); log.push({ kind: 'ai', n: aiCalls, prompt: JSON.parse(body).contents[0].parts.map((x) => x.text).join(' ').slice(0, 600), system: JSON.stringify(JSON.parse(body).systemInstruction || JSON.parse(body).system_instruction || '').slice(0, 3000) }); return send(res, 200, { candidates: [{ content: { parts: [{ text: JSON.stringify(d) }] } }] }) }
    if (p.startsWith('/ch/advanced-search/companies')) { log.push({ kind: 'ch-search', q: u.search }); return send(res, 200, { items: [
      { company_name: 'LEDGER ACCOUNTANTS LIMITED', company_number: '01234567', company_type: 'ltd', company_status: 'active', registered_office_address: { locality: 'Leeds' } },
      { company_name: 'SMITH PARTNERS', company_number: 'SO000111', company_type: 'limited-partnership', company_status: 'active', registered_office_address: { locality: 'Leeds' } }] }) }
    if (p.startsWith('/ch/search/companies')) { const q = (u.searchParams.get('q') || '').toLowerCase(); log.push({ kind: 'ch-confirm', q }); return send(res, 200, { items: q.includes('ledger') ? [{ title: 'LEDGER ACCOUNTANTS LIMITED', company_number: '01234567', company_type: 'ltd', company_status: 'active', address_snippet: 'Leeds' }] : [] }) }
    if (p === '/serper/places') { const j = JSON.parse(body); log.push({ kind: 'serper-places', q: j.q, gl: j.gl }); return send(res, 200, { places: [
      { title: 'Bright Smiles Dental', website: 'https://slow-dentist.test/', phoneNumber: '+1 512-555-0101', cid: 'c1' },
      { title: 'Old Salon', website: 'https://old-salon.test', cid: 'c2' }, { title: 'Modern Clinic', website: 'https://modern-clinic.test/', cid: 'c3' },
      { title: 'Nomx Cafe', website: 'https://nomx-cafe.test/', cid: 'c4' }, { title: 'No Site Barbers', phoneNumber: '+1 512-555-0199', cid: 'c5' },
      { title: 'On Yelp Only', website: 'https://www.yelp.com/biz/x', cid: 'c6' }] }) }
    if (p === '/serper/search') { const j = JSON.parse(body); log.push({ kind: 'serper-search', q: j.q }); return send(res, 200, { organic: j.q.toLowerCase().includes('ledger') ? [
      { title: 'Ledger Accountants - Companies House', link: 'https://find-and-update.company-information.service.gov.uk/company/01234567' }, { title: 'Ledger Accountants | Leeds accountants', link: 'https://nohttps-ledger.test/' }] : [] }) }
    if (p === '/osm') { log.push({ kind: 'osm' }); return send(res, 200, { elements: [{ type: 'node', id: 9, tags: { name: 'Corner Cafe', amenity: 'cafe', website: 'https://corner-cafe.test', phone: '+44 1904 000000', email: 'hello@corner-cafe.test', 'addr:city': 'York' } }] }) }
    if (p === '/psi') { const host = new URL(u.searchParams.get('url')).pathname.split('/')[2]; return send(res, 200, { lighthouseResult: { categories: { performance: { score: (PSI[host] || 80) / 100 } }, audits: { 'largest-contentful-paint': { numericValue: PSI[host] < 50 ? 9200 : 2100 } } } }) }
    if (p.startsWith('/site/')) { const [, , host, ...rest] = p.split('/'), path = '/' + rest.join('/'), s = SITES[host]; log.push({ kind: 'site', host, path }); if (s && s[path]) return send(res, 200, s[path], 'text/html'); return send(res, s ? 404 : 503, 'no', 'text/html') }
    if (p === '/gmail/send') { const j = JSON.parse(body); log.push({ kind: 'gmail', ...j }); return send(res, 200, { id: '<' + Date.now() + '@gmail.test>' }) }
    send(res, 404, { error: 'unknown ' + p })
  })
}).listen(4570)

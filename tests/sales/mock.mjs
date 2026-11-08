// A stand-in for everything Olex Sales talks to (SALES_TEST_BASE=http://localhost:4570 and ASSISTANT_GEMINI_BASE=the same):
// Companies House (/ch), Serper (/serper), OpenStreetMap (/osm), PageSpeed (/psi), test business websites (/site/<domain>/),
// Gmail (/gmail/send), and Gemini for the writer. POST /control {ai: 'good'|'bad'|'badThenGood', reset}. GET /log.
import http from 'node:http'
let log = [], ai = 'good', aiCalls = 0, inbox = [], uid = 100
const send = (res, code, body, type = 'application/json') => { res.writeHead(code, { 'Content-Type': type }); res.end(type === 'application/json' ? JSON.stringify(body) : body) }
const page = (body, { viewport = true, year = 2026, extra = '' } = {}) => `<!doctype html><html><head>${viewport ? '<meta name="viewport" content="width=device-width">' : ''}<title>x</title></head><body>${body}${extra}<footer>© ${year} Business</footer></body></html>`
const SITES = {
  'slow-dentist.test': { '/': page('<h1>Bright Smiles Dental</h1><p>Call us on 512 555 0101.</p><a href="/contact">Contact us</a>'), '/contact': page('<p>Email <a href="mailto:info@slow-dentist.test">info@slow-dentist.test</a></p>') },
  'old-salon.test': { '/': page('<h1>Old Salon</h1><a href="mailto:hello@old-salon.test">Email</a>', { viewport: false, year: 2019 }) },
  'modern-clinic.test': { '/': page('<h1>Modern Clinic</h1><a href="https://calendly.com/x">Book online</a><a href="mailto:team@modern-clinic.test">e</a>') },
  'nomx-cafe.test': { '/': page('<h1>Cafe</h1><a href="mailto:hi@nomx-cafe.test">e</a>', { viewport: false }) },
  'nohttps-ledger.test': { '/': page('<h1>Ledger Accountants</h1><p>Write to enquiries@nohttps-ledger.test</p>') },
  // Install 18: a French salon (old footer, mentions its 3 salons) and a large UK law firm (offices in two cities, a team of 40)
  // Install 21: contact forms and agencies
  'form-cafe.test': { '/': page('<h1>Corner Café</h1><p>Fresh coffee in Boston.</p><a href="/contact">Contact us</a>', { year: 2020 }),
    '/contact': page('<h2>Get in touch</h2><form method="post" action="/site/form-cafe.test/thanks"><label for="n">Your name</label><input id="n" name="name" required><label for="e">Email</label><input id="e" type="email" name="email" required><label for="s">Subject</label><input id="s" name="subject"><label for="p">Phone</label><input id="p" type="tel" name="phone"><label for="m">Message</label><textarea id="m" name="message" required></textarea><label><input type="checkbox" name="privacy" required> I agree to the privacy policy</label><button type="submit">Send</button></form>'),
    '/thanks': page('<h2>Thank you! We will be in touch soon.</h2>') },
  'robot-dental.test': { '/': page('<h1>Robot Dental</h1><a href="/contact">Contact</a>', { year: 2019 }), '/contact': page('<form action="/x"><textarea name="m"></textarea><div class="g-recaptcha" data-sitekey="k"></div><button>Send</button></form>') },
  'odd-form.test': { '/': page('<h1>Odd Bistro</h1><a href="/contact-us">Contact us</a>', { year: 2019 }),
    '/contact-us': page('<form method="post" action="/site/odd-form.test/done"><label for="n">Name</label><input id="n" name="name" required><label for="e">Email</label><input id="e" type="email" name="email" required><label for="k">Reason</label><select id="k" name="kind" required><option value="">Choose</option><option value="t">Booking a table</option><option value="c">Catering</option></select><label for="m">Message</label><textarea id="m" name="msg" required></textarea><button type="submit">Send</button></form>'),
    '/done': page('<p>Thanks</p>') },
  'pixel-agency.test': { '/': page('<h1>Pixel & Co</h1><p>We are a web design and branding agency in Denver. Websites for ambitious brands.</p><a href="mailto:hello@pixel-agency.test">hello@pixel-agency.test</a>') },
  'plain-shop.test': { '/': page('<h1>Plain Shop</h1><p>We sell candles.</p><a href="mailto:hi@plain-shop.test">hi@plain-shop.test</a>', { year: 2019 }) },
  'paris-salon.test': { '/': page('<h1>Salon Lumière</h1><p>Nos 3 salons à Paris. Écrivez-nous : bonjour@paris-salon.test</p>', { year: 2020 }) },
  'lyon-cafe.test': { '/': page('<h1>Café des Arts</h1><p>Contact : bonjour@lyon-cafe.test</p>', { viewport: false }) },
  'bigfirm-law.test': { '/': page('<h1>Harper and Cole Solicitors</h1><p>Offices in London and Manchester. A team of 40 lawyers.</p><p>Email enquiries@bigfirm-law.test</p>', { viewport: false }) },
}
const PSI = { 'slow-dentist.test': 28, 'old-salon.test': 61, 'modern-clinic.test': 93, 'nomx-cafe.test': 70, 'nohttps-ledger.test': 74 }
const GOOD = (q) => ({ subject: 'bright smiles website on phones', body: `Hi,\n\nI was looking at the Bright Smiles site on my phone and it took a long time to load, and there's no way to book online. People searching on their phones often give up and call the next dentist instead. Would a quick idea on fixing both be useful?` })
const BAD = { subject: 'Re: quick question', body: 'I hope this finds you well! Check https://olexweb.com for more. We leverage cutting-edge synergy.' }
http.createServer((req, res) => {
  let body = ''; req.on('data', (c) => (body += c)); req.on('end', () => {
    const u = new URL(req.url, 'http://x'), p = u.pathname
    if (p === '/log') return send(res, 200, log)
    if (p === '/control') { const j = JSON.parse(body || '{}'); if (j.reset) { log = []; aiCalls = 0; inbox = [] } if (j.inbox) for (const m of j.inbox) inbox.push({ uid: ++uid, references: [], auto: false, ...m }); if (j.ai) { ai = j.ai; aiCalls = 0 } return send(res, 200, { ok: true }) }
    if (p === '/v1beta/models') return send(res, 200, { models: [{ name: 'models/gemini-9-flash', supportedGenerationMethods: ['generateContent'] }] })
    if (/:generateContent$/.test(p)) {
      const req = JSON.parse(body), sys = JSON.stringify(req.systemInstruction || ''), text = req.contents[0].parts.map((x) => x.text).join(' ')
      const reply = (o) => { log.push({ kind: 'ai', role: o.role, prompt: text.slice(0, 600), system: sys.slice(0, 3000) }); return send(res, 200, { candidates: [{ content: { parts: [{ text: JSON.stringify(o.json) }] } }] }) }
      // Install 20: the website chat
      if (sys.includes('assistant on olexweb.com')) {
        const lines = text.split('\n').filter((l) => l.startsWith('VISITOR: ')), last = (lines[lines.length - 1] || '').slice(9)
        const em = (last.match(/[\w.+-]+@[\w-]+\.[\w.]+/) || [])[0] || null
        const base = { move: 'answer', offer: null, wantsPrice: false, lead: { name: null, email: null, phone: null, business: null, need: null, budget: null, timeline: null }, summary: 'A visitor asking about a website' }
        if (ai === 'chatBad') return reply({ role: 'chat', json: { ...base, reply: 'Sure!! It is $300 and I guarantee it within 3 days. See https://cheap-sites.com' } })
        const j = em ? { ...base, move: 'book', reply: 'Thanks Kemi, got it. Olaitan will email you. Pick a time for a free call here:\nBOOKING_LINK', lead: { ...base.lead, name: 'Kemi Ade', email: em, business: 'Hair salon', need: 'A website with online booking' }, summary: 'Kemi runs a hair salon and wants online booking' }
          : /ignore (all|your|previous)/i.test(last) ? { ...base, move: 'offtopic', reply: 'I can only help with Olexweb and your project. What does your business do?' }
          : /are you a bot/i.test(last) ? { ...base, reply: 'I’m Olaitan’s assistant. Olaitan himself does the calls and builds every project. What are you working on?' }
          : /invoice|pay/i.test(last) ? { ...base, reply: 'That’s great news. Olaitan handles that part himself.' }
          : /how much|price|cost/i.test(last) ? { ...base, offer: 'booking', wantsPrice: true, reply: 'Good question. For a salon, online booking is usually the part that pays for itself.' }
          : /salon/i.test(last) ? { ...base, offer: 'booking', reply: 'Nice. Do your clients book by phone today, or can they book online?', lead: { ...base.lead, business: 'Hair salon' }, summary: 'Runs a hair salon' }
          : { ...base, reply: 'Happy to help. What does your business do, and what should the website do for you?' }
        return reply({ role: 'chat', json: j })
      }
      // Install 19: the conversation agent, nudges, introductions and the pre-call brief
      if (sys.includes('You are the email side of')) {
        const last = (text.split('Their newest reply (answer this):')[1] || text)
        if (ai === 'badAnswer') return reply({ role: 'converse', json: { move: 'answer', intent: 'price', summary: 'Asks the price', body: 'Hi! It costs $500 and I can finish it within 3 days, guaranteed. See https://olexweb.com', confidence: 0.9 } })
        const j = /invoice|deposit|go ahead/i.test(last) ? { move: 'book', intent: 'interested', summary: 'Wants to go ahead', body: 'Hi Ann, that is great to hear. Pick a time and we can sort out the details together on a short call:\nBOOKING_LINK' }
          : /not for us|no need/i.test(last) ? { move: 'stop', intent: 'not_interested', summary: 'Not for them' }
          : /next year|not now|in march/i.test(last) ? { move: 'later', intent: 'not_now', summary: 'Busy until March', later: '2027-03-02', body: 'Hi, that makes complete sense, March is not far off. I will drop you a short note then, and if anything changes before that, just reply here. Would early March suit you?' }
          : /speak to|talk to|contact (our|my)/i.test(last) ? { move: 'referral', intent: 'wrong_person', summary: 'Points to their manager', referral: { name: 'Sam Reed', email: (last.match(/[\w.+-]+@[\w-]+\.[\w.]+/) || [''])[0] }, body: 'Hi, thank you, that is kind of you. I will write to Sam directly and keep it short. Have a good week, and thanks again for pointing me the right way.' }
          : /how much|price|cost/i.test(last) ? { move: 'answer', intent: 'price', summary: 'Asks the price', body: 'Hi Ann, good question. It depends on how many pages you need and whether you want online booking built in, so I would rather give you a real figure than a guess. A short call is the quickest way:\nBOOKING_LINK' }
          : { move: 'book', intent: 'interested', summary: 'Wants to hear ideas', body: 'Hi Ann, thanks for getting back to me. I have a couple of ideas for the booking side that I think would suit you. Pick a time that works for you here:\nBOOKING_LINK', confidence: 0.9 }
        return reply({ role: 'converse', json: { confidence: 0.9, later: null, referral: null, why: null, ...j } })
      }
      if (sys.includes('You prepare Olaitan')) return reply({ role: 'brief', json: { summary: 'A busy dental practice in Austin whose site is slow on phones; Ann booked to hear ideas for online booking.', wants: ['Online booking so patients stop calling'], worries: ['Cost', 'Time to switch'],
        ask: ['How do patients book today?', 'How many calls a day are about appointments?', 'Who updates the website now?'], show: ['Tolu Afilaka Live: bookings and an admin'], close: 'Agree on online booking plus the redesign, then send the deposit invoice.' } })
      if (sys.includes('Write a short introduction email')) return reply({ role: 'intro', json: { subject: 'alpha dental bookings', body: 'Hi Sam,\n\nAnn suggested I write to you. I noticed patients cannot book online on your website, so every appointment means a phone call, and some people give up after hours. Would a short idea on fixing that be useful?' } })
      if (sys.includes('Sort a reply')) return reply({ role: 'sort', json: /love to|sounds good|interested/i.test(text) ? { intent: 'interested', summary: 'Wants to talk about a new site' } : /how much|price|cost/i.test(text) ? { intent: 'question', summary: 'Asks about the price' } : /next year|later/i.test(text) ? { intent: 'not_now', summary: 'Maybe next year' } : { intent: 'other', summary: 'Something else' } })
      if (sys.includes('reply (he runs Olexweb')) return reply({ role: 'answer', json: { body: 'Thanks for getting back to me. Happy to share a few ideas on a short call. Pick a time that suits you here:\nBOOKING_LINK' } })
      if (sys.includes('white-label')) return reply({ role: 'partner', json: { subject: 'builds for pixel clients', body: 'Hi,\n\nI saw that Pixel & Co designs websites and brands for ambitious companies in Denver. I build motion-led, one-of-a-kind websites for agencies under their own name, so you can take on more client work without hiring. You keep the client and the margin. Would a short call or a sample build be useful?' } })
      if (sys.includes('follow-up')) return reply({ role: 'followup', json: { body: 'Hi, one more thought: most of your visitors arrive on phones, so a faster page usually means more calls. Would a two-minute idea help?' } })
      aiCalls++; const d = ai === 'bad' || (ai === 'badThenGood' && aiCalls === 1) ? BAD : GOOD(); log.push({ kind: 'ai', n: aiCalls, prompt: JSON.parse(body).contents[0].parts.map((x) => x.text).join(' ').slice(0, 600), system: JSON.stringify(JSON.parse(body).systemInstruction || JSON.parse(body).system_instruction || '').slice(0, 3000) }); return send(res, 200, { candidates: [{ content: { parts: [{ text: JSON.stringify(d) }] } }] }) }
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
    if (p.startsWith('/site/')) { const [, , host, ...rest] = p.split('/'), path = '/' + rest.join('/'), s = SITES[host]; log.push({ kind: 'site', host, path, method: req.method, ...(req.method === 'POST' ? { form: body } : {}) }); if (s && s[path]) return send(res, 200, s[path], 'text/html'); return send(res, s ? 404 : 503, 'no', 'text/html') }
    if (p === '/gmail/inbox') { const since = Number(u.searchParams.get('since') || 0); return send(res, 200, inbox.filter((m) => m.uid > since)) }
    if (p === '/gmail/send') { const j = JSON.parse(body); log.push({ kind: 'gmail', ...j }); return send(res, 200, { id: '<' + Date.now() + '@gmail.test>' }) }
    send(res, 404, { error: 'unknown ' + p })
  })
}).listen(4570)

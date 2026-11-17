import fs from 'node:fs'
// Stand-in for Google during tests: OAuth (with real PKCE checking), YouTube Data API v3, YouTube Analytics v2.
import http from 'node:http'
import { createHash } from 'node:crypto'
const PORT = 4555, log = []
const S = { codes: {}, challenges: {}, revokedRefresh: false, revokeCalls: 0, issued: new Set(), noRefresh: false, noChannel: false }
const ARTICLES = {                                     // the Directory's mock news articles (install 16): each long enough, with quotable sentences
  booster: { title: 'Starship booster caught at its launch tower', text: ['A SpaceX Super Heavy booster flew back and was caught at the same launch tower it lifted off from.', 'The giant mechanical arms closed around the booster as it slowed to a hover above the pad.', 'Catching the booster lets SpaceX fly it again within days instead of building a new one.', 'Engineers said the landing was within a few metres of the target on the tower.', 'The next flight will try to catch the upper stage as well, which has never been done.', 'Reusing rockets this way could make launches much cheaper for satellites and missions.'] },
  email1971: { title: 'History of email', text: ['In 1971 Ray Tomlinson sent the first email between two computers on the ARPANET network.', 'He chose the @ sign to separate the name of the user from the name of the computer.', 'The first message was a test, and he later said he could not remember what it said.', 'Within a few years email made up most of the traffic on the network.', 'Today billions of people send email every day for work, school and family.', 'The same basic idea of an address with the @ sign is still used in every email address.', 'Before that, people could only leave messages for others using the same computer.', 'Sending a message to a different machine across a network was the new part, and it changed how people work.', 'Tomlinson was an engineer at a company called BBN, which helped build the early network.', 'He was later added to the Internet Hall of Fame for his work.'] },
  drafts: { title: 'WhatsApp adds message drafts for everyone', text: ['WhatsApp is rolling out message drafts to everyone on Android and iPhone.', 'When you leave a chat without sending, your unfinished message now stays in the box with a Draft label.', 'The feature works in both personal and group chats.', 'You do not need to turn anything on, just update the app from the Play Store or App Store.', 'Drafts also show at the top of your chat list so you can find them quickly later on.', 'The company said the change is reaching all users over the next few weeks, starting this week in several countries.', 'People who switch between many conversations at work are expected to benefit most from the change.'] },
  space: { title: 'How to free up space on an Android phone', text: ['Open Settings and tap Storage to see what is using space on your phone.', 'Photos and videos usually take the most room, so back them up before deleting anything.', 'Clearing the cache of large apps can free several gigabytes without losing your data.', 'Uninstall apps you have not opened in months to recover more space quickly.', 'Files by Google can find duplicate files and large downloads you no longer need.', 'Moving media to a memory card is another option if your phone has a card slot available.', 'Restart the phone afterwards so the system can tidy up temporary files properly.'] },
  scam: { title: 'Fake delivery text scam is going round', text: ['Scammers are sending text messages that claim a parcel could not be delivered.', 'The message asks you to tap a link and pay a small fee to rebook the delivery.', 'The link leads to a fake page that steals your card details and bank login.', 'Real delivery companies do not ask for payment through a random text link.', 'If you already entered your card details, call your bank immediately and block the card.', 'You can report the message to your mobile network and then delete it from your phone.', 'Always check a delivery directly on the official website or app of the company instead.'] },
  copy: { title: 'Copycat news about phone batteries', text: ['Phone batteries last longer when you avoid charging them to full every single night.', 'Keeping the charge between twenty and eighty percent reduces wear on the battery cells.', 'Heat is the biggest enemy of batteries, so avoid charging the phone under your pillow.', 'Many phones now include an optimised charging setting that learns your daily routine.', 'Turning that setting on can noticeably extend the life of your battery over a year.', 'Replacing an old battery is often cheaper than buying a whole new phone outright.', 'Use the charger that came with your phone or a trusted brand for safe charging.'] },
}
const VIDS = [
  ['af5r1bfqzH8', 'Secret websites you should know (Part 8)', 'PT31S', 74, '2026-04-28T15:00:00Z'],
  ['1anYrUfp7CI', 'Secret websites you should know (Part 7)', 'PT29S', 105, '2026-04-27T15:00:00Z'],
  ['fMA31AyHTtA', 'Secret websites you should know (Part 6)', 'PT33S', 161, '2026-04-26T15:00:00Z'],
  ['afKsIoJghQw', 'Secret websites you should know (Part 4)', 'PT27S', 224, '2026-04-24T15:00:00Z'],
  ['Zp9wrIUUCog', '5 AI Apps Every Student NEEDS', 'PT45S', 114, '2026-04-18T15:00:00Z'],
  ['_ZH_LCaHLcI', 'AI Agents Explained', 'PT6M12S', 36, '2026-04-19T15:00:00Z'],
]
const send = (res, code, body, headers = {}) => { res.writeHead(code, { 'Content-Type': 'application/json', ...headers }); res.end(typeof body === 'string' ? body : JSON.stringify(body)) }
const body = (req) => new Promise((r) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => r(new URLSearchParams(b))) })
const authed = (req) => S.issued.has((req.headers.authorization || '').replace('Bearer ', ''))
const day = (o) => new Date(Date.now() - o * 86400e3).toISOString().slice(0, 10)

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x'), p = u.searchParams
  log.push(req.method + ' ' + u.pathname)
  if (u.pathname === '/_state') return send(res, 200, { ...S, issued: [...S.issued], log })
  if (u.pathname === '/_set') { for (const [k, v] of p) S[k] = v === 'true' ? true : v === 'false' ? false : isNaN(+v) ? v : +v; return send(res, 200, { ok: true }) }
  if (u.pathname === '/indexnow' && req.method === 'POST') { let raw = ''; for await (const ch of req) raw += ch; S.indexnow = (S.indexnow || []).concat([JSON.parse(raw)]); return send(res, 200, '') }
  if (u.pathname === '/_indexnow') return send(res, 200, { calls: S.indexnow || [] })
  // ---- stand-in Meta (Facebook Login for Business + Pages Reels API) ----
  if (u.pathname === '/v21.0/dialog/oauth') { S.fbDialog = Object.fromEntries(p); return send(res, 302, '', { Location: p.get('redirect_uri') + '?code=fbcode&state=' + encodeURIComponent(p.get('state')) }) }
  if (u.pathname === '/v21.0/oauth/access_token') { if (p.get('code') === 'fbcode' && p.get('client_secret') === 'meta-secret') return send(res, 200, { access_token: 'fb-user-short' }); if (p.get('fb_exchange_token') === 'fb-user-short') return send(res, 200, { access_token: 'fb-user-long' }); return send(res, 400, { error: { message: 'bad code', code: 100 } }) }
  if (u.pathname === '/v21.0/me/accounts') return p.get('access_token') === 'fb-user-long' ? send(res, 200, { data: [{ id: '777', name: 'Olexweb', access_token: 'page-token-777', tasks: ['CREATE_CONTENT', 'MANAGE'] }] }) : send(res, 400, { error: { message: 'bad token', code: 190 } })
  if (/^\/v21\.0\/[\w-]+\/video_insights$/.test(u.pathname)) {                       // Reel plays (install 13)
    S.insightCalls = (S.insightCalls || 0) + 1
    if (S.insightsDenied) return send(res, 400, { error: { message: '(#10) Requires read_insights permission', code: 10 } })
    const id = u.pathname.split('/')[2]; return send(res, 200, { data: [{ name: 'blue_reels_play_count', period: 'lifetime', values: [{ value: (S.reelViews && S.reelViews[id]) || Number(S.reelViewsAll) || 100 }] }] })
  }
  if ((u.pathname === '/v21.0/777/photos' || u.pathname === '/v21.0/777/feed' || /^\/v21\.0\/777_\d+\/comments$/.test(u.pathname)) && req.method === 'POST') {   // Install 29: the daily story
    let raw = ''; for await (const ch of req) raw += ch; const f = new URLSearchParams(raw)
    if (f.get('access_token') !== 'page-token-777') return send(res, 400, { error: { message: 'Invalid OAuth access token.', code: 190 } })
    if (S.fbBlock) return send(res, 400, { error: { message: 'You’re temporarily blocked from performing this action.', code: 368 } })
    if (u.pathname.endsWith('/photos')) {
      const url = f.get('url'), r = await fetch(url).catch(() => null), ok = r && r.status === 200 && /image\/png/.test(r.headers.get('content-type') || ''), bytes = ok ? (await r.arrayBuffer()).byteLength : 0
      S.fbPhotos = (S.fbPhotos || []).concat([{ url, published: f.get('published'), ok, bytes }]); if (!ok) return send(res, 400, { error: { message: 'Could not fetch the image', code: 324 } })
      return send(res, 200, { id: 'ph' + S.fbPhotos.length })
    }
    if (u.pathname.endsWith('/feed')) { const media = [...f.keys()].filter((k) => k.startsWith('attached_media')).map((k) => JSON.parse(f.get(k)).media_fbid); S.fbFeed = (S.fbFeed || []).concat([{ message: f.get('message'), media }]); return send(res, 200, { id: '777_' + (1000 + S.fbFeed.length) }) }
    S.fbComments = (S.fbComments || []).concat([{ on: u.pathname.split('/')[2], message: f.get('message') }]); return send(res, 200, { id: 'c' + S.fbComments.length })
  }
  if (u.pathname === '/v21.0/777/video_reels' && req.method === 'POST') {
    let raw = ''; for await (const ch of req) raw += ch; const f = new URLSearchParams(raw)
    if (f.get('access_token') !== 'page-token-777') return send(res, 400, { error: { message: 'Invalid OAuth access token.', code: 190 } })
    if (S.fbBlock) return send(res, 400, { error: { message: 'You’re temporarily blocked from performing this action.', code: 368 } })
    if (f.get('upload_phase') === 'start') { S.fbN = (S.fbN || 0) + 1; return send(res, 200, { video_id: 'fbv' + S.fbN, upload_url: 'x' }) }
    if (f.get('upload_phase') === 'finish') { S.fbPosts = (S.fbPosts || []).concat([{ video_id: f.get('video_id'), description: f.get('description'), state: f.get('video_state') }]); return send(res, 200, { success: true }) }
  }
  if (u.pathname.startsWith('/video-upload/v21.0/') && req.method === 'POST') { const chunks = []; for await (const c of req) chunks.push(c); const b = Buffer.concat(chunks)
    if (req.headers.authorization !== 'OAuth page-token-777') return send(res, 400, { error: { message: 'bad token', code: 190 } })
    S.fbUploads = (S.fbUploads || []).concat([{ id: u.pathname.split('/').pop(), bytes: b.length, said: Number(req.headers.file_size) }]); return send(res, 200, { success: true }) }
  if (u.pathname === '/_fb') return send(res, 200, { posts: S.fbPosts || [], uploads: S.fbUploads || [], dialog: S.fbDialog || null })
  if (u.pathname === '/_metas') return send(res, 200, { metas: (S.sessions || []).map((x) => x.meta) })
  if (u.pathname === '/_privacy') { S.privacy = S.privacy || {}; S.privacy[p.get('id')] = p.get('p'); return send(res, 200, { ok: true }) }
  if (u.pathname === '/auth') {                       // the consent screen: approve straight away
    const code = 'code-' + Math.random().toString(36).slice(2)
    S.codes[code] = { redirect: p.get('redirect_uri'), challenge: p.get('code_challenge'), scope: p.get('scope') }
    return send(res, 302, '', { Location: p.get('redirect_uri') + '?code=' + code + '&state=' + encodeURIComponent(p.get('state')) + '&scope=' + encodeURIComponent(p.get('scope')) })
  }
  if (u.pathname === '/token' && req.method === 'POST') {
    const b = await body(req)
    if (b.get('client_id') !== 'test-client' || b.get('client_secret') !== 'test-secret') return send(res, 401, { error: 'invalid_client' })
    if (b.get('grant_type') === 'authorization_code') {
      const c = S.codes[b.get('code')]; delete S.codes[b.get('code')]
      if (!c) return send(res, 400, { error: 'invalid_grant', error_description: 'code unknown or used' })
      if (c.redirect !== b.get('redirect_uri')) return send(res, 400, { error: 'redirect_uri_mismatch' })
      if (createHash('sha256').update(b.get('code_verifier') || '').digest('base64url') !== c.challenge) return send(res, 400, { error: 'invalid_grant', error_description: 'PKCE verifier does not match' })
      const at = 'at-' + Math.random().toString(36).slice(2); S.issued.add(at)
      return send(res, 200, { access_token: at, expires_in: 3599, token_type: 'Bearer', scope: c.scope, ...(S.noRefresh ? {} : { refresh_token: 'rt-SECRET-REFRESH-TOKEN-123' }) })
    }
    if (b.get('grant_type') === 'refresh_token') {
      if (S.revokedRefresh || b.get('refresh_token') !== 'rt-SECRET-REFRESH-TOKEN-123') return send(res, 400, { error: 'invalid_grant', error_description: 'Token has been expired or revoked.' })
      const at = 'at-' + Math.random().toString(36).slice(2); S.issued.add(at)
      return send(res, 200, { access_token: at, expires_in: 3599, token_type: 'Bearer' })
    }
  }

  // ---------- Ideas: sources, sites, AI, YouTube search ----------
  const H = 'http://localhost:4555', at = (n) => `http://${n}.test:4555/site/${n}`
  if (u.pathname === '/src/show') return send(res, 200, { hits: [
    { title: 'Show HN: PaletteForge – generate accessible colour palettes from any image', url: at('paletteforge'), points: 640 },
    { title: 'Show HN: FreeMovies – stream every new film', url: at('freemovies'), points: 900 },
    { title: 'Show HN: Clicky – a button that counts clicks', url: at('clicky'), points: 120 },
    { title: 'Show HN: Ghost tool (site is down)', url: at('down'), points: 300 },
    { title: 'Show HN: PaletteForge mirror', url: at('paletteforge') + '?ref=hn', points: 50 } ] })
  if (u.pathname === '/src/top') return send(res, 200, { hits: [ { title: 'Chrome ships native CSS masonry layout', url: at('masonry'), points: 1500 } ] })
  if (u.pathname === '/src/github') return send(res, 200, { items: [ { name: 'shotcut-ai', full_name: 'dev/shotcut-ai', description: 'Turn any screenshot into editable layers', html_url: at('shotcut'), homepage: '', stargazers_count: 9400 } ] })

  // ---- the Directory's news sources (install 16) ----
  if (u.pathname === '/dirfeed/news' || u.pathname === '/dirfeed/safe') {
    const now = new Date().toUTCString(), old = new Date(Date.now() - 9 * 86400e3).toUTCString()
    const item = (t, path, d = now) => `<item><title>${t}</title><link>http://news.test:4555/news/${path}</link><pubDate>${d}</pubDate><description>${t}. More inside.</description></item>`
    const items = u.pathname === '/dirfeed/news'
      ? [item('WhatsApp adds message drafts for everyone', 'drafts'), item('Startup raises $10 million for delivery robots', 'raise'), item('How to free up space on an Android phone', 'space'), item('Copycat news about phone batteries', 'copy'), item('Old news about a phone launch', 'oldnews', old)]
      : [item('Fake delivery text scam is going round', 'scam')]
    return send(res, 200, `<?xml version="1.0"?><rss><channel><title>${u.pathname.endsWith('news') ? 'TechNews' : 'SafeNet'}</title>${items.join('')}</channel></rss>`, { 'Content-Type': 'application/rss+xml' })
  }
  if (u.pathname.startsWith('/ph/i/v0/e')) {                               // Install 30: a stand-in for PostHog's capture API
    let raw = ''; for await (const ch of req) raw += ch; try { S.ph = (S.ph || []).concat([JSON.parse(raw)]) } catch {} return send(res, 200, { status: 1 })
  }
  if (u.pathname === '/dirfeed/space') {                                  // Install 27: a big tech moment
    const now = new Date().toUTCString()
    return send(res, 200, `<?xml version="1.0"?><rss><channel><title>SpaceNews</title><item><title>SpaceX booster lands back on the pad it launched from</title><link>http://news.test:4555/news/booster</link><pubDate>${now}</pubDate><description>The booster came home. More inside.</description></item></channel></rss>`, { 'Content-Type': 'application/rss+xml' })
  }
  if (u.pathname.startsWith('/otd/')) {                                     // Install 27: Wikipedia's "On this day"
    S.otd = (S.otd || 0) + 1
    return send(res, 200, { events: [
      { text: 'Ray Tomlinson sends the first email between two computers on a network.', year: 1971, pages: [{ extract: 'Email history.', content_urls: { desktop: { page: 'http://news.test:4555/news/email1971' } } }] },
      { text: 'A new king is crowned in a small kingdom.', year: 1802, pages: [{ extract: 'A coronation.', content_urls: { desktop: { page: 'http://news.test:4555/news/king' } } }] }] })
  }
  if (u.pathname.startsWith('/news/')) {
    const a = ARTICLES[u.pathname.slice(6)]; if (!a) return send(res, 404, 'no')
    return send(res, 200, `<!doctype html><html><head><title>${a.title}</title></head><body><article><h1>${a.title}</h1>${a.text.map((x) => `<p>${x}</p>`).join('')}</article></body></html>`, { 'Content-Type': 'text/html' })
  }
  if (u.pathname === '/v21.0/777/feed' && req.method === 'POST') {          // a link post on the Page
    let raw = ''; for await (const ch of req) raw += ch; const p = new URLSearchParams(raw)
    S.fbFeed = (S.fbFeed || []).concat([{ link: p.get('link'), message: p.get('message') }]); return send(res, 200, { id: '777_' + S.fbFeed.length })
  }
  if (u.pathname === '/feed/curated') {
    const a = (n, t) => `&lt;a href="${at(n)}"&gt;${t}&lt;/a&gt;`
    return send(res, 200, `<?xml version="1.0"?><rss><channel><title>Mock Picks</title>
<item><title>Five finds this week</title><description>Short summary without links.</description>
<content:encoded>&lt;p&gt;${a('gradientlab', 'Gradient Lab')} makes gorgeous gradients. ${a('fontpair', 'FontPair')} pairs fonts. Watch &lt;a href="https://www.youtube.com/watch?v=abc"&gt;this video&lt;/a&gt;, read &lt;a href="http://feeds.test:4555/our-post"&gt;our post&lt;/a&gt;, or &lt;a href="${at('tldraw')}"&gt;here&lt;/a&gt;.&lt;/p&gt;</content:encoded></item>
</channel></rss>`, { 'Content-Type': 'application/rss+xml' })
  }
  if (u.pathname.startsWith('/site/')) {
    if (S.siteDelay) { S.siteN = (S.siteN || 0) + 1; await new Promise((r) => setTimeout(r, S.siteDelay * (1 + (S.siteN % 3)))) }   // fast, medium, slow in turn
    const k = u.pathname.slice(6)
    if (k === 'down') return send(res, 500, 'error', { 'Content-Type': 'text/html' })
    const PAGES = { paletteforge: ['PaletteForge – accessible palettes', 'Upload an image and get WCAG-checked colour palettes. Free, no sign up.'],
      freemovies: ['FreeMovies', 'Watch new cinema releases free. No account. HD streams of every film.'],
      clicky: ['Clicky', 'A button. Click it. The number goes up.'],
      masonry: ['CSS masonry is here', 'Chrome now supports grid-template-rows: masonry natively. Try the demos.'],
      shotcut: ['Shotcut AI', 'Drop a screenshot, get editable layers for Figma. Open source.'],
      squoosh: ['Squoosh', 'Compress images in your browser. Free and open source, by Google.'],
      tldraw: ['tldraw', 'A free whiteboard in your browser. No sign up.'],
      gradientlab: ['Gradient Lab', 'Make beautiful mesh gradients and export them free.'],
      fontpair: ['FontPair', 'Find Google Font pairings that work together. Free.'],
      dirtool: ['DirTool: flowcharts from plain words', 'DirTool turns rough notes into clean flowcharts in your browser. Type your steps in plain words and DirTool draws the diagram for you. It is free to use with no sign up required. You can export your diagram as PNG or SVG and share a link with your team. DirTool works on phones, tablets and computers. Paid plans add team folders and custom branding for businesses. Students use DirTool to plan essays and projects, and freelancers use it to explain processes to clients.'],
      fibtool: ['FibTool', 'FibTool turns rough notes into clean flowcharts in your browser. Type your steps in plain words and FibTool draws the diagram for you. It is free to use with no sign up required. You can export your diagram as PNG or SVG and share a link with your team. FibTool works on phones, tablets and computers. Paid plans add team folders and custom branding for businesses. Students use FibTool to plan essays and projects, and freelancers use it to explain processes to clients.'] }
    if (k === 'bakery' || k === 'bakery/about') {                           // Install 28: a client site Olexweb built
      const sec = (h, c, t) => `<section style="padding:120px 40px;background:${c}"><h2>${h}</h2><p>${t}</p><img src="/site/pixel.png" width="300" height="200" alt=""></section>`
      if (k === 'bakery/about') return send(res, 200, '<!doctype html><html><head><title>About · Mama’s Bakery</title></head><body><h1>About Mama’s Bakery</h1><p>Family bakery in Ibadan since 2009. We bake every morning at 5am with local flour.</p></body></html>', { 'Content-Type': 'text/html' })
      return send(res, 200, `<!doctype html><html><head><title>Mama’s Bakery · fresh bread in Ibadan</title></head><body style="margin:0;font-family:sans-serif">
        <header><a href="/site/bakery/about">About us</a> <a href="https://elsewhere.example/">Instagram</a></header>
        <section style="height:900px;background:#f6d7a7"><h1>Fresh bread every morning</h1><p>Mama’s Bakery bakes bread, pastries and celebration cakes in Ibadan.</p><button>Accept cookies</button></section>
        ${sec('Our menu', '#fff3e0', 'Agege bread ₦1,200. Meat pie ₦800. Chocolate cake from ₦25,000.')}${sec('Order a celebration cake', '#ffe0e6', 'Choose the size and flavour, pick a collection day, and we bake it fresh.')}${sec('Find us', '#e0f2ff', 'Ring Road, Ibadan. Open 7am to 7pm.')}
        <footer><p>© Mama’s Bakery</p></footer></body></html>`, { 'Content-Type': 'text/html' })
    }
    if (k === 'pixel.png') { res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')) }
    const pg = PAGES[k]; if (!pg) return send(res, 404, 'nope', { 'Content-Type': 'text/html' })
    return send(res, 200, `<html><head><title>${pg[0]}</title><meta name="description" content="${pg[1]}"></head><body><h1>${pg[0]}</h1><p>${pg[1]}</p></body></html>`, { 'Content-Type': 'text/html; charset=utf-8' })
  }
  if (u.pathname === '/v1beta/models') return send(res, 200, { models: [{ name: 'models/gemini-9-flash', supportedGenerationMethods: ['generateContent'] }] })
  if (u.pathname.startsWith('/v1beta/models/') && req.method === 'POST') {
    let raw = ''; for await (const ch of req) raw += ch
    const b = JSON.parse(raw), prompt = b.contents[0].parts[0].text
    S.aiCalls = (S.aiCalls || 0) + 1
    if (prompt.startsWith('Business: a ') && prompt.includes('Rewrite these')) {     // Install 23: Poor vs Rich lines (vsBad: too long, the code must fall back)
      S.vsPrompts = (S.vsPrompts || []).concat([prompt])
      const lines = [...prompt.matchAll(/^\d+\. \[[a-z]+\] (.*)$/gm)].map((m) => m[1].replace('prints five hundred flyers', 'prints a stack of flyers'))
      if (S.vsBad) lines[3] = 'This line is far far far far far far far far far far far far far far far far too long to say.'
      return send(res, 200, { candidates: [{ content: { parts: [{ text: JSON.stringify({ lines }) }] } }] })
    }
    if (prompt.startsWith('Write ONE original')) {                          // Install 22: a real story for the long video
      const d = JSON.parse(fs.readFileSync('/home/claude/yt-test/tale-sample.json', 'utf8'))
      if (S.taleBrand && !S.taleBrandDone) { S.taleBrandDone = true; d.chapters[0].beats.find((b) => b.phone).phone.from = 'Barclays' }   // a real bank: the checks must catch it and ask again
      S.talePrompts = (S.talePrompts || []).concat([prompt.slice(0, 30000)])
      return send(res, 200, { candidates: [{ content: { parts: [{ text: JSON.stringify(d) }] } }] })
    }
    if (prompt.includes('Draft the landing page')) {          // Pages & links: a draft that keeps facts from the notes only
      const given = /14 Nov/.test(prompt), out = { title: 'Build With AI', kicker: 'Free webinar', tagline: 'Watch an idea become a live website in one hour.', intro: 'A practical session.', learnTitle: 'What you’ll see',
        learn: ['Planning with AI', 'Building live', 'Publishing it', 'Your questions'], whoFor: 'Students and freelancers.', cta: 'Save my seat', preview: 'A free live session.', hostBio: 'Olaitan builds with AI.',
        faq: [{ q: 'Is it free?', a: 'Yes.' }], when: given ? '2026-11-14T19:00' : '', minutes: given ? 60 : 0, platform: given ? 'Google Meet' : '[add the platform]', venue: '', address: '' }
      return send(res, 200, { candidates: [{ content: { parts: [{ text: JSON.stringify(out) }] } }] })
    }
    if (prompt.includes('HOW THESE STORIES WORK')) {                       // Install 29: the daily Facebook story
      S.storyPrompts = (S.storyPrompts || []).concat([prompt]); const again = prompt.includes('YOUR LAST TRY WAS REJECTED'), tayo = /Tayo’s World/.test(prompt), ep = (prompt.match(/EPISODE (\d+)/) || [])[1]
      const body = ['Tayo had ₦2,000 left, 9% battery, and a client waiting for a logo by 6pm.', 'The design app on his laptop flashed a red box: “Your free trial has ended. Pay $12 to continue.”', '“Twelve dollars?” he said to the empty room. “In this economy?”', 'He called Chidinma. She laughed so hard her jollof nearly burnt. “Tayo, just use a free one. Stop forming big man.”', 'So he did. He opened a free design site in his browser, dragged his sketch in, and fixed the colours in ten minutes.', 'At 5:48pm he sent the logo. At 5:51pm the client replied: “Perfect. Sending the balance now.”', 'Then his mum called. “Tayo, have you eaten?” He looked at the ₦2,000. “Yes ma. Today, I’m rich.”', 'He laughed, plugged in his phone, and made a list of every app he was paying for without thinking. It was longer than he expected.', 'Tomorrow, Baba Landlord is coming for the rent, and Segun has news he “can’t wait to share”.', 'What’s one app you stopped paying for and never missed?']
      const post = (again || !tayo ? '' : 'See it here: https://example.com\n\n') + body.join('\n\n')
      const out = { title: tayo ? 'Tayo and the twelve dollar trial ' + (ep || '') : (/True tech story/.test(prompt) ? 'The booster comes home' : 'The bakery nobody could find'), post,
        slides: ['Tayo had ₦2,000 left and a logo due by 6pm', '“Your free trial has ended. Pay $12 to continue.”', 'Chidinma: “Just use a free one. Stop forming big man.”', 'A free design site, ten minutes, done.', '5:51pm: “Perfect. Sending the balance now.”'],
        comment: 'x', summary: 'Tayo dodged a $12 subscription with a free design site and got paid. Baba Landlord and Segun are coming tomorrow.' }
      if (/True tech story/.test(prompt)) out.post = 'The booster fell out of the sky at a speed no one would believe, and then it stopped.\n\n' + ['A SpaceX Super Heavy booster flew back and was caught at the same launch tower it lifted off from.', 'The giant mechanical arms closed around it as it slowed to a hover.', 'Catching it means SpaceX can fly it again within days instead of building a new one.', 'Engineers said it came down within a few metres of the target.', 'Next, they want to catch the upper stage too, which has never been done.', 'Reusing rockets like this could make every launch much cheaper, for satellites and for missions far from Earth.', 'For years people said rockets were too big and too fast to land, let alone be caught. This one proved them wrong in front of millions watching live.', 'It is the kind of moment people will remember where they were when they saw it.'].join('\n\n') + (again ? '\n\nWould you ever ride on a rocket that had already flown before?' : '\n\nWould you ever ride on a rocket that had already flown 10 times?')
      return send(res, 200, { candidates: [{ content: { parts: [{ text: JSON.stringify(out) }] } }] })
    }
    if (/^Olexweb built this website\./.test(prompt)) {                       // Install 28: a portfolio project from a link
      S.portfolioPrompt = prompt
      const heads = [...(prompt.split('HEADINGS ON THE HOME PAGE (exact):')[1] || '').split('\n')[0].matchAll(/“([^”]+)”/g)].map((m) => m[1])
      const out = { name: /Mama’s Bakery/.test(prompt) ? 'Mama’s Bakery' : 'Some site', kind: 'Client website', role: 'Design, build and launch', text: 'Mama’s Bakery bakes fresh bread and cakes in Ibadan. The site lets customers see the menu with prices and order a cake for collection.',
        built: ['Menu with prices', 'Cake order form', 'WhatsApp chat button', 'Fast on phones'], result: 'Customers can now order a celebration cake online.', best: [heads[1], heads[2], 'A heading that is not on the page'].filter(Boolean) }
      return send(res, 200, { candidates: [{ content: { parts: [{ text: JSON.stringify(out) }] } }] })
    }
    if (/^For each item, decide its kind/.test(prompt)) {                    // the Directory's judge (install 16)
      S.dirJudged = (S.dirJudged || 0) + 1
      const items = [...prompt.matchAll(/^(\d+)\. \[(.+?)\] (.+?) ::/gm)].map((m) => {
        const t = m[3]
        if (/^On this day/.test(t)) return { i: Number(m[1]), kind: /email/i.test(t) ? 'story' : 'skip', topic: 'history', score: /email/i.test(t) ? 86 : 10, why: 'Tech history.' }
        if (/SpaceX/.test(t)) return { i: Number(m[1]), kind: 'story', topic: 'space', score: 93, why: 'Everyone is talking about it.' }
        return { i: Number(m[1]), kind: /raises/i.test(t) ? 'skip' : /^How to/i.test(t) ? 'guide' : /scam/i.test(t) ? 'alert' : 'update', ...(/WhatsApp/.test(t) ? { topic: 'apps' } : {}), score: /raises/i.test(t) ? 20 : /scam/i.test(t) ? 90 : 82, why: 'Useful to everyday people.' } })
      return send(res, 200, { candidates: [{ content: { parts: [{ text: JSON.stringify({ items }) }] } }] })
    }
    if (/^Write an Olexweb Directory post/.test(prompt)) {                     // a Directory post (install 16): facts quoted from the mock article
      const key = Object.keys(ARTICLES).find((k) => prompt.includes('/news/' + k)), a = ARTICLES[key], copy = key === 'copy'
      S.dirPosts = (S.dirPosts || []).concat([key])
      const pad = (x, n) => (x + ' It is short, clear and checked against the source for you.').slice(0, n)
      const out = { title: a.title.slice(0, 66), metaDescription: pad(a.title + ': what it means for you, who it affects and the simple steps to take today.', 140),
        oneLiner: 'What it is, why it matters, and what to do next.', summary: copy ? a.text[0] + ' ' + a.text[1] : 'This is a change worth knowing about for anyone who relies on a phone every day. Here is what it means in plain words, who it affects, and the few steps to take now.',
        points: ['It is available now for most people.', 'It takes a minute to check.', 'Nothing to pay for this.', 'It works on most phones.'],
        whyItMatters: 'Most people in Nigeria and across Africa do their work, chats and banking on one phone, so small changes like this save time and trouble every day.',
        whatToDo: ['Open the app and check you have the latest version.', 'Look for the new option in the menu.', 'Try it once so you know where it is.'],
        facts: a.text.slice(0, 3).map((x) => ({ claim: 'From the article.', quote: x.replace(/\.$/, '') })), faq: [{ q: 'Is this free?', a: 'The article does not mention any cost.' }, { q: 'Do I need to do anything?', a: 'Check that your app is up to date.' }],
        tags: ['phones', 'apps', 'tips'], thin: false, unsafe: false }
      return send(res, 200, { candidates: [{ content: { parts: [{ text: JSON.stringify(out) }] } }] })
    }
    if (prompt.includes('Write the Olexweb Directory page')) {      // Directory: DirTool = honest; FibTool = invents a quote (must be caught)
      const fib = prompt.includes('Name: FibTool'), N = fib ? 'FibTool' : 'DirTool'
      const out = { title: N + ': flowcharts from plain words', metaDescription: N + ' turns rough notes into clean flowcharts in your browser. Free to use with no sign up, for students and freelancers.',
        oneLiner: 'Type your steps in plain words and get a clean flowchart.', summary: N + ' turns rough notes into clean flowcharts in your browser. You type the steps in plain words and it draws the diagram, then you export it or share a link. It suits students planning projects and freelancers explaining a process.',
        facts: [{ claim: 'It draws diagrams from plain words.', quote: 'Type your steps in plain words and ' + N + ' draws the diagram for you.' }, { claim: 'Free with no sign-up.', quote: 'It is free to use with no sign up required.' },
          { claim: 'Exports PNG or SVG.', quote: fib ? 'Trusted by over 2 million teams worldwide.' : 'You can export your diagram as PNG or SVG and share a link with your team.' }],
        pricing: { status: 'freemium', claim: 'Free to use; paid plans add team features.', quote: 'Paid plans add team folders and custom branding for businesses.' },
        whoFor: ['Students planning projects', 'Freelancers explaining processes'], howToStart: ['Open the site.', 'Type your steps, one per line.', 'Export as PNG or SVG, or share the link.'],
        ourTake: 'A quick way to turn messy notes into a diagram people understand. Worth it for one-off flowcharts; teams may want the paid folders.', goodFor: ['Quick flowcharts', 'Explaining a process'], watchOut: ['Team features need a paid plan'],
        faq: [{ q: 'Is ' + N + ' free?', a: 'Yes, it is free to use with no sign-up; paid plans add team folders.' }, { q: 'How do I use ' + N + '?', a: 'Type your steps in plain words and it draws the diagram.' }, { q: 'Can I export?', a: 'Yes, as PNG or SVG.' }],
        tags: ['diagrams', 'flowcharts', 'productivity'], thin: false, unsafe: false }
      return send(res, 200, { candidates: [{ content: { parts: [{ text: JSON.stringify(out) }] } }] })
    }
    if (prompt.includes('Suggest 3 different options')) return send(res, 200, { candidates: [{ content: { parts: [{ text: JSON.stringify({ options: ['Option one', 'Option two', 'Option three'] }) }] } }] })
    if (S.aiDelay) await new Promise((r) => setTimeout(r, S.aiDelay))
    if (S.aiDown) return send(res, 503, { error: { message: 'high demand' } })
    let out


    if (/Write chapter (\d+) of (\d+): (.+?) \(/.test(prompt)) {
      const m = prompt.match(/Write chapter (\d+) of (\d+): (.+?) \(/), name = m[3]
      S.longCalls = (S.longCalls || []).concat([name])
      const page = (prompt.match(/THE SITE'S OWN PAGE[^\n]*\n([\s\S]*?)\n\nRules:/) || [])[1] || ''
      const quote = (page.split('. ')[1] || page).split('.')[0].trim()
      const host = (prompt.match(/\((https?:\/\/[^)]+)\)/) || [])[1] || ''
      const L = (t) => t
      out = { chapter: name + ': worth a look', claims: [{ claim: 'What ' + name + ' does', quote }], scenes: [
        { type: 'talk', pose: 'thinking', text: L(`This next one is ${name}, and it is the kind of site you will keep coming back to for real everyday work.`) },
        { type: 'demo', pose: 'pointing', text: L('Here is the homepage, clean and simple, and you can start straight away without any account or setup at all.'), capture: 'homepage' },
        { type: 'demo', pose: 'pointing', text: L('Watch what happens when I use the main tool once, the result appears right in front of you in seconds.'), capture: 'use the main tool' },
        { type: 'infographic', pose: 'thinking', text: L('It runs in the browser and keeps things simple for anyone who tries it.'), chips: ['In the browser', 'Simple'] },
        { type: 'demo', pose: 'pointing', text: L('Then you can copy the result into your own project, share it, or keep going and try something new.'), capture: 'copy the result' },
        { type: 'talk', pose: 'thinking', text: L('It saves time on the boring parts, so you can spend your energy on the parts that matter most to you.') },
        { type: 'url', pose: 'pointing', text: L('You can find it at the address on screen, so pause the video if you want to try it right now.'), big: host.replace(/^https?:\/\//, '').split('/')[0] }] }
      return send(res, 200, { candidates: [{ content: { parts: [{ text: JSON.stringify(out) }] } }] })
    }
    if (/^You plan one long animated story/.test(prompt)) {                             // the long story's plan (install 13)
      S.sagaPlans = (S.sagaPlans || 0) + 1
      const sites = [...prompt.matchAll(/^(\d+)\. (.+?) \(http/gm)].map((m) => ({ n: Number(m[1]), name: m[2] }))
      out = { titles: ['I Stopped Paying for 5 Things in One Day', 'My worst day, saved by websites', 'The day the internet saved me'], intro: 'Today was a total disaster from start to finish. And every single time, a website saved me.',
        outro: 'Which one would you use first? Tell me in the comments, and subscribe for tomorrow.',
        chapters: sites.map((x, i) => ({ site: x.n, time: `${8 + i * 2}:15 AM`.replace(/^(1[2-9]|2\d):15 AM/, (m, h) => `${h - 12 || 12}:15 PM`), title: 'Disaster ' + (i + 1), situation: 'Something goes wrong and ' + x.name + ' fixes it.' })) }
      return send(res, 200, { candidates: [{ content: { parts: [{ text: JSON.stringify(out) }] } }] })
    }
    if (/^Write chapter \d+ of \d+ of his day/.test(prompt)) {                             // a long-story chapter (install 13)
      const name = prompt.match(/saves him in this chapter: (.+?) \(/)[1], repair = /YOUR PREVIOUS CHAPTER failed/.test(prompt)
      S.chapterCalls = (S.chapterCalls || []).concat([name + (repair ? ' (repair)' : '')])
      const page = (prompt.match(/(?:THE SITE'S OWN PAGE|THE SOURCE)[^\n]*\n([\s\S]*?)\n\n"beats"/) || [])[1] || ''
      const quote = (page.split('. ')[1] || page).split('.')[0].trim()
      const beats = [
        { scene: 'yell', emotion: 'panic', text: 'No! Not now!' }, { scene: 'timejump', emotion: 'calm', text: '' },
        { scene: 'desk', emotion: 'happy', text: 'Morning coffee, quiet inbox, everything is finally under control today.', note: 'MONDAY' },
        { scene: 'desk', emotion: 'calm', text: 'I even finished my slides early for once in my whole life.' },
        { scene: 'buzz', emotion: 'curious', text: 'Wait, a message?' },
        { scene: 'read', emotion: 'shock', text: 'The meeting moved to right now?!', from: 'Boss', line1: 'Meeting now', line2: 'Bring slides', big: 'NOW' },
        { scene: 'panic', emotion: 'panic', text: 'My slides are a mess and the logo is blurry everywhere!' },
        { scene: 'cry', emotion: 'cry', text: 'Why does this always happen to me on a Monday?' },
        { scene: 'idea', emotion: 'smug', text: 'Hold on. There has to be a faster way.' },
        { scene: 'reveal', emotion: 'excited', text: name + '! It fixes exactly this in seconds.' },
        { scene: 'proof', emotion: 'smug', text: 'Look, it works right in the browser.', cards: ['Works in the browser', 'Nothing to install'] },
        { scene: 'proof', emotion: 'happy', text: 'No setup, no account, just open it and go.' },
        { scene: 'proof', emotion: 'smug', text: 'Even my boss would be impressed by this one.' },
        { scene: 'celebrate', emotion: 'excited', text: 'Slides? Saved!', stamp: 'SAVED' }]
      const good = { beats, again: 'Wait. Is that my boss?!', ask: 'Would you have panicked too? Tell me below.', claims: [{ claim: 'What ' + name + ' does', quote }],
        titles: ['When the meeting moves to right now…', 'My slides were a disaster', 'This site saved my meeting'], description: 'The meeting moved. The slides were a mess. Then this.' }
      out = /BadChapter/.test(name) ? { ...good, beats: beats.slice(2) } : good
      return send(res, 200, { candidates: [{ content: { parts: [{ text: JSON.stringify(out) }] } }] })
    }
    if (/^The site: .+? \(https?:/.test(prompt) && /"beats": the story/.test(prompt)) {     // story Shorts (install 12)
      const name = prompt.match(/^The site: (.+?) \(/)[1], repair = /YOUR PREVIOUS STORY failed/.test(prompt)
      S.storyCalls = (S.storyCalls || []).concat([name + (repair ? ' (repair)' : '')])
      const page = (prompt.match(/THE SITE'S OWN PAGE[^\n]*\n([\s\S]*?)\n\nStep 1/) || [])[1] || ''
      const quote = (page.split('. ')[1] || page).split('.')[0].trim(), host = (prompt.match(/Find it: ([^"\s]+)/) || [])[1] || 'site'
      const ideas = [...Array(10)].map((_, i) => ({ situation: 'Situation ' + (i + 1) + ' where ' + name + ' helps', relatable: 5 + (i === 3 ? 4 : 0), surprise: 5, payoff: 6 }))
      const beats = [
        { scene: 'yell', emotion: 'panic', text: 'No! No no no no!' },
        { scene: 'timejump', emotion: 'calm', text: '' },
        { scene: 'desk', emotion: 'happy', text: 'Day thirty of my free trial. Life is good!', note: 'DAY 30' },
        { scene: 'buzz', emotion: 'curious', text: 'Hm? An email?' },
        { scene: 'read', emotion: 'shock', text: 'Your free trial ends today?!', from: 'Photo app', line1: 'Your free', line2: 'trial ends', big: 'TODAY' },
        { scene: 'cry', emotion: 'cry', text: 'I can’t pay every month just to edit photos!' },
        { scene: 'idea', emotion: 'smug', text: 'Wait. There has to be a better way.' },
        { scene: 'reveal', emotion: 'excited', text: name + '! It does exactly what I needed.' },
        { scene: 'proof', emotion: 'smug', text: 'And it works right in the browser.', cards: ['Works in the browser', 'Nothing to install'] },
        { scene: 'celebrate', emotion: 'excited', text: 'Trial? Cancelled!', stamp: 'CANCELLED' },
        { scene: 'again', emotion: 'shock', text: 'Wait. Another one?!' }]
      const good = { ideas, chosen: 3, beats, claims: [{ claim: 'What ' + name + ' does', quote }],
        titles: ['When your free trial ends today…', 'I almost paid for this', 'This free site saved me'], description: 'He almost paid. Then he found it.\nFind it: ' + host, hashtags: ['#shorts', '#relatable', '#animation'] }
      const broken = { ...good, beats: beats.slice(2) }                                    // no yell, no time jump: critical
      const fixable = { ...good, beats: [{ ...beats[0], text: 'No no no no no no no no this cannot be happening to me!' }, ...beats.slice(1)] }
      out = /BadStory/.test(name) ? broken : /FixStory/.test(name) && !repair ? fixable : good
      return send(res, 200, { candidates: [{ content: { parts: [{ text: JSON.stringify(out) }] } }] })
    }
    if (/Write the Short about/.test(prompt)) {
      const name = prompt.match(/Write the Short about (.+?) \(/)[1], repair = /YOUR PREVIOUS SCRIPT failed/.test(prompt)
      S.scriptCalls = (S.scriptCalls || []).concat([name + (repair ? ' (repair)' : '')])
      const page = (prompt.match(/THE SITE'S OWN PAGE[^\n]*\n([\s\S]*?)\n\nRules:/) || [])[1] || ''
      const quote = (page.split('. ')[1] || page).split('.')[0].trim()
      const host = (prompt.match(/Find it: ([^"\s]+)/) || [])[1] || 'site'
      const good = { scenes: [
        { type: 'hook', pose: 'shocked', text: 'This free site does something you will use every week.', big: 'BOOKMARK THIS' },
        { type: 'demo', pose: 'pointing', text: 'Open it and you land right here.', capture: 'homepage' },
        { type: 'demo', pose: 'pointing', text: 'Try it once and watch what happens.', capture: 'use the main tool once' },
        { type: 'infographic', pose: 'thinking', text: 'No account, no download, no catch at all.', chips: ['Free', 'In the browser'] },
        { type: 'talk', pose: 'thinking', text: 'It saves you real time on boring jobs.' },
        { type: 'demo', pose: 'pointing', text: 'Then copy the result straight into your work.', capture: 'copy the result' },
        { type: 'url', pose: 'pointing', text: 'Here is where to find it.', big: host },
        { type: 'cta', pose: 'waving', text: 'Follow for a new free find every day.' } ],
        claims: [{ claim: 'What ' + name + ' does', quote }],
        titles: ['This free site will save you hours', 'Bookmark this before you forget it', 'The free tool nobody told you about'],
        description: 'A genuinely useful free site.\nFind it: ' + host, hashtags: ['#shorts', '#freetools', '#productivity'] }
      const flawed = { ...good, scenes: [{ ...good.scenes[0], text: 'This free site does something you will absolutely love using every single week from now on.' }, ...good.scenes.slice(1, 4),
        { type: 'talk', pose: 'thinking', text: 'Used by 2 million designers worldwide.' }, ...good.scenes.slice(5)],
        claims: [...good.claims, { claim: 'Used by 2 million designers', quote: 'Trusted by 2 million designers' }], titles: ['The best free site of 2026', ...good.titles.slice(1)] }
      const stubborn = /Gradient Lab|FontPair/.test(name)
      out = stubborn || !repair && !/tldraw/.test(name) ? flawed : good
      return send(res, 200, { candidates: [{ content: { parts: [{ text: JSON.stringify(out) }] } }] })
    }
    if (/Suggest 10 evergreen/.test(prompt)) out = { sites: [ { name: 'Squoosh', url: at('squoosh'), what: 'image compression' }, { name: 'tldraw', url: at('tldraw'), what: 'whiteboard' }, { name: 'Invented', url: 'http://invented.test:4555/site/doesnotexist', what: 'made up' } ] }
    else {
      const cands = [...prompt.matchAll(/^#(\d+) \[[^\]]*\] (.*)$/gm)].map((m) => ({ n: +m[1], t: m[2] }))
      S.judged = (S.judged || []).concat(cands.map((c) => c.t))
      out = { ideas: cands.map(({ n, t }) => {
        const nm = t.split(/[:–]/)[0].trim()
        const bad = /FreeMovies/.test(t), thin = /Clicky/.test(t), news = /masonry/i.test(t)
        const cat = /PaletteForge|Gradient Lab|FontPair/.test(t) ? 'creativity' : /tldraw/.test(t) ? 'productivity' : /Squoosh/.test(t) ? 'tech' : /shotcut/i.test(t) ? 'dev' : news ? 'update' : 'fun'
        return { n, name: nm, what: 'What ' + nm + ' does, plainly.', hook: 'This free site does ' + nm, why: bad ? 'Piracy.' : 'Saves real time.', risks: 'none', category: cat,
          value: thin ? 3 : news ? 6 : /FontPair/.test(t) ? 7 : 9, wow: bad || /Gradient Lab/.test(t) ? 9 : 8, reach: /Squoosh|tldraw/.test(t) ? 9 : 7, free: 9, demo: 8, trust: bad ? 2 : 9 } }) }
    }
    return send(res, 200, { candidates: [{ content: { parts: [{ text: JSON.stringify(out) }] } }] })
  }

  if (/^\/repos\/[^/]+\/[^/]+\/actions\/workflows\/(render|shots)\.yml\/dispatches$/.test(u.pathname) && req.method === 'POST') {
    let raw = ''; for await (const ch of req) raw += ch
    S.dispatches = (S.dispatches || []).concat([{ path: u.pathname, auth: req.headers.authorization, body: JSON.parse(raw) }])
    if (S.ghDown) return send(res, 401, { message: 'Bad credentials' })
    res.writeHead(204); return res.end()
  }
  if (u.pathname === '/revoke') { S.revokeCalls++; return send(res, 200, {}) }
  if (!authed(req)) return send(res, 401, { error: { code: 401, message: 'Invalid Credentials' } })
  if (u.pathname === '/youtube/v3/channels') return send(res, 200, { items: S.noChannel ? [] : [{ id: 'UCW_CpkVYb6Z_ijQqNTiJthQ',
    snippet: { title: 'Adebayo Olaitan', customUrl: '@olexweb', thumbnails: { default: { url: 'https://yt3.ggpht.com/test=s88' } } },
    statistics: { subscriberCount: '41', viewCount: '2417', videoCount: String(VIDS.length), hiddenSubscriberCount: false }, contentDetails: { relatedPlaylists: { uploads: 'UUW_uploads' } } }] })
  if (u.pathname === '/youtube/v3/playlistItems') {           // two pages, to test paging
    const first = !p.get('pageToken'), slice = first ? VIDS.slice(0, 4) : VIDS.slice(4)
    return send(res, 200, { items: slice.map((v) => ({ contentDetails: { videoId: v[0] } })), ...(first ? { nextPageToken: 'p2' } : {}) })
  }


  if (u.pathname === '/upload/youtube/v3/thumbnails/set' && req.method === 'POST') {     // Install 22: custom thumbnails
    const chunks = []; for await (const ch of req) chunks.push(ch); const buf = Buffer.concat(chunks)
    S.thumbs = (S.thumbs || []).concat([{ videoId: u.searchParams.get('videoId'), bytes: buf.length, jpeg: buf[0] === 0xff && buf[1] === 0xd8, type: req.headers['content-type'] }])
    if (S.thumbRefuse) return send(res, 403, { error: { message: 'The authenticated user doesnt have permissions to upload and set custom video thumbnails.' } })
    return send(res, 200, { items: [{ default: { url: 'https://i.ytimg.com/x.jpg' } }] })
  }
  if (u.pathname === '/upload/youtube/v3/videos' && req.method === 'POST') {
    let raw = ''; for await (const ch of req) raw += ch
    if (S.quota) return send(res, 403, { error: { code: 403, message: 'The request cannot be completed because you have exceeded your quota.', errors: [{ reason: 'quotaExceeded' }] } })
    S.sessions = S.sessions || []; const n = S.sessions.length
    S.sessions.push({ meta: JSON.parse(raw), total: Number(req.headers['x-upload-content-length']), data: [], len: 0 })
    res.writeHead(200, { Location: 'http://localhost:4555/upload/session/' + n }); return res.end()
  }
  if (u.pathname.startsWith('/upload/session/') && req.method === 'PUT') {
    const ss = S.sessions[Number(u.pathname.split('/').pop())]; const chunks = []; for await (const c of req) chunks.push(c)
    if (!ss) return send(res, 404, { error: { message: 'upload session not found' } })   // like YouTube: an unknown or expired session
    const cr = req.headers['content-range'] || '', range = () => (ss.len ? { Range: 'bytes=0-' + (ss.len - 1) } : {})
    if (/^bytes \*\//.test(cr)) { res.writeHead(308, range()); return res.end() }
    const m = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(cr); if (!m || Number(m[1]) !== ss.len) return send(res, 400, { error: { message: 'bad range ' + cr + ' at ' + ss.len } })
    if (S.failOnce && ss.len > 0) { S.failOnce = false; return send(res, 503, { error: { message: 'backend error' } }) }
    const b = Buffer.concat(chunks); ss.data.push(b); ss.len += b.length; S.uploadedBytes = ss.len
    if (ss.len >= ss.total) { S.uploaded = Buffer.concat(ss.data).toString('base64').length; S.uploadMd5 = (await import('node:crypto')).createHash('md5').update(Buffer.concat(ss.data)).digest('hex')
      return send(res, 200, { id: 'ytNew' + S.sessions.length, status: { privacyStatus: 'private', ...(ss.meta.status.publishAt ? { publishAt: ss.meta.status.publishAt } : {}) } }) }
    res.writeHead(308, range()); return res.end()
  }
  if (u.pathname === '/youtube/v3/search') {
    S.searches = (S.searches || 0) + 1
    const qn = (p.get('q') || '').toLowerCase()
    if (p.get('videoDuration') === 'short' && p.get('order') === 'viewCount') { S.niche = (S.niche || 0) + 1   // best-time research: 10 niche Shorts per term
      return send(res, 200, { items: Array.from({ length: 10 }, (_, i) => ({ id: { videoId: 'nc' + S.niche + '_' + i }, snippet: { channelId: 'otherchan', title: 'Niche ' + i } })) }) }
    const items = /squoosh/.test(qn) ? ['sq1', 'sq2', 'sq3', 'sq4'].map((id) => ({ id: { videoId: id }, snippet: { title: 'Squoosh is amazing ' + id, description: '' } })) : []
    return send(res, 200, { items })
  }
  if (u.pathname === '/youtube/v3/videos') {
    const ids = p.get('id').split(',')
    if (ids[0].startsWith('nc')) { const H = [18, 18, 18, 11, 11, 6, 6, 20, 20, 13], V = { 18: 50000, 20: 20000, 11: 8000, 13: 6000, 6: 1500 }
      return send(res, 200, { items: ids.map((id) => { const i = Number(id.split('_')[1]), age = 2 + (i % 5), at = new Date(Date.now() - age * 86400e3); at.setUTCHours(H[i], 5, 0, 0)
        const realAge = (Date.now() - at.getTime()) / 86400e3; return { id, snippet: { publishedAt: at.toISOString(), channelId: 'otherchan' }, statistics: { viewCount: String(Math.round(V[H[i]] * Math.max(1, realAge))) } } }) }) }
    if (p.get('part') === 'status,statistics') return send(res, 200, { items: ids.map((id) => ({ id, status: { privacyStatus: (S.privacy || {})[id] || 'private' }, statistics: { viewCount: '12' } })) })
    if (ids[0].startsWith('sq')) return send(res, 200, { items: ids.map((id, i) => ({ id, snippet: { title: 'Squoosh is amazing', channelTitle: 'BigTech' }, statistics: { viewCount: String([900000, 120000, 70000, 3000][i] || 10) } })) })
    return send(res, 200, { items: VIDS.filter((v) => ids.includes(v[0])).map((v) => ({ id: v[0], snippet: { title: v[1], publishedAt: v[4], thumbnails: { medium: { url: `https://i.ytimg.com/vi/${v[0]}/mqdefault.jpg` } } },
      contentDetails: { duration: v[2] }, statistics: { viewCount: String(v[3]), likeCount: String(Math.round(v[3] / 14)), commentCount: String(Math.round(v[3] / 60)) }, status: { privacyStatus: 'public' } })) })
  }
  if (u.pathname === '/v2/reports') {
    if (p.get('ids') !== 'channel==MINE') return send(res, 400, { error: { message: 'bad ids' } })
    if (p.get('dimensions') === 'day') {
      const m = p.get('metrics').split(','), rows = []
      for (let o = 40; o >= 2; o--) { const v = o < 30 && o > 18 ? 40 + ((o * 37) % 70) : 2 + (o % 5); rows.push([day(o), v, v * 0.42, 55 + (o % 9), o % 6 === 0 ? 2 : 0, o % 13 === 0 ? 1 : 0, Math.round(v / 12), o % 4 === 0 ? 1 : 0]) }
      return send(res, 200, { columnHeaders: ['day', ...m].map((name) => ({ name })), rows })
    }
    if (p.get('dimensions') === 'country') return send(res, 200, { columnHeaders: [{ name: 'country' }, { name: 'views' }], rows: [['NG', 600], ['US', 250], ['GB', 150]] })
    if (p.get('dimensions') === 'video') {
      const m = p.get('metrics').split(',')
      return send(res, 200, { columnHeaders: ['video', ...m].map((name) => ({ name })), rows: VIDS.map((v, i) => [v[0], v[3], v[3] * 0.45, [71, 64, 88, 93, 52, 38][i], i % 3, i === 3 ? 4 : 1]) })
    }
  }
  send(res, 404, { error: { message: 'not mocked: ' + u.pathname } })
}).listen(PORT, () => console.log('mock google on ' + PORT))

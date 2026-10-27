// Stand-in for Google during tests: OAuth (with real PKCE checking), YouTube Data API v3, YouTube Analytics v2.
import http from 'node:http'
import { createHash } from 'node:crypto'
const PORT = 4555, log = []
const S = { codes: {}, challenges: {}, revokedRefresh: false, revokeCalls: 0, issued: new Set(), noRefresh: false, noChannel: false }
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
    const pg = PAGES[k]; if (!pg) return send(res, 404, 'nope', { 'Content-Type': 'text/html' })
    return send(res, 200, `<html><head><title>${pg[0]}</title><meta name="description" content="${pg[1]}"></head><body><h1>${pg[0]}</h1><p>${pg[1]}</p></body></html>`, { 'Content-Type': 'text/html; charset=utf-8' })
  }
  if (u.pathname === '/v1beta/models') return send(res, 200, { models: [{ name: 'models/gemini-9-flash', supportedGenerationMethods: ['generateContent'] }] })
  if (u.pathname.startsWith('/v1beta/models/') && req.method === 'POST') {
    let raw = ''; for await (const ch of req) raw += ch
    const b = JSON.parse(raw), prompt = b.contents[0].parts[0].text
    S.aiCalls = (S.aiCalls || 0) + 1
    if (prompt.includes('Draft the landing page')) {          // Pages & links: a draft that keeps facts from the notes only
      const given = /14 Nov/.test(prompt), out = { title: 'Build With AI', kicker: 'Free webinar', tagline: 'Watch an idea become a live website in one hour.', intro: 'A practical session.', learnTitle: 'What you’ll see',
        learn: ['Planning with AI', 'Building live', 'Publishing it', 'Your questions'], whoFor: 'Students and freelancers.', cta: 'Save my seat', preview: 'A free live session.', hostBio: 'Olaitan builds with AI.',
        faq: [{ q: 'Is it free?', a: 'Yes.' }], when: given ? '2026-11-14T19:00' : '', minutes: given ? 60 : 0, platform: given ? 'Google Meet' : '[add the platform]', venue: '', address: '' }
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

  if (/^\/repos\/[^/]+\/[^/]+\/actions\/workflows\/render\.yml\/dispatches$/.test(u.pathname) && req.method === 'POST') {
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

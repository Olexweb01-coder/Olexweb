// Renders the database lists into exactly the markup the approved pages use. Every piece of text is escaped,
// so nothing typed in the admin can ever run as code on the public site.
import 'server-only'

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const safeUrl = (u) => { try { const x = new URL(u); return ['https:', 'http:'].includes(x.protocol) ? String(u).trim() : '' } catch { return '' } }   // kept exactly as typed, once checked
const safeImg = (s) => (/^\/media\/img\/[a-f0-9]{24}\.webp$/.test(s) || /^\/v2\/sites\/[a-z0-9-]+\.webp$/.test(s) ? s : '')
export const domain = (u) => { try { return new URL(u).hostname.replace(/^www\./, '') } catch { return '' } }
const small = (img) => img.replace(/-full\.webp$/, '.webp')
const SIGN = '<svg class="h2-sign" viewBox="0 0 400 24" preserveAspectRatio="none" aria-hidden="true"><path d="M2 14 C 40 4, 78 22, 118 12 S 200 4, 240 10 S 330 18, 398 6"/></svg>'
const enc = (s) => encodeURIComponent(s).replace(/'/g, '%27')
const WA = 'https://wa.me/2347011726321?text=' + enc("Hi Olexweb, I have a project in mind and I'd like to talk about it.")
const WA_ROOM = 'https://wa.me/2347011726321?text=' + enc("Hi Olaitan, I'd like to join the Creator's Room.")

// ---------- Portfolio: the projects ----------
export function renderCases(projects) {
  return '\n' + projects.map((w, i) => {
    const k = esc(w.slug), d = esc(domain(w.url)), url = safeUrl(w.url), img = safeImg(w.image)
    const size = w.width && w.height ? `width="${Number(w.width)}" height="${Number(w.height)}"` : 'width="900" height="1968"'
    return `      <article class="case${i % 2 === 1 ? ' flip' : ''} rv" id="${k}" aria-labelledby="c-${k}">
        <div class="cframe"><div class="cbar"><i></i><i></i><i></i><span>${d}</span></div><div class="cscreen">${img ? `<img src="${esc(img)}" alt="${esc(w.name)} website, home page" ${size} decoding="async">` : ''}</div></div>
        <div class="case-info"><p class="case-kind">${esc(w.kind)}</p><h3 id="c-${k}">${esc(w.name)}</h3><p class="case-role">${esc(w.role)}</p>
          <p class="case-text">${esc(w.text)}</p>
          <ul class="case-built" aria-label="What was built">${(w.built || []).map((b) => '<li>' + esc(b) + '</li>').join('')}</ul>
          ${w.result ? `<p class="case-result"><b>The result</b>${esc(w.result)}</p>` : ''}
          ${url ? `<a class="lnk" href="${esc(url)}" target="_blank" rel="noopener">Visit ${d}</a>` : ''}</div>
      </article>`
  }).join('\n')
}

// ---------- Portfolio: what clients say (only shown when there is at least one) ----------
const QUOTE_CSS = `<style>
.quotes { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr)); gap: clamp(14px, 2vw, 24px); }
.quote { margin: 0; border: 1px solid var(--hair, rgba(242,239,233,.14)); border-radius: 22px; padding: clamp(22px, 2.6vw, 32px); display: flex; flex-direction: column; gap: 16px; background: rgba(242,239,233,.025); }
.quote .q-stars { color: var(--green, #8fe36a); letter-spacing: 3px; font-size: 15px; }
.quote blockquote { margin: 0; font-family: var(--display); font-weight: 600; font-stretch: 92%; font-size: clamp(19px, 1.6vw, 23px); line-height: 1.32; color: var(--paper, #f2efe9); }
.quote figcaption { margin-top: auto; display: grid; gap: 2px; font-size: 14.5px; }
.quote figcaption b { font-weight: 700; } .quote figcaption span { color: var(--paper-dim, rgba(242,239,233,.66)); }
</style>`
export function renderTestimonials(list) {
  if (!list.length) return ''
  return `  <section class="sec" aria-labelledby="tsT"><div class="wrap">${QUOTE_CSS}
    <div class="head"><div><h2 class="h2" id="tsT">What clients say.</h2>${SIGN}</div><p class="sub rv">In their own words, shared with their permission.</p></div>
    <div class="quotes">${list.map((t) => `<figure class="quote rv">${t.stars ? `<div class="q-stars" aria-label="${Number(t.stars)} out of 5">${'★'.repeat(Number(t.stars))}</div>` : ''}<blockquote>\u201c${esc(t.text)}\u201d</blockquote><figcaption><b>${esc(t.name)}</b>${t.role ? `<span>${esc(t.role)}</span>` : ''}</figcaption></figure>`).join('')}</div>
  </div></section>
`
}

// ---------- Blog: the newest article, then the rest ----------
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export const fmtDate = (d) => (d ? `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}` : '')
export function renderBlogList(posts) {
  if (!posts.length) return '    <p class="sub">The first article is on its way.</p>\n'
  const [f, ...rest] = posts
  return `    <a class="feat rv" href="/insights/${esc(f.slug)}"><div><p class="feat-k">Newest</p><h2>${esc(f.title)}</h2></div><div><p>${esc(f.summary)}</p><div class="feat-meta"><span>${esc(fmtDate(f.published_on))}</span><span>${Number(f.minutes)} min read</span></div></div></a>
    <ul class="posts">${rest.map((a, n) => `<li><a class="post" href="/insights/${esc(a.slug)}"><span class="post-n">${String(n + 2).padStart(2, '0')}</span><span class="post-t">${esc(a.title)}<svg viewBox="0 0 400 12" preserveAspectRatio="none" aria-hidden="true"><path d="M2 7 C 60 2, 120 11, 200 6 S 340 3, 398 5"/></svg></span><p class="post-s">${esc(a.summary)}</p><span class="post-r">${Number(a.minutes)} min read</span></a></li>`).join('')}</ul>`
}

// ---------- Ventures: the cards ----------
export function renderVentureCards(vs) {
  return '<div class="v-deal" id="vDeal">\n' + vs.map((v) => {
    const url = safeUrl(v.url), d = esc(domain(v.url)), img = safeImg(v.image)
    return `        <article class="vcard"><div class="vshot">${img ? `<img src="${esc(small(img))}" alt="${esc(v.name)} website" loading="lazy">` : ''}</div><div class="vbody"><h3>${esc(v.name)}</h3><p class="vline">${esc(v.line)}</p><p class="vstory">${esc(v.summary)}</p><div class="vlinks"><a class="lnk" href="/ventures/${esc(v.slug)}">The story</a>${url ? `<a class="lnk" href="${esc(url)}" target="_blank" rel="noopener">${d}</a>` : ''}</div></div></article>`
  }).join('\n') + '\n    </div>\n'
}

// ---------- A venture's story page ----------
export function renderVentureMain(v, others) {
  const url = safeUrl(v.url), d = esc(domain(v.url)), img = safeImg(v.image), paras = (v.text || []).filter(Boolean)
  const more = others.map((o) => { const oi = safeImg(o.image); return `<a class="vmore rv" href="/ventures/${esc(o.slug)}"><div class="vmore-shot">${oi ? `<img src="${esc(small(oi))}" alt="${esc(o.name)} website">` : ''}</div><div class="vmore-body"><em>${esc(o.kind)}</em><strong>${esc(o.name)}</strong><span>${esc(o.line)}</span></div></a>` }).join('')
  return `<main id="top">
  <section class="vn-hero" aria-labelledby="vnT">
    <div class="head"><h1 class="h2 vn-name" id="vnT">${esc(v.name)}</h1>${SIGN}
      <p class="vn-line rv">${esc(v.line)}</p>
      <div class="vn-acts rv">${url ? `<a class="btn btn-green" href="${esc(url)}" target="_blank" rel="noopener">Visit ${d}</a>` : ''}<a class="btn btn-line" href="/ventures">All ventures</a></div></div>
    <div class="cframe vn-frame"><div class="cbar"><i></i><i></i><i></i><span>${d}</span></div><div class="cscreen">${img ? `<img src="${esc(img)}" alt="${esc(v.name)} website, home page">` : ''}</div></div>
  </section>
  <section class="sec" id="story" aria-labelledby="whyT"><div class="wrap vn-story">
    <div class="head" style="display:block;margin:0"><h2 class="h2" id="whyT">Why it exists.</h2>${SIGN}</div>
    <div>${paras.length ? `<p class="lead rv">${esc(paras[0])}</p>${paras.slice(1).map((x) => `<p class="rv">${esc(x)}</p>`).join('')}` : ''}</div>
  </div></section>
${others.length ? `  <section class="sec" id="more" aria-labelledby="moreT"><div class="wrap">
    <div class="head"><div><h2 class="h2" id="moreT">More ventures.</h2>${SIGN}</div><p class="sub rv">The same craft that builds client websites, turned on problems worth owning.</p></div>
    <div class="vn-more">${more}</div>
  </div></section>
` : ''}  <section class="sec bio-cta" aria-labelledby="vnCta"><div class="wrap" style="position:relative">
    <h2 class="h2" id="vnCta">Building something of your own?</h2>${SIGN}
    <p class="sub rv">The Creator's Room is a community for people turning ideas into products and businesses. Or tell me what you're building and we'll work on it together.</p>
    <div class="acts rv"><a class="btn btn-green" href="${esc(WA_ROOM)}">Join the Creator's Room</a><a class="btn btn-line" href="${esc(WA)}">Start my project</a></div>
  </div></section>
</main>`
}

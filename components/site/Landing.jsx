// Install 29: one page per real search (lib/site/landings.js), in the Directory's look: the answer, what you get, how it
// works, real work from the portfolio, the questions people ask, and one way to start (WhatsApp or the project form).
import { DIR_CSS } from '@/components/dirStyles'

const WA = 'https://wa.me/2347011726321?text=' + encodeURIComponent('Hi Olexweb, I found you on Google and I’d like to talk about a project.')
export default function Landing({ L, projects = [] }) {
  return (<div className="dx">
    <style dangerouslySetInnerHTML={{ __html: DIR_CSS + CSS }} />
    <div className="dx-w"><header className="dx-bar"><a className="dx-mark" href="/" aria-label="Olexweb, home"><img src="/studio/mark.png" alt="" width="21" height="24" />Olexweb</a><nav className="dx-nav"><a href="/portfolio">Portfolio</a><a href="/tools">Directory</a></nav></header>
      <nav className="ln-crumbs" aria-label="Breadcrumb"><a href="/">Olexweb</a> › {L.path.startsWith('/services/') ? <><a href="/work-with-me">Services</a> › </> : null}<span>{L.kicker}</span></nav>
      <section className="ln-hero"><span className="dx-eb">{L.kicker}</span><h1 className="dx-h1 ln-h1">{L.h1}</h1><p className="dx-lede">{L.lede}</p>
        <div className="ln-cta"><a className="ln-go" href={WA} target="_blank" rel="noopener">Talk on WhatsApp</a><a className="ln-line" href={'/start?from=' + encodeURIComponent(L.path)}>Send your project details</a></div></section>
      {L.sections.map(([h, items]) => (<section key={h} className="ln-sec"><h2>{h}</h2><ul>{items.map((t) => <li key={t}>{t}</li>)}</ul></section>))}
      {projects.length ? <section className="ln-sec"><h2>Real work by Olexweb</h2><div className="ln-work">{projects.slice(0, 6).map((p) => (
        <a key={p.slug} className="ln-card" href={'/portfolio#' + p.slug}>{p.image ? <img src={String(p.image).replace(/-full\.webp$/, '.webp')} alt={p.name + ' website'} loading="lazy" /> : null}<b>{p.name}</b><span>{p.kind}</span></a>))}</div></section> : null}
      <section className="ln-sec"><h2>Questions people ask</h2>{L.faq.map(([q, a]) => <details key={q} className="ln-q"><summary>{q}</summary><p>{a}</p></details>)}</section>
      <section className="ln-end"><h2>Tell us what you’re building.</h2><p>WhatsApp opens with a message already written. Or send the details and get a reply within a day.</p>
        <div className="ln-cta"><a className="ln-go" href={WA} target="_blank" rel="noopener">Talk on WhatsApp</a><a className="ln-line" href={'/start?from=' + encodeURIComponent(L.path)}>Send your project details</a></div></section>
      <nav className="ln-more" aria-label="Related">{L.links.map(([h, t]) => <a key={h} href={h}>{t} →</a>)}</nav>
      <footer className="dx-foot"><span>© {new Date().getFullYear()} Olexweb · Olaitan Adebayo</span><span><a href="/">olexweb.com</a> · <a href="/privacy">Privacy</a></span></footer>
    </div>
  </div>)
}
const CSS = `
.ln-crumbs{font-size:13.5px;color:var(--dim);margin:6px 0 0}.ln-crumbs a{color:inherit}
.ln-hero{padding:36px 0 18px;max-width:880px}.ln-h1{font-size:clamp(40px,6.4vw,84px);line-height:.98;margin:12px 0 18px}
.ln-cta{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}
.ln-go,.ln-line{display:inline-flex;align-items:center;padding:14px 22px;border-radius:999px;font:800 15.5px var(--font-mona),system-ui;text-decoration:none}
.ln-go{background:var(--ink);color:#fff}.ln-line{border:1px solid var(--line);color:var(--ink);background:#fff}
.ln-sec{max-width:880px;padding:28px 0;border-top:1px solid var(--line)}.ln-sec h2{font:800 clamp(24px,3vw,34px)/1.1 var(--font-mona),system-ui;margin:0 0 14px}
.ln-sec ul{margin:0;padding-left:20px;display:grid;gap:10px;font-size:17px;line-height:1.55}
.ln-work{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px}
.ln-card{display:flex;flex-direction:column;gap:4px;padding:10px;border:1px solid var(--line);border-radius:14px;background:#fff;color:var(--ink);text-decoration:none}
.ln-card img{width:100%;aspect-ratio:16/11;object-fit:cover;object-position:top;border-radius:8px;margin-bottom:6px}.ln-card span{font-size:13px;color:var(--dim)}
.ln-q{border-bottom:1px solid var(--line);padding:14px 0}.ln-q summary{cursor:pointer;font-weight:800;font-size:17px}.ln-q p{margin:10px 0 0;font-size:16px;line-height:1.6;color:var(--dim)}
.ln-end{margin:30px 0 10px;padding:30px;border-radius:22px;background:var(--ink);color:#f2efe9}.ln-end h2{font:800 clamp(26px,3.4vw,40px)/1.05 var(--font-mona),system-ui;margin:0 0 8px}
.ln-end p{color:rgba(242,239,233,.75);margin:0}.ln-end .ln-go{background:var(--g);color:#0e1a0b}.ln-end .ln-line{background:none;color:#f2efe9;border-color:rgba(242,239,233,.3)}
.ln-more{display:flex;flex-wrap:wrap;gap:16px;margin:22px 0 30px}.ln-more a{font-weight:800;color:var(--ink)}
@media (max-width:640px){.ln-hero{padding-top:22px}.ln-sec ul{font-size:16px}.ln-end{padding:22px}}
`

// Install 30: olexweb.com/services: every service and guide in one place (the hub that links them all)
import { VERIFIED_HTML, integratedHtml } from '@/lib/site/trust'   // Install 46
import { DIR_CSS } from '@/components/dirStyles'
import JsonLd from '@/components/JsonLd'
import { LANDINGS } from '@/lib/site/landings'
import { pageMetadata, pageJsonLd, SITE } from '@/lib/seo'
export const metadata = pageMetadata('services')
const GROUPS = [
  ['Websites', ['small-business-website-nigeria', 'website-design-lagos', 'ecommerce-website-nigeria', 'website-redesign']],
  ['Systems and AI', ['web-app-development-nigeria', 'ai-for-business-nigeria', 'digital-transformation-nigeria', 'olex-ai']],
  ['Being found', ['seo-services-nigeria', 'geo-ai-search-optimisation']],
  ['For your kind of business', ['church-website-nigeria', 'school-website-nigeria', 'restaurant-website-nigeria', 'real-estate-website-nigeria', 'hotel-website-nigeria']],
  ['Guides', ['best-business-website', 'website-cost-nigeria']],
]
export default function Page() {
  const ld = pageJsonLd('services', [{ '@type': 'ItemList', itemListElement: GROUPS.flatMap((g) => g[1]).map((k, i) => ({ '@type': 'ListItem', position: i + 1, name: LANDINGS[k].h1, url: SITE + LANDINGS[k].path })) }])
  return (<div className="dx"><JsonLd data={ld} /><style dangerouslySetInnerHTML={{ __html: DIR_CSS + CSS }} />
    <div className="dx-w"><header className="dx-bar"><a className="dx-mark" href="/" aria-label="Olexweb, home"><img src="/studio/mark.png" alt="" width="21" height="24" />Olexweb</a><nav className="dx-nav"><a href="/portfolio">Portfolio</a><a href="/tools">Directory</a></nav></header>
      <section className="sv-hero"><span className="dx-eb">Services</span><h1 className="dx-h1">What Olexweb builds, and how it helps you get found</h1>
        <p className="dx-lede">Websites, online shops and the systems behind them, AI that takes real work off your desk, and the work of being found on Google and in AI answers. Pick what fits; every page says plainly what you get.</p></section>
      <div dangerouslySetInnerHTML={{ __html: integratedHtml() }} />
      {GROUPS.map(([h, keys]) => (<section key={h} className="sv-g"><h2>{h}</h2><div className="sv-list">{keys.map((k) => (<a key={k} href={LANDINGS[k].path} className="sv-card"><b>{LANDINGS[k].h1}</b><span>{LANDINGS[k].lede}</span></a>))}</div></section>))}
      <footer className="dx-foot"><span>© {new Date().getFullYear()} Olexweb · Olaitan Adebayo</span><span><a href="/">olexweb.com</a> · <a href="/privacy">Privacy</a></span><span style={{ flexBasis: '100%' }} dangerouslySetInnerHTML={{ __html: VERIFIED_HTML }} /></footer></div></div>)
}
const CSS = `.sv-hero{padding:36px 0 10px;max-width:900px}.sv-g{padding:24px 0;border-top:1px solid var(--line)}.sv-g h2{font:800 clamp(22px,2.8vw,30px)/1.1 var(--font-mona),system-ui;margin:0 0 14px}
.sv-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}.sv-card{display:flex;flex-direction:column;gap:8px;padding:18px;border:1px solid var(--line);border-radius:16px;background:#fff;color:var(--ink);text-decoration:none}
.sv-card b{font:800 18px/1.25 var(--font-mona),system-ui}.sv-card span{font-size:14.5px;line-height:1.5;color:var(--dim)}.sv-card:hover{border-color:var(--ink)}`

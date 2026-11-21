// Install 46: two honest trust rows.
//  "Integrated with": a sliding strip of the platforms Olexweb's work runs on and connects to (true: the site and its
//   systems use them). Under the home page's first screen, and on the services and start pages.
//  "Verified by": real, earned badges only (ScamAdviser now; more as they're earned). In every page's footer.
import { LOGOS } from './logos'
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
const item = ([n, d]) => `<li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg><span>${esc(n)}</span></li>`
export const INTEGRATED_CSS = `.ig{padding:28px 0 34px;overflow:hidden}.ig h2{margin:0 0 18px;text-align:center;font:600 13px/1 system-ui,sans-serif;letter-spacing:.18em;text-transform:uppercase;opacity:.6}
.ig-track{display:flex;width:max-content;animation:ig-slide 48s linear infinite}.ig:hover .ig-track{animation-play-state:paused}
.ig ul{display:flex;gap:46px;margin:0;padding:0 23px;list-style:none}.ig li{display:flex;align-items:center;gap:10px;white-space:nowrap;font:500 16px/1 system-ui,sans-serif;opacity:.78}
.ig svg{width:24px;height:24px;fill:currentColor;flex:none}.ig-mask{-webkit-mask-image:linear-gradient(90deg,transparent,#000 10%,#000 90%,transparent);mask-image:linear-gradient(90deg,transparent,#000 10%,#000 90%,transparent)}
@keyframes ig-slide{to{transform:translateX(-50%)}}@media (prefers-reduced-motion:reduce){.ig-track{animation:none;flex-wrap:wrap;width:auto;justify-content:center}.ig-track ul+ul{display:none}}`
export function integratedHtml() {
  const list = `<ul>${LOGOS.map(item).join('')}</ul>`
  return `<style>${INTEGRATED_CSS}</style><section class="ig" aria-label="Integrated with"><h2>Integrated with</h2><div class="ig-mask"><div class="ig-track">${list}<ul aria-hidden="true">${LOGOS.map(item).join('')}</ul></div></div></section>`
}
export const VERIFIED_HTML = `<div class="foot-verified" style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:18px 0 4px;font:500 13px/1 system-ui,sans-serif;opacity:.85"><span style="letter-spacing:.14em;text-transform:uppercase;opacity:.7">Verified by</span><a href="https://www.scamadviser.com/check-website/olexweb.com" target="_blank" rel="noopener"><img src="https://files.scamadviser.com/thumbs/scamadviser-logo-4ad94.jpg_900x.jpg" alt="Check Olexweb on ScamAdviser.com" width="156" height="30" loading="lazy" style="display:block;width:156px;height:30px;border-radius:6px"></a></div>`
// every page's footer gets the "Verified by" row (all pages' HTML passes through here)
export function withVerified(html) {
  const s = String(html || '')
  return s.includes('</footer>') && !s.includes('foot-verified') ? s.replace('</footer>', VERIFIED_HTML + '</footer>') : s
}

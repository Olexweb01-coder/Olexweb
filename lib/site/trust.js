// Install 46: two honest trust rows.
//  "Our global ecosystem": a sliding strip of the platforms Olexweb's work runs on and connects to (true: the site and its
//   systems use them). Under the home page's first screen, and on the services and start pages.
//  "Trusted by": real, earned badges only (ScamAdviser now; more as they're earned). In every page's footer.
import { LOGOS } from './logos'
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
const item = ([n, d, c]) => `<li><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="${/^#(000000|181717)$/i.test(c) ? '#ffffff' : c}" d="${d}"/></svg><span>${esc(n)}</span></li>`   // each brand in its own colour (black ones in their official white for dark backgrounds)
export const INTEGRATED_CSS = `.ig{padding:64px 0 44px;overflow:hidden}.ig h2{margin:0 0 26px;text-align:center;font:600 14px/1 system-ui,sans-serif;letter-spacing:.2em;text-transform:uppercase;opacity:.65}
.ig-track{display:flex;width:max-content;animation:ig-slide 55s linear infinite}.ig:hover .ig-track{animation-play-state:paused}
.ig ul{display:flex;gap:56px;margin:0;padding:0 28px;list-style:none}.ig li{display:flex;align-items:center;gap:13px;white-space:nowrap;font:600 21px/1 system-ui,sans-serif;color:#f2efe9}
.ig svg{width:34px;height:34px;flex:none}.ig-mask{-webkit-mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent);mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)}
@keyframes ig-slide{to{transform:translateX(-50%)}}@media (max-width:700px){.ig{padding:48px 0 34px}.ig li{font-size:17px}.ig svg{width:28px;height:28px}.ig ul{gap:40px}}@media (prefers-reduced-motion:reduce){.ig-track{animation:none;flex-wrap:wrap;width:auto;justify-content:center}.ig-track ul+ul{display:none}}`
export function integratedHtml() {
  const list = `<ul>${LOGOS.map(item).join('')}</ul>`
  return `<style>${INTEGRATED_CSS}</style><section class="ig" aria-label="Our global ecosystem"><h2>Our global ecosystem</h2><div class="ig-mask"><div class="ig-track">${list}<ul aria-hidden="true">${LOGOS.map(item).join('')}</ul></div></div></section>`
}
export const VERIFIED_HTML = `<div class="foot-verified" style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:18px 0 4px;font:500 13px/1 system-ui,sans-serif;opacity:.85"><span style="letter-spacing:.14em;text-transform:uppercase;opacity:.7">Trusted by</span><a href="https://www.scamadviser.com/check-website/olexweb.com" target="_blank" rel="noopener"><img src="https://files.scamadviser.com/thumbs/scamadviser-logo-4ad94.jpg_900x.jpg" alt="Olexweb on ScamAdviser" width="156" height="30" loading="lazy" style="display:block;width:156px;height:30px;border-radius:6px"></a></div>`
// every page's footer gets the "Verified by" row (all pages' HTML passes through here)
export function withVerified(html) {
  const s = String(html || '')
  return s.includes('</footer>') && !s.includes('foot-verified') ? s.replace('</footer>', VERIFIED_HTML + '</footer>') : s
}

// The Olexweb Meet website's frame (Install 58g): top menu (a drawer on phones), footer, and the sign-up button that
// follows you on phones. Plain markup (works in server and client pages); motion comes from SiteMotion.
import { I } from '../app/icons'
import SiteMotion from './SiteMotion'

export const NAV = [['/features', 'Features'], ['/for', 'For you'], ['/earn', 'Earn'], ['/pricing', 'Pricing'], ['/mentors', 'Find a mentor']]
// base: '' on meet.olexweb.com, '/meet' on the main address
export const at = (base, p) => (p === '/' ? (base || '/') : base + p)
export const startHref = (base) => `${base || ''}/?next=${encodeURIComponent('/?then=start')}#signin`.replace(/^\/\?/, '/?')
export const signinHref = (base) => `${base || ''}/#signin`.replace(/^\/#/, '/#')

export function SiteNav({ base = '', active = '' }) {
  return (<>
    <nav className="top" aria-label="Main"><div className="wrap">
      <a className="brand" href={at(base, '/')}><img src="/meet/logo-96.png" alt="" width="34" height="34" /><span className="full">Olexweb&nbsp;</span><b>Meet</b></a>
      <div className="links">{NAV.map(([p, l]) => <a key={p} href={at(base, p)} className={active === p ? 'on' : ''} aria-current={active === p ? 'page' : undefined}>{l}</a>)}</div>
      <span className="sp" />
      <div className="navr"><a className="btn si" href={signinHref(base)}>Sign in</a><a className="btn go" href={startHref(base)}>Start free</a>
        <button className="mbtn" type="button" aria-label="Open the menu" data-open-drawer><I n="menu" className="ico" /></button></div>
    </div></nav>
    <div className="drawer" data-drawer role="dialog" aria-modal="true" aria-label="Menu"><div>
      <div className="dhead"><a className="brand" href={at(base, '/')}><img src="/meet/logo-96.png" alt="" width="34" height="34" /><b>Meet</b></a><button type="button" className="mbtn" aria-label="Close the menu" data-close-drawer>✕</button></div>
      <a href={at(base, '/')}>Home</a>{NAV.map(([p, l]) => <a key={p} href={at(base, p)}>{l}</a>)}<a href={at(base, '/help')}>Help</a><a href={at(base, '/about')}>About</a>
      <a href={signinHref(base)}>Sign in</a><a className="btn go" href={startHref(base)} style={{ marginTop: 10 }}>Start free</a></div></div>
  </>)
}
export function SiteFooter({ base = '' }) {
  return (<footer><div className="wrap fgrid">
    <div><a className="brand" href={at(base, '/')}><img src="/meet/logo-96.png" alt="" width="34" height="34" /><span>Olexweb&nbsp;</span><b>Meet</b></a>
      <p style={{ color: 'var(--faint)', maxWidth: '24em', fontSize: 14 }}>Free audio and video meetings that work on real networks. Part of <a href="https://olexweb.com" style={{ textDecoration: 'underline' }}>Olexweb</a>.</p></div>
    <div><h4>Product</h4><a href={at(base, '/features')}>Features</a><a href={at(base, '/for')}>For you</a><a href={at(base, '/pricing')}>Pricing</a><a href={at(base, '/earn')}>Earn</a></div>
    <div><h4>Community</h4><a href={at(base, '/mentors')}>Find a mentor</a><a href={at(base, '/leaders')}>Leaderboard</a><a href={at(base, '/help')}>Help</a><a href={at(base, '/about')}>About</a></div>
    <div><h4>Policies</h4><a href="/meet/legal/earnings">Earnings and payouts</a><a href="/meet/legal/refunds">Refunds</a><a href="/meet/legal/community">Community rules</a></div>
    <div><h4>Olexweb</h4><a href="https://olexweb.com">olexweb.com</a><a href="https://olexweb.com/terms">Terms</a><a href="https://olexweb.com/privacy">Privacy</a></div>
  </div><div className="wrap" style={{ color: 'var(--faint)', fontSize: 13, marginTop: 30 }}>© {new Date().getFullYear()} Olexweb</div></footer>)
}
export default function Site({ base = '', active = '', children, cta = true }) {
  return (<div className="ms">
    <SiteNav base={base} active={active} />
    <main id="main">{children}</main>
    <SiteFooter base={base} />
    {cta ? <a className="btn go sticky" data-sticky href={startHref(base)}>Start a free meeting</a> : null}
    <SiteMotion />
  </div>)
}
// shared pieces
export const Section = ({ children, alt = false, tight = false, id }) => <section id={id} className="sec" style={{ ...(alt ? { background: 'var(--bg2)', borderBlock: '1px solid var(--line)' } : {}), ...(tight ? { paddingTop: 0 } : {}) }}><div className="wrap">{children}</div></section>
export const Head = ({ eyebrow, title, text, center = false }) => <div className={'sh rv' + (center ? ' center' : '')}>{eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}<h2>{title}</h2>{text ? <p>{text}</p> : null}</div>
export function Final({ base, title = 'Your next meeting starts here.', text = 'Free, no time limit, and nothing for your guests to install.', second = null }) {
  return (<div className="wrap" style={{ marginTop: 40 }}><div className="final rv"><span className="pill"><i />Takes 10 seconds</span><h2>{title}</h2><p style={{ color: 'var(--dim)', fontSize: 18, margin: 0, maxWidth: '30em' }}>{text}</p>
    <div className="cta" style={{ justifyContent: 'center', margin: 0 }}><a className="btn go" href={startHref(base)}>Start a free meeting</a>{second}</div></div></div>)
}
export function PageHero({ pill, title, accent, text, children = null }) {
  return (<header className="hero phero"><div className="glow" style={{ width: 520, height: 520, background: '#2f7d3a', right: -160, top: -160 }} /><div className="glow" style={{ width: 380, height: 380, background: '#8fe36a', left: -200, top: 160, opacity: 0.14 }} />
    <div className="wrap"><span className="pill"><i />{pill}</span><h1>{title} {accent ? <span className="grad">{accent}</span> : null}</h1><p className="lede">{text}</p>{children}</div></header>)
}

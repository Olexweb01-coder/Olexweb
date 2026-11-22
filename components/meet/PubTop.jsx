// The top bar of Meet's public pages: Back, the brand, and a way into the app (Install 58d)
import { meetBase } from '@/lib/site/meet'
import BackButton from './BackButton'
export default function PubTop({ children = null, back = true }) {
  const home = meetBase() ? '/' : '/meet'
  return <header className="pb-top"><div className="pb-row" style={{ gap: 10, flexWrap: 'nowrap', minWidth: 0 }}>{back ? <BackButton home={home} /> : null}
    <a className="pb-brand" href={home}><img src="/meet/logo-96.png" alt="" width="32" height="32" /><span>Olexweb <b>Meet</b></span></a></div>
    {children || <a className="pb-btn pb-sm" href={home}>Open Meet</a>}</header>
}

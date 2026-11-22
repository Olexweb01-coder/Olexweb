// The top bar of Meet's public pages
import { meetBase } from '@/lib/site/meet'
export default function PubTop({ children = null }) {
  const home = meetBase() ? '/' : '/meet'
  return <header className="pb-top"><a className="pb-brand" href={home}><img src="/meet/logo-96.png" alt="" width="32" height="32" /><span>Olexweb <b>Meet</b></span></a>{children}</header>
}

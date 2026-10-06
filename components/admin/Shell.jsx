'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon } from './icons'
import { Toast } from './ui'

const NAV = [['/admin', 'home', 'Home'], ['/admin/projects', 'work', 'Projects'], ['/admin/assistant', 'assistant', 'Assistant'], ['/admin/reviews', 'reviews', 'Reviews'], ['/admin/blog', 'blog', 'Blog'], ['/admin/more', 'more', 'More']]
export default function Shell({ name, waiting = 0, children }) {
  const path = usePathname()
  const here = (href) => (href === '/admin' ? path === '/admin' : path.startsWith(href))
  return (
    <>
      <div className="app">
        <nav className="side" aria-label="Admin">
          <div className="auth-mark"><img src="/studio/mark.png" alt="" width="26" height="30" />Olexweb</div>
          {NAV.map(([href, ic, label]) => (
            <Link key={href} href={href} className="nav-a" aria-current={here(href) ? 'page' : undefined}>{Icon[ic]}{label}{ic === 'reviews' && waiting > 0 ? <span className="count">{waiting}</span> : null}</Link>
          ))}
          <div className="me"><img src="/v2/photos/p2.webp" alt="" width="32" height="32" />{name}</div>
        </nav>
        <main className="main" id="main">{children}</main>
        <nav className="tabs" aria-label="Admin">
          {NAV.map(([href, ic, label]) => (
            <Link key={href} href={href} className="tab" aria-current={here(href) ? 'page' : undefined}>{ic === 'reviews' && waiting > 0 ? <i className="dot" aria-hidden="true" /> : null}{Icon[ic]}{label}</Link>
          ))}
        </nav>
      </div>
      <Toast />
    </>
  )
}

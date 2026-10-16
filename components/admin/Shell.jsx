'use client'
// The admin frame, Olex AI style: a collapsible sidebar (a drawer on phones) with New chat, the sections and your chats,
// and the page beside it. The look (glass, clay or neumorphic) comes from a cookie, so the first paint is already right.
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { Icon } from './icons'
import { Toast, toast } from './ui'
import Freshness, { RefreshButton } from './Freshness'

const setCookie = (k, v) => { document.cookie = `${k}=${v}; path=/admin; max-age=31536000; samesite=strict${location.protocol === 'https:' ? '; secure' : ''}` }

export default function Shell({ name, owner, nav, chats = [], style = 'glass', collapsed = false, version, children }) {
  const path = usePathname(), params = useSearchParams(), router = useRouter()
  const [closed, setClosed] = useState(collapsed), [drawer, setDrawer] = useState(false), [list, setList] = useState(chats)
  useEffect(() => { setList(chats) }, [chats])
  useEffect(() => { setDrawer(false) }, [path, params])                    // a drawer closes once you've picked something
  useEffect(() => { const k = (e) => { if (e.key === 'Escape') setDrawer(false) }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [])
  const isChat = owner && path === '/admin', openChat = isChat ? Number(params.get('c')) || null : null
  const here = (href) => path === href || path.startsWith(href + '/')
  function toggle() {
    if (window.matchMedia('(max-width: 900px)').matches) { setDrawer((d) => !d); return }
    setClosed((c) => { setCookie('olex_side', c ? 'open' : 'closed'); return !c })
  }
  async function removeChat(c) {
    if (!window.confirm(`Delete “${c.title}”? This can’t be undone.`)) return
    const r = await fetch('/admin/api/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ action: 'delete-chat', chatId: c.id }) }).catch(() => null)
    if (!r || !r.ok) { toast('That chat couldn’t be deleted. Try again.'); return }
    setList((l) => l.filter((x) => x.id !== c.id)); toast('Chat deleted.')
    if (openChat === c.id) router.replace('/admin'); else router.refresh()
  }
  return (
    <div className={'olex' + (closed ? ' side-closed' : '') + (drawer ? ' drawer-on' : '')} data-style={style}>
      <div className="olex-bg" aria-hidden="true" />
      <div className="app">
        <aside className="side" aria-label="Olex AI">
          <div className="side-head">
            <Link href={owner ? '/admin' : '/admin/overview'} className="brand"><img src="/studio/mark.png" alt="" width="22" height="26" /><span>Olex AI</span></Link>
            <button type="button" className="icon-btn" onClick={toggle} aria-label="Close the sidebar">{Icon.side}</button>
          </div>
          {owner ? <Link href="/admin" className={'newchat' + (isChat && !openChat ? ' on' : '')}>{Icon.compose}New chat</Link> : null}
          <nav className="side-nav" aria-label="Sections">
            {nav.map(([href, ic, label, count]) => (
              <Link key={href} href={href} className="nav-a" aria-current={here(href) ? 'page' : undefined}>{Icon[ic]}<span>{label}</span>{count > 0 ? <span className="count">{count}</span> : null}</Link>
            ))}
          </nav>
          {owner ? <div className="side-chats">
            <p className="side-label">Chats</p>
            {list.length ? <ul>{list.map((c) => (
              <li key={c.id} className={openChat === c.id ? 'on' : ''}>
                <Link href={'/admin?c=' + c.id} aria-current={openChat === c.id ? 'page' : undefined}>{c.title}</Link>
                <button type="button" aria-label={'Delete ' + c.title} onClick={() => removeChat(c)}>{Icon.close}</button>
              </li>))}</ul> : <p className="side-empty">Your chats with Olex AI appear here.</p>}
          </div> : <div className="side-chats" />}
          <div className="side-foot">
            <RefreshButton side />
            <Link href="/admin/more" className="me"><img src="/v2/photos/p2.webp" alt="" width="30" height="30" /><span>{name}</span></Link>
          </div>
        </aside>
        <div className="scrim" onClick={() => setDrawer(false)} aria-hidden="true" />
        <div className="stage">
          <header className="topbar">
            <button type="button" className="icon-btn opener" onClick={toggle} aria-label="Open the sidebar">{Icon.menu}</button>
            <span className="topbar-t">{isChat ? 'Olex AI' : ''}</span>
            <span className="topbar-end">
              {owner ? <Link href="/admin" className="icon-btn" aria-label="New chat">{Icon.compose}</Link> : null}
              <span className="phone-only"><RefreshButton /></span>
            </span>
          </header>
          <main className={'main' + (isChat ? ' main-chat' : '')} id="main">{isChat ? children : <div className="page">{children}</div>}</main>
        </div>
      </div>
      <Freshness version={version} />
      <Toast />
    </div>
  )
}

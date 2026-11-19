'use client'
// Install 40: Google Analytics (GA4), only after the visitor says yes. Off until NEXT_PUBLIC_GA_ID (the Measurement ID,
// G-XXXXXXX) is set in Vercel. One small bar at the bottom, shown once on any public page and remembered everywhere;
// never in the admin. Ads stay off until AdSense is added (they'll use the same yes). olexweb.com/cookies#settings reopens it.
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
const GA = process.env.NEXT_PUBLIC_GA_ID
const KEY = 'olx_consent'
const hidden = (p) => /^\/(admin|preview|review|doc|me)(\/|$)/.test(p)
const read = () => { try { return localStorage.getItem(KEY) } catch { return null } }
const save = (v) => { try { localStorage.setItem(KEY, v) } catch {} }
function load() {
  if (window.__olxGa || !GA) return
  window.__olxGa = true
  window.dataLayer = window.dataLayer || []
  window.gtag = function () { window.dataLayer.push(arguments) }
  window.gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' })
  window.gtag('js', new Date())
  window.gtag('config', GA, { send_page_view: false, anonymize_ip: true })
  const s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA); document.head.appendChild(s)
}
export default function Consent() {
  const path = usePathname() || '/'
  const [ask, setAsk] = useState(false)
  useEffect(() => {
    if (!GA || hidden(path)) return
    const v = read()
    if (v === 'yes') load()
    setAsk(!v || location.hash === '#settings')
  }, [path])
  useEffect(() => {                                                   // every page you open counts once (after a yes)
    if (!GA || hidden(path) || read() !== 'yes' || !window.gtag) return
    window.gtag('event', 'page_view', { page_path: path, page_location: location.origin + path, page_title: document.title })
  }, [path])
  if (!GA || !ask || hidden(path)) return null
  const choose = (v) => { save(v); setAsk(false); if (v === 'yes') { load(); window.gtag('event', 'page_view', { page_path: path, page_location: location.origin + path, page_title: document.title }) } }
  return (<div role="dialog" aria-label="Cookies" style={{ position: 'fixed', left: 12, right: 12, bottom: 12, zIndex: 60, maxWidth: 640, margin: '0 auto', background: '#14171a', color: '#f2f3f5', borderRadius: 16, padding: '14px 16px', boxShadow: '0 10px 30px rgba(0,0,0,.35)', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', font: '500 14px/1.45 system-ui,-apple-system,Segoe UI,sans-serif' }}>
    <span style={{ flex: '1 1 260px' }}>We use cookies to count visits and see which pages help people, so we can make the site better. No ads track you. <a href="/cookies" style={{ color: '#9fe870', textDecoration: 'underline' }}>Cookie policy</a></span>
    <span style={{ display: 'flex', gap: 8 }}>
      <button type="button" onClick={() => choose('no')} style={{ padding: '9px 14px', borderRadius: 999, border: '1px solid #3a3f45', background: 'none', color: '#f2f3f5', font: 'inherit', cursor: 'pointer' }}>No thanks</button>
      <button type="button" onClick={() => choose('yes')} style={{ padding: '9px 16px', borderRadius: 999, border: 0, background: '#9fe870', color: '#0d1210', font: '700 14px/1.45 system-ui,sans-serif', cursor: 'pointer' }}>Accept</button>
    </span>
  </div>)
}

'use client'
// Install 30: optional visitor analytics with PostHog (us.posthog.com). Off until NEXT_PUBLIC_POSTHOG_KEY is set in Vercel.
// Anonymous and cookie-free: a random id kept only for the browser tab's session, no personal data, never in the admin,
// and nothing sent when the browser asks not to be tracked. Events go through olexweb.com/ingest (see next.config.js),
// so the page only ever talks to its own site. What it records: page views (with where the visitor came from), taps on
// WhatsApp, email and phone links, and form sends.
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY
const off = () => !KEY || /^\/(admin|preview|review)/.test(location.pathname) || navigator.doNotTrack === '1' || window.doNotTrack === '1'
function id() {
  try { let v = sessionStorage.getItem('olx_a'); if (!v) { v = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2)); sessionStorage.setItem('olx_a', v) } return v }
  catch { return 'anon' }
}
function send(event, props = {}) {
  if (off()) return
  const body = JSON.stringify({ api_key: KEY, event, distinct_id: id(), timestamp: new Date().toISOString(),
    properties: { $current_url: location.origin + location.pathname, $pathname: location.pathname, $host: location.host, $referrer: document.referrer || '$direct',
      $screen_width: screen.width, $lib: 'olexweb', $process_person_profile: false, ...props } })
  try { if (!navigator.sendBeacon || !navigator.sendBeacon('/ingest/i/v0/e/', new Blob([body], { type: 'application/json' }))) fetch('/ingest/i/v0/e/', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body }).catch(() => {}) } catch {}
}
export default function Analytics() {
  const path = usePathname()
  useEffect(() => { if (KEY) send('$pageview') }, [path])
  useEffect(() => {
    if (!KEY) return
    const onClick = (e) => {
      const a = e.target.closest && e.target.closest('a[href]'); if (!a) return
      const h = a.getAttribute('href') || '', label = (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60)
      if (/wa\.me\//.test(h)) send('whatsapp_click', { label }); else if (h.startsWith('mailto:')) send('email_click', { label }); else if (h.startsWith('tel:')) send('call_click', { label })
    }
    const onSubmit = (e) => send('form_sent', { form: (e.target && (e.target.id || e.target.getAttribute('name'))) || '' })
    document.addEventListener('click', onClick, true); document.addEventListener('submit', onSubmit, true)
    return () => { document.removeEventListener('click', onClick, true); document.removeEventListener('submit', onSubmit, true) }
  }, [])
  return null
}

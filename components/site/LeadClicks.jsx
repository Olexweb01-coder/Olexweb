'use client'
// Counts taps on WhatsApp buttons, by page (anonymous daily totals; no cookies). Never runs inside the admin.
import { useEffect } from 'react'
export default function LeadClicks() {
  useEffect(() => {
    if (location.pathname.startsWith('/admin')) return
    const onClick = (e) => {
      const a = e.target.closest && e.target.closest('a[href*="wa.me/2347011726321"]'); if (!a) return
      if (!a.hasAttribute('data-choice') && (a.textContent || '').replace(/\s+/g, ' ').trim() === 'Start my project' && !location.pathname.startsWith('/start')) return   // opens the choice; counted if they pick WhatsApp
      const body = JSON.stringify({ page: location.pathname.slice(0, 120), label: a.hasAttribute('data-choice') ? 'Start my project (WhatsApp)' : (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40) })
      try { if (!navigator.sendBeacon || !navigator.sendBeacon('/api/leads/click', new Blob([body], { type: 'application/json' }))) fetch('/api/leads/click', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body }) } catch {}
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])
  return null
}

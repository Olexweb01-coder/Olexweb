'use client'
// Simple / Detailed (Install 15): both views are on the page and only one is shown, so switching is instant. The choice is
// remembered on this device (one key per screen).
import { useState, useEffect } from 'react'

export default function SimpleSwitch({ k, simple, detailed }) {
  const [view, setView] = useState('simple')
  const pick = (v) => { setView(v); try { localStorage.setItem('olex-view-' + k, v) } catch {}; window.scrollTo(0, 0) }
  useEffect(() => { try { if (localStorage.getItem('olex-view-' + k) === 'detailed') setView('detailed') } catch {} }, [k])
  useEffect(() => {                                    // "Show the details" inside a simple view asks for the detailed one
    const on = (e) => pick(e.detail === 'detailed' ? 'detailed' : 'simple'); window.addEventListener('olex-view', on); return () => window.removeEventListener('olex-view', on)
  }, [k]) // eslint-disable-line react-hooks/exhaustive-deps
  return (<>
    <div className="sm-mode" role="group" aria-label="How much to show">
      {[['simple', 'Simple'], ['detailed', 'Detailed']].map(([key, l]) => <button key={key} aria-pressed={view === key} onClick={() => pick(key)}>{l}</button>)}
    </div>
    <div hidden={view !== 'simple'}>{simple}</div>
    <div hidden={view !== 'detailed'}>{detailed}</div>
    <style dangerouslySetInnerHTML={{ __html: `.sm-mode{display:inline-flex;gap:4px;background:var(--raise);border:1px solid var(--line);border-radius:999px;padding:4px;margin:0 0 14px}
.sm-mode button{min-height:38px;padding:0 16px;border-radius:999px;border:0;background:none;color:var(--dim);font:inherit;font-size:14px;font-weight:700;cursor:pointer}
.sm-mode button[aria-pressed=true]{background:var(--paper);color:#111}` }} />
  </>)
}
export const showDetails = () => window.dispatchEvent(new CustomEvent('olex-view', { detail: 'detailed' }))

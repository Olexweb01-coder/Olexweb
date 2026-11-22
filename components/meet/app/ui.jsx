'use client'
// Small shared pieces of the new Meet app (Install 58)
import { useEffect, useRef, useState } from 'react'
import { I } from './icons'

export const naira = (n) => '₦' + Math.round(Number(n) || 0).toLocaleString('en-NG')
export const kobo = (k) => '₦' + ((Number(k) || 0) / 100).toLocaleString('en-NG', { minimumFractionDigits: k % 100 ? 2 : 0, maximumFractionDigits: 2 })
export const day = (iso) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
export const when = (iso) => new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
export const onMeetApp = () => typeof location !== 'undefined' && location.hostname.startsWith('meet.')
export const pathFor = (code) => (onMeetApp() ? '/' : '/meet/') + code
export const linkFor = (code) => location.origin + pathFor(code)
export const homePath = () => (onMeetApp() ? '/' : '/meet')
export const site = () => location.origin + (onMeetApp() ? '' : '/meet')
export async function api(path, body) {
  const r = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) } : { cache: 'no-store', credentials: 'same-origin' })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw Object.assign(new Error(j.error || 'That didn’t work. Try again.'), { status: r.status })
  return j
}
export async function copyText(text) { try { await navigator.clipboard.writeText(text); return true } catch { prompt('Copy this:', text); return false } }
export async function shareText(text, url) { try { if (navigator.share) { await navigator.share(url ? { text, url } : { text }); return 'shared' } } catch { return '' } return (await copyText(url ? `${text} ${url}` : text)) ? 'copied' : '' }

export function Avatar({ name, picture, size = 40, className = 'av' }) {
  return picture ? <img className={className} src={picture} alt="" width={size} height={size} referrerPolicy="no-referrer" style={{ width: size, height: size, objectFit: 'cover' }} />
    : <span className={className} style={{ width: size, height: size, background: '#8fe36a' }}>{(name || '?').slice(0, 1).toUpperCase()}</span>
}
export function Ring({ pct = 0, level, name, picture, big = false }) {
  return (<div className="ring" style={{ '--p': pct }}>{picture ? <img src={picture} alt="" referrerPolicy="no-referrer" style={{ objectFit: 'cover' }} /> : <div style={{ background: '#8fe36a' }}>{(name || '?').slice(0, 1).toUpperCase()}</div>}{level ? <span className="lv">{level}</span> : null}</div>)
}
// a dialog: closes on Escape and on a tap outside; focus moves into it
export function Sheet({ title, onClose, children, wide = false }) {
  const box = useRef(null)
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose() }; document.addEventListener('keydown', k)
    const f = box.current && box.current.querySelector('input,select,textarea,button'); if (f) f.focus({ preventScroll: true })
    document.documentElement.classList.add('ma-lock'); return () => { document.removeEventListener('keydown', k); document.documentElement.classList.remove('ma-lock') }
  }, [onClose])
  return (<div className="sheet on" role="dialog" aria-modal="true" aria-label={title} onPointerDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
    <div ref={box} className={wide ? 'wide' : ''}><div className="sh-h"><h3>{title}</h3><button type="button" className="ib sm" aria-label="Close" onClick={onClose}>✕</button></div>{children}</div></div>)
}
export function Field({ label, hint, children }) { return <label className="fld"><span>{label}</span>{children}{hint ? <small>{hint}</small> : null}</label> }
export function Empty({ icon = 'spark', title, children }) { return <div className="empty"><span className="ni bg-b"><I n={icon} /></span><b>{title}</b>{children ? <p>{children}</p> : null}</div> }
// exactly what one sale splits into (from the server's numbers)
export function Fees({ price, pct, paystack, olexweb, host, why = 'Olexweb' }) {
  return (<div className="fees"><div><span>Price</span><b>{kobo(price)}</b></div><div><span>Paystack’s fee (paid by you, set by Paystack)</span><b>− {kobo(paystack)}</b></div>
    <div><span>{why} ({pct}%)</span><b>− {kobo(olexweb)}</b></div><div className="t"><span>To your bank, weekly</span><b>{kobo(host)}</b></div></div>)
}
// the same maths as lib/meet/money.js, for the live preview while a host types a price
export const PCT = { ticket: 5, booking: 5, bundle: 5, cert: 5, directory: 10, membership: 7 }
export function split(priceNaira, kind) {
  const price = Math.round(Number(priceNaira) * 100); if (!(price > 0)) return null
  const olexweb = Math.floor((price * PCT[kind]) / 100), paystack = Math.min(Math.ceil((price * 150) / 10000) + (price >= 250000 ? 10000 : 0), 200000)
  return { price, pct: PCT[kind], olexweb, paystack, host: price - olexweb - paystack }
}

// join with a code or a pasted link
export function JoinBox({ className = 'search' }) {
  const [v, setV] = useState('')
  const code = (v.match(/[a-hj-km-np-z]{3}-[a-hj-km-np-z]{4}-[a-hj-km-np-z]{3}/) || [])[0]
  return (<form className={className} role="search" onSubmit={(e) => { e.preventDefault(); if (code) location.assign(pathFor(code)) }}>
    <I n="link" /><input value={v} onChange={(e) => setV(e.target.value)} placeholder="Join with a code or link" aria-label="Meeting code or link" autoComplete="off" spellCheck="false" />
    {code ? <button className="btn go sm">Join</button> : null}</form>)
}


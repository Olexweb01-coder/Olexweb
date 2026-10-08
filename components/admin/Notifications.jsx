'use client'
// Olex AI notifications on this device: turn on (one tap; phones require it), choose kinds, send a test, turn off.
import { useEffect, useState } from 'react'
import { toast } from './ui'

const KINDS = [['published', 'A post went live'], ['draft', 'A new draft is waiting'], ['research', 'Research is done'], ['run', 'Today’s run is done'], ['busy', 'Gemini was busy (retrying)'], ['review', 'A new review is waiting'], ['lead', 'A new enquiry']]
async function call(payload) {
  try {
    const r = await fetch('/admin/api/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), credentials: 'same-origin' })
    const j = await r.json().catch(() => ({}))
    if (r.status === 401) { window.location.assign('/admin/login'); return { error: 'Sign in again.' } }
    return r.ok ? j : { error: j.error || 'Something went wrong. Try again.' }
  } catch { return { error: 'No connection. Try again.' } }
}
const keyBytes = (b64) => { const p = '='.repeat((4 - (b64.length % 4)) % 4), s = atob((b64 + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(s, (c) => c.charCodeAt(0)) }
// Register the notification helper and wait for THAT registration to be running (navigator.serviceWorker.ready can
// wait forever in some browsers, so it isn't used), with a clear message if it doesn't start.
async function helper() {
  const reg = await navigator.serviceWorker.register('/admin/sw.js', { scope: '/admin/' })
  if (reg.active) return reg
  const w = reg.installing || reg.waiting
  await new Promise((ok, no) => {
    const t = setTimeout(() => no(new Error('The notification helper didn’t start. Try again.')), 15000)
    if (!w) { clearTimeout(t); return ok() }
    w.addEventListener('statechange', () => { if (w.state === 'activated') { clearTimeout(t); ok() } else if (w.state === 'redundant') { clearTimeout(t); no(new Error('The notification helper didn’t start. Try again.')) } })
  })
  return reg
}
const device = () => { const u = navigator.userAgent; return /iPhone|iPad/.test(u) ? 'iPhone or iPad' : /Android/.test(u) ? 'Android phone' : /Mac/.test(u) ? 'Mac' : /Windows/.test(u) ? 'Windows computer' : 'This device' }

export default function Notifications() {
  const [st, setSt] = useState({ loading: true }), [busy, setBusy] = useState(false)
  async function load() {
    const supported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    const ios = /iPhone|iPad/.test(navigator.userAgent), installed = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
    const s = await call({ action: 'status' })
    let on = false
    if (supported) { const reg = await navigator.serviceWorker.getRegistration('/admin/'); on = !!(reg && (await reg.pushManager.getSubscription())) }
    setSt({ loading: false, supported, ios, installed, on, permission: supported ? Notification.permission : 'default', ...s })
  }
  useEffect(() => { load() }, [])
  async function turnOn() {
    setBusy(true)
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') { toast(perm === 'denied' ? 'Notifications are blocked. Allow them for this site in your phone’s settings.' : 'Notifications weren’t allowed.'); await load(); return }
      const reg = await helper()
      const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(st.key) }))
      const r = await call({ action: 'subscribe', subscription: sub.toJSON(), device: device() })
      if (r.error) toast(r.error); else toast('Notifications are on for this device.', true)
    } catch (e) { toast('This device couldn’t turn notifications on. ' + (e && e.message ? e.message : '')) } finally { setBusy(false); load() }
  }
  async function turnOff() {
    setBusy(true)
    try { const reg = await navigator.serviceWorker.getRegistration('/admin/'); const sub = reg && (await reg.pushManager.getSubscription()); if (sub) { await call({ action: 'unsubscribe', endpoint: sub.endpoint }); await sub.unsubscribe() } toast('Notifications are off for this device.') }
    finally { setBusy(false); load() }
  }
  async function setKind(k, v) { const prefs = { ...st.prefs, [k]: v }; setSt({ ...st, prefs }); const r = await call({ action: 'prefs', prefs }); if (r.error) toast(r.error) }
  async function test() { setBusy(true); const r = await call({ action: 'test' }); setBusy(false); if (r.error) toast(r.error); else toast(r.sent ? 'Sent. It should arrive in a few seconds.' : 'No device has notifications turned on yet.') }

  let body
  if (st.loading) body = <p className="note">Checking this device…</p>
  else if (!st.ready) body = <p className="note">Notifications aren’t set up yet. Run <b>npm run notify:keys</b>, then add the two keys to .env.local and Vercel.</p>
  else if (st.ios && !st.installed) body = <p className="note">On iPhone, notifications work in the installed admin. Open it from your Home Screen (Share, then Add to Home Screen), then turn them on here.</p>
  else if (!st.supported) body = <p className="note">This browser can’t receive notifications. Try Chrome on Android, Safari on an iPhone (from the Home Screen), or a desktop browser.</p>
  else body = (<>
    <div className="switch"><span><b>{st.on ? 'On for this device' : 'Off for this device'}</b><br /><span style={{ color: 'var(--dim)', fontSize: 13.5 }}>{st.devices ? `${st.devices} device${st.devices === 1 ? '' : 's'} receive Olex AI notifications.` : 'No devices yet.'}</span></span>
      {st.on ? <button type="button" className="btn btn-line" disabled={busy} onClick={turnOff}>Turn off</button> : <button type="button" className="btn btn-green" disabled={busy || st.permission === 'denied'} onClick={turnOn}>Turn on notifications</button>}</div>
    {st.permission === 'denied' ? <p className="note">Notifications are blocked for this site. Allow them in your browser or phone settings, then come back.</p> : null}
    <div className="perm" style={{ marginTop: 10 }}>{KINDS.map(([k, label]) => <div className="switch" key={k}><span><b>{label}</b></span>
      <input type="checkbox" className="toggle" checked={!!(st.prefs && st.prefs[k])} onChange={(e) => setKind(k, e.target.checked)} aria-label={label} /></div>)}</div>
    <p style={{ marginTop: 12 }}><button type="button" className="btn btn-line" disabled={busy} onClick={test}>Send a test</button></p>
  </>)
  return (<section aria-labelledby="ntT"><h2 className="section-t" id="ntT">Notifications from Olex AI</h2>{body}</section>)
}

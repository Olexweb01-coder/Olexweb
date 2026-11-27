'use client'
// Install 60: the "Install app" button. It shows only while Meet isn't installed on this device:
// - opened from the home screen or as an installed app: hidden;
// - Chrome, Edge or Samsung Internet with the app already installed (the browser says so): hidden;
// - the browser offers its own install: one tap installs it, and the button goes once it's installed;
// - iPhone and iPad (no website can tell if it's on the home screen there), other browsers: the steps, one by one.
// If they remove the app, the browser offers the install again and the button comes back by itself.
import { useEffect, useState } from 'react'
import { Sheet, onMeetApp } from './ui'

let saved = null                                                    // the browser's install offer, kept for every button
const subs = new Set(), tell = () => subs.forEach((f) => f())
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); saved = e; tell() })
  window.addEventListener('appinstalled', () => { saved = null; try { sessionStorage.setItem('meet-installed', '1') } catch {} tell() })
}
function deviceOf() {
  const ua = navigator.userAgent
  const ios = /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  if (ios) return /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua) ? 'ios-other' : 'ios'
  if (/android/i.test(ua)) return /SamsungBrowser/.test(ua) ? 'samsung' : /Firefox/.test(ua) ? 'android-firefox' : 'android'
  if (/Safari/.test(ua) && !/Chrome|Chromium|Edg/.test(ua)) return 'mac-safari'
  return /Chrome|Chromium|Edg/.test(ua) ? 'computer' : 'none'
}
export function useInstall() {
  const [s, setS] = useState({ show: false, offer: null, device: 'none' })
  useEffect(() => {
    if (!onMeetApp()) return                                        // the install files live on the Meet address only
    let alive = true, installedHere = false
    const standalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
    const work = () => {
      if (!alive) return
      const device = deviceOf()
      let just = false; try { just = sessionStorage.getItem('meet-installed') === '1' } catch {}
      if (standalone() || installedHere || (just && !saved)) return setS({ show: false, offer: null, device })
      if (saved) return setS({ show: true, offer: saved, device })
      // no offer from the browser: steps where adding by hand works; on Chrome for computers, the offer comes when it can
      setS({ show: ['ios', 'ios-other', 'android', 'samsung', 'android-firefox', 'mac-safari'].includes(device), offer: null, device })
    }
    subs.add(work); work()
    if (navigator.getInstalledRelatedApps) navigator.getInstalledRelatedApps().then((apps) => { if (apps && apps.length) { installedHere = true; work() } }).catch(() => {})
    const mq = window.matchMedia('(display-mode: standalone)'), onMq = () => work()
    if (mq.addEventListener) mq.addEventListener('change', onMq)
    return () => { alive = false; subs.delete(work); if (mq.removeEventListener) mq.removeEventListener('change', onMq) }
  }, [])
  return s
}
const DL = <svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19.5h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
const STEPS = {
  ios: ['Tap the Share button (the square with an arrow pointing up). It’s at the bottom of Safari, or at the top on iPad.', 'Scroll down and tap “Add to Home Screen”. Don’t see it? Tap “Edit Actions” at the bottom and add it.', 'Tap “Add” at the top right.', 'Open Olexweb Meet from the new icon on your home screen.'],
  'ios-other': ['Tap the Share button: at the top right of the address bar in Chrome, or in the menu of other browsers.', 'Tap “Add to Home Screen”. Not there? Open this page in Safari and tap Share, then “Add to Home Screen”.', 'Tap “Add”.', 'Open Olexweb Meet from the new icon on your home screen.'],
  android: ['Tap the menu (⋮) at the top right of Chrome.', 'Tap “Install app” or “Add to Home screen”.', 'Tap “Install”.', 'Open Olexweb Meet from the new icon on your home screen.'],
  samsung: ['Tap the menu (☰) at the bottom right.', 'Tap “Add page to”, then “Home screen”.', 'Tap “Add”.', 'Open Olexweb Meet from the new icon on your home screen.'],
  'android-firefox': ['Tap the menu (⋮).', 'Tap “Install” or “Add to Home screen”.', 'Tap “Add”.', 'Open Olexweb Meet from the new icon on your home screen.'],
  'mac-safari': ['In the menu bar, click File.', 'Click “Add to Dock”.', 'Click “Add”.', 'Open Olexweb Meet from your Dock.'],
  computer: ['Click the install icon at the right of the address bar (a small screen with an arrow).', 'Or open the browser’s menu (⋮) and choose “Install Olexweb Meet”.', 'Click “Install”.', 'Open it from your desktop or Start menu.'],
}
let stepsOpen = false                                               // the steps sheet lives outside the top bar (InstallSteps)
const setStepsOpen = (v) => { stepsOpen = v; tell() }
export function InstallButton({ big = false }) {
  const { show, offer } = useInstall()
  if (!show) return null
  async function go() {
    if (offer) { try { offer.prompt(); const c = await offer.userChoice; if (c && c.outcome === 'accepted') { saved = null; try { sessionStorage.setItem('meet-installed', '1') } catch {} tell() } } catch { setStepsOpen(true) } return }
    setStepsOpen(true)
  }
  return <button className={big ? 'btn' : 'btn sm install-btn'} onClick={go} aria-label="Install the Olexweb Meet app">{DL}<span>{big ? 'Install the app' : 'Install'}</span></button>
}
export function InstallSteps() {
  const { device } = useInstall(), [, bump] = useState(0)
  useEffect(() => { const f = () => bump((n) => n + 1); subs.add(f); return () => subs.delete(f) }, [])
  if (!stepsOpen) return null
  return (<Sheet title="Install Olexweb Meet" onClose={() => setStepsOpen(false)}><div className="inst">
    <p className="dim">It opens like an app, straight from your {device === 'mac-safari' || device === 'computer' ? 'computer' : 'home screen'}, and it’s free.</p>
    <ol>{(STEPS[device] || STEPS.computer).map((t, i) => <li key={i}><span className="n">{i + 1}</span><span>{t}</span></li>)}</ol>
    <button className="btn go" onClick={() => setStepsOpen(false)}>Done</button></div></Sheet>)
}

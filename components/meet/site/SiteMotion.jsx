'use client'
// The website's motion and small interactions (Install 58g): sections rise in as you scroll, numbers count up, the phone
// menu, the sign-up button that appears after the first screen, tabs, and the "what you keep" calculator. Everything
// works without it too (content shows; links work). People who prefer less motion get none.
import { useEffect } from 'react'

const pct = { ticket: 5, membership: 7, directory: 10 }                      // same maths as lib/meet/money.js
function keep(naira, kind) {
  const p = Math.round(naira * 100), o = Math.floor((p * pct[kind]) / 100), s = Math.min(Math.ceil((p * 150) / 10000) + (p >= 250000 ? 10000 : 0), 200000)
  return { p, fees: o + s, h: p - o - s }
}
const N = (k) => '₦' + (k / 100).toLocaleString('en-NG', { minimumFractionDigits: k % 100 ? 2 : 0, maximumFractionDigits: 2 })

export default function SiteMotion() {
  useEffect(() => {
    const root = document.querySelector('.ms'); if (!root) return
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches
    // rise in, and count up
    const count = (el) => { const to = +el.dataset.count, suf = el.dataset.suffix || ''; if (calm) { el.textContent = to + suf; return } let t0 = null; const f = (t) => { t0 ??= t; const k = Math.min(1, (t - t0) / 1200); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))).toLocaleString() + suf; if (k < 1) requestAnimationFrame(f) }; requestAnimationFrame(f) }
    const rv = [...root.querySelectorAll('.rv')]
    let io = null
    if (calm || !('IntersectionObserver' in window)) { rv.forEach((x) => x.classList.add('in')); root.querySelectorAll('[data-count]').forEach(count) }
    else {
      io = new IntersectionObserver((es) => es.forEach((e) => { if (!e.isIntersecting) return; e.target.classList.add('in'); e.target.querySelectorAll('[data-count]').forEach(count); io.unobserve(e.target) }), { threshold: 0.12, rootMargin: '0px 0px -40px 0px' })
      rv.forEach((x) => io.observe(x))
    }
    // the phone menu
    const drawer = root.querySelector('[data-drawer]')
    const open = () => { drawer.classList.add('on'); document.documentElement.style.overflow = 'hidden'; const f = drawer.querySelector('a'); if (f) f.focus() }
    const close = () => { drawer.classList.remove('on'); document.documentElement.style.overflow = '' }
    const onClick = (e) => {
      if (e.target.closest('[data-open-drawer]')) open()
      else if (e.target.closest('[data-close-drawer]') || e.target === drawer || (drawer.contains(e.target) && e.target.closest('a'))) close()
      const tab = e.target.closest('[data-tab]')
      if (tab) { const g = tab.closest('[data-tabs]'); g.querySelectorAll('[data-tab]').forEach((b) => { const on = b === tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', on) }); g.parentElement.querySelectorAll('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== tab.dataset.tab }) }
    }
    const onKey = (e) => { if (e.key === 'Escape') close() }
    root.addEventListener('click', onClick); document.addEventListener('keydown', onKey)
    // the sign-up button on phones, after the first screen
    const sticky = root.querySelector('[data-sticky]'), onScroll = () => sticky && sticky.classList.toggle('on', scrollY > innerHeight * 0.9 && innerHeight + scrollY < document.body.scrollHeight - 400)
    addEventListener('scroll', onScroll, { passive: true }); onScroll()
    // the top bar: if big text makes it too full, the "Start free" button steps aside (it is in the menu and the page too)
    const nav = root.querySelector('nav.top'), fit = () => { if (!nav) return; nav.classList.remove('tight'); const w = nav.querySelector('.wrap'); if (w && w.scrollWidth > w.clientWidth + 1) nav.classList.add('tight') }
    const ro = 'ResizeObserver' in window && nav ? new ResizeObserver(fit) : null; if (ro) ro.observe(nav); fit()
    // "what you keep"
    const calcs = [...root.querySelectorAll('[data-calc]')].map((c) => {
      const i = c.querySelector('input'), s = c.querySelector('select'), q = (x) => c.querySelector(x)
      const run = () => { const v = Math.max(0, Math.round(+i.value || 0)); if (v < 100) { q('.vh').textContent = 'From ₦100'; return } const r = keep(v, s.value); q('.vh').textContent = N(r.h); if (q('.vf')) q('.vf').textContent = '− ' + N(r.fees); if (q('.vt')) q('.vt').textContent = N(r.p); if (q('.bh')) { q('.bh').style.width = (r.h / r.p) * 100 + '%'; q('.bf').style.width = (r.fees / r.p) * 100 + '%' } }
      i.addEventListener('input', run); s.addEventListener('change', run); run(); return [i, s, run]
    })
    return () => { if (io) io.disconnect(); if (ro) ro.disconnect(); root.removeEventListener('click', onClick); document.removeEventListener('keydown', onKey); removeEventListener('scroll', onScroll); calcs.forEach(([i, s, run]) => { i.removeEventListener('input', run); s.removeEventListener('change', run) }) }
  }, [])
  return null
}

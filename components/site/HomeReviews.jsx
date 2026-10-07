'use client'
// The homepage review slider's controls. The reviews themselves are already on the page (and swipe natively),
// so if this fails, they still show. Arrows, dots, a counter, and a gentle auto-advance that stops for people.
import { useEffect } from 'react'

export default function HomeReviews() {
  useEffect(() => {
    const root = document.querySelector('.hr'); if (!root) return
    const track = root.querySelector('.hr-track'), slides = [...root.querySelectorAll('.hr-slide')], n = slides.length
    if (n < 2) return
    const count = root.querySelector('.hr-count'), dots = [...root.querySelectorAll('.hr-dot')]
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let at = 0, paused = false, visible = false, resumeTimer = null
    root.classList.add('on')
    const current = () => Math.round(track.scrollLeft / Math.max(1, slides[0].getBoundingClientRect().width + 16))
    const show = (i) => { at = (i + n) % n; track.scrollTo({ left: slides[at].offsetLeft - track.offsetLeft, behavior: reduce ? 'auto' : 'smooth' }) }
    const mark = () => { at = Math.min(n - 1, Math.max(0, current())); count.textContent = `${at + 1} / ${n}`; dots.forEach((d, k) => d.setAttribute('aria-current', String(k === at))) }
    const byPerson = () => { count.setAttribute('aria-live', 'polite'); paused = true; clearTimeout(resumeTimer); resumeTimer = setTimeout(() => { paused = false }, 12000) }
    const prev = root.querySelector('.hr-prev'), next = root.querySelector('.hr-next')
    prev.onclick = () => { byPerson(); show(at - 1) }; next.onclick = () => { byPerson(); show(at + 1) }
    dots.forEach((d, k) => { d.onclick = () => { byPerson(); show(k) } })
    let raf = 0; const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(mark) }
    track.addEventListener('scroll', onScroll, { passive: true })
    const stop = () => { paused = true; clearTimeout(resumeTimer) }, later = () => { clearTimeout(resumeTimer); resumeTimer = setTimeout(() => { paused = false }, 12000) }
    root.addEventListener('pointerenter', stop); root.addEventListener('pointerleave', later)
    root.addEventListener('touchstart', () => { byPerson() }, { passive: true }); root.addEventListener('focusin', stop); root.addEventListener('focusout', later)
    track.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') { e.preventDefault(); byPerson(); show(at + 1) } else if (e.key === 'ArrowLeft') { e.preventDefault(); byPerson(); show(at - 1) } })
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting }, { threshold: 0.4 }); io.observe(root)
    const auto = reduce ? null : setInterval(() => { if (!paused && visible && document.visibilityState === 'visible') { count.setAttribute('aria-live', 'off'); show(at + 1) } }, 7000)
    return () => { clearInterval(auto); clearTimeout(resumeTimer); io.disconnect(); track.removeEventListener('scroll', onScroll); root.classList.remove('on') }
  }, [])
  return null
}

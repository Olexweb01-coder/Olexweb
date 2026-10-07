'use client'
// The Blog page's extras, added after it loads (the approved page shows exactly as before if anything fails):
// real-only badges and counts, "Read by N people this month", and All articles / Saved tabs (saves live on this device).
import { useEffect } from 'react'

const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || '[]') } catch { return [] } }
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e }
const slugOf = (a) => (a.getAttribute('href') || '').replace(/^\/insights\//, '')

export default function BlogTools() {
  useEffect(() => {
    const main = document.querySelector('main'); if (!main) return
    const feat = main.querySelector('a.feat'), rows = [...main.querySelectorAll('ul.posts > li')]
    const links = [feat, ...rows.map((li) => li.querySelector('a.post'))].filter(Boolean)
    const slugs = links.map(slugOf).filter((s) => /^[a-z0-9-]{1,90}$/.test(s))
    if (!slugs.length) return
    const added = []
    const add = (node, where, ref) => { where.insertBefore(node, ref || null); added.push(node); return node }

    // tabs: All articles / Saved
    const tabs = el('div', 'olx-tabs'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Show')
    const allBtn = el('button', null, 'All articles'), savedBtn = el('button', null, 'Saved')
    for (const b of [allBtn, savedBtn]) { b.type = 'button'; b.setAttribute('role', 'tab'); tabs.appendChild(b) }
    const anchor = feat || main.querySelector('ul.posts')
    add(tabs, anchor.parentNode, anchor)
    const note = el('p', 'olx-note'); add(note, anchor.parentNode, null)
    const show = (saved) => {
      const mine = read('olx-saved').map((s) => s.slug)
      allBtn.setAttribute('aria-selected', String(!saved)); savedBtn.setAttribute('aria-selected', String(saved))
      savedBtn.textContent = `Saved (${mine.length})`
      for (const a of links) { const box = a.closest('li') || a; box.hidden = saved && !mine.includes(slugOf(a)) }
      note.hidden = !saved
      note.textContent = mine.length ? 'Saved on this device. No account needed, so your saves stay in this browser.' : 'Nothing saved yet. Tap Save on any article and it will wait for you here, on this device.'
      try { history.replaceState(null, '', saved ? '#saved' : location.pathname) } catch {}
    }
    allBtn.onclick = () => show(false); savedBtn.onclick = () => show(true)
    show(location.hash === '#saved')
    const resync = () => show(savedBtn.getAttribute('aria-selected') === 'true'); window.addEventListener('storage', resync)

    // real-only numbers and badges
    let alive = true
    fetch('/api/blog/stats?slugs=' + slugs.join(',')).then((r) => r.json()).then((j) => {
      if (!alive) return
      const P = j.posts || {}
      if (j.monthReads) { const sub = main.querySelector('.pg-hero .sub'); if (sub) add(el('p', 'olx-month', `${j.monthReads} reads this month.`), sub.parentNode, sub.nextSibling) }
      for (const a of links) {
        const s = P[slugOf(a)]; if (!s) continue
        const bits = [s.reads ? `${s.reads} reads` : null, s.likes != null ? `${s.likes} likes` : null].filter(Boolean)
        if (a === feat) {
          const top = a.querySelector('div'); if (top && s.badge) add(el('span', 'olx-badge', s.badge), top, top.firstChild)
          const meta = a.querySelector('.feat-meta'); if (meta) for (const b of bits) add(el('span', null, b), meta, null)
        } else {
          const t = a.querySelector('.post-t'); if (t && s.badge) add(el('span', 'olx-tag', s.badge), t, t.firstChild)   // inside the title: the row's grid is untouched
          const r = a.querySelector('.post-r'); if (r && bits.length) add(el('span', 'olx-nums', ' \u00b7 ' + bits.join(' \u00b7 ')), r, null)
        }
      }
    }).catch(() => {})
    return () => { alive = false; window.removeEventListener('storage', resync); for (const n of added) n.remove(); for (const a of links) { const b = a.closest('li') || a; b.hidden = false } }
  }, [])
  return <style dangerouslySetInnerHTML={{ __html: CSS }} />
}

const CSS = `
.olx-tabs{display:flex;gap:4px;margin:0 0 18px;padding:4px;border-radius:999px;background:#121412;border:1px solid rgba(242,239,233,.11);max-width:420px}
.olx-tabs button{appearance:none;flex:1;height:42px;border:0;border-radius:999px;background:transparent;color:rgba(242,239,233,.72);font:inherit;font-size:15px;font-weight:600;cursor:pointer}
.olx-tabs button[aria-selected="true"]{background:var(--paper,#f2efe9);color:var(--night,#0a0b0a);font-weight:700}
.olx-note{margin:18px 0 0;padding:16px 18px;border-radius:18px;background:#121412;border:1px solid rgba(242,239,233,.11);font-size:14px;line-height:1.55;color:rgba(242,239,233,.72)}
.olx-month{margin:12px 0 0;font-size:15px;color:rgba(242,239,233,.72)}
.olx-badge{display:inline-flex;align-items:center;height:28px;padding:0 10px;margin:0 0 10px;border-radius:999px;background:var(--green,#8fe36a);color:#0e1a0b;font-size:12.5px;font-weight:700}
.olx-tag{display:flex;width:max-content;align-items:center;height:24px;padding:0 9px;margin:0 0 8px;font-family:var(--body);letter-spacing:0;border-radius:999px;border:1px solid rgba(143,227,106,.45);color:var(--green,#8fe36a);font-size:12px;font-weight:700}
.olx-nums{color:inherit}
`

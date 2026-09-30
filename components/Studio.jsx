'use client'
import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import * as THREE from 'three'
import { initStudio } from '@/lib/engine'
import { site, person, work, services, process, insights, thinking, anthem, events } from '@/content/site'

export default function Studio() {
  const router = useRouter()
  const ref = useRef(null)
  useEffect(() => {
    document.body.classList.add('studio-page')
    let ok = true
    try { const c = document.createElement('canvas'); if (!(c.getContext('webgl') || c.getContext('experimental-webgl'))) ok = false } catch (e) { ok = false }
    if (!ok) { document.getElementById('nowebgl').classList.add('on'); return () => document.body.classList.remove('studio-page') }
    const cfg = {
      pano: '/studio/pano.jpg', panoLite: '/studio/pano-2048.jpg',
      surfaces: Object.assign({ mark: '/studio/mark.png' }, Object.fromEntries([1,2,3,4,5,6,7].map(i => ['photo_' + i, '/studio/photos/gallery-' + i + '.jpg'])),
        Object.fromEntries(work.map(w => ['site_' + w.key, '/studio/sites/' + w.key + '.jpg']))),
      sites: work.map(w => ({ key: w.key, name: w.name, url: w.url, embed: w.embed, text: w.text })),
      contact: { email: site.email, phone: site.phone, phoneDisplay: site.phoneDisplay, phone2: site.phone2, phone2Display: site.phone2Display, whatsapp: site.whatsapp },
      person, services, process, insights, thinking, guideName: site.guide, robot: true, music: site.music, anthem, events,
      onReadArticle: (slug) => router.push('/insights/' + slug),
    }
    ref.current = initStudio(THREE, cfg)
    return () => { document.body.classList.remove('studio-page'); if (ref.current) ref.current.destroy() }
  }, [router])
  return (
    <div id="studio-root" dangerouslySetInnerHTML={{ __html: `
<canvas id="studio" aria-hidden="true"></canvas>
<div id="book"><div id="book-inner"><button id="book-close" class="x" type="button" aria-label="Close the book">&times;</button><div id="book-measure" class="leaf" aria-hidden="true"><div class="face"></div></div><div id="book-cover"></div><div id="book-left"></div><div id="book-leaves"></div><div id="book-spine"></div><div id="book-controls"><span id="book-title"></span></div><button id="book-prev" class="barrow" type="button" aria-label="Previous page">&lsaquo;</button><button id="book-next" class="barrow" type="button" aria-label="Next page">&rsaquo;</button><div id="book-ctas"></div></div></div>
<div id="edge" aria-hidden="true"></div>
<div id="shade" aria-hidden="true"></div>
<svg id="hilite" aria-hidden="true"><polygon points="0,0" /></svg>
<div id="hilite-label"></div>
<div id="live"><div id="live-bar"><span>Live on the desk</span><button id="live-close" type="button">Back to the monitor</button></div><iframe id="live-frame" title="Website on the monitor" src="about:blank" referrerpolicy="no-referrer-when-downgrade"></iframe></div>
<div id="gallery"><button id="gallery-prev" type="button" aria-label="Previous photograph">&lsaquo;</button><button id="gallery-next" type="button" aria-label="Next photograph">&rsaquo;</button><div id="gallery-caption">Olaitan Adebayo</div><button id="gallery-story" type="button">The story</button><button id="gallery-close" type="button" aria-label="Close">&times;</button></div>
<div id="markers"></div>
<div id="orbit">
  <div id="orbit-ring"></div>
  <div id="orbit-col">
    <div id="orbit-head"></div>
    <div id="orbit-items"></div>
  </div>
</div>
<div id="orbit-detail">
  <button id="d-back" class="dback" type="button">&lsaquo; Back</button>
  <button id="d-close" class="x" type="button" aria-label="Close">&times;</button>
  <h3 id="d-title"></h3>
  <p id="d-text"></p>
  <a id="d-link" class="cta" href="#"></a><div id="d-ctas"></div>
</div>
<div id="veil"><img src="/studio/logo.png" alt="" width="180" /></div>

<div id="brand" class="hud"><img src="/studio/mark.png" alt="Olexweb" width="26" height="30" />Olexweb</div>
<button id="skip" class="pill hud" type="button">Skip arrival</button>
<button id="back" class="pill hud" type="button">Back to the studio</button>
<div id="sound" class="hud"><button id="sound-toggle" type="button" aria-label="Turn sound off"><svg viewBox="0 0 24 24" class="on-icon"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11"/></svg><svg viewBox="0 0 24 24" class="off-icon"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l4 6M21 9l-4 6"/></svg></button><button id="music-toggle" type="button" aria-label="Turn music off" title="Music"><svg viewBox="0 0 24 24" class="on-icon"><path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/></svg><svg viewBox="0 0 24 24" class="off-icon"><path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/><path d="M3 3l18 18"/></svg></button><input id="sound-vol" type="range" min="0" max="100" value="60" aria-label="Volume"></div>
<button id="overview" class="pill hud" type="button">See the studio</button>
<button id="ask" class="pill hud" type="button"><i></i>Ask Olex's AI</button>
<div id="hint" class="hud">Drag to look around. Scroll to zoom out. Click an object to go closer.</div>
<div id="caption" role="status" aria-live="polite"></div>
<div id="label"></div>



<div id="nowebgl"><p>The studio needs WebGL. Open it in a current version of Chrome, Edge, Safari or Firefox, or use the menu above.</p></div>

` }} />
  )
}

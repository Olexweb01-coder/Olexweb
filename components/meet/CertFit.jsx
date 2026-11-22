'use client'
// Fits the fixed-size certificate (1400×990) to the screen, and prints it. Without script it still shows, at full size.
import { useEffect, useRef } from 'react'
export default function CertFit({ children }) {
  const box = useRef(null)
  useEffect(() => {
    const el = box.current; if (!el) return
    const fit = () => { const c = el.firstElementChild; if (c) c.style.transform = `scale(${el.clientWidth / 1400})` }
    fit(); const ro = new ResizeObserver(fit); ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return <div className="cv" ref={box}>{children}</div>
}
export function PrintButton() {
  return <button type="button" className="pb-btn pb-go" onClick={() => window.print()}>Download as PDF</button>
}

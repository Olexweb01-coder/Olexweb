'use client'
// Share this post (Install 16): WhatsApp first (that's where people pass things on), then Facebook, X and copy link.
import { useState } from 'react'

export default function DirShare({ path, title }) {
  const [copied, setCopied] = useState(false)
  const url = 'https://olexweb.com' + path, text = encodeURIComponent(title + ' ' + url)
  const links = [['WhatsApp', 'https://wa.me/?text=' + text], ['Facebook', 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url)], ['X', 'https://x.com/intent/post?text=' + text]]
  async function copy() { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch {} }
  return (<div className="ds-share" aria-label="Share">
    <span>Share</span>{links.map(([n, h]) => <a key={n} href={h} target="_blank" rel="noopener noreferrer">{n}</a>)}<button onClick={copy}>{copied ? 'Copied' : 'Copy link'}</button>
    <style dangerouslySetInnerHTML={{ __html: `.ds-share{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:16px;font-size:14px}.ds-share>span{color:var(--dim);font-weight:700;margin-right:2px}
.ds-share a,.ds-share button{padding:9px 14px;border-radius:999px;border:1px solid var(--line);background:var(--card);color:var(--ink);font:700 14px var(--font-mona),system-ui;text-decoration:none;cursor:pointer}
.ds-share a:first-of-type{background:#25d366;border-color:#25d366;color:#062b12}` }} />
  </div>)
}

'use client'
// Renders the assistant's Markdown as React elements. No raw HTML is ever inserted, so nothing in an answer can run as code.
// Supports: headings, paragraphs, bold, italics, inline code, code blocks, bullet and numbered lists, tables, quotes, rules, links.
import { Fragment } from 'react'

const safeHref = (u) => (/^(https?:\/\/|mailto:)/i.test(u) || /^\/[a-z0-9\-/?=&#._]*$/i.test(u) ? u : null)

function inline(text, key = 'i') {
  const out = []; let rest = String(text), n = 0
  const RE = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]{1,200}\]\([^)\s]{1,500}\))|(\*[^*\s][^*]*\*|_[^_\s][^_]*_)/
  while (rest) {
    const m = rest.match(RE)
    if (!m) { out.push(rest); break }
    if (m.index) out.push(rest.slice(0, m.index))
    const tok = m[0], k = `${key}-${n++}`
    if (m[1]) out.push(<code key={k} className="md-code">{tok.slice(1, -1)}</code>)
    else if (m[2]) out.push(<strong key={k}>{inline(tok.slice(2, -2), k)}</strong>)
    else if (m[3]) { const [, label, href] = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/); const h = safeHref(href)
      out.push(h ? <a key={k} href={h} target={h.startsWith('/') ? undefined : '_blank'} rel={h.startsWith('/') ? undefined : 'noopener noreferrer'}>{label}</a> : label) }
    else out.push(<em key={k}>{inline(tok.slice(1, -1), k)}</em>)
    rest = rest.slice(m.index + tok.length)
  }
  return out
}

export default function Markdown({ text }) {
  const lines = String(text || '').replace(/\r/g, '').split('\n'), blocks = []
  for (let i = 0; i < lines.length;) {
    const l = lines[i]
    if (/^```/.test(l)) {                                                         // code block
      const body = []; i++
      while (i < lines.length && !/^```/.test(lines[i])) body.push(lines[i++])
      i++; blocks.push(<pre key={i} className="md-pre"><code>{body.join('\n')}</code></pre>); continue
    }
    if (/^\s*$/.test(l)) { i++; continue }
    let m
    if ((m = l.match(/^(#{1,4})\s+(.*)$/))) { const H = m[1].length <= 2 ? 'h3' : 'h4'; blocks.push(<H key={i} className="md-h">{inline(m[2], 'h' + i)}</H>); i++; continue }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(l)) { blocks.push(<hr key={i} className="md-hr" />); i++; continue }
    if (/^\s*\|.*\|\s*$/.test(l) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {   // table
      const cells = (s) => s.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
      const head = cells(l), rows = []; i += 2
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(cells(lines[i++]))
      blocks.push(<div key={i} className="md-table"><table><thead><tr>{head.map((h, j) => <th key={j}>{inline(h, `th${i}${j}`)}</th>)}</tr></thead>
        <tbody>{rows.map((r, a) => <tr key={a}>{r.map((c, b) => <td key={b}>{inline(c, `td${i}${a}${b}`)}</td>)}</tr>)}</tbody></table></div>); continue
    }
    if (/^\s*([-*•])\s+/.test(l) || /^\s*\d+[.)]\s+/.test(l)) {                    // lists
      const ordered = /^\s*\d+[.)]\s+/.test(l), items = []
      while (i < lines.length && (ordered ? /^\s*\d+[.)]\s+/ : /^\s*([-*•])\s+/).test(lines[i])) items.push(lines[i++].replace(/^\s*([-*•]|\d+[.)])\s+/, ''))
      const L = ordered ? 'ol' : 'ul'
      blocks.push(<L key={i} className="md-list">{items.map((t, j) => <li key={j}>{inline(t, `li${i}${j}`)}</li>)}</L>); continue
    }
    if (/^\s*>\s?/.test(l)) { const q = []; while (i < lines.length && /^\s*>\s?/.test(lines[i])) q.push(lines[i++].replace(/^\s*>\s?/, ''))
      blocks.push(<blockquote key={i} className="md-quote">{inline(q.join(' '), 'q' + i)}</blockquote>); continue }
    const para = [l]; i++                                                          // paragraph
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|```|\s*([-*•])\s|\s*\d+[.)]\s|\s*>|\s*\|.*\|\s*$)/.test(lines[i])) para.push(lines[i++])
    blocks.push(<p key={i} className="md-p">{para.map((p, j) => <Fragment key={j}>{j ? <br /> : null}{inline(p, `p${i}${j}`)}</Fragment>)}</p>)
  }
  return <div className="md">{blocks}</div>
}

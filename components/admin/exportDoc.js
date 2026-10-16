'use client'
// Turning an answer into a file: Word (.docx), Excel (.xlsx, from its tables) or PDF (your browser's "Save as PDF").
// Everything is built here in the browser; nothing is uploaded. The libraries load only when you tap a button.
import { download, safePath } from './zip'

const strip = (md) => String(md || '').split('<<<')[0].replace(/\n?\*Made with [^*]+\*\s*/g, '\n')
export const hasTable = (md) => /^\s*\|.*\|\s*$\n^\s*\|?\s*:?-{2,}/m.test(md)
export function titleOf(md) {
  const h = String(md).match(/^#{1,3}\s+(.+)$/m), first = String(md).replace(/[#*_`>|-]/g, ' ').trim().split(/\s+/).slice(0, 7).join(' ')
  return ((h && h[1]) || first || 'Olex AI document').replace(/[*_`]/g, '').trim().slice(0, 80)
}
const fileName = (title, ext) => safePath(title.replace(/[^\w\s.-]/g, '').trim().replace(/\s+/g, ' ') || 'Olex AI document').slice(0, 70) + '.' + ext

// A small Markdown reader shared by Word and Excel.
function blocks(md) {
  const lines = strip(md).replace(/\r/g, '').split('\n'), out = []
  for (let i = 0; i < lines.length;) {
    const l = lines[i]
    if (/^\s*```/.test(l)) { const body = []; i++; while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) body.push(lines[i++]); i++; out.push({ t: 'code', text: body.join('\n') }); continue }
    if (/^\s*$/.test(l)) { i++; continue }
    let m
    if ((m = l.match(/^(#{1,6})\s+(.*)$/))) { out.push({ t: 'h', level: m[1].length, text: m[2] }); i++; continue }
    if (/^!\[/.test(l)) { i++; continue }
    if (/^\s*\|.*\|\s*$/.test(l) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const cells = (s) => s.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
      const rows = [cells(l)]; i += 2; while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(cells(lines[i++]))
      out.push({ t: 'table', rows }); continue
    }
    if (/^\s*([-*•]|\d+[.)])\s+/.test(l)) {
      const ordered = /^\s*\d+[.)]\s+/.test(l), items = []
      while (i < lines.length && /^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*([-*•]|\d+[.)])\s+/, ''))
      out.push({ t: 'list', ordered, items }); continue
    }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(l)) { i++; continue }
    const para = [l.replace(/^\s*>\s?/, '')]; i++
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|\s*([-*•]|\d+[.)])\s|\s*\|.*\|\s*$|!\[)/.test(lines[i])) para.push(lines[i++].replace(/^\s*>\s?/, ''))
    out.push({ t: 'p', text: para.join(' ') })
  }
  return out
}
// **bold**, *italic*, `code` and [links](url) as runs.
function runs(text) {
  const out = [], re = /(\*\*[^*]+\*\*)|(`[^`]+`)|(\*[^*\s][^*]*\*|_[^_\s][^_]*_)|(\[[^\]]+\]\([^)]+\))/g; let last = 0, m
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) })
    if (m[1]) out.push({ text: m[1].slice(2, -2), bold: true })
    else if (m[2]) out.push({ text: m[2].slice(1, -1), code: true })
    else if (m[3]) out.push({ text: m[3].slice(1, -1), italics: true })
    else { const [, label, url] = m[4].match(/^\[([^\]]+)\]\(([^)]+)\)$/); out.push({ text: `${label} (${url})` }) }
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ text: text.slice(last) })
  return out
}

export async function toWord(md) {
  const D = await import('docx'), title = titleOf(md)
  const run = (r) => new D.TextRun({ text: r.text, bold: r.bold, italics: r.italics, font: r.code ? 'Consolas' : undefined })
  const H = [D.HeadingLevel.HEADING_1, D.HeadingLevel.HEADING_1, D.HeadingLevel.HEADING_2, D.HeadingLevel.HEADING_3, D.HeadingLevel.HEADING_4, D.HeadingLevel.HEADING_5, D.HeadingLevel.HEADING_6]
  const children = []
  for (const b of blocks(md)) {
    if (b.t === 'h') children.push(new D.Paragraph({ heading: H[b.level], children: runs(b.text).map(run) }))
    else if (b.t === 'p') children.push(new D.Paragraph({ spacing: { after: 160 }, children: runs(b.text).map(run) }))
    else if (b.t === 'list') b.items.forEach((it, n) => children.push(new D.Paragraph({ bullet: b.ordered ? undefined : { level: 0 }, children: [...(b.ordered ? [new D.TextRun({ text: `${n + 1}. ` })] : []), ...runs(it).map(run)] })))
    else if (b.t === 'code') b.text.split('\n').forEach((ln) => children.push(new D.Paragraph({ children: [new D.TextRun({ text: ln || ' ', font: 'Consolas', size: 19 })] })))
    else if (b.t === 'table') {
      const width = Math.max(...b.rows.map((r) => r.length))
      children.push(new D.Table({ width: { size: 100, type: D.WidthType.PERCENTAGE }, rows: b.rows.map((r, ri) => new D.TableRow({ tableHeader: ri === 0,
        children: Array.from({ length: width }, (_, ci) => new D.TableCell({ children: [new D.Paragraph({ children: runs(r[ci] || '').map((x) => run({ ...x, bold: ri === 0 || x.bold })) })] })) })) }))
      children.push(new D.Paragraph({ text: '' }))
    }
  }
  const doc = new D.Document({ creator: 'Olex AI', title, styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } }, sections: [{ children }] })
  download(await D.Packer.toBlob(doc), fileName(title, 'docx'))
}

export async function toExcel(md) {
  const XLSX = await import('xlsx'), title = titleOf(md), wb = XLSX.utils.book_new()
  const tables = blocks(md).filter((b) => b.t === 'table'), num = (v) => { const s = String(v).replace(/[₦$£€,\s]/g, ''); return /^-?\d+(\.\d+)?%?$/.test(s) && s !== '' ? (s.endsWith('%') ? Number(s.slice(0, -1)) / 100 : Number(s)) : String(v).replace(/\*\*/g, '') }
  if (tables.length) tables.forEach((t, i) => { const ws = XLSX.utils.aoa_to_sheet(t.rows.map((r, ri) => r.map((c) => (ri === 0 ? c.replace(/\*\*/g, '') : num(c))))); ws['!cols'] = t.rows[0].map((_, ci) => ({ wch: Math.min(50, Math.max(10, ...t.rows.map((r) => String(r[ci] || '').length + 2))) })); XLSX.utils.book_append_sheet(wb, ws, tables.length > 1 ? `Table ${i + 1}` : 'Table') })
  else XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(strip(md).split('\n').filter((l) => l.trim()).map((l) => [l])), 'Text')
  download(new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName(title, 'xlsx'))
}

// PDF: the answer as it looks, on clean pages; your device's print screen offers "Save as PDF".
export function toPdf(htmlOfAnswer, md) {
  const title = titleOf(md), f = document.createElement('iframe')
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; f.setAttribute('aria-hidden', 'true')
  f.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><title>${title.replace(/</g, '&lt;')}</title><style>
    @page{margin:18mm 16mm} body{font:11pt/1.55 -apple-system,'Segoe UI',Calibri,Arial,sans-serif;color:#141814}
    h1,h2,h3,h4{font-family:inherit;line-height:1.2;margin:1.1em 0 .4em} h1{font-size:20pt} h2{font-size:15pt} h3{font-size:12.5pt}
    p{margin:0 0 .7em} ul,ol{margin:0 0 .8em;padding-left:1.4em} table{border-collapse:collapse;width:100%;margin:.4em 0 1em;font-size:10pt}
    th,td{border:1px solid #c9ccc4;padding:5px 7px;text-align:left;vertical-align:top} th{background:#eef0ea}
    pre{background:#f3f4f0;border:1px solid #dde0d8;border-radius:6px;padding:8px 10px;white-space:pre-wrap;font:9pt/1.45 Consolas,monospace} code{font-family:Consolas,monospace}
    img{max-width:100%;border-radius:6px} blockquote{border-left:3px solid #8fe36a;margin:0 0 .8em;padding-left:10px;color:#555}
    .code-bar,.code-out,.code-zip,.fb,.learned,.msgmeta,figcaption button,.md-img a{display:none!important} .md-code{background:#f0f2ec;padding:0 3px;border-radius:3px}
  </style></head><body>${htmlOfAnswer}</body></html>`
  f.onload = () => { setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print() } catch {} setTimeout(() => f.remove(), 60000) }, 200) }
  document.body.appendChild(f)
}

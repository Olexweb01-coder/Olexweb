'use client'
// Reading documents in the browser, so files of any size never pass through the server's 4.5 MB upload limit.
// The exact text and tables are taken out by code (not guessed by AI): PDF (pdf.js), Word (mammoth), Excel and CSV
// (SheetJS). Only scanned pages and photos go to an AI vision model, to read the text in them.
export const DOC_RE = /\.(pdf|docx|xlsx|xlsm|xls|ods|csv|tsv|png|jpe?g|webp|gif)$/i
const MAX_CHARS = 3_000_000, MAX_SCANS = 15

async function vision(blob, purpose) {
  const dataUrl = await new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = bad; r.readAsDataURL(blob) })
  const r = await fetch('/admin/api/vision', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ image: dataUrl, purpose }) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || 'The image couldn’t be read.')
  return j.text || ''
}
// Shrink a picture to a sensible size before it goes anywhere.
async function shrink(source, max = 1600, quality = 0.8) {
  const bmp = source instanceof HTMLCanvasElement ? source : await createImageBitmap(source)
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas')
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale)
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height)
  return new Promise((ok) => c.toBlob(ok, 'image/jpeg', quality))
}

async function pdf(file, say) {
  const pdfjs = await import('pdfjs-dist/build/pdf')
  pdfjs.GlobalWorkerOptions.workerSrc = '/olex/pdf.worker.min.js'
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise
  const pages = doc.numPages, out = []; let scans = 0, skipped = 0
  for (let i = 1; i <= pages; i++) {
    say(`Reading page ${i} of ${pages}…`)
    const page = await doc.getPage(i), tc = await page.getTextContent()
    let t = ''; for (const it of tc.items) { t += it.str; t += it.hasEOL ? '\n' : (it.str && !/\s$/.test(it.str) ? ' ' : '') }
    t = t.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
    if (t.replace(/\s/g, '').length < 25) {                                   // no real text on the page: a scan or a photo
      if (scans < MAX_SCANS) {
        scans++; say(`Page ${i} is a scan. Reading it with AI (${scans})…`)
        const vp = page.getViewport({ scale: 1.7 }), c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height
        await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise
        try { t = await vision(await shrink(c, 1800, 0.75), 'ocr') } catch (e) { t = `[This page is a scan and couldn’t be read: ${e.message}]` }
      } else { skipped++; t = '[Scanned page not read: only the first 15 scanned pages are read.]' }
    }
    out.push(`--- Page ${i} ---\n${t}`)
  }
  return { text: out.join('\n\n'), pages, note: scans ? `${scans} scanned page${scans === 1 ? '' : 's'} read with AI${skipped ? `, ${skipped} skipped` : ''}` : '' }
}

// Word: headings, lists and tables are kept, as Markdown.
function htmlToMarkdown(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html'), out = []
  const text = (n) => n.textContent.replace(/\s+/g, ' ').trim()
  const walk = (n) => {
    for (const el of n.children) {
      const tag = el.tagName.toLowerCase()
      if (/^h[1-6]$/.test(tag)) out.push('#'.repeat(Number(tag[1])) + ' ' + text(el))
      else if (tag === 'p') { const t = text(el); if (t) out.push(t) }
      else if (tag === 'ul' || tag === 'ol') [...el.children].forEach((li, i) => out.push((tag === 'ol' ? `${i + 1}. ` : '- ') + text(li)))
      else if (tag === 'table') {
        const rows = [...el.querySelectorAll('tr')].map((tr) => [...tr.children].map((c) => text(c).replace(/\|/g, '/')))
        if (rows.length) { out.push('| ' + rows[0].join(' | ') + ' |', '|' + rows[0].map(() => '---').join('|') + '|', ...rows.slice(1).map((r) => '| ' + r.join(' | ') + ' |')) }
      } else walk(el)
    }
  }
  walk(doc.body); return out.join('\n\n')
}
async function word(file) {
  const mammoth = (await import('mammoth/mammoth.browser')).default || (await import('mammoth/mammoth.browser'))
  const r = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() })
  return { text: htmlToMarkdown(r.value), pages: null }
}
async function sheet(file) {
  const XLSX = await import('xlsx')
  const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array', cellDates: true })
  const parts = wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name], csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false }).trim()
    const rows = csv ? csv.split('\n').length : 0
    return `## Sheet: ${name} (${rows} row${rows === 1 ? '' : 's'})\n\`\`\`csv\n${csv}\n\`\`\``
  })
  return { text: parts.join('\n\n'), pages: wb.SheetNames.length }
}
async function picture(file, say) {
  say('Reading the image with AI…')
  return { text: await vision(await shrink(file), 'describe'), pages: null }
}

export async function readDocument(file, say = () => {}) {
  const name = file.name, ext = (name.split('.').pop() || '').toLowerCase()
  let r
  if (ext === 'pdf') r = await pdf(file, say)
  else if (ext === 'docx') r = await word(file)
  else if (['xlsx', 'xlsm', 'xls', 'ods', 'csv', 'tsv'].includes(ext)) r = await sheet(file)
  else if (/^(png|jpe?g|webp|gif)$/.test(ext)) r = await picture(file, say)
  else throw new Error(`${name} isn’t a supported document.`)
  let text = (r.text || '').trim()
  if (!text) throw new Error(`No text was found in ${name}.`)
  let cut = false; if (text.length > MAX_CHARS) { text = text.slice(0, MAX_CHARS); cut = true }
  return { name, kind: ext, text, pages: r.pages, note: [r.note, cut && 'very long, so only the first 3 million characters were kept'].filter(Boolean).join('; ') }
}

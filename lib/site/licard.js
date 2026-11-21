// Install 44: the key in a LinkedIn picture's link, so only the site itself can fetch it (to upload it to LinkedIn)
import { createHash } from 'node:crypto'
export const cardKey = (id) => createHash('sha256').update(String(process.env.AUTH_SECRET || '') + ':li-card:' + id).digest('hex').slice(0, 20)
// Install 45: a carousel for LinkedIn is a PDF, one slide per page. The slides come as PNG pictures; each is turned into a
// JPEG (sharp) and laid on its own 1080 × 1350 page. A tiny PDF writer, so nothing new needs installing.
export async function slidesToPdf(pngs) {
  const sharp = (await import('sharp')).default
  const jpgs = []
  for (const p of pngs) jpgs.push(await sharp(p).flatten({ background: '#ffffff' }).jpeg({ quality: 88 }).toBuffer())
  const W = 1080, H = 1350, parts = [], offs = []
  let len = 0
  const add = (b) => { const buf = Buffer.isBuffer(b) ? b : Buffer.from(b, 'latin1'); parts.push(buf); len += buf.length }
  const obj = (n, body) => { offs[n] = len; add(`${n} 0 obj\n`); for (const b of [].concat(body)) add(b); add('\nendobj\n') }
  add('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n')
  const n = jpgs.length, kids = jpgs.map((_, i) => `${3 + i * 3} 0 R`).join(' ')
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>')
  obj(2, `<< /Type /Pages /Kids [${kids}] /Count ${n} >>`)
  jpgs.forEach((j, i) => {
    const pg = 3 + i * 3, cs = pg + 1, im = pg + 2, draw = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`
    obj(pg, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 ${im} 0 R >> >> /Contents ${cs} 0 R >>`)
    obj(cs, [`<< /Length ${draw.length} >>\nstream\n`, draw, '\nendstream'])
    obj(im, [`<< /Type /XObject /Subtype /Image /Width ${W} /Height ${H} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${j.length} >>\nstream\n`, j, '\nendstream'])
  })
  const total = 3 + n * 3, xref = len
  add(`xref\n0 ${total}\n0000000000 65535 f \n`)
  for (let k = 1; k < total; k++) add(String(offs[k]).padStart(10, '0') + ' 00000 n \n')
  add(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`)
  return Buffer.concat(parts)
}

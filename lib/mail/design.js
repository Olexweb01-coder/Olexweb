// Olexweb Mail's email design, shared by every email the site sends: a dark header with the logo, a white card, a footer.
// Table layout and inline styles (what Gmail, Outlook and phone mail apps reliably show). brand: 'meet' (Olexweb Meet,
// its icon and link) or 'olexweb' (Olexweb, the main logo and olexweb.com).
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const meetSite = () => (process.env.MEET_ORIGIN || 'https://meet.olexweb.com').replace(/\/$/, '')
const mainSite = () => (process.env.MAIN_ORIGIN || 'https://olexweb.com').replace(/\/$/, '')
export function frame({ preheader, heading, body, foot, brand = 'meet' }) {
  const meet = brand === 'meet', s = meet ? meetSite() : mainSite(), icon = meetSite() + '/meet/icon-192.png'
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>${esc(heading)}</title></head>
<body style="margin:0;padding:0;background:#eef0ec;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef0ec"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:18px;overflow:hidden;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#151815">
<tr><td style="background:#0a0b0a;padding:22px 28px">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
  <td style="vertical-align:middle"><img src="${meet ? icon : mainSite() + '/icon.png'}" width="40" height="40" alt="" style="display:block;border:0;border-radius:10px"></td>
  <td style="vertical-align:middle;padding-left:12px;font-size:19px;font-weight:700;color:#f2efe9;letter-spacing:-.2px">${meet ? 'Olexweb <span style="color:#8fe36a">Meet</span>' : 'Olexweb'}</td>
  </tr></table></td></tr>
<tr><td style="padding:32px 28px 8px"><h1 style="margin:0 0 14px;font-size:24px;line-height:1.25;font-weight:800;color:#151815">${esc(heading)}</h1>${body}</td></tr>
<tr><td style="padding:8px 28px 28px;font-size:13px;line-height:1.6;color:#6b6f69">${foot}</td></tr>
</table>
<p style="margin:16px 0 0;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#7b7f78">${meet ? 'Olexweb Meet' : 'Olexweb'}, <a href="${s}" style="color:#4c8a33;text-decoration:none">${s.replace(/^https?:\/\//, '')}</a></p>
</td></tr></table></body></html>`
}
export const p = (t) => `<p style="margin:0 0 14px;font-size:15.5px;line-height:1.6;color:#2b2f2a">${t}</p>`

// Admin → Mail → Send test: proof the platform works, in the same design as every other email
export function testEmail({ pipes = [], from = '' }) {
  const when = new Date(Date.now() + 3600e3).toISOString().replace('T', ' ').slice(0, 16) + ' (Lagos)'
  const row = (k, v) => `<tr><td style="padding:8px 0;border-top:1px solid #e6ebe2;font-size:14px;color:#6b6f69;width:130px">${k}</td><td style="padding:8px 0;border-top:1px solid #e6ebe2;font-size:14px;color:#151815">${v}</td></tr>`
  const order = pipes.map((x, i) => `${i + 1}. ${esc(x)}`).join('<br>') || 'none switched on'
  const body = p('If you’re reading this, <b>Olexweb Mail</b> is sending from your site and this email reached your inbox.')
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 18px">${row('Sent', when)}${row('From', esc(from))}${row('Pipes, in order', order)}</table>`
    + p('<span style="color:#6b6f69;font-size:14px">Admin → Mail shows which pipe carried it, and every email the site sends.</span>')
  return { subject: 'Olexweb Mail is working', html: frame({ brand: 'olexweb', preheader: 'Your own email platform is sending. This is a test from Admin → Mail.', heading: 'Olexweb Mail is working', body, foot: 'You sent this test from Admin → Mail. Nothing else to do.' }),
    text: `Olexweb Mail is working\n\nIf you’re reading this, Olexweb Mail is sending from your site and this email reached your inbox.\n\nSent: ${when}\nFrom: ${from}\nPipes, in order: ${pipes.join(', ') || 'none switched on'}\n\nAdmin → Mail shows which pipe carried it.` }
}

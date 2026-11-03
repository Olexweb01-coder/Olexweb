// Shared by the Automation screens (server and client): channel icons and the base styles.
// Styles go in with <style dangerouslySetInnerHTML>: as a text child, React escapes the quotes on the server, which broke
// rules like content:"" and made every Automation page re-render in the browser (hydration errors). Fixed CSS only, never user input.
export const ChIcon = {
  youtube: <svg viewBox="0 0 24 24" className="au-ci" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="4" /><path d="M10 9.2v5.6l4.8-2.8z" /></svg>,
  facebook: <svg viewBox="0 0 24 24" className="au-ci" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><path d="M13.5 20v-6.5H16l.4-3h-2.9V9c0-.9.3-1.4 1.5-1.4h1.5V5.1c-.3 0-1.2-.1-2.2-.1-2.2 0-3.6 1.3-3.6 3.7v1.8H8v3h2.7V20" /></svg>,
  instagram: <svg viewBox="0 0 24 24" className="au-ci" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5.5" /><circle cx="12" cy="12" r="4" /><circle cx="17.3" cy="6.7" r=".6" /></svg>,
  warn: <svg viewBox="0 0 24 24" className="au-wi" aria-hidden="true"><path d="M12 4 2.8 19.5h18.4z" /><path d="M12 10v4.2M12 16.8v.2" /></svg>,
}

export const CSS = `
.au{display:grid;gap:14px}
.au-ci{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linejoin:round;stroke-linecap:round;color:var(--green);flex:none}
.au-wi{width:20px;height:20px;fill:none;stroke:var(--warn,#e0a243);stroke-width:1.7;stroke-linejoin:round;stroke-linecap:round;flex:none;margin-top:2px}
.au-n{font-family:'Mona Sans',var(--font-body,inherit);font-variant-numeric:tabular-nums;font-weight:700}
.au-prod{display:flex;gap:14px;align-items:flex-start;padding:16px 18px;border-radius:20px;border:1px solid var(--line);background:var(--raise)}
.au-prod.au-short{border-color:rgba(224,162,67,.5);background:linear-gradient(0deg,rgba(224,162,67,.07),rgba(224,162,67,.07)),var(--raise)}
.au-prod p{margin:0;flex:1;font-size:14.5px;line-height:1.55;color:var(--paper)}
.au-ok{width:10px;height:10px;border-radius:50%;background:var(--green);margin-top:6px;flex:none;box-shadow:0 0 0 4px rgba(143,227,106,.15)}.au-ok.au-off{background:var(--faint);box-shadow:none}
.au-more{flex:none;padding:10px 18px;border-radius:999px;border:1px solid var(--line);background:transparent;color:var(--paper);font:700 14px inherit;cursor:pointer;transition:background .15s,transform .1s}
.au-more:hover{background:rgba(var(--fg),.06)}.au-more:active{transform:scale(.97)}.au-more:disabled{opacity:.6;cursor:default}
@media (max-width:640px){.au-prod{flex-wrap:wrap}.au-prod p{flex:1 1 calc(100% - 34px)}.au-prod .au-more{margin-left:34px}}
.au-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
@media (max-width:1000px){.au-cards{grid-template-columns:1fr}}
.au :where(a).au-card{display:grid;align-content:start;gap:14px;padding:18px;border-radius:20px;border:1px solid var(--line);background:var(--raise);color:var(--paper);text-decoration:none;transition:border-color .15s,transform .15s}
.au :where(a).au-card:hover{border-color:rgba(143,227,106,.35)}
.au-ch{display:flex;align-items:center;gap:10px}.au-ch b{font-size:17px;font-weight:800}
.au-pill{padding:3px 10px;border-radius:999px;font-size:12px;font-weight:800;background:rgba(var(--fg),.08);color:var(--dim)}
.au-pill.au-on{background:rgba(143,227,106,.14);color:var(--green)}.au-pill.au-warn{background:rgba(224,162,67,.15);color:var(--warn,#e0a243)}.au-pill.au-bad{background:rgba(255,138,138,.14);color:var(--bad,#ff8a8a)}
.au-rows{display:grid;margin:0}.au-rows>div{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-top:1px solid var(--line);font-size:14px}.au-rows>div:first-child{border-top:0;padding-top:0}
.au-rows dt{color:var(--paper)}.au-rows dd{margin:0;color:var(--dim);text-align:right;font-family:'Mona Sans',var(--font-body,inherit);font-variant-numeric:tabular-nums}
.au-note{margin:0;font-size:14px;line-height:1.6;color:var(--dim)}
.au-box{padding:18px;border-radius:20px;border:1px solid var(--line);background:var(--raise)}.au-box h2{margin:0 0 10px;font-size:17px;font-weight:800}
.au-list{list-style:none;margin:0;padding:0}.au-list li{display:flex;justify-content:space-between;gap:12px;padding:11px 0;border-top:1px solid var(--line);font-size:14px}.au-list li:first-child{border-top:0;padding-top:2px}
.au-list :where(a){color:var(--green);font-weight:700;text-decoration:none;white-space:nowrap}
`

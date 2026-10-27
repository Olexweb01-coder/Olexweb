// Shared styles for the Directory: brand colours only (Night, Paper, Green, Green-ink), Hubot + Mona (numbers in Mona).
export const DIR_CSS = `
.dx{--ink:#0a0b0a;--paper:#f2efe9;--card:color-mix(in srgb,#f2efe9 55%,#fff);--dim:rgba(10,11,10,.62);--line:rgba(10,11,10,.12);--g:#8fe36a;--gi:#0e1a0b;--ease:cubic-bezier(.2,.8,.2,1);
  background:var(--paper);color:var(--ink);font-family:var(--font-mona),system-ui,sans-serif;-webkit-font-smoothing:antialiased;min-height:100vh;overflow-x:clip}
html:has(.dx){background:#f2efe9}.dx *{box-sizing:border-box}.dx :where(a){color:inherit}.dx h1,.dx h2,.dx h3,.dx p{margin:0}.dx-w{max-width:1040px;margin:0 auto;padding:0 20px}
.dx-ico{width:18px;height:18px;flex:none;stroke:currentColor;fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.dx-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;height:62px}.dx-mark{display:flex;align-items:center;gap:10px;font-weight:800;font-size:15px;text-decoration:none}
.dx-mark span{width:26px;height:26px;border-radius:8px;background:var(--ink);display:grid;place-items:center}.dx-mark i{width:9px;height:9px;border-radius:2px;background:var(--g);transform:rotate(45deg)}
.dx-nav{display:flex;gap:16px;font-weight:700;font-size:14px}.dx-nav a{text-decoration:none;color:var(--dim)}.dx-nav a:hover{color:var(--ink)}
.dx-eb{display:inline-flex;gap:8px;align-items:center;font-size:12px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:var(--gi)}
.dx-h1{font-family:var(--font-hubot),system-ui;font-stretch:76%;font-weight:900;font-size:clamp(46px,10vw,104px);line-height:.88;letter-spacing:-.02em;margin-top:12px}
.dx-ln{display:block;overflow:hidden;padding-bottom:.04em}.dx-ln>span{display:inline-block;transform:translateY(105%);animation:dxUp .9s var(--ease) forwards}
.dx-lede{font-size:clamp(18px,4vw,22px);line-height:1.45;max-width:40ch;margin-top:16px;opacity:0;transform:translateY(12px);animation:dxIn .7s var(--ease) .45s forwards}
@keyframes dxUp{to{transform:none}}@keyframes dxIn{to{opacity:1;transform:none}}
.dx-badge{display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:999px;font-size:12px;font-weight:800;letter-spacing:.04em}.dx-free{background:var(--g);color:var(--gi)}.dx-freemium{background:color-mix(in srgb,var(--g) 35%,#fff);color:var(--gi)}.dx-paid{background:var(--ink);color:var(--paper)}.dx-unknown{background:rgba(10,11,10,.08);color:var(--dim)}
.dx-btn{position:relative;display:inline-flex;justify-content:center;align-items:center;gap:10px;padding:15px 22px;border:0;border-radius:999px;background:var(--ink);color:var(--paper);font:800 15.5px var(--font-mona),system-ui;text-decoration:none;cursor:pointer;overflow:hidden;transition:transform .25s var(--ease)}
.dx-btn:active{transform:scale(.97)}.dx-btn .dx-ico{transition:transform .3s var(--ease)}.dx-btn:hover .dx-ico{transform:translateX(4px)}.dx-btn.dx-g{background:var(--g);color:var(--gi)}
.dx-card{padding:18px;border-radius:20px;background:var(--card);border:1px solid var(--line)}
.dx-rv{transition:opacity .8s var(--ease),transform .8s var(--ease)}.dx-rv.dx-wait{opacity:0;transform:translateY(22px)}
.dx-foot{margin-top:56px;padding:26px 0 34px;border-top:1px solid var(--line);font-size:13.5px;color:var(--dim);display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}.dx-foot a{text-decoration:none}
.dx a:focus-visible,.dx button:focus-visible,.dx input:focus-visible,.dx summary:focus-visible{outline:3px solid var(--gi);outline-offset:3px}
@media(prefers-reduced-motion:reduce){.dx *{animation:none!important;transition:none!important}.dx-ln>span,.dx-lede{opacity:1!important;transform:none!important}}`
export const PRICE = { free: 'Free', freemium: 'Free + paid plans', paid: 'Paid', unknown: 'Pricing not stated' }

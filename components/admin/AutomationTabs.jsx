// The Automation heading and its tabs, shared by Overview, YouTube (its own pages, with their sub-tabs below), Facebook and Instagram.
const TABS = [['overview', 'Overview', '/admin/automation'], ['youtube', 'YouTube', '/admin/youtube'], ['facebook', 'Facebook', '/admin/automation/facebook'], ['instagram', 'Instagram', '/admin/automation/instagram']]
export default function AutomationHead({ current }) {
  return (<>
    <div className="top"><h1 className="d">Automation</h1></div>
    <nav className="au-tabs" aria-label="Automation">
      {TABS.map(([k, l, href]) => <a key={k} href={href} className="au-tab" aria-current={current === k ? 'page' : undefined}>{l}</a>)}
    </nav>
    <style>{`
.au-tabs{display:flex;gap:4px;margin:2px 0 18px;border-bottom:1px solid var(--line);overflow-x:auto;scrollbar-width:none}
.au-tabs::-webkit-scrollbar{display:none}
.au-tabs :where(a).au-tab{position:relative;padding:10px 14px 12px;font-weight:700;font-size:14.5px;color:var(--dim);text-decoration:none;white-space:nowrap;transition:color .15s}
.au-tabs :where(a).au-tab:hover{color:var(--paper)}
.au-tabs :where(a).au-tab[aria-current=page]{color:var(--paper)}
.au-tabs :where(a).au-tab[aria-current=page]::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;border-radius:2px;background:var(--green)}
`}</style>
  </>)
}

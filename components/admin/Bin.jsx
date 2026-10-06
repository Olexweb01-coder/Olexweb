'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from './icons'
import { act, toast } from './ui'
const NAME = { project: 'Project', post: 'Article', venture: 'Venture' }
const daysLeft = (d) => Math.max(0, 30 - Math.floor((Date.now() - new Date(d)) / 864e5))
export default function BinList({ items }) {
  const router = useRouter(), [busy, setBusy] = useState(null)
  async function go(it, action) {
    if (action === 'purge' && !window.confirm(`Delete "${it.name}" for good? This can't be undone.`)) return
    setBusy(it.type + it.id); const r = await act({ action, type: it.type, id: it.id }); setBusy(null)
    if (r.error) toast(r.error); else { toast(action === 'restore' ? 'Restored as hidden. Publish it when ready.' : 'Deleted for good.'); router.refresh() }
  }
  return (<>
    <div className="top"><h1 className="d">Bin</h1></div>
    {items.length ? <ul className="rows">{items.map((it) => (
      <li key={it.type + it.id} className="row bin-row"><span className="ic">{Icon.bin}</span>
        <span><span className="row-t">{it.name}</span><span className="row-s">{NAME[it.type]}. Deleted for good in {daysLeft(it.binned_at)} days.</span></span>
        <span className="acts"><button className="btn btn-line" disabled={busy === it.type + it.id} onClick={() => go(it, 'restore')}>Restore</button><button className="btn btn-bad" disabled={busy === it.type + it.id} onClick={() => go(it, 'purge')}>Delete</button></span></li>))}</ul>
      : <div className="empty">The bin is empty. Things you delete wait here for 30 days.</div>}
  </>)
}

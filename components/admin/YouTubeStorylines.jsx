// YouTube → Storylines (Install 32, in place of Ideas; Install 33: the 3D builds): what the channel shows, day by day. The websites and tools Olex AI finds go to the Directory instead.
const SERIES = [
  ['How it goes', 'You want something simple. The first fix is silly. It causes a problem, the next fix solves it and causes another… until the real invention is standing there: “Congratulations! You just built a car engine.”'],
  ['Topics', 'Anything in tech and the internet: the internet itself, phones, chips, AI, passwords, payments, search, maps, messaging, cameras, EVs, batteries, space, websites, games, gadgets, smart homes, Wi-Fi and more. A new one every time, never repeated.'],
  ['On screen', 'Every line shows something in 3D: pieces appear, connect, break, overheat, get swapped for something better. Anything without a 3D model becomes a labelled block, so no idea is off limits.'],
]
const dayName = (d, today) => d === today ? 'Today' : new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })
export default function YouTubeStorylines({ data }) {
  const yt = (data.channels || []).find((c) => c.key === 'youtube'), slots = yt ? yt.slots.filter((s) => s.status !== 'skipped' && s.day >= data.today) : []
  return (<div className="sl2">
    <section className="sl2-card"><h2>Coming up on YouTube</h2>
      {slots.length ? slots.map((s) => (<div key={s.id} className="sl2-row"><span className="sl2-day">{dayName(s.day, data.today)}<br /><small>{s.time}</small></span>
        <span><b>{s.formatName.replace(/^Story: /, '')}</b>{s.title ? <> · {s.title}</> : <> · being written</>}{s.story && s.story.logline ? <small>{s.story.logline}</small> : null}<small>{s.label}{s.hint ? ': ' + s.hint : ''}</small></span></div>))
        : <p className="sl2-note">{data.on ? 'The next videos are being planned.' : 'The plan is off. Turn it on in Automation → Plan.'}</p>}
      <a className="sl2-btn" href="/admin/automation/plan">Open the plan (approve, swap, change a title)</a></section>
    <section className="sl2-card"><h2>How every video works</h2>{SERIES.map(([n, t]) => <div key={n} className="sl2-row"><span className="sl2-day">{n}</span><span>{t}</span></div>)}
      <p className="sl2-note">The plan shows what each one turns out to be (the viewers only find out at the end).</p></section>
    <section className="sl2-card"><h2>The websites Olex AI finds</h2><p className="sl2-note" style={{ marginTop: 0 }}>They now become the Directory’s New tools: 5 to 10 a day, each with its own page that brings people to Olexweb.</p><a className="sl2-btn" href="/admin/directory">Open the Directory</a></section>
    <style dangerouslySetInnerHTML={{ __html: `.sl2{display:grid;gap:16px}.sl2-card{padding:18px 20px;border-radius:18px;background:var(--raise);border:1px solid var(--line)}.sl2-card h2{margin:0 0 8px;font-size:19px}
.sl2-row{display:grid;grid-template-columns:150px 1fr;gap:14px;padding:12px 0;border-top:1px solid var(--line);font-size:15px;line-height:1.45}.sl2-row:first-of-type{border-top:0}.sl2-row small{display:block;color:var(--dim);font-size:13.5px;margin-top:3px}
.sl2-day{font-weight:800}.sl2-note{color:var(--dim);font-size:14px;margin:10px 0 0}.sl2-btn{display:inline-block;margin-top:12px;padding:10px 16px;border-radius:999px;border:1px solid var(--line);color:var(--paper);font-weight:800;text-decoration:none}
@media (max-width:560px){.sl2-row{grid-template-columns:1fr;gap:4px}}` }} />
  </div>)
}

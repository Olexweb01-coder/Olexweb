// Drawn pieces of the website (Install 58g): a live-looking meeting, the "what you keep" calculator, small feature
// demos. Icons and shapes only (no emoji), in Olexweb's colours.
import { I } from '../app/icons'

export function Stage({ title = 'Design class · week 3', people = 32 }) {
  return (<div style={{ position: 'relative' }}>
    <div className="stage" aria-hidden="true">
      <div className="sbar"><span className="rec"><i />REC</span><b style={{ color: 'var(--fg)' }}>{title}</b><span className="sp" /><span>{people} here</span></div>
      <div className="tiles">
        <div className="tl big talk"><div className="av" style={{ background: '#8fe36a' }}>A</div><span className="nm">Ada · host</span><span className="bars"><i /><i /><i /></span></div>
        <div className="tl"><div className="av" style={{ background: '#e9c46a' }}>T</div><span className="nm">Tobi</span></div>
        <div className="tl"><div className="av" style={{ background: '#c9f2a8' }}>K</div><span className="nm">Kemi</span><span className="hand"><I n="star" className="ico" /></span></div>
      </div>
      <div className="ctrl"><span><I n="mic" className="ico" /></span><span><I n="video" className="ico" /></span><span><I n="chat" className="ico" /></span><span className="end" /></div>
      <span className="react"><I n="star" className="ico" /></span><span className="react r2"><I n="spark" className="ico" /></span><span className="react r3"><I n="check" className="ico" /></span>
    </div>
    <div className="chip c1" aria-hidden="true"><span className="ni bg-b"><I n="spark" className="ico" /></span><span><b>AI notes ready</b><small>Summary and 4 next steps</small></span></div>
    <div className="chip c2" aria-hidden="true"><span className="ni bg-y"><I n="trophy" className="ico" /></span><span><b>Level up! Level 5</b><small>Host</small></span></div>
    <div className="chip c3" aria-hidden="true"><span className="ni bg-g"><I n="coin" className="ico" /></span><span><b>Ticket sold</b><small>Paid to your bank weekly</small></span></div>
  </div>)
}
// "what you keep": only the total of fees is shown here; the full split lives in the app and the policies
export function Calc({ price = 5000, title = null, policy = '/meet/legal/earnings', style }) {
  return (<div className="calc" data-calc style={style}>
    {title ? <b style={{ fontSize: 20 }}>{title}</b> : null}
    <label>Your price (₦)<input type="number" defaultValue={price} min={100} inputMode="numeric" aria-label="Your price in naira" /></label>
    <label>What you sell<select defaultValue="ticket" aria-label="What you sell"><option value="ticket">A ticket, session, bundle or certificate</option><option value="membership">A monthly membership</option><option value="directory">A session booked from Find a mentor</option></select></label>
    <div className="barsplit" aria-hidden="true"><i className="bh" style={{ background: 'var(--g)' }} /><i className="bf" style={{ background: 'var(--gold)' }} /></div>
    <div className="split"><div><span>Price</span><b className="vt" /></div><div><span>All fees (payment and platform)</span><b className="vf" /></div><div className="t"><span>You keep</span><b className="vh" /></div></div>
    <small style={{ color: 'var(--faint)' }}>Exact, to the kobo. <a href={policy} style={{ textDecoration: 'underline' }}>How fees work</a></small>
  </div>)
}
export const Notes = () => (<div className="notes"><div><I n="spark" className="ico sm" /><span><b>Summary:</b> The launch moves to March.</span></div><div><I n="check" className="ico sm" /><span><b>Decision:</b> Kemi leads the design review.</span></div><div><I n="arrow" className="ico sm" /><span><b>Next:</b> Tobi sends the budget by Friday.</span></div></div>)
export const Poll = () => (<div className="poll"><div style={{ '--w': '68%' }}><i /><span>Morning</span><span className="num">68%</span></div><div style={{ '--w': '22%' }}><i /><span>Evening</span><span className="num">22%</span></div><div style={{ '--w': '10%' }}><i /><span>Weekend</span><span className="num">10%</span></div></div>)
export const Signal = () => <div className="signal">{[20, 35, 55, 80, 100].map((h) => <i key={h} style={{ '--h': h + '%' }} />)}</div>
export const Rooms = () => <div className="rooms"><span>A</span><span>B</span><span>C</span></div>
export const Lock = () => <div className="lock"><I n="lock" className="ico" /></div>
export function Check({ children }) { return <li><I n="check" className="ico sm" /><span>{children}</span></li> }

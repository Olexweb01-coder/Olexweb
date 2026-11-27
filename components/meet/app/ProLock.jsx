'use client'
// Install 58j: what a Free host is missing. Pro features show crossed out with a lock, with the way to unlock them (Pro, or
// Pro for one meeting). Only once prices are on; while everything is free, nothing is locked.
import { I } from './icons'
import { naira } from './ui'

export const lockedFor = (h) => !!(h && h.dash.pricing.on && !h.dash.plan.pro && !h.dash.plan.owner)
export const PRO_LIST = ['Video recording', 'All your past meetings and transcripts', 'Sell course bundles', 'Paid one-on-one sessions', 'Be listed in Find a mentor', 'Memberships for your community', 'Paid certificates']
export function ProLocked({ h, nav, title = 'You’re on Free', text = 'Everything you use now stays free. Pro unlocks these:', items = PRO_LIST, oneMeeting = true }) {
  if (!lockedFor(h)) return null
  const p = h.dash.pricing.prices
  return (<section className="card prolock"><div className="ch"><h3><span className="probadge">PRO</span>{title}</h3></div>
    <p className="dim" style={{ marginTop: 0 }}>{text}</p>
    <ul className="plist">{items.map((x) => <li key={x}><I n="lock" /><s>{x}</s></li>)}</ul>
    <div className="row-btns"><button className="btn go" onClick={() => nav('settings')}>Go Pro · {naira(p.month)}/month</button>
      {oneMeeting ? <button className="btn" onClick={() => nav('settings')}>Pro for one meeting · {naira(p.meeting)}</button> : null}</div></section>)
}
// a single locked line inside a form or list
export const LockLine = ({ children }) => <p className="lockline"><I n="lock" /><span><s>{children}</s> <b className="probadge">PRO</b></span></p>

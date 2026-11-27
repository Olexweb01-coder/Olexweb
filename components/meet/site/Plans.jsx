// Install 61: the three plans side by side (the pricing page and the landing page), with the prices from the admin:
// Free, Pro for one meeting, and Pro. No hooks, so a server page and a client page can both use it.
const naira = (n) => '₦' + Math.round(Number(n) || 0).toLocaleString('en-NG')

export const ONE_MEETING = ['Everything in Free', 'Video recording of that meeting', 'Certificates for your guests', 'Email reminders to everyone registered', 'AI notes emailed to guests after']
export function PlanCards({ p = {}, free = 100, freeHref, oneHref, proHref }) {
  const save = p.month && p.year ? p.month * 12 - p.year : 0
  return (<div className="plans three">
    <div className="plan rv"><b style={{ fontSize: 20 }}>Free</b><div className="price">₦0<small> forever</small></div>
      <ul><li>No time limit</li><li>Up to {free} people</li><li>Audio and video, screen sharing</li><li>MP3 recordings and AI notes</li><li>Polls, Q&amp;A, breakout rooms</li><li>Sell tickets, invite and earn</li></ul><a className="btn" href={freeHref}>Start free</a></div>
    <div className="plan one rv d1"><b style={{ fontSize: 20 }}>Pro for one meeting</b><div className="price">{p.meeting ? naira(p.meeting) : '–'}<small> one time</small></div>
      <small style={{ color: 'var(--dim)', marginTop: -8 }}>Pay once for a single meeting. No subscription.</small>
      <ul>{ONE_MEETING.map((x) => <li key={x}>{x}</li>)}</ul><a className="btn go" href={oneHref}>Choose one meeting</a></div>
    <div className="plan pro rv d2"><b style={{ fontSize: 20 }}>Pro</b><div className="price">{p.month ? naira(p.month) : '–'}<small> / month</small></div>
      {p.year ? <small style={{ color: 'var(--dim)', marginTop: -8 }}>or {naira(p.year)} a year{save > 0 ? `, saving ${naira(save)}` : ''}</small> : null}
      <ul><li>Everything in Free</li><li>Video recording</li><li>All past meetings and transcripts</li><li>Course bundles and paid sessions</li><li>Listed in Find a mentor</li><li>Memberships and paid certificates</li></ul><a className="btn go" href={proHref}>Go Pro</a></div>
  </div>)
}

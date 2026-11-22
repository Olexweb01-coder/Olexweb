// Features (Install 58g): everything Meet does, one idea per row.
import Site, { Section, Head, Final, PageHero, startHref, at } from '@/components/meet/site/Site'
import { Notes, Poll, Signal, Rooms, Lock, Check } from '@/components/meet/site/Bits'
import { I } from '@/components/meet/app/icons'
import { siteBase, pageMeta } from '@/lib/meet/site'
export const dynamic = 'force-dynamic'
export const generateMetadata = () => pageMeta('/features', 'Features', 'Audio and video meetings that stay light on data: AI notes, free MP3 recordings, polls, Q&A, breakout rooms, encryption, scheduling, attendance and certificates.')

const Row = ({ tag, title, text, list, flip, children }) => (<div className={'frow' + (flip ? ' flip' : '')}>
  <div className="rv"><span className="tag">{tag}</span><h3 style={{ marginTop: 14 }}>{title}</h3><p>{text}</p><ul className="checks">{list.map((x) => <Check key={x}>{x}</Check>)}</ul></div>
  <div className="vis rv d1" aria-hidden="true">{children}</div></div>)
const Ico = ({ n, c = 'bg-g' }) => <span className={'ni ' + c} style={{ width: 56, height: 56, borderRadius: 18, display: 'grid', placeItems: 'center' }}><I n={n} className="ico" /></span>

export default function Features() {
  const base = siteBase('/features')
  return (<Site base={base} active="/features">
    <PageHero pill="Features" title="Made for real meetings," accent="on real networks." text="Everything you need to teach, gather and work together, on any phone or computer. Guests never need an account or an app." >
      <div className="cta"><a className="btn go" href={startHref(base)}>Start a free meeting</a><a className="btn" href={at(base, '/pricing')}>See pricing</a></div></PageHero>
    <Section tight>
      <Row tag="Any network" title="Light on data. Strong on voice." text="Meet protects voice first and lowers video on its own when the signal drops, so people keep hearing each other." list={['Audio meetings or video, switch any time', 'Data saver turns other people’s cameras off', 'Noise cancellation keeps voices clear', 'Background blur on video']}><Signal /><p style={{ margin: 0, color: 'var(--dim)' }}>Video adjusts to each person’s connection.</p></Row>
      <Row flip tag="Olex AI" title="Notes that write themselves." text="Switch on AI notes and get a summary, the decisions made and the next steps, ready after the meeting." list={['Summary, decisions and next steps', 'Email the notes to everyone who came', 'The first 60 minutes of each meeting free', 'Transcripts of past meetings with Pro']}><Notes /></Row>
      <Row tag="Recording" title="Keep every word." text="Record audio as an MP3 for free, or video with Pro. Recordings are saved on your own device, not on our servers." list={['Free MP3 recordings', 'Video recording with Pro', 'Everyone can see when recording is on', 'Saved to your device']}><Ico n="mic" /><p style={{ margin: 0, color: 'var(--dim)' }}>Audio only · 48 min · 21 MB</p></Row>
      <Row flip tag="Classes" title="Run the room." text="Tools that make a class or workshop feel live: ask questions, split into groups, see who came." list={['Polls and Q&A, answered live', 'Breakout rooms, back with one tap', 'Hands up, reactions and chat', 'Screen sharing']}><Poll /><Rooms /></Row>
      <Row tag="Safety" title="Private when it matters." text="You decide who gets in and who can speak. Turn on end-to-end encryption and only the people in the meeting can see and hear it." list={['End-to-end encryption', 'A waiting room you control', 'Only people you allow can speak or share', 'Remove someone with one tap']}><Lock /></Row>
      <Row flip tag="Scheduling" title="Plan it, share it, see who came." text="Pick a time and get a ready-made invite. Guests add it to their calendar with reminders." list={['Google Calendar, Apple Calendar and Outlook', 'Your own room link that never changes', 'Ask guests for details when they join', 'Attendance list with an Excel download']}><Ico n="cal" c="bg-b" /><p style={{ margin: 0, color: 'var(--dim)' }}>Thursday, 7:00 PM · reminders on</p></Row>
      <Row tag="Certificates" title="Proof anyone can check." text="Give certificates to people who stayed. Each one has its own code and a public page that shows it is real." list={['Five designs', 'Your academy’s name and signature', 'A code and a check page for each one', 'Free or paid, your choice']}><Ico n="cert" c="bg-y" /><p style={{ margin: 0, color: 'var(--dim)' }}>Check code: 7KQ2-M9XA</p></Row>
      <Row flip tag="Levels" title="Every meeting counts." text="Earn XP, level up and unlock achievements you can share. Top hosts are celebrated every month." list={['Levels and achievements', 'Weekly streaks', 'Monthly leaderboard and spotlight', 'Share your achievement cards']}><Ico n="trophy" c="bg-y" /><p style={{ margin: 0, color: 'var(--dim)' }}>Level 5 · Host · 2,540 XP</p></Row>
      <Row tag="Install" title="An app, without the app store." text="Use it in the browser on any phone or computer, or install it from the browser in one tap." list={['Android, iPhone, Windows and Mac', 'A small floating window on Android and computers', 'Works in Chrome, Edge, Safari and Firefox', 'Nothing for guests to install']}><Ico n="video" /><p style={{ margin: 0, color: 'var(--dim)' }}>Add to Home Screen</p></Row>
    </Section>
    <Section alt>
      <Head eyebrow="How it works" title="Live in under a minute" center />
      <div className="steps"><div className="step rv"><h3>Start or schedule</h3><p>Tap New meeting, or pick a time. You get a link straight away.</p></div><div className="step rv d1"><h3>Share the link</h3><p>WhatsApp, email, anywhere. Guests tap and join from any phone or computer.</p></div><div className="step rv d2"><h3>Meet, then follow up</h3><p>Talk, share, poll. Afterwards, AI notes and certificates go out by themselves.</p></div></div>
    </Section>
    <Final base={base} second={<a className="btn" href={at(base, '/pricing')}>See pricing</a>} />
    <div style={{ height: 60 }} />
  </Site>)
}

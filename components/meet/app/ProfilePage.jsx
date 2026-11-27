'use client'
// My profile (Install 58): banner (a pattern, your own picture, or your bio), photo, level, numbers, activity,
// badges and achievement cards you can share or save.
import { useState } from 'react'
import { I } from './icons'
import { api, copyText, shareText, Ring, Sheet, Field, day } from './ui'

export const PATTERN_LIST = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']
// a picture from the phone or computer, cropped and made small before it leaves the device
async function shrink(file, w, h, maxBytes) {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url })
    const c = document.createElement('canvas'); c.width = w; c.height = h
    const s = Math.max(w / img.width, h / img.height), dw = img.width * s, dh = img.height * s
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh)
    for (const q of [0.86, 0.76, 0.64, 0.5]) { const d = c.toDataURL('image/jpeg', q); if (d.length * 0.75 < maxBytes) return d }
    throw new Error('That picture is too big. Try another.')
  } catch (e) { throw new Error(e && e.message ? e.message : 'That picture couldn’t be opened.') } finally { URL.revokeObjectURL(url) }
}
export default function ProfilePage({ ctx }) {
  const { h, reload, setToast } = ctx
  const [edit, setEdit] = useState(null), [banner, setBanner] = useState(null), [busy, setBusy] = useState('')
  if (!h) return <div className="wrap"><div className="cover skel" /></div>
  const me = h.me, lvl = h.level, c = h.community, s = h.dash.stats, earned = c.badges.filter((b) => b.earned)
  async function photo(file) {
    if (!file) return; setBusy('photo')
    try { const d = await shrink(file, 320, 320, 140_000); await api('/api/meet/home', { action: 'photo', data: d }); setToast('Photo saved.'); reload() } catch (x) { setToast(x.message) } finally { setBusy('') }
  }
  async function save(x) {
    x.preventDefault(); setBusy('save')
    try { await api('/api/meet/community', { action: 'profile', handle: edit.handle, bio: edit.bio, public: edit.public }); setEdit(null); setToast('Profile saved.'); reload() } catch (e) { setToast(e.message) } finally { setBusy('') }
  }
  const publicUrl = me.handle ? `${location.origin}/meet/h/${me.handle}` : ''
  return (<div className="wrap">
    <div className={'cover ' + (me.banner.kind === 'bio' ? 'bio ' : '') + (me.banner.kind === 'pattern' ? me.banner.pattern : '')} style={me.banner.kind === 'image' && me.bannerImg ? { backgroundImage: `url(/api/meet/pic/${me.id}?b=1&v=${me.banner.v || ''})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
      {me.banner.kind === 'bio' ? <span>{me.bio || 'Add a line about you in Edit profile.'}</span> : null}
      <button className="edit" onClick={() => setBanner({ kind: me.banner.kind, pattern: me.banner.pattern || 'p1' })}><I n="cam" />Banner</button></div>
    <div className="ph">
      <div className="avwrap"><Ring pct={lvl.pct} level={lvl.level} name={me.name} picture={me.picture} big />
        <label className="cam" aria-label="Change your photo" title="Change your photo"><I n="cam" /><input type="file" accept="image/*" hidden onChange={(x) => photo(x.target.files && x.target.files[0])} disabled={busy === 'photo'} /></label></div>
      <div className="info"><h1>{me.name}</h1><div className="meta">{lvl.title} · Level {lvl.level} · {lvl.xp.toLocaleString()} XP · since {day(me.since)}</div>
        {me.bio && me.banner.kind !== 'bio' ? <p className="dim" style={{ margin: '6px 0 0' }}>{me.bio}</p> : null}</div>
      <div className="acts"><button className="btn sm" onClick={() => setEdit({ handle: me.handle, bio: me.bio, public: me.public })}>Edit profile</button>
        {me.public && me.handle ? <a className="btn sm go" href={`/meet/h/${me.handle}`}>View public</a> : null}</div>
    </div>
    <div className="stats"><div className="stat"><span>Meetings</span><b>{s.meetings}</b><small>{s.people} joins</small></div><div className="stat"><span>Hours</span><b>{Math.round((s.minutes / 60) * 10) / 10}</b><small>hosted</small></div>
      <div className="stat"><span>Rating</span><b>{s.rating ? '★ ' + s.rating : '–'}</b><small>{s.ratings} ratings</small></div><div className="stat"><span>Streak</span><b>{c.streak}</b><small>weeks in a row</small></div></div>
    <section className="card"><div className="ch"><h3>Activity</h3><small className="dim">Meetings per week, last 26 weeks</small></div><div className="heat">{h.heat.map((n, i) => <i key={i} title={`${n} meeting${n === 1 ? '' : 's'}`} className={n >= 3 ? 'l3' : n === 2 ? 'l2' : n ? 'l1' : ''} />)}</div></section>
    <section className="card"><div className="ch"><h3>Achievements</h3><small className="dim">{earned.length} of {c.badges.length} · 10 earn a free Pro meeting</small></div>
      <div className="cards">{c.badges.map((b, i) => <div key={b.id} className={'acard ' + (b.earned ? 'g' + (i % 4) : 'off')}>
        {b.earned ? <button className="shr" aria-label={`Share ${b.name}`} onClick={async () => { const r = await shareText(`I earned “${b.name}” on Olexweb Meet`, me.public && me.handle ? `${location.origin}/meet/h/${me.handle}/a/${b.id}` : location.origin); if (r === 'copied') setToast('Copied.') }}><I n="out" /></button> : null}
        <span className="big"><I n={b.earned ? 'trophy' : 'lock'} /></span><div><h4>{b.name}</h4><small>{b.desc}</small></div>
        <div className="who"><span>{b.earned ? me.name : 'Locked'}</span>{b.earned ? <a href={`/api/meet/card?b=${b.id}`} download>Save</a> : <span>+100 XP</span>}</div></div>)}</div></section>
    {publicUrl && me.public ? <section className="card"><div className="ch"><h3>Your public link</h3></div><div className="reflink light"><code>{publicUrl}</code><button className="btn sm go" onClick={async () => { await copyText(publicUrl); setToast('Copied.') }}>Copy</button></div></section> : null}

    {edit ? <Sheet title="Edit profile" onClose={() => setEdit(null)}><form className="stack" onSubmit={save}>
      <Field label="Profile name (your address: /meet/h/name)"><input className="in" maxLength={30} value={edit.handle} onChange={(x) => setEdit({ ...edit, handle: x.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} placeholder="ada-teaches" /></Field>
      <Field label="About you"><textarea className="in" rows={3} maxLength={300} value={edit.bio} onChange={(x) => setEdit({ ...edit, bio: x.target.value })} /></Field>
      <label className="check"><input type="checkbox" checked={edit.public} onChange={(x) => setEdit({ ...edit, public: x.target.checked })} /><span>Show me publicly: my profile, ratings and reviews, the leaderboard, and people can follow me.</span></label>
      <div className="row-btns"><button className="btn go" disabled={busy === 'save'}>{busy === 'save' ? 'Saving…' : 'Save'}</button></div></form></Sheet> : null}
    {banner ? <BannerSheet b={banner} setB={setBanner} me={me} done={() => { setBanner(null); reload() }} setToast={setToast} /> : null}
  </div>)
}
function BannerSheet({ b, setB, me, done, setToast }) {
  const [busy, setBusy] = useState(false)
  async function save(data, kind = b.kind) {
    setBusy(true)
    try { await api('/api/meet/home', { action: 'banner', kind, pattern: b.pattern, ...(data ? { data } : {}) }); setToast('Banner saved.'); done() } catch (x) { setToast(x.message) } finally { setBusy(false) }
  }
  return (<Sheet title="Your banner" onClose={() => setB(null)}>
    <button className={'opt' + (b.kind === 'pattern' ? ' on' : '')} onClick={() => setB({ ...b, kind: 'pattern' })}><span className="ni bg-g"><I n="spark" /></span><span><b>A pattern</b><br /><small>In Olexweb’s colours</small></span></button>
    {b.kind === 'pattern' ? <div className="pick">{PATTERN_LIST.map((p) => <span key={p} role="button" tabIndex={0} aria-label={'Pattern ' + p.slice(1)} className={'cover ' + p + (b.pattern === p ? ' on' : '')} onClick={() => setB({ ...b, pattern: p })} onKeyDown={(x) => { if (x.key === 'Enter') setB({ ...b, pattern: p }) }} />)}</div> : null}
    <label className={'opt' + (b.kind === 'image' ? ' on' : '')}><span className="ni bg-o"><I n="cam" /></span><span><b>My own picture</b><br /><small>From your phone or computer</small></span>
      <input type="file" accept="image/*" hidden onChange={async (x) => { const f = x.target.files && x.target.files[0]; if (!f) return; try { const d = await shrink(f, 1500, 420, 380_000); setB({ ...b, kind: 'image' }); await save(d, 'image') } catch (e) { setToast(e.message) } }} /></label>
    <button className={'opt' + (b.kind === 'bio' ? ' on' : '')} onClick={() => setB({ ...b, kind: 'bio' })}><span className="ni bg-b"><I n="chat" /></span><span><b>My bio</b><br /><small>{me.bio ? `“${me.bio.slice(0, 60)}${me.bio.length > 60 ? '…' : ''}”` : 'Add a line about you in Edit profile first'}</small></span></button>
    <div className="row-btns"><button className="btn go" disabled={busy || b.kind === 'image'} onClick={() => save(null)}>{busy ? 'Saving…' : 'Save'}</button></div>
  </Sheet>)
}

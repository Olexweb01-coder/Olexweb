'use client'
import { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from './icons'
import { act, toast, Sheet, Notice } from './ui'

const PILL = { live: ['live', 'Live'], draft: ['draft', 'Draft'], waiting: ['draft', 'Waiting for approval'] }
const KW = ['Olaitan Adebayo', 'Olexweb', 'web developer', 'immersive digital experiences', '3D website design', 'business website design', 'Next.js developer', 'website that brings customers']
const fmt = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : 'Not published yet'
const slugify = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/['\u2019]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/, '')

export default function BlogBoard({ items, canPublish, isOwner }) {
  const router = useRouter(), [edit, setEdit] = useState(null)
  const close = useCallback(() => setEdit(null), [])
  return (<>
    <div className="top"><h1 className="d">Blog</h1><button className="btn btn-green" onClick={() => setEdit({ isNew: true, data: { body: [{ type: 'p', text: '' }], seo: {} } })}>Write</button></div>
    <Notice />
    <ul className="rows">{items.map((p) => (
      <li key={p.id} className="row click" onClick={() => setEdit({ data: p })}><span className="ic">{Icon.pen}</span>
        <span><span className="row-t">{p.title}</span><span className="row-s">{fmt(p.published_on)}, {p.minutes}-minute read</span></span>
        <span className={'pill ' + (PILL[p.status] || PILL.draft)[0]}>{(PILL[p.status] || PILL.draft)[1]}</span></li>))}</ul>
    {edit ? <PostEditor key={edit.data.id || 'new'} item={edit} canPublish={canPublish} isOwner={isOwner} onClose={close} onDone={() => { setEdit(null); router.refresh() }} /> : null}
  </>)
}

// The checklist: the same rules the preview showed (keyword overuse is judged from 300 words).
export function seoChecks({ keyword, title, description, body }) {
  const kw = (keyword || '').trim().toLowerCase(), st = title || '', sd = description || ''
  const text = body.map((b) => b.text).join(' '), words = text.split(/\s+/).filter(Boolean).length
  const first = (body.find((b) => b.type === 'p') || {}).text || '', heads = body.filter((b) => b.type === 'h').map((b) => b.text.toLowerCase())
  const hits = kw ? text.toLowerCase().split(kw).length - 1 : 0, density = words ? (hits * kw.split(/\s+/).length) / words * 100 : 0
  return [
    [!!kw, 'A focus keyword is chosen'],
    [!!kw && st.toLowerCase().includes(kw), 'The keyword is in the search title'],
    [!!kw && first.toLowerCase().includes(kw), 'The keyword is in the first paragraph'],
    [!!kw && heads.some((h) => h.includes(kw)), 'The keyword is in at least one heading'],
    [st.length >= 30 && st.length <= 60, 'Search title is 30 to 60 characters'],
    [sd.length >= 110 && sd.length <= 155, 'Search description is 110 to 155 characters'],
    [words >= 600, `At least 600 words (now ${words})`],
    [words >= 300 && density <= 3, words < 300 ? 'Keyword use is checked once the article reaches 300 words' : density > 3 ? 'The keyword is overused: Google penalises stuffing' : 'The keyword is not overused', words >= 300 && density > 3],
  ]
}

function PostEditor({ item, canPublish, isOwner, onClose, onDone }) {
  const p = item.data, seo0 = p.seo || {}
  const [title, setTitle] = useState(p.title || ''), [summary, setSummary] = useState(p.summary || '')
  const [body, setBody] = useState((p.body && p.body.length ? p.body : [{ type: 'p', text: '' }]).map((b, i) => ({ ...b, k: i + '-' + Math.random() })))
  const [seo, setSeo] = useState({ keyword: seo0.keyword || '', title: seo0.title || '', description: seo0.description || '' })
  const [slug, setSlug] = useState(p.slug || ''), [id, setId] = useState(p.id || null)
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const status = p.status || 'draft', isLive = status === 'live', locked = !canPublish && isLive
  const address = isLive ? p.slug : (slug || slugify(title) || 'new-article')
  const checks = useMemo(() => seoChecks({ ...seo, body }), [seo, body])
  const score = checks.filter((c) => c[0] && !c[2]).length

  const setBlock = (i, patch) => setBody(body.map((b, j) => (j === i ? { ...b, ...patch } : b)))
  const moveBlock = (i, d) => { const j = i + d; if (j < 0 || j >= body.length) return; const n = body.slice(); [n[i], n[j]] = [n[j], n[i]]; setBody(n) }
  const addBlock = (type) => setBody([...body, { type, text: '', k: Date.now() + '-' + Math.random() }])

  async function go(action, done) {
    setBusy(true); setErr('')
    const data = { title, summary, body: body.map(({ type, text }) => ({ type, text })), seo, slug: isLive ? p.slug : address }
    let r = { id }
    if (!locked && ['save', 'publish', 'submit'].includes(action)) { r = await act({ action: 'save', type: 'post', id, data }); if (!r.error) setId(r.id) }
    if (!r.error && action !== 'save') r = await act({ action, type: 'post', id: r.id })
    setBusy(false)
    if (r.error) { setErr(r.error); return }
    toast(done, action === 'publish'); onDone()
  }
  const foot = locked ? null : canPublish
    ? (isLive ? <><button className="btn btn-line" disabled={busy} onClick={() => go('hide', 'Taken off the site.')}>Unpublish</button><button className="btn btn-green" disabled={busy} onClick={() => go('publish', 'Published.')}>Save changes</button></>
              : <><button className="btn btn-line" disabled={busy} onClick={() => go('save', 'Draft saved.')}>Save draft</button><button className="btn btn-green" disabled={busy} onClick={() => go('publish', 'Published.')}>Publish</button></>)
    : <><button className="btn btn-line" disabled={busy} onClick={() => go('save', 'Draft saved.')}>Save draft</button><button className="btn btn-green" disabled={busy} onClick={() => go('submit', 'Sent to Olaitan for approval.')}>Send for approval</button></>

  return (<Sheet title={item.isNew ? 'New article' : 'Edit article'} onClose={onClose} foot={foot}>
    {locked ? <p className="read-only">This article is live. Only Olaitan can change it.</p> : null}
    <fieldset disabled={locked} style={{ border: 0, padding: 0, margin: 0 }}>
      <div className="field"><label htmlFor="bp1">Title</label><input className="input" id="bp1" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} /></div>
      <div className="field"><label htmlFor="bp2">Summary</label><textarea className="input" id="bp2" style={{ minHeight: 70 }} value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={320} placeholder="One or two sentences shown on the Blog page." /></div>
      <div className="field"><label>Article</label>
        {body.map((b, i) => (<div key={b.k} className={'block' + (b.type === 'h' ? ' h' : '')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <small>{b.type === 'h' ? 'Heading' : 'Paragraph'}</small>
            <span style={{ display: 'flex', gap: 4 }}>
              <button type="button" className="btn btn-line" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setBlock(i, { type: b.type === 'h' ? 'p' : 'h' })}>{b.type === 'h' ? 'Make paragraph' : 'Make heading'}</button>
              <button type="button" className="btn btn-line" style={{ padding: '4px 10px', fontSize: 12 }} aria-label="Move up" onClick={() => moveBlock(i, -1)}>Up</button>
              <button type="button" className="btn btn-line" style={{ padding: '4px 10px', fontSize: 12 }} aria-label="Move down" onClick={() => moveBlock(i, 1)}>Down</button>
              <button type="button" className="btn btn-line" style={{ padding: '4px 10px', fontSize: 12 }} aria-label="Remove" onClick={() => setBody(body.length > 1 ? body.filter((_, j) => j !== i) : [{ type: 'p', text: '', k: 'x' + Date.now() }])}>&times;</button>
            </span></div>
          <textarea value={b.text} onChange={(e) => setBlock(i, { text: e.target.value })} maxLength={6000} aria-label={b.type === 'h' ? 'Heading' : 'Paragraph'} />
        </div>))}
        <div className="acts"><button type="button" className="btn btn-line" onClick={() => addBlock('p')}>Add paragraph</button><button type="button" className="btn btn-line" onClick={() => addBlock('h')}>Add heading</button></div></div>

      <section className="seo" aria-labelledby="seoT"><h3 id="seoT">Search</h3><p className="sub">Helps this article get found on Google. Write for people first; these checks keep it findable.</p>
        <div className="field"><label htmlFor="kw">Focus keyword</label><input className="input" id="kw" value={seo.keyword} onChange={(e) => setSeo({ ...seo, keyword: e.target.value })} maxLength={80} placeholder="What would someone type into Google?" />
          <div className="sugg">{KW.map((k) => <button type="button" key={k} onClick={() => setSeo({ ...seo, keyword: k })}>{k}</button>)}</div></div>
        <div className="field"><label htmlFor="st">Search title</label><input className="input" id="st" value={seo.title} onChange={(e) => setSeo({ ...seo, title: e.target.value })} maxLength={70} /><span className="count-hint">{seo.title.length} / 60</span></div>
        <div className="field"><label htmlFor="sd">Search description</label><textarea className="input" id="sd" style={{ minHeight: 70 }} value={seo.description} onChange={(e) => setSeo({ ...seo, description: e.target.value })} maxLength={170} /><span className="count-hint">{seo.description.length} / 155</span></div>
        <div className="field"><label htmlFor="sl">Address</label><input className="input" id="sl" value={'olexweb.com/insights/' + address} readOnly={isLive} onChange={(e) => setSlug(slugify(e.target.value.replace(/^.*insights\//, '')))} />{isLive ? <span className="count-hint">Live articles keep their address, so links and rankings aren’t lost.</span> : null}</div>
        <div className="field"><label>How it looks on Google</label><div className="gprev"><div className="u">olexweb.com › insights › {address}</div><div className="t">{seo.title || title || 'Your search title'}</div><div className="s">{seo.description || 'Your search description shows here.'}</div></div></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}><b>Checklist</b><span className="score">{score} of {checks.length}</span></div>
        <ul className="checks">{checks.map(([ok, txt, warn]) => <li key={txt} className={warn ? 'warn' : ok ? 'pass' : ''}>{txt}</li>)}</ul>
        <div className="auto"><b>Added automatically on publish:</b> an author box naming Olaitan Adebayo, founder of Olexweb; the article data Google reads (author, dates, publisher); a share image with the title; and the sitemap entry.</div>
      </section>
    </fieldset>
    {err ? <p className="err" role="alert">{err}</p> : null}
    {isOwner && !item.isNew ? <p style={{ marginTop: 22 }}><button className="btn btn-bad" disabled={busy} onClick={() => go('bin', 'Moved to the bin.')}>Move to bin</button></p> : null}
  </Sheet>)
}

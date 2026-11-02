'use client'
// The meeting: a short lobby (name, mic, camera, data saver), then the room: people (video or initials with a ring that
// follows their voice), chat, raised hands, screen sharing, and the host's controls. Built for weak networks: voice is
// protected first (speech audio with redundancy and silence detection), video is 360p at most and drops to smaller
// layers on its own, only the people on screen get video, and Data saver turns other people's cameras off entirely.
// LiveKit's library loads after the page appears, so the first load stays light.
import { useCallback, useEffect, useRef, useState } from 'react'

const SAVED_NAME = 'olexweb-meet-name'
const MAX_TILES = 9
const I = {
  mic: <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></svg>,
  micOff: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 9.5V6a3 3 0 0 0-5.6-1.5M9 9v2a3 3 0 0 0 4.6 2.5M5.5 11a6.5 6.5 0 0 0 10.4 5.2M18.5 11c0 .8-.1 1.5-.4 2.2M12 17.5V21M4 4l16 16" /></svg>,
  cam: <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6.5" width="12.5" height="11" rx="2.5" /><path d="M15.5 10.5 21 7.5v9l-5.5-3" /></svg>,
  camOff: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6.5h5a2.5 2.5 0 0 1 2.5 2.5v4.5M15.5 10.5 21 7.5v9l-3.5-2M13 17.5H5.5A2.5 2.5 0 0 1 3 15V9a2.5 2.5 0 0 1 1.5-2.3M3 3l18 18" /></svg>,
  share: <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4.5" width="18" height="12.5" rx="2" /><path d="M8.5 20.5h7M12 17v3.5M12 13.5v-6M9.2 10 12 7.3l2.8 2.7" /></svg>,
  hand: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 12.5V5.8a1.6 1.6 0 0 1 3.2 0V11M11.2 10.5V4.6a1.6 1.6 0 0 1 3.2 0v6M14.4 10.6V6.2a1.6 1.6 0 0 1 3.2 0v7.6a7 7 0 0 1-7 7h-.6a6.5 6.5 0 0 1-5.3-2.8l-2.4-3.5a1.5 1.5 0 0 1 2.3-1.9L8 15" /></svg>,
  chat: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 12a7.8 7.8 0 0 1-11.3 7L4 20l1.1-4.6A8.5 8.5 0 1 1 20.5 12z" /></svg>,
  people: <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8.5" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M15.5 5.2a3.5 3.5 0 0 1 0 6.6M18 14.3a6.5 6.5 0 0 1 3.5 5.7" /></svg>,
  leaf: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19c0-8 5.5-13.5 15-14-.4 9.6-6 15-14 15M5 19l7-7" /></svg>,
  leave: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 13.5c4.7-4 12.3-4 17 0l-1.8 2.6-3.3-1.2V12a12 12 0 0 0-6.8 0v2.9l-3.3 1.2z" /></svg>,
  link: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" /></svg>,
  close: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>,
  weak: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18v-1M9 18v-4M14 18v-7M19 18V7" /></svg>,
  send: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12 20 4l-5.5 16-3-6.5z" /><path d="M11.5 13.5 20 4" /></svg>,
}
const initials = (n) => { const w = String(n || '?').trim().split(/\s+/).filter(Boolean); return ((w[0] || '?')[0] + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase() }
const TONES = ['#2b3a2a', '#33302a', '#26333a', '#3a2a33', '#2f2a3a', '#2a3a36']
const tone = (id) => TONES[[...String(id)].reduce((a, c) => a + c.charCodeAt(0), 0) % TONES.length]
const isHostId = (id) => String(id).startsWith('h_')
const clock = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0') }

async function post(path, body) {
  const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || 'That didn’t work. Try again.')
  return j
}
function deviceError(e, what) {
  const n = e && e.name
  if (n === 'NotAllowedError' || n === 'SecurityError') return `Your browser blocked the ${what}. Allow it in the address bar, then try again.`
  if (n === 'NotFoundError' || n === 'OverconstrainedError') return `No ${what} was found on this device.`
  if (n === 'NotReadableError') return `Another app is using the ${what}. Close it, then try again.`
  return `The ${what} couldn’t start. Try again.`
}

export default function MeetRoom({ code, title, speakers, initialState, host: hostAtLoad, hostName }) {
  const [host, setHost] = useState(hostAtLoad)
  const [phase, setPhase] = useState(initialState === 'ended' ? 'ended' : initialState === 'unavailable' ? 'unavailable' : 'lobby')
  const [name, setName] = useState(hostName || ''), [micOn, setMicOn] = useState(true), [camOn, setCamOn] = useState(false), [saver, setSaver] = useState(false)
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [toasts, setToasts] = useState([])
  const [, setTick] = useState(0), bump = useCallback(() => setTick((t) => t + 1), [])
  const [panel, setPanel] = useState(null), [messages, setMessages] = useState([]), [unread, setUnread] = useState(0)
  const [conn, setConn] = useState({ reconnecting: false, weak: false, audioBlocked: false }), [startedAt, setStartedAt] = useState(0), [leaving, setLeaving] = useState(false)
  const roomRef = useRef(null), lkRef = useRef(null), previewRef = useRef(null), previewTrack = useRef(null), joinInfo = useRef(null)
  const saverRef = useRef(false), endedRef = useRef(false), panelRef = useRef(null), spoke = useRef(new Map()), levelEls = useRef(new Map())

  useEffect(() => { saverRef.current = saver }, [saver])
  useEffect(() => { panelRef.current = panel; if (panel === 'chat') setUnread(0) }, [panel])
  useEffect(() => { if (!hostName) { try { const n = localStorage.getItem(SAVED_NAME); if (n) setName(n) } catch {} } }, [hostName])
  useEffect(() => {                                            // opened from another app (WhatsApp), the first load can't see your sign-in: ask again
    if (hostAtLoad || initialState === 'ended') return
    fetch('/api/meet?code=' + encodeURIComponent(code), { cache: 'no-store', credentials: 'same-origin' }).then((r) => r.json()).then((j) => {
      if (j && j.host) { setHost(true); setName((n) => n || j.hostName || '') }
    }).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { import('livekit-client').then((m) => { lkRef.current = m }).catch(() => {}) }, [])   // ready by the time Join is pressed
  const toast = useCallback((text) => { const id = Math.random(); setToasts((t) => [...t.slice(-1), { id, text }]); setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000) }, [])

  // ---------- lobby camera preview ----------
  async function previewOn(on) {
    setCamOn(on); setError('')
    if (previewTrack.current) { previewTrack.current.stop(); previewTrack.current = null }
    if (!on) return
    try {
      const lk = lkRef.current || (lkRef.current = await import('livekit-client'))
      const t = await lk.createLocalVideoTrack({ resolution: lk.VideoPresets.h360.resolution })
      previewTrack.current = t; if (previewRef.current) t.attach(previewRef.current)
    } catch (e) { setCamOn(false); setError(deviceError(e, 'camera')) }
  }
  useEffect(() => () => { if (previewTrack.current) previewTrack.current.stop() }, [])

  // ---------- joining ----------
  async function join(e) {
    if (e) e.preventDefault()
    const n = name.replace(/\s+/g, ' ').trim()
    if (!n) { setError('Type your name to join.'); return }
    setError(''); setPhase('joining')
    try { localStorage.setItem(SAVED_NAME, n) } catch {}
    try {
      const j = await post('/api/meet', { code, name: n })
      if (j.state === 'waiting') { setPhase('waiting'); return }
      if (j.state === 'ended') { setPhase('ended'); return }
      if (j.state === 'unavailable') { setPhase('unavailable'); return }
      joinInfo.current = j; setHost(!!j.host); await connect(j)
    } catch (err) { setPhase('lobby'); setError(err.message || 'Couldn’t join. Check your connection and try again.') }
  }
  // the waiting screen asks every 5 seconds whether the host has started
  useEffect(() => {
    if (phase !== 'waiting') return
    let stop = false
    const t = setInterval(async () => {
      const r = await fetch('/api/meet?code=' + encodeURIComponent(code), { cache: 'no-store' }).then((x) => x.json()).catch(() => null)
      if (stop || !r) return
      if (r.state === 'open') { clearInterval(t); join() } else if (r.state === 'ended') { clearInterval(t); setPhase('ended') }
    }, 5000)
    return () => { stop = true; clearInterval(t) }
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  async function connect(info) {
    const lk = lkRef.current || (lkRef.current = await import('livekit-client'))
    const room = new lk.Room({
      adaptiveStream: true, dynacast: true,                       // small tiles get small video; nobody sends layers nobody watches
      videoCaptureDefaults: { resolution: lk.VideoPresets.h360.resolution },
      audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      publishDefaults: { simulcast: true, videoSimulcastLayers: [lk.VideoPresets.h90, lk.VideoPresets.h180], videoEncoding: { maxBitrate: 400_000, maxFramerate: 24 },
        audioPreset: lk.AudioPresets.speech, red: true, dtx: true },   // voice first: redundancy against lost packets, silence costs nothing
    })
    roomRef.current = room
    const E = lk.RoomEvent, cam = lk.Track.Source.Camera
    const holdVideo = (pub) => { if (saverRef.current && pub && pub.source === cam && pub.kind === 'video') pub.setSubscribed(false) }
    room
      .on(E.ParticipantConnected, bump).on(E.ParticipantDisconnected, bump).on(E.TrackSubscribed, (t, pub) => { holdVideo(pub); bump() }).on(E.TrackUnsubscribed, bump)
      .on(E.TrackPublished, (pub) => { holdVideo(pub); bump() }).on(E.TrackUnpublished, bump).on(E.TrackMuted, bump).on(E.TrackUnmuted, bump)
      .on(E.LocalTrackPublished, bump).on(E.LocalTrackUnpublished, bump).on(E.ParticipantNameChanged, bump)
      .on(E.ActiveSpeakersChanged, (list) => { const now = Date.now(); for (const p of list) spoke.current.set(p.identity, now); bump() })
      .on(E.ParticipantAttributesChanged, (changed, p) => {
        if (info.host && p !== room.localParticipant && 'hand' in changed && changed.hand) toast(`${p.name || 'Someone'} raised a hand.`)
        bump()
      })
      .on(E.ParticipantPermissionsChanged, (prev, p) => {
        if (p === room.localParticipant) {
          const now = !!(p.permissions && p.permissions.canPublish), was = !!(prev && prev.canPublish)
          if (now && !was) toast('You can speak now. Turn on your mic when you’re ready.')
          if (!now && was) toast('The host ended your turn to speak.')
        }
        bump()
      })
      .on(E.ConnectionQualityChanged, (q, p) => { if (p === room.localParticipant) setConn((c) => ({ ...c, weak: q === lk.ConnectionQuality.Poor || q === lk.ConnectionQuality.Lost })); bump() })
      .on(E.Reconnecting, () => setConn((c) => ({ ...c, reconnecting: true }))).on(E.Reconnected, () => setConn((c) => ({ ...c, reconnecting: false })))
      .on(E.AudioPlaybackStatusChanged, () => setConn((c) => ({ ...c, audioBlocked: !room.canPlaybackAudio })))
      .on(E.DataReceived, (payload, p, kind, topic) => {
        if (topic !== 'chat' || !p) return
        let m; try { m = JSON.parse(new TextDecoder().decode(payload)) } catch { return }
        const text = String((m && m.text) || '').slice(0, 1000).trim(); if (!text) return
        setMessages((l) => [...l.slice(-299), { id: String(m.id || Math.random()), who: p.identity, name: p.name || 'Someone', text, at: Date.now() }])
        if (panelRef.current !== 'chat') setUnread((u) => u + 1)
      })
      .on(E.Disconnected, (reason) => {
        const R = lk.DisconnectReason
        roomRef.current = null; levelEls.current.clear()
        setPhase(endedRef.current || reason === R.ROOM_DELETED ? 'ended' : reason === R.PARTICIPANT_REMOVED ? 'removed' : 'left')
      })
    await room.connect(info.url, info.token)
    if (previewTrack.current) { previewTrack.current.stop(); previewTrack.current = null }
    setStartedAt(Date.now()); setPhase('in'); setConn({ reconnecting: false, weak: false, audioBlocked: !room.canPlaybackAudio })
    if (saverRef.current) applySaver(true)
    if (info.speaker) {
      if (micOn) await room.localParticipant.setMicrophoneEnabled(true).catch((e) => { setMicOn(false); toast(deviceError(e, 'microphone')) })
      if (camOn && !saverRef.current) await room.localParticipant.setCameraEnabled(true).catch((e) => { setCamOn(false); toast(deviceError(e, 'camera')) })
    }
    room.startAudio().catch(() => {}); bump()
  }
  useEffect(() => {
    const off = () => { if (roomRef.current) roomRef.current.disconnect() }
    window.addEventListener('pagehide', off)
    return () => { window.removeEventListener('pagehide', off); off() }
  }, [])

  // the voice ring: one loop for everyone on screen, reading each person's live audio level
  useEffect(() => {
    if (phase !== 'in') return
    let raf = 0, still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const loop = () => {
      const room = roomRef.current
      if (room) for (const [id, el] of levelEls.current) {
        const p = id === room.localParticipant.identity ? room.localParticipant : room.remoteParticipants.get(id)
        const lvl = p ? Math.min(1, (p.audioLevel || 0) * 3) : 0
        el.style.setProperty('--lvl', still ? (lvl > 0.08 ? 1 : 0) : lvl.toFixed(3))
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [phase])

  // ---------- controls ----------
  const room = roomRef.current, me = room && room.localParticipant
  const canSpeak = !!(me && me.permissions && me.permissions.canPublish)
  async function toggleMic() {
    if (!room) return
    const on = !me.isMicrophoneEnabled
    try { await me.setMicrophoneEnabled(on); setMicOn(on) } catch (e) { toast(deviceError(e, 'microphone')) } bump()
  }
  async function toggleCam() {
    if (!room) return
    const on = !me.isCameraEnabled
    if (on && saverRef.current) { toast('Turn off Data saver to use your camera.'); return }
    try { await me.setCameraEnabled(on); setCamOn(on) } catch (e) { toast(deviceError(e, 'camera')) } bump()
  }
  async function toggleShare() {
    if (!room) return
    const on = !me.isScreenShareEnabled
    try { await me.setScreenShareEnabled(on, { audio: false }) } catch (e) { if (e && e.name !== 'NotAllowedError') toast('Screen sharing couldn’t start. Try again.') } bump()
  }
  async function toggleHand() {
    if (!room) return
    const up = !(me.attributes && me.attributes.hand)
    try { await me.setAttributes({ hand: up ? String(Date.now()) : '' }); if (up) toast('Your hand is up. The host can see it.') } catch { toast('That didn’t work. Try again.') } bump()
  }
  function applySaver(on) {
    const r = roomRef.current; if (!r || !lkRef.current) return
    const cam = lkRef.current.Track.Source.Camera
    for (const p of r.remoteParticipants.values()) for (const pub of p.trackPublications.values()) if (pub.source === cam) pub.setSubscribed(!on)
    if (on && r.localParticipant.isCameraEnabled) { r.localParticipant.setCameraEnabled(false).catch(() => {}); setCamOn(false) }
    bump()
  }
  function toggleSaver() { const on = !saverRef.current; saverRef.current = on; setSaver(on); applySaver(on); toast(on ? 'Data saver is on: voices and shared screens only.' : 'Data saver is off.') }
  async function sendChat(text) {
    const t = String(text || '').trim().slice(0, 1000); if (!t || !room) return false
    const id = Math.random().toString(36).slice(2)
    try {
      await me.publishData(new TextEncoder().encode(JSON.stringify({ id, text: t })), { reliable: true, topic: 'chat' })
      setMessages((l) => [...l.slice(-299), { id, who: me.identity, name: me.name || 'You', text: t, at: Date.now(), mine: true }]); return true
    } catch { toast('Your message didn’t send. Try again.'); return false }
  }
  async function hostDo(action, p) {
    if (action === 'remove' && !window.confirm(`Remove ${p.name || 'this person'} from the meeting?`)) return
    try { await post('/admin/api/meetings', { action, code, identity: p.identity }); toast(action === 'allow-speak' ? `${p.name} can speak now.` : action === 'stop-speak' ? `${p.name} is listening again.` : `${p.name} was removed.`) }
    catch (e) { toast(e.message) }
  }
  function leave() { setLeaving(false); if (roomRef.current) roomRef.current.disconnect() }
  async function endForAll() {
    setLeaving(false)
    try { await post('/admin/api/meetings', { action: 'end', code }) } catch (e) { toast(e.message); return }
    endedRef.current = true; setPhase('ended'); if (roomRef.current) roomRef.current.disconnect()
  }
  async function copyLink() {
    const url = location.origin + '/meet/' + code
    try { await navigator.clipboard.writeText(url); toast('Meeting link copied.') } catch { window.prompt('Copy the meeting link:', url) }
  }

  // ---------- screens other than the room ----------
  if (phase !== 'in') return (<div className="mt mt-solo">
    <header className="mt-brand"><img src="/studio/mark.png" alt="" width="22" height="26" /><span>Olexweb</span></header>
    <main className="mt-card">
      {phase === 'ended' ? <><h1 className="mt-h">This meeting has ended</h1><p className="mt-p">Thanks for being here. You can close this page.</p></>
        : phase === 'removed' ? <><h1 className="mt-h">You were removed from the meeting</h1><p className="mt-p">The host removed you. If that was a mistake, ask them for the link again.</p></>
        : phase === 'unavailable' ? <><h1 className="mt-h">Meetings aren’t available right now</h1><p className="mt-p">Try again in a little while.</p></>
        : phase === 'left' ? <><h1 className="mt-h">You left the meeting</h1><p className="mt-p">{title}</p><div className="mt-row"><button className="mt-btn mt-go" onClick={() => { setPhase('lobby'); setMessages([]) }}>Join again</button></div></>
        : phase === 'waiting' ? <><h1 className="mt-h">{title}</h1><p className="mt-p mt-wait"><span className="mt-pulse" aria-hidden="true" />Waiting for the host to start the meeting. You’ll go in by yourself when they do.</p>
          <div className="mt-row"><button className="mt-btn" onClick={() => setPhase('lobby')}>Back</button></div></>
        : <form onSubmit={join} className="mt-lobby">
          <h1 className="mt-h">{title}</h1>
          <p className="mt-p">{host ? 'You’re the host. Joining starts the meeting for everyone with the link.' : speakers === 'invited' ? 'You’ll join as a listener. Raise your hand to ask to speak, and use the chat anytime.' : 'Check your name, mic and camera, then join.'}</p>
          <div className={'mt-preview' + (camOn ? ' on' : '')}>
            <video ref={previewRef} muted playsInline autoPlay className="mt-mirror" />
            {!camOn ? <span className="mt-av mt-av-lg" style={{ background: tone(name || 'x') }}>{initials(name || '?')}</span> : null}
          </div>
          <label className="mt-lab" htmlFor="mt-name">Your name</label>
          <input id="mt-name" className="mt-in" value={name} maxLength={40} autoComplete="name" onChange={(e) => setName(e.target.value)} placeholder="How others will see you" />
          {host || speakers === 'everyone' ? <div className="mt-toggles" role="group" aria-label="Before you join">
            <button type="button" className="mt-chip" aria-pressed={micOn} onClick={() => setMicOn((m) => !m)}>{micOn ? I.mic : I.micOff}{micOn ? 'Mic on' : 'Mic off'}</button>
            <button type="button" className="mt-chip" aria-pressed={camOn} disabled={saver} onClick={() => previewOn(!camOn)}>{camOn ? I.cam : I.camOff}{camOn ? 'Camera on' : 'Camera off'}</button>
            <button type="button" className="mt-chip" aria-pressed={saver} onClick={() => { const on = !saver; setSaver(on); if (on && camOn) previewOn(false) }}>{I.leaf}Data saver</button>
          </div> : <div className="mt-toggles"><button type="button" className="mt-chip" aria-pressed={saver} onClick={() => setSaver((s) => !s)}>{I.leaf}Data saver</button></div>}
          {saver ? <p className="mt-hint">Data saver: you’ll hear everyone and see shared screens, but not cameras. Best on a weak or costly connection.</p> : null}
          {error ? <p className="mt-err" role="alert">{error}</p> : null}
          <button type="submit" className="mt-btn mt-go" disabled={phase === 'joining'}>{phase === 'joining' ? 'Joining…' : host ? 'Start the meeting' : 'Join the meeting'}</button>
        </form>}
    </main>
  </div>)

  // ---------- the room ----------
  const lk = lkRef.current, S = lk.Track.Source
  const all = [me, ...room.remoteParticipants.values()]
  const speaksNow = (p) => !!(p.permissions && p.permissions.canPublish)
  const share = all.map((p) => ({ p, pub: p.getTrackPublication(S.ScreenShare) })).find((x) => x.pub && x.pub.track && !x.pub.isMuted)
  const onStage = all.filter((p) => speaksNow(p) || isHostId(p.identity))
    .sort((a, b) => (spoke.current.get(b.identity) || 0) - (spoke.current.get(a.identity) || 0) || (+!!b.isCameraEnabled - +!!a.isCameraEnabled) || ((a.joinedAt || 0) - (b.joinedAt || 0)))
  const limit = share ? 4 : MAX_TILES
  const tiles = onStage.slice(0, limit)
  if (me && !tiles.includes(me) && onStage.includes(me)) tiles[tiles.length - 1] = me        // you always see yourself
  const listeners = all.filter((p) => !onStage.includes(p)), hidden = onStage.length - tiles.length
  const hands = all.filter((p) => p.attributes && p.attributes.hand).sort((a, b) => Number(a.attributes.hand) - Number(b.attributes.hand))
  const audioPubs = [...room.remoteParticipants.values()].flatMap((p) => [...p.audioTrackPublications.values()].filter((x) => x.track))
  const canShare = canSpeak && typeof navigator !== 'undefined' && navigator.mediaDevices && 'getDisplayMedia' in navigator.mediaDevices

  return (<div className={'mt mt-in-room' + (panel ? ' mt-panel-on' : '')}>
    <header className="mt-top">
      <div className="mt-title"><b>{title}</b><Elapsed from={startedAt} /></div>
      <div className="mt-top-end">
        <span className="mt-count" title="People in the meeting">{I.people}{all.length}</span>
        <button className="mt-btn mt-sm" onClick={copyLink}>{I.link}<span>Copy link</span></button>
      </div>
    </header>

    {conn.reconnecting ? <p className="mt-banner" role="status">Reconnecting… Your audio comes back on its own.</p>
      : conn.weak ? <p className="mt-banner mt-warn" role="status">{I.weak}Your connection is weak.{!saver ? <> <button className="mt-link" onClick={toggleSaver}>Turn on Data saver</button> to keep voices clear.</> : ' Voices come first.'}</p> : null}
    {conn.audioBlocked ? <p className="mt-banner" role="status">Sound is off in this browser. <button className="mt-link" onClick={() => room.startAudio().then(() => setConn((c) => ({ ...c, audioBlocked: false }))).catch(() => {})}>Turn on sound</button></p> : null}

    <div className="mt-body">
      <main className={'mt-stage' + (share ? ' mt-sharing' : '')} aria-label="People in the meeting">
        {share ? <Shared pub={share.pub} who={share.p} local={share.p === me} /> : null}
        <div className="mt-grid" data-n={Math.min(tiles.length + (hidden > 0 || listeners.length ? 1 : 0), limit)}>
          {tiles.map((p) => <Tile key={p.identity} p={p} me={p === me} lk={lk} saver={saver} levelEls={levelEls} />)}
          {hidden > 0 || listeners.length ? <button className="mt-tile mt-more" onClick={() => setPanel('people')}>
            {hidden > 0 ? <b>{hidden} more on stage</b> : null}{listeners.length ? <span>{listeners.length} listening</span> : null}</button> : null}
        </div>
      </main>
      {panel ? <aside className="mt-panel" aria-label={panel === 'chat' ? 'Chat' : 'People'}>
        <div className="mt-panel-h"><h2>{panel === 'chat' ? 'Chat' : `People (${all.length})`}</h2><button className="mt-x" onClick={() => setPanel(null)} aria-label="Close">{I.close}</button></div>
        {panel === 'chat' ? <Chat messages={messages} send={sendChat} myId={me.identity} />
          : <People all={all} me={me} host={host} hands={hands} speaksNow={speaksNow} hostDo={hostDo} lk={lk} />}
      </aside> : null}
    </div>

    <nav className="mt-bar" aria-label="Meeting controls">
      {canSpeak ? <>
        <button className={'mt-c' + (me.isMicrophoneEnabled ? '' : ' mt-off')} aria-pressed={me.isMicrophoneEnabled} onClick={toggleMic}>{me.isMicrophoneEnabled ? I.mic : I.micOff}<span>{me.isMicrophoneEnabled ? 'Mute' : 'Unmute'}</span></button>
        <button className={'mt-c' + (me.isCameraEnabled ? '' : ' mt-off')} aria-pressed={me.isCameraEnabled} onClick={toggleCam}>{me.isCameraEnabled ? I.cam : I.camOff}<span>{me.isCameraEnabled ? 'Stop video' : 'Start video'}</span></button>
        {canShare ? <button className={'mt-c' + (me.isScreenShareEnabled ? ' mt-on' : '')} aria-pressed={me.isScreenShareEnabled} onClick={toggleShare}>{I.share}<span>{me.isScreenShareEnabled ? 'Stop sharing' : 'Share screen'}</span></button> : null}
      </> : null}
      {!host ? <button className={'mt-c' + (me.attributes && me.attributes.hand ? ' mt-on' : '')} aria-pressed={!!(me.attributes && me.attributes.hand)} onClick={toggleHand}>{I.hand}<span>{me.attributes && me.attributes.hand ? 'Lower hand' : 'Raise hand'}</span></button> : null}
      <button className={'mt-c' + (panel === 'chat' ? ' mt-on' : '')} aria-pressed={panel === 'chat'} onClick={() => setPanel((x) => (x === 'chat' ? null : 'chat'))}>{I.chat}<span>Chat</span>{unread ? <i className="mt-badge" aria-label={unread + ' new'}>{unread > 9 ? '9+' : unread}</i> : null}</button>
      <button className={'mt-c' + (panel === 'people' ? ' mt-on' : '')} aria-pressed={panel === 'people'} onClick={() => setPanel((x) => (x === 'people' ? null : 'people'))}>{I.people}<span>People</span>{host && hands.length ? <i className="mt-badge">{hands.length}</i> : null}</button>
      <button className={'mt-c' + (saver ? ' mt-on' : '')} aria-pressed={saver} onClick={toggleSaver}>{I.leaf}<span>Data saver</span></button>
      <button className="mt-c mt-leave" onClick={() => (host ? setLeaving(true) : leave())}>{I.leave}<span>Leave</span></button>
    </nav>

    {leaving ? <div className="mt-modal" role="dialog" aria-modal="true" aria-label="Leave the meeting" onClick={(e) => { if (e.target === e.currentTarget) setLeaving(false) }}>
      <div className="mt-card mt-dialog">
        <h2 className="mt-h2">Leave or end the meeting?</h2>
        <p className="mt-p">Ending it removes everyone and closes the link.</p>
        <div className="mt-col">
          <button className="mt-btn mt-danger" onClick={endForAll}>End for everyone</button>
          <button className="mt-btn" onClick={leave}>Leave, keep it running</button>
          <button className="mt-btn mt-ghost" onClick={() => setLeaving(false)}>Cancel</button>
        </div>
      </div>
    </div> : null}

    <div className="mt-toasts" aria-live="polite">{toasts.map((t) => <p key={t.id} className="mt-toast">{t.text}</p>)}</div>
    {audioPubs.map((pub) => <AudioOut key={pub.trackSid} track={pub.track} />)}
  </div>)
}

function Elapsed({ from }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  return <span className="mt-time">{from ? clock(now - from) : ''}</span>
}
function AudioOut({ track }) {
  const ref = useRef(null)
  useEffect(() => { const el = ref.current; if (!el || !track) return; track.attach(el); return () => { track.detach(el) } }, [track])
  return <audio ref={ref} autoPlay />
}
function Tile({ p, me, lk, saver, levelEls }) {
  const S = lk.Track.Source, cam = p.getTrackPublication(S.Camera), mic = p.getTrackPublication(S.Microphone)
  const track = cam && cam.track && !cam.isMuted ? cam.track : null
  const vref = useRef(null), ring = useRef(null)
  useEffect(() => { const el = vref.current; if (!el || !track) return; track.attach(el); return () => { track.detach(el) } }, [track])
  useEffect(() => { const el = ring.current, m = levelEls.current; if (el) m.set(p.identity, el); return () => { if (m.get(p.identity) === el) m.delete(p.identity) } }, [p.identity, levelEls])
  const muted = !mic || mic.isMuted, weak = p.connectionQuality === lk.ConnectionQuality.Poor
  return (<div className={'mt-tile' + (p.isSpeaking ? ' mt-speaking' : '') + (track ? ' mt-has-video' : '')} ref={ring}>
    {track ? <video ref={vref} muted playsInline autoPlay className={me && cam.source === S.Camera ? 'mt-mirror' : ''} />
      : <span className="mt-av" style={{ background: tone(p.identity) }}>{initials(p.name)}</span>}
    {!track && cam && !cam.isMuted && saver && !me ? <span className="mt-saved">Video paused (Data saver)</span> : null}
    <span className="mt-name">{muted ? <i className="mt-mute" aria-label="Muted">{I.micOff}</i> : null}{p.name || 'Guest'}{me ? ' (you)' : ''}{isHostId(p.identity) ? <em>Host</em> : null}</span>
    {p.attributes && p.attributes.hand ? <span className="mt-hand" aria-label="Hand raised">{I.hand}</span> : null}
    {weak ? <span className="mt-weak" title="Weak connection" aria-label="Weak connection">{I.weak}</span> : null}
  </div>)
}
function Shared({ pub, who, local }) {
  const ref = useRef(null), t = pub.track
  useEffect(() => { const el = ref.current; if (!el || !t) return; t.attach(el); return () => { t.detach(el) } }, [t])
  return (<div className="mt-share"><video ref={ref} muted playsInline autoPlay /><span className="mt-name">{local ? 'You are sharing your screen' : `${who.name || 'Someone'} is sharing`}</span></div>)
}
function Chat({ messages, send, myId }) {
  const [text, setText] = useState(''), list = useRef(null)
  useEffect(() => { const el = list.current; if (el) el.scrollTop = el.scrollHeight }, [messages.length])
  async function go(e) { e.preventDefault(); if (await send(text)) setText('') }
  return (<div className="mt-chat">
    <div className="mt-msgs" ref={list}>
      {messages.length ? messages.map((m, i) => { const same = i > 0 && messages[i - 1].who === m.who
        return <div key={m.id} className={'mt-msg' + (m.who === myId ? ' mt-mine' : '') + (same ? ' mt-same' : '')}>{!same ? <b>{m.who === myId ? 'You' : m.name}</b> : null}<p>{m.text}</p></div> })
        : <p className="mt-empty">Messages here go to everyone in the meeting. They disappear when it ends.</p>}
    </div>
    <form className="mt-send" onSubmit={go}>
      <textarea className="mt-in" rows={1} maxLength={1000} value={text} placeholder="Message everyone" aria-label="Message everyone" onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go(e) } }} />
      <button className="mt-btn mt-go mt-icon" aria-label="Send" disabled={!text.trim()}>{I.send}</button>
    </form>
  </div>)
}
function People({ all, me, host, hands, speaksNow, hostDo, lk }) {
  const S = lk.Track.Source
  const order = [...hands, ...all.filter((p) => !hands.includes(p))]
  return (<ul className="mt-people">
    {order.map((p) => { const mic = p.getTrackPublication(S.Microphone), on = mic && !mic.isMuted, isHost = isHostId(p.identity), speaks = isHost || speaksNow(p)
      return <li key={p.identity}>
        <span className="mt-av mt-av-sm" style={{ background: tone(p.identity) }}>{initials(p.name)}</span>
        <span className="mt-who"><b>{p.name || 'Guest'}{p === me ? ' (you)' : ''}</b><small>{isHost ? 'Host' : speaks ? 'Can speak' : 'Listening'}{p.attributes && p.attributes.hand ? ', hand raised' : ''}</small></span>
        {p.attributes && p.attributes.hand ? <span className="mt-hand-sm" aria-hidden="true">{I.hand}</span> : null}
        {speaks ? <span className={'mt-mic-sm' + (on ? '' : ' mt-off')} aria-label={on ? 'Mic on' : 'Muted'}>{on ? I.mic : I.micOff}</span> : null}
        {host && !isHost ? <span className="mt-acts">
          {speaks ? <button className="mt-btn mt-xs" onClick={() => hostDo('stop-speak', p)}>Stop speaking</button> : <button className="mt-btn mt-xs mt-go" onClick={() => hostDo('allow-speak', p)}>Let speak</button>}
          <button className="mt-btn mt-xs mt-ghost" onClick={() => hostDo('remove', p)}>Remove</button>
        </span> : null}
      </li> })}
  </ul>)
}

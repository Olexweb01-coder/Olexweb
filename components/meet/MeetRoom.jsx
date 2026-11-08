'use client'
// The meeting: a short lobby (name, mic, camera, data saver), then the room: people (video or initials with a ring that
// follows their voice), chat, raised hands, screen sharing, and the host's controls. Built for weak networks: voice is
// protected first (speech audio with redundancy and silence detection), video is 360p at most and drops to smaller
// layers on its own, only the people on screen get video, and Data saver turns other people's cameras off entirely.
// LiveKit's library loads after the page appears, so the first load stays light.
import { useCallback, useEffect, useRef, useState } from 'react'
import { MeetRecorder, canMp3, canRecord, pendingRecordings, saveRecording, discardRecording, fileName } from './recorder'
import { keepWords, NotesPanel } from './Guests'
import { MiniWindow, canMini, callControls, callState } from './pip'
import { saved as savedFx, remember as rememberFx, setNoise, setBlur, canCleanNoise, canBlur } from './effects'

const SAVED_NAME = 'olexweb-meet-name'
// on the Meet app (meet.olexweb.com) a meeting is /abc-defg-hij; on the main site it's /meet/abc-defg-hij
// iPhone and iPad (newer iPads say "Mac" but have touch): Apple pauses a web page's microphone when you leave the browser
const onApple = () => typeof navigator !== 'undefined' && (/iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1))
const onMeetApp = () => typeof location !== 'undefined' && location.hostname.startsWith('meet.')
const hereLink = (code) => `${location.origin}${onMeetApp() ? '' : '/meet'}/${code}`
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
  rec: <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4" className="mt-fill" /></svg>,
  stop: <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="6.5" width="11" height="11" rx="2" className="mt-fill" /></svg>,
  smile: <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M8.5 14.2a4.2 4.2 0 0 0 7 0" /><path d="M9.3 9.6h.01M14.7 9.6h.01" strokeWidth="2.6" /></svg>,
  dots: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 12h.01M12 12h.01M18.5 12h.01" strokeWidth="3" /></svg>,
  notes: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5h9l3.5 3.5v13.5H6z" /><path d="M9 10h6M9 13.5h6M9 17h4" /><path d="M18 3l.7 1.6 1.6.7-1.6.7L18 7.6l-.7-1.6-1.6-.7 1.6-.7z" className="mt-fill" /></svg>,
  mini: <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5" /><rect x="12" y="11.5" width="7" height="5" rx="1.2" className="mt-fill" /></svg>,
  wave: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h2M8 8v8M12 5v14M16 8v8M20 11v2" /></svg>,
  blur: <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="9" r="3.5" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /><path d="M3 5.5h.01M3 12h.01M3 18.5h.01M21 5.5h.01M21 12h.01M21 18.5h.01" strokeWidth="2.6" /></svg>,
  pause: <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="5.5" width="3.5" height="13" rx="1" className="mt-fill" /><rect x="13.5" y="5.5" width="3.5" height="13" rx="1" className="mt-fill" /></svg>,
}
// quick reactions float up on everyone's screen; the picker's set covers everyday chat
export const REACTIONS = ['👍', '👏', '😂', '❤️', '🎉', '😮']
const EMOJI = ['😀', '😂', '🤣', '😊', '😍', '🥰', '😎', '🤩', '😉', '🙂', '🤔', '😮', '😅', '😢', '😭', '😡', '🥳', '😴', '🙏', '👍', '👎', '👏', '🙌', '👋',
  '💪', '🤝', '✌️', '👌', '❤️', '🔥', '✨', '🎉', '💯', '✅', '❌', '⭐', '💡', '📌', '⏰', '📎', '☕', '🍕', '🎂', '🌍', '🚀', '📈', '💰', '🇳🇬']
const ONLY_EMOJI = /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|\u200d|\ufe0f|\s)+$/u
const initials = (n) => { const w = String(n || '?').trim().split(/\s+/).filter(Boolean); return ((w[0] || '?')[0] + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase() }
const TONES = ['#2b3a2a', '#33302a', '#26333a', '#3a2a33', '#2f2a3a', '#2a3a36']
const tone = (id) => TONES[[...String(id)].reduce((a, c) => a + c.charCodeAt(0), 0) % TONES.length]
const isHostId = (id) => String(id).startsWith('h_')
const isCoId = (p) => !!(p && p.attributes && p.attributes.cohost === '1' && p.permissions && p.permissions.canSubscribeMetrics)   // a co-host: only the server sets this mark
const isBoss = (p) => !!p && (isHostId(p.identity) || isCoId(p))
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

export default function MeetRoom({ code, title, speakers, initialState, startsAt, minutes, host: hostAtLoad, hostName, canNotes = false, form = null }) {
  const [host, setHost] = useState(hostAtLoad)
  const [phase, setPhase] = useState(initialState === 'ended' ? 'ended' : initialState === 'unavailable' ? 'unavailable' : 'lobby')
  const [name, setName] = useState(hostName || ''), [micOn, setMicOn] = useState(true), [camOn, setCamOn] = useState(false), [saver, setSaver] = useState(false)
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [toasts, setToasts] = useState([])
  const [, setTick] = useState(0), bump = useCallback(() => setTick((t) => t + 1), [])
  const [panel, setPanel] = useState(null), [messages, setMessages] = useState([]), [unread, setUnread] = useState(0)
  const [conn, setConn] = useState({ reconnecting: false, weak: false, audioBlocked: false }), [startedAt, setStartedAt] = useState(0), [leaving, setLeaving] = useState(false)
  const roomRef = useRef(null), lkRef = useRef(null), previewRef = useRef(null), previewTrack = useRef(null), joinInfo = useRef(null)
  const [rec, setRec] = useState(null), [askRec, setAskRec] = useState(false), [recAudio, setRecAudio] = useState(false), [pending, setPending] = useState([])
  const [floats, setFloats] = useState([]), [pop, setPop] = useState(null), [notesReady, setNotesReady] = useState(false)
  const [det, setDet] = useState({ phone: '', email: '', org: '', answer: '', consent: false }), [reporting, setReporting] = useState(false)
  const asks = !!(form && !host)                                            // the host's details form (never for the host)
  const awayOff = useRef(() => {}), controlsOff = useRef(() => {}), prevRec = useRef(''), recRef = useRef(null), notesRef = useRef(null), stageRef = useRef(null)
  const [noting, setNoting] = useState(false), [showNotes, setShowNotes] = useState(false)
  const [cohost, setCohost] = useState(false), cohostRef = useRef(false)          // made a co-host by the host: the host's controls, except ending and co-hosts
  const boss = host || cohost
  const seat = () => (joinInfo.current && joinInfo.current.seat ? { as: joinInfo.current.identity, seat: joinInfo.current.seat } : {})
  const [recHigh, setRecHigh] = useState(false)
  const miniRef = useRef(null), actRef = useRef({}), [miniOk, setMiniOk] = useState(false)   // the floating mini window
  useEffect(() => setMiniOk(canMini()), [])
  const [fxLive, setFxLive] = useState({ noise: false, blur: false })   // what's actually running (data-noise / data-blur)
  const [fx, setFx] = useState({ noise: true, blur: false }), [blurOk, setBlurOk] = useState(false), fxRef = useRef(fx)   // noise cancellation and background blur
  const [iosTip, setIosTip] = useState(false)
  useEffect(() => setIosTip(onApple()), [])
  const [noiseOk, setNoiseOk] = useState(false)                             // decided in the browser (the server can't know), so the page matches
  useEffect(() => { const v = savedFx(); setFx(v); fxRef.current = v; setNoiseOk(canCleanNoise()); canBlur().then(setBlurOk) }, [])
  const lastReact = useRef(0), closing = useRef(false)
  const selfMic = useRef(0)                                      // when this person last switched their own mic (so a host mute is told apart)
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
  useEffect(() => { if (canRecord()) pendingRecordings().then(setPending) }, [])
  useEffect(() => { if (!pop) return; const k = (e) => { if (e.key === 'Escape') setPop(null) }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [pop])
  useEffect(() => { import('livekit-client').then((m) => { lkRef.current = m }).catch(() => {}) }, [])   // ready by the time Join is pressed
  const float = useCallback((e, who) => { const id = Math.random(); setFloats((f) => [...f.slice(-11), { id, e, who, x: 8 + Math.random() * 30 }]); setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 3200) }, [])
  // tells the attendance list this guest left (the key is the server's own, so it can only speak for this guest)
  const saidLeft = () => { const j = joinInfo.current; if (j && j.leaveKey && navigator.sendBeacon) navigator.sendBeacon('/api/meet/left', new Blob([JSON.stringify({ identity: j.identity, key: j.leaveKey })], { type: 'application/json' })) }
  async function sendReport(reason, note) {
    try { await post('/api/meet/report', { code, reason, note, name }); setReporting(false); toast('Thanks. Your report was sent to Olexweb.') } catch (e) { toast(e.message) }
  }
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
      const j = await post('/api/meet', { code, name: n, ...(asks ? { details: det } : {}) })
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
    // when this person's mic or camera starts, their chosen effects go on it (on their own device)
    room.on(E.LocalTrackPublished, (pub) => {
      if (pub.source === lk.Track.Source.Microphone && fxRef.current.noise && canCleanNoise()) setNoise(pub.track, true).then(() => setFxLive((v) => ({ ...v, noise: true }))).catch(() => toast('Noise cancellation couldn’t start here. Your voice still works.'))
      if (pub.source === cam && fxRef.current.blur) setBlur(pub.track, true).then(() => setFxLive((v) => ({ ...v, blur: true }))).catch((e) => { toast(e.message || 'Blur couldn’t start.'); const v = { ...fxRef.current, blur: false }; fxRef.current = v; setFx(v); rememberFx({ blur: false }) })
    })
    const checkCo = (p) => {                                                      // am I a co-host? (the attribute and the server-only mark arrive together)
      if (info.host) return
      const on = isCoId(p); if (on === cohostRef.current) return
      cohostRef.current = on; setCohost(on)
      toast(on ? 'The host made you a co-host. You can now mute, remove, record and take AI notes.' : 'You’re no longer a co-host.')
    }
    const holdVideo = (pub) => { if (saverRef.current && pub && pub.source === cam && pub.kind === 'video') pub.setSubscribed(false) }
    room
      .on(E.ParticipantConnected, bump).on(E.ParticipantDisconnected, bump).on(E.TrackSubscribed, (t, pub) => { holdVideo(pub); bump() }).on(E.TrackUnsubscribed, bump)
      .on(E.TrackPublished, (pub) => { holdVideo(pub); bump() }).on(E.TrackUnpublished, bump).on(E.TrackUnmuted, bump)
      .on(E.TrackMuted, (pub, p) => {                                     // muted by the host (not by their own tap): the mic button turns off and they're told
        if (p === room.localParticipant && pub && pub.source === lk.Track.Source.Microphone && Date.now() - selfMic.current > 2000) { setMicOn(false); toast('The host muted your microphone. Tap the mic to speak again.') }
        bump()
      })
      .on(E.LocalTrackPublished, bump).on(E.LocalTrackUnpublished, bump).on(E.ParticipantNameChanged, bump)
      .on(E.ActiveSpeakersChanged, (list) => { const now = Date.now(); for (const p of list) spoke.current.set(p.identity, now); bump() })
      .on(E.ParticipantAttributesChanged, (changed, p) => {
        if ((info.host || cohostRef.current) && p !== room.localParticipant && 'hand' in changed && changed.hand) toast(`${p.name || 'Someone'} raised a hand.`)
        if (p === room.localParticipant) checkCo(p)
        if (p !== room.localParticipant && isBoss(p) && 'rec' in changed) { const w = isHostId(p.identity) ? 'The host' : `${p.name || 'A co-host'} (co-host)`; toast(changed.rec === 'paused' ? `${w} paused the recording.` : changed.rec ? (prevRec.current === 'paused' ? `${w} resumed recording.` : `${w} started recording this meeting.`) : `${w} stopped recording.`) }
        if (isBoss(p) && 'rec' in changed) prevRec.current = changed.rec
        bump()
      })
      .on(E.ParticipantPermissionsChanged, (prev, p) => {
        if (p === room.localParticipant) {
          checkCo(p)
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
        if (!p || (topic !== 'chat' && topic !== 'react')) return
        let m; try { m = JSON.parse(new TextDecoder().decode(payload)) } catch { return }
        if (topic === 'react') { if (m && REACTIONS.includes(m.e)) float(m.e, p.name || 'Someone'); return }
        const text = String((m && m.text) || '').slice(0, 1000).trim(); if (!text) return
        setMessages((l) => [...l.slice(-299), { id: String(m.id || Math.random()), who: p.identity, name: p.name || 'Someone', text, at: Date.now() }])
        if (panelRef.current !== 'chat') setUnread((u) => u + 1)
      })
      .on(E.Disconnected, (reason) => {
        const R = lk.DisconnectReason
        roomRef.current = null; levelEls.current.clear()
        if (miniRef.current) miniRef.current.close(); controlsOff.current()
        if (recRef.current && !closing.current) { const r = recRef.current; recRef.current = null; setRec(null); r.stop().then((f) => { if (f) { toast('Recording saved: ' + f.name); if (f.notes && canNotes) setNotesReady(true) } }).catch(() => toast('The recording couldn’t be saved. Reopen this page to try again.')) }
        setPhase(endedRef.current || reason === R.ROOM_DELETED ? 'ended' : reason === R.PARTICIPANT_REMOVED ? 'removed' : 'left')
      })
    await room.connect(info.url, info.token)
    if (previewTrack.current) { previewTrack.current.stop(); previewTrack.current = null }
    miniRef.current = new MiniWindow({ room, lk, actions: { mic: () => actRef.current.toggleMic(), cam: () => actRef.current.toggleCam(), leave: () => actRef.current.leave(),
      state: () => ({ micOn: room.localParticipant.isMicrophoneEnabled, camOn: room.localParticipant.isCameraEnabled }) } })
    controlsOff.current = callControls({ title, mic: () => actRef.current.toggleMic(), cam: () => actRef.current.toggleCam(), leave: () => actRef.current.leave(),
      mini: () => { if (miniRef.current) miniRef.current.show().catch(() => {}) } })
    if (onApple()) {
      let micWasOn = false
      const seen = async () => {
        const lp = room.localParticipant
        if (document.visibilityState === 'hidden') { micWasOn = lp.isMicrophoneEnabled; lp.setAttributes({ away: '1' }).catch(() => {}); return }
        lp.setAttributes({ away: '' }).catch(() => {})
        const pub = lp.getTrackPublication(lk.Track.Source.Microphone), t = pub && pub.track && pub.track.mediaStreamTrack
        if (micWasOn && (!t || t.readyState === 'ended' || t.muted)) {             // iOS stopped it: start it again
          try { selfMic.current = Date.now(); await lp.setMicrophoneEnabled(false); await lp.setMicrophoneEnabled(true); setMicOn(true) } catch { setMicOn(false); toast('Tap the mic to turn it back on.') }
        }
      }
      document.addEventListener('visibilitychange', seen); awayOff.current = () => document.removeEventListener('visibilitychange', seen)
    }
    setStartedAt(Date.now()); setPhase('in'); setConn({ reconnecting: false, weak: false, audioBlocked: !room.canPlaybackAudio })
    if (saverRef.current) applySaver(true)
    if (info.speaker) {
      if (micOn) await room.localParticipant.setMicrophoneEnabled(true).catch((e) => { setMicOn(false); toast(deviceError(e, 'microphone')) })
      if (camOn && !saverRef.current) await room.localParticipant.setCameraEnabled(true).catch((e) => { setCamOn(false); toast(deviceError(e, 'camera')) })
    }
    room.startAudio().catch(() => {}); bump()
    if (info.host && canRecord() && !recRef.current) setAskRec(true)
    if (!info.host && [...room.remoteParticipants.values()].some((p) => isBoss(p) && p.attributes && p.attributes.rec)) toast('This meeting is being recorded.')
  }
  useEffect(() => {
    // the tab is closing: leave any recording's saved pieces where they are; the lobby offers them next time
    const off = () => { closing.current = true; awayOff.current(); saidLeft(); if (miniRef.current) miniRef.current.close(); controlsOff.current(); if (roomRef.current) roomRef.current.disconnect() }
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
  useEffect(() => { callState(micOn, camOn) }, [micOn, camOn])
  const room = roomRef.current, me = room && room.localParticipant
  const canSpeak = !!(me && me.permissions && me.permissions.canPublish)
  async function toggleMic() {
    if (!room) return
    const on = !me.isMicrophoneEnabled
    selfMic.current = Date.now()
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
    try { await post('/api/meet/host', { action, code, identity: p.identity, ...seat() }); toast(action === 'allow-speak' ? `${p.name} can speak now.` : action === 'stop-speak' ? `${p.name} is listening again.` : action === 'mute' ? `${p.name || 'They'} is muted.` : action === 'make-cohost' ? `${p.name || 'They'} is a co-host now.` : action === 'unmake-cohost' ? `${p.name || 'They'} is no longer a co-host.` : `${p.name} was removed.`) }
    catch (e) { toast(e.message) }
  }
  async function startRec(audioOnly) {
    setAskRec(false)
    if (!room || recRef.current) return
    try {
      const r = new MeetRecorder({ room, title, audioOnly, stage: stageRef.current, code, kbps: recHigh ? 96 : 64 })
      await r.start(); recRef.current = r; setRec({ at: Date.now(), audioOnly })
      await me.setAttributes({ rec: '1' }).catch(() => {})
      toast(audioOnly ? 'Recording audio. Everyone can see it’s on.' : 'Recording. Everyone can see it’s on.')
    } catch (e) { toast(e.message || 'Recording couldn’t start. Try again.') }
  }
  async function toggleFx(kind) {
    const on = !fx[kind], v = { ...fx, [kind]: on }; setFx(v); fxRef.current = v; rememberFx({ [kind]: on })
    const r = roomRef.current; if (!r) return
    const L = lkRef.current, pub = r.localParticipant.getTrackPublication(kind === 'noise' ? L.Track.Source.Microphone : L.Track.Source.Camera)
    if (!pub || !pub.track) { toast(on ? (kind === 'noise' ? 'Noise cancellation will be on when your mic is.' : 'Your background will be blurred when your camera is on.') : 'Turned off.'); return }
    try { await (kind === 'noise' ? setNoise(pub.track, on) : setBlur(pub.track, on)); setFxLive((x) => ({ ...x, [kind]: on })); toast(kind === 'noise' ? (on ? 'Noise cancellation is on.' : 'Noise cancellation is off.') : (on ? 'Your background is blurred.' : 'Background blur is off.')) }
    catch (e) { toast(e.message || 'That didn’t work here.'); const back = { ...v, [kind]: !on }; setFx(back); fxRef.current = back; rememberFx({ [kind]: !on }) }
  }
  actRef.current = { toggleMic: () => toggleMic(), toggleCam: () => toggleCam(), leave: () => leave() }
  async function openMini() {
    setPop(null)
    try { await miniRef.current.show() } catch (e) { toast(e && e.name === 'NotAllowedError' ? 'Tap Mini window again to open it.' : 'This browser can’t open a mini window.') }
  }
  async function toggleNotes() {
    if (notesRef.current) { const r = notesRef.current; notesRef.current = null; setNoting(false); me.setAttributes({ notes: '' }).catch(() => {}); try { const f = await r.stop(); if (f && f.notes) { setNotesReady(true); toast('AI notes stopped. Make the notes when you’re ready.') } } catch {} return }
    try { const r = new MeetRecorder({ room, title, code, notesOnly: true }); await r.start(); notesRef.current = r; setNoting(true); await me.setAttributes({ notes: '1' }).catch(() => {}); toast('AI notes are on. Everyone can see it.') }
    catch (e) { toast(e.message || 'AI notes couldn’t start. Try again.') }
  }
  async function pauseRec() {
    const r = recRef.current; if (!r) return
    if (rec.pausedAt) { r.resume(); setRec({ ...rec, pausedAt: 0, pausedTotal: (rec.pausedTotal || 0) + (Date.now() - rec.pausedAt) }); me.setAttributes({ rec: '1' }).catch(() => {}); toast('Recording again.') }
    else { r.pause(); setRec({ ...rec, pausedAt: Date.now() }); me.setAttributes({ rec: 'paused' }).catch(() => {}); toast('Recording paused. Nothing is recorded until you resume.') }
  }
  async function stopRec() {
    const r = recRef.current; if (!r) return
    recRef.current = null; setRec(null)
    if (roomRef.current) roomRef.current.localParticipant.setAttributes({ rec: '' }).catch(() => {})
    try { const f = await r.stop(); toast(f ? 'Recording saved to this device: ' + f.name : 'Nothing was recorded.'); if (f && f.notes && (canNotes || cohostRef.current)) setNotesReady(true) }
    catch { toast('The recording couldn’t be saved. Reopen this page to try again.') }
  }
  async function react(e) {
    const now = Date.now(); if (!room || now - lastReact.current < 350) return
    lastReact.current = now; float(e, 'You')
    me.publishData(new TextEncoder().encode(JSON.stringify({ e })), { reliable: true, topic: 'react' }).catch(() => {})
  }
  async function savePending(x) { try { const f = await saveRecording(x.id); if (f) toast('Saved: ' + f.name) } catch { toast('That recording couldn’t be saved.') } setPending(await pendingRecordings()) }
  async function dropPending(x) { if (!window.confirm('Delete this unsaved recording? It can’t be recovered.')) return; await discardRecording(x.id).catch(() => {}); setPending(await pendingRecordings()) }
  async function leave() { setLeaving(false); if (miniRef.current) miniRef.current.close(); controlsOff.current(); if (recRef.current) await stopRec(); if (notesRef.current) await toggleNotes(); saidLeft(); if (roomRef.current) roomRef.current.disconnect() }
  async function endForAll() {
    setLeaving(false)
    if (recRef.current) await stopRec()
    if (notesRef.current) await toggleNotes()
    try { await post('/api/meet/host', { action: 'end', code }) } catch (e) { toast(e.message); return }
    endedRef.current = true; setPhase('ended'); if (roomRef.current) roomRef.current.disconnect()
  }
  async function copyLink() {
    const url = hereLink(code)
    try { await navigator.clipboard.writeText(url); toast('Meeting link copied.') } catch { window.prompt('Copy the meeting link:', url) }
  }

  // ---------- screens other than the room ----------
  if (phase !== 'in') return (<div className="mt mt-solo">{showNotes ? <NotesPanel code={code} title={title} make who={seat()} onClose={() => setShowNotes(false)} /> : null}
    <header className="mt-brand"><img src="/studio/mark.png" alt="" width="22" height="26" /><span>Olexweb</span></header>
    <main className="mt-card">
      {phase === 'ended' ? <><h1 className="mt-h">This meeting has ended</h1><p className="mt-p">{boss && notesReady ? 'Your recording is saved. Olex AI can turn it into notes: a summary, decisions and action items.' : 'Thanks for being here. You can close this page.'}</p>
          {boss && notesReady ? <div className="mt-row"><button className="mt-btn mt-go" onClick={() => setShowNotes(true)}>Make AI notes</button></div> : null}</>
        : phase === 'removed' ? <><h1 className="mt-h">You were removed from the meeting</h1><p className="mt-p">The host removed you. If that was a mistake, ask them for the link again.</p></>
        : phase === 'unavailable' ? <><h1 className="mt-h">Meetings aren’t available right now</h1><p className="mt-p">Try again in a little while.</p></>
        : phase === 'left' ? <><h1 className="mt-h">You left the meeting</h1><p className="mt-p">{title}</p><div className="mt-row"><button className="mt-btn mt-go" onClick={() => { setPhase('lobby'); setMessages([]) }}>Join again</button></div></>
        : phase === 'waiting' ? <><h1 className="mt-h">{title}</h1>{startsAt ? <When at={startsAt} minutes={minutes} code={code} title={title} /> : null}<p className="mt-p mt-wait"><span className="mt-pulse" aria-hidden="true" />Waiting for the host to start the meeting. You’ll go in by yourself when they do.</p>
          <div className="mt-row"><button className="mt-btn" onClick={() => setPhase('lobby')}>Back</button></div></>
        : <form onSubmit={join} className="mt-lobby">
          {pending.length ? <div className="mt-pending" role="status">
            <b>{pending.length === 1 ? 'A recording wasn’t saved' : `${pending.length} recordings weren’t saved`}</b>
            {pending.map((x) => <div key={x.id} className="mt-pending-row"><span>{fileName(x)}</span>
              <button type="button" className="mt-btn mt-xs mt-go" onClick={() => savePending(x)}>Save</button>
              <button type="button" className="mt-btn mt-xs mt-ghost" onClick={() => dropPending(x)}>Delete</button></div>)}
          </div> : null}
          <h1 className="mt-h">{title}</h1>
          {startsAt ? <When at={startsAt} minutes={minutes} code={code} title={title} host={host} /> : null}
          <p className="mt-p">{host ? 'You’re the host. Joining starts the meeting for everyone with the link.' : speakers === 'invited' ? 'You’ll join as a listener. Raise your hand to ask to speak, and use the chat anytime.' : asks ? 'The host asks for a few details before you join. Then check your mic and camera.' : 'Check your name, mic and camera, then join.'}</p>
          <div className={'mt-preview' + (camOn ? ' on' : '')}>
            <video ref={previewRef} muted playsInline autoPlay className="mt-mirror" />
            {!camOn ? <span className="mt-av mt-av-lg" style={{ background: tone(name || 'x') }}>{initials(name || '?')}</span> : null}
          </div>
          <label className="mt-lab" htmlFor="mt-name">Your name</label>
          <input id="mt-name" className="mt-in" value={name} maxLength={40} autoComplete="name" onChange={(e) => setName(e.target.value)} placeholder="How others will see you" />
          {iosTip ? <p className="mt-iostip">On iPhone, keep this page open while you talk. If you switch apps, your mic pauses until you come back (Apple’s rule for websites).</p> : null}
          {asks ? <div className="mt-asks">
            {form.phone !== 'off' ? <><label className="mt-lab" htmlFor="mt-phone">Phone number{form.phone === 'optional' ? ' (optional)' : ''}</label>
              <input id="mt-phone" className="mt-in" type="tel" inputMode="tel" autoComplete="tel" maxLength={30} value={det.phone} onChange={(e) => setDet({ ...det, phone: e.target.value })} placeholder="+234 801 234 5678" /></> : null}
            {form.email !== 'off' ? <><label className="mt-lab" htmlFor="mt-email">Email{form.email === 'optional' ? ' (optional)' : ''}</label>
              <input id="mt-email" className="mt-in" type="email" inputMode="email" autoComplete="email" maxLength={200} value={det.email} onChange={(e) => setDet({ ...det, email: e.target.value })} placeholder="you@example.com" /></> : null}
            {form.org ? <><label className="mt-lab" htmlFor="mt-org">Organisation or role (optional)</label>
              <input id="mt-org" className="mt-in" maxLength={100} autoComplete="organization" value={det.org} onChange={(e) => setDet({ ...det, org: e.target.value })} /></> : null}
            {form.question ? <><label className="mt-lab" htmlFor="mt-ans">{form.question} (optional)</label>
              <input id="mt-ans" className="mt-in" maxLength={500} value={det.answer} onChange={(e) => setDet({ ...det, answer: e.target.value })} /></> : null}
            <label className="mt-consent"><input type="checkbox" checked={det.consent} onChange={(e) => setDet({ ...det, consent: e.target.checked })} />
              <span>Share these details with the host of this meeting. Only the host sees them. They’re kept {keepWords(form.keep)}{form.keep ? ' after the meeting' : ''}, then deleted.</span></label>
          </div> : null}
          {host || speakers === 'everyone' ? <div className="mt-toggles" role="group" aria-label="Before you join">
            <button type="button" className="mt-chip" aria-pressed={micOn} onClick={() => setMicOn((m) => !m)}>{micOn ? I.mic : I.micOff}{micOn ? 'Mic on' : 'Mic off'}</button>
            <button type="button" className="mt-chip" aria-pressed={camOn} disabled={saver} onClick={() => previewOn(!camOn)}>{camOn ? I.cam : I.camOff}{camOn ? 'Camera on' : 'Camera off'}</button>
            <button type="button" className="mt-chip" aria-pressed={saver} onClick={() => { const on = !saver; setSaver(on); if (on && camOn) previewOn(false) }}>{I.leaf}Data saver</button>
            {noiseOk ? <button type="button" className="mt-chip" aria-pressed={fx.noise} onClick={() => { const v = { ...fx, noise: !fx.noise }; setFx(v); fxRef.current = v; rememberFx({ noise: v.noise }) }}>{I.wave}Noise cancellation</button> : null}
            {blurOk ? <button type="button" className="mt-chip" aria-pressed={fx.blur} onClick={() => { const v = { ...fx, blur: !fx.blur }; setFx(v); fxRef.current = v; rememberFx({ blur: v.blur }) }}>{I.blur}Blur background</button> : null}
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
  const onStage = all.filter((p) => speaksNow(p) || isBoss(p))
    .sort((a, b) => (spoke.current.get(b.identity) || 0) - (spoke.current.get(a.identity) || 0) || (+!!b.isCameraEnabled - +!!a.isCameraEnabled) || ((a.joinedAt || 0) - (b.joinedAt || 0)))
  const limit = share ? 4 : MAX_TILES
  const tiles = onStage.slice(0, limit)
  if (me && !tiles.includes(me) && onStage.includes(me)) tiles[tiles.length - 1] = me        // you always see yourself
  const listeners = all.filter((p) => !onStage.includes(p)), hidden = onStage.length - tiles.length
  const hands = all.filter((p) => p.attributes && p.attributes.hand).sort((a, b) => Number(a.attributes.hand) - Number(b.attributes.hand))
  const audioPubs = [...room.remoteParticipants.values()].flatMap((p) => [...p.audioTrackPublications.values()].filter((x) => x.track))
  const canShare = canSpeak && typeof navigator !== 'undefined' && navigator.mediaDevices && 'getDisplayMedia' in navigator.mediaDevices
  const recording = !!rec || all.some((p) => isBoss(p) && p.attributes && p.attributes.rec)
  const notesOn = noting || all.some((p) => isBoss(p) && p.attributes && p.attributes.notes)
  const recPaused = rec ? !!rec.pausedAt : all.some((p) => isBoss(p) && p.attributes && p.attributes.rec === 'paused')
  const hand = !!(me.attributes && me.attributes.hand)

  return (<div className={'mt mt-in-room' + (panel ? ' mt-panel-on' : '')} data-noise={fxLive.noise ? 'on' : 'off'} data-blur={fxLive.blur ? 'on' : 'off'} onPointerDown={(e) => { if (pop && !e.target.closest('.mt-popwrap')) setPop(null) }}>
    <header className="mt-top">
      <div className="mt-title"><b>{title}</b><Elapsed from={startedAt} />{recording ? <span className={'mt-recbadge' + (recPaused ? ' mt-paused' : '')} role="status"><i aria-hidden="true" />{recPaused ? 'Recording paused' : 'Recording'}</span> : null}{notesOn ? <span className="mt-recbadge mt-notesbadge" role="status"><i aria-hidden="true" />AI notes</span> : null}</div>
      <div className="mt-top-end">
        <span className="mt-count" title="People in the meeting">{I.people}{all.length}</span>
        <button className="mt-btn mt-sm" onClick={copyLink}>{I.link}<span>Copy link</span></button>
      </div>
    </header>

    {conn.reconnecting ? <p className="mt-banner" role="status">Reconnecting… Your audio comes back on its own.</p>
      : conn.weak ? <p className="mt-banner mt-warn" role="status">{I.weak}Your connection is weak.{!saver ? <> <button className="mt-link" onClick={toggleSaver}>Turn on Data saver</button> to keep voices clear.</> : ' Voices come first.'}</p> : null}
    {boss && notesReady ? <p className="mt-banner" role="status">Your recording is ready for AI notes. <button className="mt-link" onClick={() => setShowNotes(true)}>Make AI notes</button><button className="mt-x mt-x-sm" onClick={() => setNotesReady(false)} aria-label="Hide">{I.close}</button></p> : null}
    {conn.audioBlocked ? <p className="mt-banner" role="status">Sound is off in this browser. <button className="mt-link" onClick={() => room.startAudio().then(() => setConn((c) => ({ ...c, audioBlocked: false }))).catch(() => {})}>Turn on sound</button></p> : null}

    <div className="mt-body">
      <main ref={stageRef} className={'mt-stage' + (share ? ' mt-sharing' : '')} aria-label="People in the meeting">
        <div className="mt-floats" aria-hidden="true">{floats.map((f) => <span key={f.id} className="mt-float" style={{ left: f.x + '%' }}><b>{f.e}</b><small>{f.who}</small></span>)}</div>
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
          : <><People all={all} me={me} host={host} boss={boss} hands={hands} speaksNow={speaksNow} hostDo={hostDo} lk={lk} />{!host ? <button className="mt-report-link" onClick={() => setReporting(true)}>Report this meeting</button> : null}</>}
      </aside> : null}
    </div>

    <nav className="mt-bar" aria-label="Meeting controls">
      {canSpeak ? <>
        <button className={'mt-c' + (me.isMicrophoneEnabled ? '' : ' mt-off')} aria-pressed={me.isMicrophoneEnabled} onClick={toggleMic}>{me.isMicrophoneEnabled ? I.mic : I.micOff}<span>{me.isMicrophoneEnabled ? 'Mute' : 'Unmute'}</span></button>
        <button className={'mt-c' + (me.isCameraEnabled ? '' : ' mt-off')} aria-pressed={me.isCameraEnabled} onClick={toggleCam}>{me.isCameraEnabled ? I.cam : I.camOff}<span>{me.isCameraEnabled ? 'Stop video' : 'Start video'}</span></button>
        {canShare ? <button className={'mt-c mt-wide' + (me.isScreenShareEnabled ? ' mt-on' : '')} aria-pressed={me.isScreenShareEnabled} onClick={toggleShare}>{I.share}<span>{me.isScreenShareEnabled ? 'Stop sharing' : 'Share screen'}</span></button> : null}
      </> : null}
      {!boss ? <button className={'mt-c' + (hand ? ' mt-on' : '')} aria-pressed={hand} onClick={toggleHand}>{I.hand}<span>{hand ? 'Lower hand' : 'Raise hand'}</span></button> : null}
      <span className="mt-popwrap">
        <button className={'mt-c' + (pop === 'react' ? ' mt-on' : '')} aria-expanded={pop === 'react'} onClick={() => setPop((x) => (x === 'react' ? null : 'react'))}>{I.smile}<span>React</span></button>
        {pop === 'react' ? <span className="mt-pop mt-reacts" role="group" aria-label="Send a reaction">{REACTIONS.map((e) => <button key={e} onClick={() => react(e)} aria-label={'Send ' + e}>{e}</button>)}</span> : null}
      </span>
      {boss && canRecord() ? <button className={'mt-c' + (rec ? ' mt-recording' : '')} aria-pressed={!!rec} onClick={() => (rec ? stopRec() : setAskRec(true))}>{rec ? I.stop : I.rec}<span>{rec ? <RecTime from={rec.at} paused={rec.pausedAt} pausedTotal={rec.pausedTotal} /> : 'Record'}</span></button> : null}
      {boss && canRecord() ? <button className={'mt-c mt-wide' + (noting ? ' mt-on' : '')} aria-pressed={noting} onClick={toggleNotes}>{I.notes}<span>{noting ? 'Stop notes' : 'AI notes'}</span></button> : null}
      {boss && rec ? <button className={'mt-c' + (rec.pausedAt ? ' mt-on' : '')} aria-pressed={!!rec.pausedAt} onClick={pauseRec}>{rec.pausedAt ? I.rec : I.pause}<span>{rec.pausedAt ? 'Resume' : 'Pause'}</span></button> : null}
      <button className={'mt-c' + (panel === 'chat' ? ' mt-on' : '')} aria-pressed={panel === 'chat'} onClick={() => setPanel((x) => (x === 'chat' ? null : 'chat'))}>{I.chat}<span>Chat</span>{unread ? <i className="mt-badge" aria-label={unread + ' new'}>{unread > 9 ? '9+' : unread}</i> : null}</button>
      <button className={'mt-c' + (panel === 'people' ? ' mt-on' : '')} aria-pressed={panel === 'people'} onClick={() => setPanel((x) => (x === 'people' ? null : 'people'))}>{I.people}<span>People</span>{host && hands.length ? <i className="mt-badge">{hands.length}</i> : null}</button>
      <button className={'mt-c mt-wide' + (saver ? ' mt-on' : '')} aria-pressed={saver} onClick={toggleSaver}>{I.leaf}<span>Data saver</span></button>
      <span className="mt-popwrap">
        <button className={'mt-c' + (pop === 'more' ? ' mt-on' : '')} aria-expanded={pop === 'more'} onClick={() => setPop((x) => (x === 'more' ? null : 'more'))}>{I.dots}<span>More</span></button>
        {pop === 'more' ? <span className="mt-pop mt-menu" role="menu">
          {canShare ? <button className="mt-narrow" role="menuitem" onClick={() => { setPop(null); toggleShare() }}>{I.share}{me.isScreenShareEnabled ? 'Stop sharing' : 'Share screen'}</button> : null}
          <button className="mt-narrow" role="menuitemcheckbox" aria-checked={saver} onClick={() => { setPop(null); toggleSaver() }}>{I.leaf}Data saver{saver ? ': on' : ''}</button>
          {miniOk ? <button role="menuitem" onClick={openMini}>{I.mini}Mini window</button> : null}
          {noiseOk ? <button role="menuitemcheckbox" aria-checked={fx.noise} onClick={() => { setPop(null); toggleFx('noise') }}>{I.wave}Noise cancellation{fx.noise ? ': on' : ''}</button> : null}
          {blurOk ? <button role="menuitemcheckbox" aria-checked={fx.blur} onClick={() => { setPop(null); toggleFx('blur') }}>{I.blur}Blur background{fx.blur ? ': on' : ''}</button> : null}
          {boss && canRecord() ? <button className="mt-narrow" role="menuitemcheckbox" aria-checked={noting} onClick={() => { setPop(null); toggleNotes() }}>{I.notes}{noting ? 'Stop AI notes' : 'AI notes'}</button> : null}
          {!host ? <button role="menuitem" onClick={() => { setPop(null); setReporting(true) }}>{I.close}Report this meeting</button> : null}
        </span> : null}
      </span>
      <button className="mt-c mt-leave" onClick={() => (host ? setLeaving(true) : leave())}>{I.leave}<span>Leave</span></button>
    </nav>

    {askRec ? <div className="mt-modal" role="dialog" aria-modal="true" aria-labelledby="mt-rec-h" onClick={(e) => { if (e.target === e.currentTarget) setAskRec(false) }}>
      <div className="mt-card mt-dialog">
        <h2 className="mt-h2" id="mt-rec-h">Record this meeting?</h2>
        <p className="mt-p">Everyone sees that it’s being recorded. When you stop, the file saves to this device. Keep this tab open while recording.</p>
        <div className="mt-seg" role="group" aria-label="What to record">
          <button type="button" aria-pressed={!recAudio} onClick={() => setRecAudio(false)}>Video and audio</button>
          <button type="button" aria-pressed={recAudio} onClick={() => setRecAudio(true)}>Audio only</button>
        </div>
        {recAudio && canMp3() ? <div className="mt-recq"><span>MP3 quality</span><div className="mt-seg mt-seg-sm" role="group" aria-label="MP3 quality">
          <button type="button" aria-pressed={!recHigh} onClick={() => setRecHigh(false)}>Standard</button><button type="button" aria-pressed={recHigh} onClick={() => setRecHigh(true)}>High</button></div>
          <small>{recHigh ? '96 kbps: about 43 MB an hour' : '64 kbps: clear speech, about 29 MB an hour'}</small></div> : null}
        <p className="mt-hint">{recAudio ? (canMp3() ? 'An MP3 that plays everywhere (WhatsApp, phones, computers). Best for notes later.' : 'Small file, about 30 MB an hour. Best for notes later.') : 'What you see on screen, up to about 400 MB an hour.'}</p>
        <div className="mt-col">
          <button className="mt-btn mt-rec-go" onClick={() => startRec(recAudio)} autoFocus>{I.rec}Record</button>
          <button className="mt-btn mt-ghost" onClick={() => setAskRec(false)}>Not now</button>
        </div>
      </div>
    </div> : null}

    {showNotes ? <NotesPanel code={code} title={title} make who={seat()} onClose={() => setShowNotes(false)} /> : null}
    {reporting ? <ReportBox onSend={sendReport} onClose={() => setReporting(false)} /> : null}

    {leaving ? <div className="mt-modal" role="dialog" aria-modal="true" aria-label="Leave the meeting" onClick={(e) => { if (e.target === e.currentTarget) setLeaving(false) }}>
      <div className="mt-card mt-dialog">
        <h2 className="mt-h2">Leave or end the meeting?</h2>
        <p className="mt-p">Ending it removes everyone and closes the link.{rec ? ' Your recording is saved first.' : ''}</p>
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

// When a scheduled meeting starts: Lagos time, the guest's own time if it differs, how long until, and Add to calendar.
// Rendered only in the browser (dates format slightly differently on servers), so the page never mismatches.
function When({ at, minutes, code, title, host }) {
  const [now, setNow] = useState(null)
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t) }, [])
  if (!now) return <div className="mt-when" aria-hidden="true" />
  const t = new Date(at).getTime(), left = t - now, f = (tz) => new Date(at).toLocaleString('en-GB', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', hour12: true }).replace(' at ', ', ')
  const mine = Intl.DateTimeFormat().resolvedOptions().timeZone, lagos = f('Africa/Lagos'), local = mine && mine !== 'Africa/Lagos' && f(mine) !== lagos ? f(mine) : null
  const m = Math.round(left / 60e3), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60
  const until = left <= 0 ? (left > -minutes * 60e3 ? 'Starting now' : 'This was the planned time') : `Starts in ${[d && `${d} day${d === 1 ? '' : 's'}`, h && `${h} hour${h === 1 ? '' : 's'}`, !d && mm && `${mm} minute${mm === 1 ? '' : 's'}`].filter(Boolean).join(' ') || 'under a minute'}`
  const z = (x) => new Date(x).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''), url = hereLink(code)
  const google = 'https://calendar.google.com/calendar/render?' + new URLSearchParams({ action: 'TEMPLATE', text: title, dates: `${z(t)}/${z(t + minutes * 60e3)}`, details: 'Join the meeting: ' + url, location: url })
  return (<div className="mt-when">
    <p className="mt-when-at"><b>{lagos}</b> <span>Lagos time</span>{local ? <><br /><span>{local} your time</span></> : null}</p>
    <p className="mt-when-left">{until}</p>
    {left > 0 && !host ? <div className="mt-row mt-cal"><a className="mt-btn mt-sm" href={google} target="_blank" rel="noopener">Add to Google Calendar</a><a className="mt-btn mt-sm" href={'/api/meet?calendar=1&code=' + code} download="meeting.ics">Apple or Outlook calendar</a></div> : null}
  </div>)
}
function ReportBox({ onSend, onClose }) {
  const [reason, setReason] = useState(''), [note, setNote] = useState(''), [busy, setBusy] = useState(false)
  return (<div className="mt-modal" role="dialog" aria-modal="true" aria-labelledby="mt-rep-h" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
    <form className="mt-card mt-dialog" onSubmit={async (e) => { e.preventDefault(); if (!reason) return; setBusy(true); await onSend(reason, note); setBusy(false) }}>
      <h2 className="mt-h2" id="mt-rep-h">Report this meeting</h2>
      <p className="mt-p">Olexweb looks at every report. The host isn’t told who reported.</p>
      <div className="mt-reasons" role="radiogroup" aria-label="Reason">{[['spam', 'Spam or scam'], ['abuse', 'Abuse or harassment'], ['illegal', 'Illegal or harmful content'], ['other', 'Something else']].map(([v, l]) =>
        <label key={v}><input type="radio" name="reason" value={v} checked={reason === v} onChange={() => setReason(v)} />{l}</label>)}</div>
      <textarea className="mt-in" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything that would help (optional)" aria-label="More details (optional)" />
      <div className="mt-col" style={{ marginTop: 14 }}><button className="mt-btn mt-danger" disabled={!reason || busy}>{busy ? 'Sending…' : 'Send report'}</button><button type="button" className="mt-btn mt-ghost" onClick={onClose}>Cancel</button></div>
    </form>
  </div>)
}
function Elapsed({ from }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  return <span className="mt-time">{from ? clock(now - from) : ''}</span>
}
function RecTime({ from, paused = 0, pausedTotal = 0 }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  return <>{clock((paused || now) - from - pausedTotal)}{paused ? ' paused' : ''}</>
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
  return (<div className={'mt-tile' + (p.isSpeaking ? ' mt-speaking' : '') + (track ? ' mt-has-video' : '')} ref={ring}
    data-name={p.name || 'Guest'} data-initials={initials(p.name)} data-tone={tone(p.identity)} data-host={isHostId(p.identity) ? '1' : undefined}>
    {track ? <video ref={vref} muted playsInline autoPlay className={me && cam.source === S.Camera ? 'mt-mirror' : ''} />
      : <span className="mt-av" style={{ background: tone(p.identity) }}>{initials(p.name)}</span>}
    {!track && cam && !cam.isMuted && saver && !me ? <span className="mt-saved">Video paused (Data saver)</span> : null}
    <span className="mt-name">{muted ? <i className="mt-mute" aria-label="Muted">{I.micOff}</i> : null}{p.name || 'Guest'}{me ? ' (you)' : ''}{isHostId(p.identity) ? <em>Host</em> : isCoId(p) ? <em>Co-host</em> : null}</span>
    {p.attributes && p.attributes.hand ? <span className="mt-hand" aria-label="Hand raised">{I.hand}</span> : null}
    {p.attributes && p.attributes.away ? <span className="mt-away">Stepped away (iPhone pauses the mic)</span> : null}
    {weak ? <span className="mt-weak" title="Weak connection" aria-label="Weak connection">{I.weak}</span> : null}
  </div>)
}
function Shared({ pub, who, local }) {
  const ref = useRef(null), t = pub.track
  useEffect(() => { const el = ref.current; if (!el || !t) return; t.attach(el); return () => { t.detach(el) } }, [t])
  return (<div className="mt-share"><video ref={ref} muted playsInline autoPlay /><span className="mt-name">{local ? 'You are sharing your screen' : `${who.name || 'Someone'} is sharing`}</span></div>)
}
function Chat({ messages, send, myId }) {
  const [text, setText] = useState(''), [picker, setPicker] = useState(false), list = useRef(null), box = useRef(null)
  useEffect(() => { const el = list.current; if (el) el.scrollTop = el.scrollHeight }, [messages.length])
  async function go(e) { e.preventDefault(); if (await send(text)) { setText(''); setPicker(false) } }
  function add(e) {                                                        // into the message where the cursor is
    const el = box.current, a = el ? el.selectionStart : text.length, b = el ? el.selectionEnd : text.length
    const next = (text.slice(0, a) + e + text.slice(b)).slice(0, 1000); setText(next)
    requestAnimationFrame(() => { if (el) { el.focus(); el.setSelectionRange(a + e.length, a + e.length) } })
  }
  return (<div className="mt-chat">
    <div className="mt-msgs" ref={list}>
      {messages.length ? messages.map((m, i) => { const same = i > 0 && messages[i - 1].who === m.who
        const big = m.text.length <= 12 && ONLY_EMOJI.test(m.text)
        return <div key={m.id} className={'mt-msg' + (m.who === myId ? ' mt-mine' : '') + (same ? ' mt-same' : '') + (big ? ' mt-big' : '')}>{!same ? <b>{m.who === myId ? 'You' : m.name}</b> : null}<p>{m.text}</p></div> })
        : <p className="mt-empty">Messages here go to everyone in the meeting. They disappear when it ends.</p>}
    </div>
    {picker ? <div className="mt-emoji" role="group" aria-label="Emoji">{EMOJI.map((e) => <button type="button" key={e} onClick={() => add(e)} aria-label={e}>{e}</button>)}</div> : null}
    <form className="mt-send" onSubmit={go}>
      <button type="button" className={'mt-btn mt-icon mt-ghost' + (picker ? ' mt-picked' : '')} aria-label="Emoji" aria-expanded={picker} onClick={() => setPicker((x) => !x)}>{I.smile}</button>
      <textarea ref={box} className="mt-in" rows={1} maxLength={1000} value={text} placeholder="Message everyone" aria-label="Message everyone" onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go(e) } else if (e.key === 'Escape') setPicker(false) }} />
      <button className="mt-btn mt-go mt-icon" aria-label="Send" disabled={!text.trim()}>{I.send}</button>
    </form>
  </div>)
}
function People({ all, me, host, boss, hands, speaksNow, hostDo, lk }) {
  const S = lk.Track.Source
  const order = [...hands, ...all.filter((p) => !hands.includes(p))]
  return (<ul className="mt-people">
    {order.map((p) => { const mic = p.getTrackPublication(S.Microphone), on = mic && !mic.isMuted, isHost = isHostId(p.identity), co = isCoId(p), speaks = isHost || co || speaksNow(p)
      return <li key={p.identity}>
        <span className="mt-av mt-av-sm" style={{ background: tone(p.identity) }}>{initials(p.name)}</span>
        <span className="mt-who"><b>{p.name || 'Guest'}{p === me ? ' (you)' : ''}</b><small>{isHost ? 'Host' : co ? 'Co-host' : speaks ? 'Can speak' : 'Listening'}{p.attributes && p.attributes.hand ? ', hand raised' : ''}</small></span>
        {p.attributes && p.attributes.hand ? <span className="mt-hand-sm" aria-hidden="true">{I.hand}</span> : null}
        {speaks ? <span className={'mt-mic-sm' + (on ? '' : ' mt-off')} aria-label={on ? 'Mic on' : 'Muted'}>{on ? I.mic : I.micOff}</span> : null}
        {boss && !isHost && p !== me && (host || !co) ? <span className="mt-acts">
          {on ? <button className="mt-btn mt-xs" onClick={() => hostDo('mute', p)} aria-label={`Mute ${p.name || 'Guest'}`}>Mute</button> : null}
          {speaks ? <button className="mt-btn mt-xs" onClick={() => hostDo('stop-speak', p)}>Stop speaking</button> : <button className="mt-btn mt-xs mt-go" onClick={() => hostDo('allow-speak', p)}>Let speak</button>}
          {host ? <button className="mt-btn mt-xs" onClick={() => hostDo(co ? 'unmake-cohost' : 'make-cohost', p)}>{co ? 'Remove co-host' : 'Make co-host'}</button> : null}
          <button className="mt-btn mt-xs mt-ghost" onClick={() => hostDo('remove', p)}>Remove</button>
        </span> : null}
      </li> })}
  </ul>)
}

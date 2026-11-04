// Olexweb Meet's MP3 encoder (LAME via @breezystack/lamejs), off the main thread so the meeting stays smooth.
// { init, sampleRate, kbps } then Float32 audio; { flush } ends it. Answers { bytes } as MP3 is made, { done } at the end.
import lame from '@breezystack/lamejs'
let enc = null
onmessage = (e) => {
  const m = e.data
  if (m && m.init) { enc = new lame.Mp3Encoder(1, m.sampleRate, m.kbps); return }
  if (!enc) return
  if (m && m.flush) { const out = enc.flush(); postMessage({ bytes: out.length ? new Uint8Array(out) : null, done: true }); enc = null; return }
  const pcm = new Int16Array(m.length)
  for (let i = 0; i < m.length; i++) { const s = Math.max(-1, Math.min(1, m[i])); pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff }
  const out = enc.encodeBuffer(pcm)
  if (out.length) postMessage({ bytes: new Uint8Array(out) })
}

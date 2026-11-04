'use client'
// Olexweb Meet's audio and video effects, run on each person's own device (free, private, any server).
// NOISE: RNNoise (an open-source AI noise suppressor, @sapphi-red/web-noise-suppressor, MIT) on the microphone, on top of
//   the browser's own noise suppression. Works as a LiveKit track processor, so everyone hears the cleaned voice and
//   recordings use it too. Light enough for phones. Files are served from this site (/meet/noise).
// BLUR: LiveKit's background processor (@livekit/track-processors, MediaPipe's selfie segmenter), with the model and
//   engine served from this site (/meet/vision), so no third party is contacted. Loaded only when switched on.
// Each person's choice is remembered on their device.

const KEY = 'olexweb-meet-effects'
export const saved = () => { try { return { noise: true, blur: false, ...JSON.parse(localStorage.getItem(KEY) || '{}') } } catch { return { noise: true, blur: false } } }
export const remember = (v) => { try { localStorage.setItem(KEY, JSON.stringify({ ...saved(), ...v })) } catch {} }
export const canCleanNoise = () => typeof window !== 'undefined' && typeof AudioWorkletNode !== 'undefined' && typeof WebAssembly !== 'undefined'
export async function canBlur() { try { const m = await import('@livekit/track-processors'); return m.supportsBackgroundProcessors() } catch { return false } }

// a LiveKit audio track processor: microphone → RNNoise (48 kHz, its native rate) → the track everyone hears
class NoiseProcessor {
  constructor() { this.name = 'olexweb-noise' }
  async init({ track }) {
    const { loadRnnoise, RnnoiseWorkletNode } = await import('@sapphi-red/web-noise-suppressor')
    this.ctx = new AudioContext({ sampleRate: 48000 })
    const [wasm] = await Promise.all([loadRnnoise({ url: '/meet/noise/rnnoise.wasm', simdUrl: '/meet/noise/rnnoise_simd.wasm' }), this.ctx.audioWorklet.addModule('/meet/noise/rnnoise-worklet.js')])
    this.src = this.ctx.createMediaStreamSource(new MediaStream([track]))
    this.node = new RnnoiseWorkletNode(this.ctx, { maxChannels: 1, wasmBinary: wasm })
    this.dest = this.ctx.createMediaStreamDestination()
    this.src.connect(this.node); this.node.connect(this.dest)
    if (this.ctx.state === 'suspended') await this.ctx.resume().catch(() => {})
    this.processedTrack = this.dest.stream.getAudioTracks()[0]
  }
  async restart(opts) { await this.destroy(); await this.init(opts) }
  async destroy() {
    try { this.src && this.src.disconnect(); this.node && (this.node.port.postMessage('destroy'), this.node.disconnect()) } catch {}
    if (this.ctx && this.ctx.state !== 'closed') await this.ctx.close().catch(() => {})
    this.processedTrack = undefined
  }
}

// switch noise cancellation on or off for the local microphone track (LocalAudioTrack)
export async function setNoise(audioTrack, on) {
  if (!audioTrack) return false
  if (on) {
    if (!canCleanNoise()) throw new Error('This browser can’t run noise cancellation.')
    if (!audioTrack.getProcessor || !audioTrack.getProcessor()) await audioTrack.setProcessor(new NoiseProcessor())
  } else if (audioTrack.getProcessor && audioTrack.getProcessor()) await audioTrack.stopProcessor()
  return on
}

// switch background blur on or off for the local camera track (LocalVideoTrack)
export async function setBlur(videoTrack, on) {
  if (!videoTrack) return false
  const m = await import('@livekit/track-processors')
  if (on) {
    if (!m.supportsBackgroundProcessors()) throw new Error('This browser can’t blur backgrounds. Try Chrome or Edge.')
    await videoTrack.setProcessor(m.BackgroundProcessor({ mode: 'background-blur', blurRadius: 14,
      assetPaths: { tasksVisionFileSet: '/meet/vision', modelAssetPath: '/meet/vision/selfie_segmenter.tflite' } }))
  } else if (videoTrack.getProcessor && videoTrack.getProcessor()) await videoTrack.stopProcessor()
  return on
}

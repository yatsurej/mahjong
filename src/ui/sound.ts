/**
 * Tiny synthesized sound effects via the Web Audio API — no audio files, works
 * offline, and stays silent in non-browser environments (tests). Everything is
 * gated on a mute preference stored in localStorage.
 */

let ctx: AudioContext | null = null
let muted = readMuted()

function readMuted(): boolean {
  try { return localStorage.getItem('mahjong-muted') === '1' } catch { return false }
}

export function isMuted(): boolean {
  return muted
}
export function setMuted(m: boolean): void {
  muted = m
  try { localStorage.setItem('mahjong-muted', m ? '1' : '0') } catch { /* ignore */ }
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  if (!ctx) {
    try { ctx = new Ctor() } catch { return null }
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
  return ctx
}

/** A dry wooden clack — a short filtered noise burst with a little body. */
export function playClack(): void {
  if (muted) return
  const c = audio()
  if (!c) return
  const now = c.currentTime
  const dur = 0.09

  const buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * dur)), c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2.5)
  }
  const src = c.createBufferSource()
  src.buffer = buf
  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 1700
  bp.Q.value = 0.9
  const g = c.createGain()
  g.gain.value = 0.22
  src.connect(bp).connect(g).connect(c.destination)
  src.start(now)
  src.stop(now + dur)

  // a touch of low body so it reads as a tile, not a hiss
  const osc = c.createOscillator()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(220, now)
  osc.frequency.exponentialRampToValueAtTime(90, now + 0.06)
  const og = c.createGain()
  og.gain.setValueAtTime(0.12, now)
  og.gain.exponentialRampToValueAtTime(0.001, now + 0.08)
  osc.connect(og).connect(c.destination)
  osc.start(now)
  osc.stop(now + 0.09)
}

function tone(c: AudioContext, freq: number, start: number, dur: number, gain: number, type: OscillatorType = 'sine') {
  const o = c.createOscillator()
  o.type = type
  o.frequency.value = freq
  const g = c.createGain()
  g.gain.setValueAtTime(0, start)
  g.gain.linearRampToValueAtTime(gain, start + 0.02)
  g.gain.exponentialRampToValueAtTime(0.001, start + dur)
  o.connect(g).connect(c.destination)
  o.start(start)
  o.stop(start + dur + 0.02)
}

/** A firm rising two-note "declare" for a pung / chow / kong call. */
export function playCall(): void {
  if (muted) return
  const c = audio()
  if (!c) return
  const now = c.currentTime
  tone(c, 329.63, now, 0.14, 0.12, 'square')        // E4
  tone(c, 493.88, now + 0.09, 0.24, 0.12, 'square') // B4 — a bold fifth up
}

/** A bright rising arpeggio for a win. */
export function playWin(): void {
  if (muted) return
  const c = audio()
  if (!c) return
  const now = c.currentTime
  const notes = [523.25, 659.25, 783.99, 1046.5] // C5 E5 G5 C6
  notes.forEach((f, i) => tone(c, f, now + i * 0.1, 0.42, 0.16))
}

/** A soft, gentle two-note fall for a hand you didn't win. */
export function playLose(): void {
  if (muted) return
  const c = audio()
  if (!c) return
  const now = c.currentTime
  tone(c, 392, now, 0.32, 0.1, 'sine')        // G4
  tone(c, 311.13, now + 0.16, 0.5, 0.1, 'sine') // E♭4
}

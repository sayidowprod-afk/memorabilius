// Sons du pack, synthétisés (aucun fichier) : déchirure, souffle, « ding » par rareté. Coupure mémorisée sur l'appareil.
let ctx: AudioContext | null = null
const KEY = 'pk-sound'
export const soundOn = () => { try { return localStorage.getItem(KEY) !== '0' } catch { return true } }
export const setSound = (v: boolean) => { try { localStorage.setItem(KEY, v ? '1' : '0') } catch { /* rien */ } }
function ac(): AudioContext | null {
  if (!soundOn()) return null
  try {
    const A = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!ctx) ctx = new A()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch { return null }
}
const noise = (c: AudioContext, len: number) => { const b = c.createBuffer(1, Math.ceil(c.sampleRate * len), c.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b }
function tone(c: AudioContext, f: number, at: number, dur: number, vol: number, type: OscillatorType = 'sine') {
  const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = f
  g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  o.connect(g); g.connect(c.destination); o.start(at); o.stop(at + dur + 0.05)
}
// bruit de papier qui se déchire : souffle filtré qui monte
export function sndTear(dur = 0.7) {
  const c = ac(); if (!c) return
  const s = c.createBufferSource(); s.buffer = noise(c, dur); const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.9
  const t = c.currentTime; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(5200, t + dur)
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.35, t + dur * 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  s.connect(f); f.connect(g); g.connect(c.destination); s.start(t)
}
export function sndOpen() {
  const c = ac(); if (!c) return
  const t = c.currentTime
  const s = c.createBufferSource(); s.buffer = noise(c, 0.5); const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(6000, t + 0.4)
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.3, t + 0.12); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
  s.connect(f); f.connect(g); g.connect(c.destination); s.start(t)
  tone(c, 220, t, 0.35, 0.18, 'triangle')
}
export function sndFlip() { const c = ac(); if (!c) return; const t = c.currentTime; tone(c, 520, t, 0.06, 0.12, 'square'); tone(c, 330, t + 0.04, 0.08, 0.08, 'square') }
export function sndThrow() {
  const c = ac(); if (!c) return
  const t = c.currentTime, s = c.createBufferSource(); s.buffer = noise(c, 0.25); const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1800
  const g = c.createGain(); g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25); s.connect(f); f.connect(g); g.connect(c.destination); s.start(t)
}
// « ding » selon la rareté : plus elle est haute, plus c'est riche
export function sndRarity(r: number) {
  const c = ac(); if (!c) return
  const t = c.currentTime
  if (r <= 1) return
  if (r === 2) { tone(c, 660, t, 0.25, 0.14); return }
  if (r === 3) { tone(c, 660, t, 0.3, 0.16); tone(c, 880, t + 0.09, 0.35, 0.16); return }
  if (r === 4) { [523, 659, 784].forEach((f, i) => tone(c, f, t + i * 0.08, 0.6, 0.17)); tone(c, 1047, t + 0.28, 0.8, 0.12); return }
  ;[523, 659, 784, 1047, 1319].forEach((f, i) => tone(c, f, t + i * 0.09, 1.1, 0.18)); tone(c, 130, t, 1.2, 0.22, 'triangle'); tone(c, 2093, t + 0.5, 1.0, 0.08)
}

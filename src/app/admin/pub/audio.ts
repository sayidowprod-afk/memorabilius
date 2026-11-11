// Outil admin (/admin/pub) : musiques générées par synthèse (aucun échantillon, aucun droit d'auteur) + possibilité d'utiliser ton propre morceau.
// Fonctionnent en direct (AudioContext) comme hors-ligne (OfflineAudioContext, pour l'export MP4).
export type MusicKind = 'lounge' | 'beat' | 'file' | 'none'

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12)

function noiseBuf(ac: BaseAudioContext, len = 0.5) {
  const b = ac.createBuffer(1, Math.ceil(ac.sampleRate * len), ac.sampleRate), d = b.getChannelData(0)
  let s = 12345
  for (let i = 0; i < d.length; i++) { s = (s * 1664525 + 1013904223) >>> 0; d[i] = (s / 4294967296) * 2 - 1 }
  return b
}
// réverbération : réponse impulsionnelle bruitée à décroissance exponentielle
function makeReverb(ac: BaseAudioContext, secs = 1.8, decay = 3) {
  const len = Math.ceil(ac.sampleRate * secs), b = ac.createBuffer(2, len, ac.sampleRate)
  let s = 99
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) { s = (s * 1664525 + 1013904223) >>> 0; d[i] = ((s / 4294967296) * 2 - 1) * Math.pow(1 - i / len, decay) } }
  const conv = ac.createConvolver(); conv.buffer = b
  return conv
}
function master(ac: BaseAudioContext, dest: AudioNode, t0: number, dur: number, level: number, fadeIn: number, fadeOut: number) {
  const out = ac.createGain(), comp = ac.createDynamicsCompressor()
  comp.threshold.value = -16; comp.knee.value = 14; comp.ratio.value = 3.5; comp.attack.value = 0.004; comp.release.value = 0.18
  out.gain.setValueAtTime(0.0001, t0); out.gain.linearRampToValueAtTime(level, t0 + Math.max(0.02, fadeIn))
  out.gain.setValueAtTime(level, Math.max(t0 + fadeIn + 0.01, t0 + dur - fadeOut)); out.gain.linearRampToValueAtTime(0.0001, t0 + dur)
  comp.connect(out); out.connect(dest)
  return comp
}

// ── « Musique d'attente » : lofi / lounge doux à 80 bpm (piano électrique FM, accords de septième, basse ronde, batterie feutrée, craquements de vinyle)
export function scheduleLounge(ac: BaseAudioContext, dest: AudioNode, lead: number, dur: number, vol = 1) {
  const t0 = ac.currentTime + lead, end = t0 + dur
  const bus = master(ac, dest, t0, dur, 0.9 * vol, 1.2, 2.5)
  const warm = ac.createBiquadFilter(); warm.type = 'lowpass'; warm.frequency.value = 7000; warm.connect(bus)
  const out = ac.createGain(); out.connect(warm)
  const rev = makeReverb(ac, 2.4, 2.6), revG = ac.createGain(); revG.gain.value = 0.3; rev.connect(revG); revG.connect(warm)
  const nb = noiseBuf(ac)
  const beat = 0.75, bar = beat * 4
  const chords = [
    { bass: 41, tones: [57, 60, 64, 65] }, // Fmaj7
    { bass: 40, tones: [55, 59, 62, 64] }, // Em7
    { bass: 38, tones: [53, 57, 60, 62] }, // Dm7
    { bass: 36, tones: [52, 55, 59, 64] }, // Cmaj7
  ]
  let seed = 11
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
  const rhodes = (at: number, midi: number, g: number, d: number, send = 0.4) => {
    if (at >= end) return
    const f = mtof(midi), car = ac.createOscillator(), mod = ac.createOscillator(), mg = ac.createGain(), env = ac.createGain()
    car.frequency.value = f; mod.frequency.value = f
    mg.gain.setValueAtTime(f * 2.2, at); mg.gain.exponentialRampToValueAtTime(f * 0.12, at + 0.7)
    mod.connect(mg); mg.connect(car.frequency)
    env.gain.setValueAtTime(0.0001, at); env.gain.linearRampToValueAtTime(g, at + 0.006); env.gain.exponentialRampToValueAtTime(0.0001, at + d)
    car.connect(env); env.connect(out)
    const s = ac.createGain(); s.gain.value = send; env.connect(s); s.connect(rev)
    const tine = ac.createOscillator(), tg = ac.createGain(); tine.frequency.value = f * 4
    tg.gain.setValueAtTime(g * 0.22, at); tg.gain.exponentialRampToValueAtTime(0.0001, at + 0.1); tine.connect(tg); tg.connect(out)
    for (const o of [car, mod, tine]) { o.start(at); o.stop(at + d + 0.05) }
  }
  const sine = (at: number, midi: number, g: number, d: number) => {
    if (at >= end) return
    const o = ac.createOscillator(), e = ac.createGain(); o.type = 'sine'; o.frequency.value = mtof(midi)
    e.gain.setValueAtTime(0.0001, at); e.gain.linearRampToValueAtTime(g, at + 0.015); e.gain.exponentialRampToValueAtTime(0.0001, at + d)
    o.connect(e); e.connect(out); o.start(at); o.stop(at + d + 0.05)
  }
  const nz = (at: number, o: { type: BiquadFilterType; f: number; q?: number; g: number; d: number; to?: GainNode }) => {
    if (at >= end) return
    const s = ac.createBufferSource(); s.buffer = nb; const f = ac.createBiquadFilter(); f.type = o.type; f.frequency.value = o.f; f.Q.value = o.q ?? 0.8
    const e = ac.createGain(); e.gain.setValueAtTime(o.g, at); e.gain.exponentialRampToValueAtTime(0.0001, at + o.d)
    s.connect(f); f.connect(e); e.connect(o.to ?? out); s.start(at, 0, Math.min(0.5, o.d + 0.05))
  }
  const bars = Math.ceil(dur / bar) + 1
  for (let b = 0; b < bars; b++) {
    const bt = t0 + b * bar, ch = chords[b % 4]
    // nappe très douce
    for (const m of ch.tones) {
      const o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain()
      o.type = 'sawtooth'; o.frequency.value = mtof(m - 12); o.detune.value = (rnd() - 0.5) * 14; f.type = 'lowpass'; f.frequency.value = 650
      g.gain.setValueAtTime(0.0001, bt); g.gain.linearRampToValueAtTime(0.018, bt + 0.8); g.gain.setValueAtTime(0.018, bt + bar - 0.3); g.gain.linearRampToValueAtTime(0.0001, bt + bar + 0.8)
      o.connect(f); f.connect(g); g.connect(out); o.start(bt); o.stop(bt + bar + 0.9)
    }
    // piano électrique : accords sur 1, « et » de 2 et « et » de 4 (rythme syncopé de lofi)
    ;[[0, 0.1], [1.5, 0.07], [2.75, 0.07]].forEach(([bi, g], hi) => ch.tones.forEach((m, i) => rhodes(bt + bi * beat + i * 0.012 + (hi ? 0.02 : 0), m, g, 1.6)))
    // basse ronde
    sine(bt, ch.bass, 0.3, 1.1); sine(bt + beat * 2, ch.bass + 7, 0.2, 0.55); sine(bt + beat * 3.5, ch.bass + 12, 0.16, 0.4)
    // batterie feutrée : kick 1 et « et » de 2, caisse claire 2 et 4, charleston swingué
    for (const bi of [0, 1.5]) {
      const at = bt + bi * beat; if (at >= end) continue
      const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(120, at); o.frequency.exponentialRampToValueAtTime(48, at + 0.12)
      g.gain.setValueAtTime(0.5, at); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.3); o.connect(g); g.connect(out); o.start(at); o.stop(at + 0.32)
    }
    for (const bi of [1, 3]) { const at = bt + bi * beat; nz(at, { type: 'bandpass', f: 1900, q: 0.7, g: 0.22, d: 0.16 }); nz(at, { type: 'lowpass', f: 400, g: 0.1, d: 0.08 }) }
    for (let i = 0; i < 8; i++) nz(bt + i * (beat / 2) + (i % 2 ? beat * 0.14 : 0), { type: 'highpass', f: 7500, g: i % 2 ? 0.05 : 0.028, d: 0.05 })
    // petites notes de piano (gamme pentatonique), de plus en plus présentes
    if (b >= 1) for (let i = 0; i < (b % 2 ? 2 : 3); i++) rhodes(bt + (rnd() * 3 + 0.5) * beat, [72, 74, 76, 79, 81][Math.floor(rnd() * 5)], 0.06, 1.6, 0.7)
    // craquements de vinyle
    for (let i = 0; i < 7; i++) nz(bt + rnd() * bar, { type: 'highpass', f: 2500, g: 0.012 + rnd() * 0.012, d: 0.012 })
  }
}

// ── Beat dynamique façon TikTok : 120 bpm, kick 4×4 avec effet de pompe (sidechain) sur les accords et la basse, clap, charleston, basse en croches, accords « stab », mélodie en pizzicato avec écho
export function scheduleBeat(ac: BaseAudioContext, dest: AudioNode, lead: number, dur: number, vol = 1) {
  const t0 = ac.currentTime + lead, end = t0 + dur, beat = 0.5, bar = 2
  const bus = master(ac, dest, t0, dur, 0.95 * vol, 0.05, 1.2)
  const dry = ac.createGain(); dry.connect(bus)
  const duck = ac.createGain(); duck.connect(bus)
  for (let i = 0; t0 + i * beat < end; i++) { const at = t0 + i * beat; duck.gain.setValueAtTime(0.22, at); duck.gain.linearRampToValueAtTime(1, at + 0.3) }
  const rev = makeReverb(ac, 1.5, 3), revG = ac.createGain(); revG.gain.value = 0.3; rev.connect(revG); revG.connect(duck)
  const echo = ac.createDelay(1); echo.delayTime.value = 0.375
  const fb = ac.createGain(); fb.gain.value = 0.34; const ef = ac.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 3200
  echo.connect(ef); ef.connect(fb); fb.connect(echo); const eo = ac.createGain(); eo.gain.value = 0.5; ef.connect(eo); eo.connect(duck)
  const nb = noiseBuf(ac)
  const nz = (at: number, o: { type: BiquadFilterType; f: number; q?: number; g: number; d: number; rv?: number }) => {
    if (at >= end) return
    const s = ac.createBufferSource(); s.buffer = nb; const f = ac.createBiquadFilter(); f.type = o.type; f.frequency.value = o.f; f.Q.value = o.q ?? 0.8
    const e = ac.createGain(); e.gain.setValueAtTime(o.g, at); e.gain.exponentialRampToValueAtTime(0.0001, at + o.d)
    s.connect(f); f.connect(e); e.connect(dry); if (o.rv) { const r = ac.createGain(); r.gain.value = o.rv; e.connect(r); r.connect(rev) }
    s.start(at, 0, Math.min(0.5, o.d + 0.05))
  }
  const prog = [
    { r: 45, c: [57, 60, 64] }, // Am
    { r: 41, c: [57, 60, 65] }, // F
    { r: 48, c: [55, 60, 64] }, // C
    { r: 43, c: [55, 59, 62] }, // G
  ]
  const lead1 = [76, 0, 81, 0, 79, 76, 0, 74], lead2 = [76, 0, 72, 0, 74, 76, 0, 0]
  const bars = Math.ceil(dur / bar) + 1
  for (let b = 0; b < bars; b++) {
    const bt = t0 + b * bar, ch = prog[b % 4]
    // kick 4×4 + clap sur 2 et 4
    for (let i = 0; i < 4; i++) {
      const at = bt + i * beat; if (at >= end) continue
      const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(155, at); o.frequency.exponentialRampToValueAtTime(44, at + 0.11)
      g.gain.setValueAtTime(1, at); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.34); o.connect(g); g.connect(dry); o.start(at); o.stop(at + 0.36)
      nz(at, { type: 'highpass', f: 3500, g: 0.3, d: 0.012 })
      if (i % 2) { nz(at, { type: 'bandpass', f: 1500, q: 0.7, g: 0.5, d: 0.15, rv: 0.5 }); nz(at + 0.011, { type: 'bandpass', f: 1800, q: 0.8, g: 0.35, d: 0.1 }) }
    }
    // charleston : fermé en doubles-croches (accentué), ouvert sur les contretemps
    for (let i = 0; i < 16; i++) nz(bt + i * (beat / 4), { type: 'highpass', f: 8000, g: i % 4 === 2 ? 0 : (i % 2 ? 0.05 : 0.085), d: 0.03 })
    for (let i = 0; i < 4; i++) nz(bt + i * beat + beat / 2, { type: 'highpass', f: 6500, g: 0.12, d: 0.17 })
    // basse en croches (scie filtrée + sous-grave)
    for (let i = 0; i < 8; i++) {
      if (i === 2 || i === 6) continue
      const at = bt + i * (beat / 2); if (at >= end) continue
      const f0 = mtof(ch.r - 12 + (i === 3 || i === 7 ? 12 : 0))
      const o = ac.createOscillator(), s = ac.createOscillator(), lp = ac.createBiquadFilter(), g = ac.createGain()
      o.type = 'sawtooth'; o.frequency.value = f0; s.type = 'sine'; s.frequency.value = f0; lp.type = 'lowpass'; lp.frequency.setValueAtTime(1100, at); lp.frequency.exponentialRampToValueAtTime(260, at + 0.16)
      g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(0.3, at + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.22)
      o.connect(lp); lp.connect(g); s.connect(g); g.connect(duck); o.start(at); s.start(at); o.stop(at + 0.24); s.stop(at + 0.24)
    }
    // nappe + accords « stab » en super-scie (dès la 2e mesure)
    for (const m of ch.c) {
      const o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain()
      o.type = 'triangle'; o.frequency.value = mtof(m - 12); f.type = 'lowpass'; f.frequency.value = 1100
      g.gain.setValueAtTime(0.0001, bt); g.gain.linearRampToValueAtTime(0.035, bt + 0.4); g.gain.setValueAtTime(0.035, bt + bar - 0.1); g.gain.linearRampToValueAtTime(0.0001, bt + bar + 0.3)
      o.connect(f); f.connect(g); g.connect(duck); o.start(bt); o.stop(bt + bar + 0.4)
    }
    if (b >= 1) for (const bi of [0, 1.5, 2.5]) {
      const at = bt + bi * beat; if (at >= end) continue
      for (const m of ch.c) for (const det of [-12, 0, 12]) {
        const o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain()
        o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = det; f.type = 'lowpass'; f.frequency.setValueAtTime(3200, at); f.frequency.exponentialRampToValueAtTime(900, at + 0.25)
        g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(0.03, at + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.28)
        o.connect(f); f.connect(g); g.connect(duck); const s = ac.createGain(); s.gain.value = 0.35; g.connect(s); s.connect(rev); o.start(at); o.stop(at + 0.3)
      }
    }
    // mélodie pizzicato (dès la 2e mesure) avec écho en croche pointée
    if (b >= 1) {
      const pat = b % 2 ? lead2 : lead1
      pat.forEach((m, i) => {
        if (!m) return
        const at = bt + i * (beat / 2); if (at >= end) return
        const o = ac.createOscillator(), o2 = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain()
        o.type = 'square'; o.frequency.value = mtof(m); o2.type = 'triangle'; o2.frequency.value = mtof(m + 12); f.type = 'lowpass'; f.frequency.setValueAtTime(4200, at); f.frequency.exponentialRampToValueAtTime(1400, at + 0.2)
        g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(0.055, at + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.24)
        o.connect(f); o2.connect(f); f.connect(g); g.connect(duck); const s = ac.createGain(); s.gain.value = 0.6; g.connect(s); s.connect(echo); const r = ac.createGain(); r.gain.value = 0.3; g.connect(r); r.connect(rev)
        o.start(at); o2.start(at); o.stop(at + 0.27); o2.stop(at + 0.27)
      })
    }
  }
}

// ── petits « swipes » (souffle qui monte + tic) sur chaque coupe de scène
export function scheduleHits(ac: BaseAudioContext, dest: AudioNode, lead: number, times: number[], vol = 1) {
  const t0 = ac.currentTime + lead, nb = noiseBuf(ac, 0.8)
  const out = ac.createGain(); out.gain.value = 0.9 * vol; out.connect(dest)
  for (const at0 of times) {
    const at = t0 + at0
    const s = ac.createBufferSource(); s.buffer = nb; const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.1
    f.frequency.setValueAtTime(500, at - 0.3); f.frequency.exponentialRampToValueAtTime(5000, at + 0.12)
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, Math.max(0, at - 0.3)); g.gain.linearRampToValueAtTime(0.3, at - 0.03); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.3)
    s.connect(f); f.connect(g); g.connect(out); s.start(Math.max(0, at - 0.3))
  }
}

// ── ton propre morceau (libre de droits : bibliothèque audio de YouTube, TikTok « Musique commerciale », etc.)
export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  const ac = new OfflineAudioContext(2, 44100, 44100)
  return await ac.decodeAudioData(await file.arrayBuffer())
}
export function scheduleFile(ac: BaseAudioContext, dest: AudioNode, lead: number, dur: number, buf: AudioBuffer, vol = 1) {
  const t0 = ac.currentTime + lead
  const src = ac.createBufferSource(); src.buffer = buf
  const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.9 * vol, t0 + 0.4)
  g.gain.setValueAtTime(0.9 * vol, Math.max(t0 + 0.5, t0 + dur - 1.5)); g.gain.linearRampToValueAtTime(0.0001, t0 + dur)
  src.connect(g); g.connect(dest); src.start(t0, 0, dur)
}

export function scheduleMusic(ac: BaseAudioContext, dest: AudioNode, lead: number, dur: number, kind: MusicKind, file: AudioBuffer | null, vol = 1) {
  if (kind === 'lounge') scheduleLounge(ac, dest, lead, dur, vol)
  else if (kind === 'beat') scheduleBeat(ac, dest, lead, dur, vol)
  else if (kind === 'file' && file) scheduleFile(ac, dest, lead, dur, file, vol)
}

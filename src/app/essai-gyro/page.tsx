'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

// ESSAI (pas encore dans le viewer) : la carte réagit à l'inclinaison du téléphone.
// Objectif : tester l'effet SANS dénaturer la carte. On compare trois modes, et le bouton « Voir sans effet » (maintenu) montre la carte intacte.
//  - Reflet seul : la carte reste droite, seule une lueur douce glisse dessus (superposée, jamais dans l'image).
//  - Inclinaison seule : la carte penche de quelques degrés, sans reflet.
//  - Les deux.
// Les coins de la carte restent nets (jamais arrondis). Sur ordinateur, la souris simule l'inclinaison.
type Mode = 'reflet' | 'incl' | 'both'

export default function EssaiGyro() {
  const [img, setImg] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('both')
  const [amp, setAmp] = useState(10)        // degrés max d'inclinaison
  const [gloss, setGloss] = useState(35)    // intensité du reflet (0–100)
  const [bare, setBare] = useState(false)   // « voir sans effet »
  const [sensor, setSensor] = useState<'inconnu' | 'actif' | 'absent' | 'refusé'>('inconnu')
  const [live, setLive] = useState({ b: 0, g: 0 })
  const cardRef = useRef<HTMLDivElement>(null)
  const glareRef = useRef<HTMLDivElement>(null)
  const base = useRef<{ b: number; g: number } | null>(null)   // position « à plat » de référence
  const cur = useRef({ x: 0, y: 0 })                           // inclinaison lissée, −1 à 1
  const target = useRef({ x: 0, y: 0 })
  const settings = useRef({ mode, amp, gloss, bare })
  useEffect(() => { settings.current = { mode, amp, gloss, bare } }, [mode, amp, gloss, bare])

  const onOrient = useCallback((e: DeviceOrientationEvent) => {
    if (e.beta == null || e.gamma == null) return
    if (!base.current) base.current = { b: e.beta, g: e.gamma }
    const clamp = (v: number) => Math.max(-1, Math.min(1, v))
    // 25° de mouvement du poignet = effet maximal : au-delà, la carte ne bouge plus (elle ne « part » jamais)
    target.current = { x: clamp((e.gamma - base.current.g) / 25), y: clamp((e.beta - base.current.b) / 25) }
    setSensor('actif'); setLive({ b: Math.round(e.beta), g: Math.round(e.gamma) })
  }, [])

  const start = async () => {
    try {
      const DOE = (window as any).DeviceOrientationEvent
      if (DOE && typeof DOE.requestPermission === 'function') {
        const r = await DOE.requestPermission()
        if (r !== 'granted') { setSensor('refusé'); return }
      }
      window.addEventListener('deviceorientation', onOrient)
      // si aucun événement n'arrive (ordinateur), on le dit
      setTimeout(() => setSensor(s => (s === 'inconnu' ? 'absent' : s)), 1200)
    } catch { setSensor('absent') }
  }
  useEffect(() => { start(); return () => window.removeEventListener('deviceorientation', onOrient) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // boucle d'animation : lissage pour que le mouvement soit doux, sans à-coups
  useEffect(() => {
    let raf = 0
    const loop = () => {
      const s = settings.current
      cur.current.x += (target.current.x - cur.current.x) * 0.12
      cur.current.y += (target.current.y - cur.current.y) * 0.12
      const { x, y } = cur.current
      const card = cardRef.current, glare = glareRef.current
      if (card) card.style.transform = !s.bare && s.mode !== 'reflet' ? `perspective(900px) rotateY(${(x * s.amp).toFixed(2)}deg) rotateX(${(-y * s.amp).toFixed(2)}deg)` : 'perspective(900px)'
      if (glare) {
        const on = !s.bare && s.mode !== 'incl'
        glare.style.opacity = on ? String(s.gloss / 100) : '0'
        glare.style.background = `radial-gradient(circle at ${50 + x * 45}% ${50 + y * 45}%, rgba(255,255,255,.85) 0%, rgba(255,255,255,.25) 28%, rgba(255,255,255,0) 58%)`
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  // ordinateur : la souris simule l'inclinaison
  const onMouse = (e: React.MouseEvent) => {
    if (sensor === 'actif') return
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    target.current = { x: ((e.clientX - r.left) / r.width - 0.5) * 2, y: ((e.clientY - r.top) / r.height - 0.5) * 2 }
  }
  const recenter = () => { base.current = null }

  const chip = (m: Mode, label: string) => (
    <button key={m} onClick={() => setMode(m)} style={{ flex: 1, padding: '10px 6px', border: `2px solid ${mode === m ? '#2f6bff' : '#243063'}`, background: mode === m ? '#2f6bff' : '#0e1530', color: '#fff', font: '800 12px system-ui', cursor: 'pointer' }}>{label}</button>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#050912', color: '#fff', font: '14px system-ui', padding: '20px 16px 60px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <h1 style={{ margin: 0, fontSize: 20 }}>Essai : inclinaison au gyroscope</h1>
      <p style={{ margin: 0, maxWidth: 420, color: '#aab3d1', fontSize: 13, lineHeight: 1.5, textAlign: 'center' }}>
        Choisis une de tes cartes, incline le téléphone, et juge si l’effet respecte la carte. Maintiens « Voir sans effet » pour comparer avec la carte intacte. Sur ordinateur, bouge la souris sur la carte.
      </p>
      <label style={{ border: '2px dashed #3a4a8a', padding: '10px 14px', cursor: 'pointer', fontWeight: 700 }}>
        {img ? 'Changer de carte' : 'Choisir une photo de carte'}
        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) setImg(URL.createObjectURL(f)) }} />
      </label>

      <div onMouseMove={onMouse} style={{ padding: 30 }}>
        <div ref={cardRef} style={{ position: 'relative', width: 'min(62vw, 260px)', aspectRatio: '5 / 7', background: img ? '#000' : 'linear-gradient(135deg,#243063,#4a5aa8)', boxShadow: '0 18px 40px rgba(0,0,0,.6)', overflow: 'hidden' }}>
          {img
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            : <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#8794bd', font: '700 13px system-ui' }}>Ta carte ici</span>}
          {/* reflet : une couche à part, superposée en douceur ; l'image dessous n'est jamais modifiée */}
          <div ref={glareRef} style={{ position: 'absolute', inset: 0, mixBlendMode: 'soft-light', pointerEvents: 'none', opacity: 0 }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, width: 'min(92vw, 420px)' }}>{chip('reflet', 'Reflet seul')}{chip('incl', 'Inclinaison seule')}{chip('both', 'Les deux')}</div>

      <div style={{ width: 'min(92vw, 420px)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ width: 130, fontSize: 12, color: '#aab3d1' }}>Inclinaison : {amp}°</span><input type="range" min={2} max={20} value={amp} onChange={e => setAmp(+e.target.value)} style={{ flex: 1 }} /></label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ width: 130, fontSize: 12, color: '#aab3d1' }}>Reflet : {gloss} %</span><input type="range" min={0} max={80} value={gloss} onChange={e => setGloss(+e.target.value)} style={{ flex: 1 }} /></label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onPointerDown={() => setBare(true)} onPointerUp={() => setBare(false)} onPointerLeave={() => setBare(false)} onPointerCancel={() => setBare(false)}
            style={{ flex: 1, padding: 12, border: '2px solid #fff', background: bare ? '#fff' : 'transparent', color: bare ? '#06122e' : '#fff', font: '800 12px system-ui', cursor: 'pointer', userSelect: 'none' }}>Voir sans effet (maintenir)</button>
          <button onClick={recenter} style={{ flex: 1, padding: 12, border: '2px solid #3a4a8a', background: 'transparent', color: '#aab3d1', font: '800 12px system-ui', cursor: 'pointer' }}>Recentrer</button>
        </div>
        {sensor === 'refusé' && <button onClick={start} style={{ padding: 12, background: '#2f6bff', border: 0, color: '#fff', font: '800 13px system-ui' }}>Autoriser le capteur de mouvement</button>}
        <div style={{ fontSize: 12, color: '#8794bd', textAlign: 'center' }}>
          Capteur : {sensor === 'actif' ? `actif (avant/arrière ${live.b}°, gauche/droite ${live.g}°)` : sensor === 'absent' ? 'non détecté (souris simulée)' : sensor === 'refusé' ? 'refusé' : 'en attente…'}
          {sensor === 'absent' && <div style={{ marginTop: 4 }}>Sur téléphone, ce capteur ne fonctionne qu’en https : l’essai se fait donc sur le vrai site.</div>}
        </div>
      </div>
    </div>
  )
}

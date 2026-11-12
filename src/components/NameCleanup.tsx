'use client'
import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '@/lib/supabase'
import { findVariantGroups, findTeamGroups, resolveTeam, type VariantGroup } from '@/lib/nameVariants'

// 783 · « Nettoyer mes noms » : propose d'unifier les écritures d'un même joueur ou d'une même équipe dans MA galerie.
// Rien ne s'affiche s'il n'y a rien à unifier. Rien n'est modifié sans clic ; seules mes cartes ajoutées à la main sont corrigées.
type Field = 'nom' | 'equipe'
interface Props {
  userId: string
  cards: { id_manuelle?: string; n: string; t: string }[]
  onApplied: (field: Field, ids: string[], value: string) => void
}
const ignoredKey = (uid: string) => `name-cleanup-ignored-${uid}`
const readIgnored = (uid: string): Set<string> => { try { return new Set(JSON.parse(localStorage.getItem(ignoredKey(uid)) || '[]')) } catch { return new Set() } }

export default function NameCleanup({ userId, cards, onApplied }: Props) {
  const [ignored, setIgnored] = useState<Set<string>>(() => (typeof window === 'undefined' ? new Set() : readIgnored(userId)))
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [chosen, setChosen] = useState<Record<string, string>>({})   // écriture choisie à la place de la proposée
  const [done, setDone] = useState<string[]>([])
  const [error, setError] = useState('')

  const groups = useMemo(() => {
    const mine = cards.filter(c => c.id_manuelle)
    const mk = (get: (c: { n: string; t: string }) => string) => findVariantGroups(cards.map(get), mine.map(c => ({ id: c.id_manuelle as string, value: get(c) })), ignored)
    return [
      ...mk(c => c.n).map(g => ({ field: 'nom' as Field, g })),
      // équipes : d'abord les surnoms reconnus (Sixers → Philadelphia 76ers), puis les simples variantes d'écriture des noms non reconnus
      ...findTeamGroups(mine.map(c => ({ id: c.id_manuelle as string, value: c.t })), ignored).map(g => ({ field: 'equipe' as Field, g })),
      ...findVariantGroups(cards.map(c => c.t).filter(v => !resolveTeam(v)), mine.filter(c => !resolveTeam(c.t)).map(c => ({ id: c.id_manuelle as string, value: c.t })), ignored).map(g => ({ field: 'equipe' as Field, g })),
    ]
  }, [cards, ignored])

  // rien à unifier : on n'affiche rien (sauf le récapitulatif de ce qui vient d'être fait, tant que la fenêtre est ouverte)
  if (!groups.length && !open) return null

  const id = (field: Field, g: VariantGroup) => `${field}:${g.key}`
  const finalValue = (field: Field, g: VariantGroup) => chosen[id(field, g)] ?? g.canonical
  const apply = async (field: Field, g: VariantGroup) => {
    const value = finalValue(field, g)
    // la valeur choisie peut être l'une des écritures « à corriger » : on corrige alors toutes les AUTRES (celles différentes de la valeur choisie)
    const ids = g.variants.filter(v => v.value !== value).flatMap(v => v.ids)
    // si l'écriture choisie n'est pas celle de la galerie, les cartes qui portaient la proposée sont à corriger aussi
    const extra = cards.filter(c => c.id_manuelle && (field === 'nom' ? c.n : c.t).trim() !== value && (field === 'nom' ? c.n : c.t).trim() === g.canonical).map(c => c.id_manuelle as string)
    const all = [...new Set([...ids, ...(value !== g.canonical ? extra : [])])]
    if (!all.length) return
    setBusy(id(field, g)); setError('')
    const { error: err } = await supabase.from('cartes_manuelles').update({ [field]: value }).in('id', all).eq('user_id', userId)
    setBusy(null)
    if (err) { setError('Impossible de modifier pour le moment. Réessaie dans un instant.'); return }
    onApplied(field, all, value)
    setDone(d => [...d, `${all.length} carte${all.length > 1 ? 's' : ''} → « ${value} »`])
  }
  const ignore = (field: Field, g: VariantGroup) => {
    const next = new Set(ignored); next.add(g.key)
    try { localStorage.setItem(ignoredKey(userId), JSON.stringify([...next])) } catch { /* stockage indisponible */ }
    setIgnored(next)
  }

  return (
    <>
      {groups.length > 0 && (
        <div className="da-draft" role="status">
          <div style={{ flex: 1, minWidth: 0 }}>
            <b>{groups.length} nom{groups.length > 1 ? 's' : ''} écrit{groups.length > 1 ? 's' : ''} de plusieurs façons</b>
            <div className="da-draft-sub">Par exemple « Lebron James » et « LeBron James ». Les filtres par joueur et par équipe les comptent à part.</div>
          </div>
          <button type="button" className="da-confirm-btn primary" onClick={() => { setDone([]); setOpen(true) }}>Voir →</button>
        </div>
      )}
      {open && typeof document !== 'undefined' && createPortal(
        <div role="dialog" aria-modal="true" aria-label="Nettoyer mes noms" onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
          style={{ position: 'fixed', inset: 0, zIndex: 20000000, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--bg2, #0e1530)', color: 'var(--text, #f0f0f0)', border: '2px solid var(--border, #243063)', width: 'min(560px, 100%)', maxHeight: '86vh', overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <b style={{ fontSize: 17, flex: 1 }}>Nettoyer mes noms</b>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fermer" style={{ background: 'none', border: 0, color: 'inherit', fontSize: 22, cursor: 'pointer' }}>×</button>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text2, #aab3d1)' }}>Seules les différences de majuscules, d’accents, de ponctuation et d’espaces sont proposées : jamais deux noms qui se ressemblent seulement. Seules les cartes que tu as ajoutées toi-même sont modifiées.</p>
            {done.map((d, i) => <div key={i} style={{ fontSize: 13, color: '#4fd18b' }}>✓ {d}</div>)}
            {error && <div style={{ fontSize: 13, color: '#ff6b6b' }}>{error}</div>}
            {groups.length === 0 && <div style={{ fontSize: 14 }}>Tout est unifié.</div>}
            {groups.map(({ field, g }) => {
              const all = [g.canonical, ...g.variants.map(v => v.value)]
              const sel = finalValue(field, g)
              return (
                <div key={id(field, g)} style={{ border: '1px solid var(--border, #243063)', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text2, #aab3d1)' }}>{field === 'nom' ? 'Joueur' : 'Équipe'}</div>
                  <div role="radiogroup" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {all.map(v => (
                      <label key={v} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, cursor: 'pointer' }}>
                        <input type="radio" name={id(field, g)} checked={sel === v} onChange={() => setChosen(c => ({ ...c, [id(field, g)]: v }))} />
                        <span style={{ fontWeight: sel === v ? 800 : 500 }}>{v}</span>
                        {v === g.canonical && <span style={{ fontSize: 11, opacity: .65 }}>{g.key.startsWith('team:') ? '(nom officiel)' : '(la plus utilisée)'}</span>}
                      </label>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button type="button" className="da-confirm-btn primary" disabled={busy === id(field, g)} onClick={() => apply(field, g)}>{busy === id(field, g) ? '…' : `Unifier en « ${sel} »`}</button>
                    <button type="button" className="da-confirm-btn" onClick={() => ignore(field, g)}>Ce sont deux choses différentes</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

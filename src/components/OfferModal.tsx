'use client'
/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { fmtPrice } from '@/lib/marketplace'
import { parsePrice, OFFER_TTL_HOURS } from '@/lib/offers'
import ModalShell from '@/components/ModalShell'
import TradeReputation from '@/components/TradeReputation'
import PcBobbles from '@/components/PcBobbles'
import FollowCounts from '@/components/FollowCounts'
import FollowButton from '@/components/FollowButton'
import LevelBadge from '@/components/LevelBadge'
import OnlineIndicator from '@/components/OnlineIndicator'
import { InstagramIcon, XIcon, DiscordIcon } from '@/components/SocialIcons'
import { useTheme } from '@/lib/ThemeContext'

interface SellerCard { id: string; nom: string; annee: string | null; marque: string | null; image_recto: string | null; prix_vente: number | null }
interface SellerProfile {
  id: string; display_name: string | null; avatar_url: string | null; bio: string | null; slug: string | null
  pcs?: { type?: string; name?: string }[] | null
  couleur_bordure?: string | null; instagram?: string | null; twitter?: string | null; discord?: string | null; last_seen?: string | null; is_donor?: boolean | null
  stats_total?: number | null; stats_rc?: number | null; stats_auto?: number | null; stats_patch?: number | null; stats_num?: number | null
}

const MAX_LOT = 10
const DISCOUNTS = [5, 10, 15] as const
const round2 = (n: number) => Math.round(n * 100) / 100
const asInput = (n: number) => String(round2(n)).replace('.', ',')

// Fenêtre de profil du vendeur : EXACTEMENT le bandeau de profil de sa galerie (mêmes classes .da-profile, avatar avec niveau, nom, réputation,
// abonnés, bio, réseaux, boutons, chiffres, figurines des PCs), mais en colonne.
function SellerWindow({ sellerId, fallbackName }: { sellerId: string; fallbackName: string }) {
  const { dark } = useTheme()
  const [p, setP] = useState<SellerProfile | null>(null)
  useEffect(() => {
    let off = false
    supabase.from('profiles').select('id, display_name, avatar_url, bio, slug, pcs, couleur_bordure, instagram, twitter, discord, last_seen, is_donor, stats_total, stats_rc, stats_auto, stats_patch, stats_num').eq('id', sellerId).maybeSingle()
      .then(({ data }) => { if (!off) setP((data as SellerProfile) || null) })
    return () => { off = true }
  }, [sellerId])
  const name = p?.display_name || fallbackName
  const accent = p?.couleur_bordure || '#003DA6'
  const src = p?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=003DA6&color=fff&size=128`
  const nums = [
    { val: p?.stats_total, label: 'Cartes', color: undefined as string | undefined },
    { val: p?.stats_rc, label: 'RC', color: '#F97316' },
    { val: p?.stats_auto, label: 'Auto', color: '#3B82F6' },
    { val: p?.stats_patch, label: 'Patch', color: '#EF4444' },
    { val: p?.stats_num, label: 'Num', color: '#A855F7' },
  ]
  return (
    <div className="da-profile da-grain om-side" style={{ ['--da-accent' as string]: accent, position: 'relative', background: dark ? '#1e1e1e' : 'white', boxShadow: 'var(--elevation-md)' }}>
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to top left, ${accent}${dark ? '3d' : '2b'}, transparent 70%)`, pointerEvents: 'none' }} />
      <div className="om-in" style={{ position: 'relative', padding: '24px 22px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
        <div style={{ position: 'relative' }}>
          <LevelBadge userId={sellerId} accent={accent} avatarClassName="profile-avatar-halo">
            <img src={src} width={80} height={80} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} alt={name} />
          </LevelBadge>
          <div style={{ position: 'absolute', bottom: 2, right: 2 }}><OnlineIndicator lastSeen={p?.last_seen ?? null} size={16} /></div>
        </div>
        <h1 className={p?.is_donor ? 'holo-name' : ''} style={{ margin: 0 }}>{name}</h1>
        <TradeReputation userId={sellerId} />
        <FollowCounts userId={sellerId} onOpenList={() => {}} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' }}>
          {p?.instagram && <a href={`https://instagram.com/${p.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: '50%', color: '#E1306C', background: dark ? '#2a1a20' : '#fce4ec' }}><InstagramIcon size={15} /></a>}
          {p?.twitter && <a href={`https://x.com/${p.twitter.replace('@', '')}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: '50%', color: dark ? '#e0e0e0' : '#121212', background: dark ? '#1a1a1a' : '#f0f0f0' }}><XIcon size={13} /></a>}
          {p?.discord && <button type="button" title={p.discord} onClick={() => { navigator.clipboard.writeText(p.discord!).then(() => toast.success('Pseudo Discord copié'), () => {}) }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: '50%', border: 'none', color: '#5865F2', background: dark ? '#1a1c33' : '#eef0ff', cursor: 'pointer' }}><DiscordIcon size={15} /></button>}
          <Link href={`/messages?to=${sellerId}`} style={{ fontSize: 12, fontWeight: 700, color: 'white', background: accent, padding: '5px 12px', borderRadius: 20, textDecoration: 'none' }}>Message</Link>
          <FollowButton targetUserId={sellerId} accent={accent} />
        </div>
        {p?.bio && <p style={{ fontSize: 13, margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{p.bio}</p>}
        <div className="om-bottom" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        {/* les figurines poussent vers le haut depuis leur ligne de base : on réserve la place au-dessus (seulement si le joueur en a) */}
        <div className="om-bob"><div style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}><PcBobbles pcs={p?.pcs} ownerId={sellerId} maxHeight={120} /></div></div>
        <div className="om-statsrow" style={{ display: 'grid', gridTemplateColumns: `repeat(${nums.filter(n => n.val != null).length || 1}, 1fr)`, width: '100%', borderTop: '1px solid rgba(255,255,255,.28)', paddingTop: 12 }}>
          {nums.filter(n => n.val != null).map((n, i) => (
            <div key={n.label} style={{ textAlign: 'center', minWidth: 0, borderLeft: i ? '1px solid rgba(255,255,255,.22)' : 'none' }}>
              <div className="da-num" style={{ fontSize: 22, fontWeight: 900, color: n.color || accent, lineHeight: 1 }}>{Number(n.val).toLocaleString('fr-FR')}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#999', textTransform: 'uppercase', marginTop: 2 }}>{n.label}</div>
            </div>
          ))}
        </div>
        <Link href={`/galerie/${p?.slug || sellerId}`} target="_blank" style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', marginTop: 4 }}>Voir sa galerie ↗</Link>
        </div>
      </div>
    </div>
  )
}

// Offre de prix (acheteur) : on choisit UNE ou PLUSIEURS cartes à vendre chez ce membre et on propose un prix pour le tout (boutons -5 / -10 / -15 %, ou prix libre).
// Aucun paiement : si le vendeur accepte, la suite (envoi, règlement) se passe entre membres.
export default function OfferModal({ sellerId, sellerName, presetCardId, onClose, onCreated }: {
  sellerId: string; sellerName: string; presetCardId?: string; dark?: boolean; onClose: () => void; onCreated: () => void
}) {
  const [cards, setCards] = useState<SellerCard[] | null>(null)
  const [picked, setPicked] = useState<string[]>(presetCardId ? [presetCardId] : [])
  const [price, setPrice] = useState('')
  const [discount, setDiscount] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.from('cartes_manuelles')
        .select('id, nom, annee, marque, image_recto, prix_vente')
        .eq('user_id', sellerId).eq('disponible_vente', true).or('vendue.is.null,vendue.eq.false')
        .order('created_at', { ascending: false }).limit(200)
      if (!cancelled) setCards(((data as SellerCard[]) || []).filter(c => c.prix_vente != null))
    })()
    return () => { cancelled = true }
  }, [sellerId])

  const chosen = useMemo(() => (cards || []).filter(c => picked.includes(c.id)), [cards, picked])
  const total = useMemo(() => round2(chosen.reduce((s, c) => s + Number(c.prix_vente), 0)), [chosen])

  // une remise choisie suit la sélection (le prix est recalculé si on ajoute / retire une carte)
  useEffect(() => { if (discount != null && total > 0) setPrice(asInput(total * (1 - discount / 100))) }, [total, discount])

  const toggle = (id: string) => setPicked(p => p.includes(id) ? p.filter(x => x !== id) : p.length >= MAX_LOT ? (toast.error(`${MAX_LOT} cartes maximum par offre.`), p) : [...p, id])
  const applyDiscount = (d: number) => {
    if (!total) { toast.error('Choisis d’abord une carte.'); return }
    if (discount === d) { setDiscount(null); setPrice(asInput(total)); return }   // re-clic : la remise s'enlève, le prix complet revient
    setDiscount(d); setPrice(asInput(total * (1 - d / 100)))
  }

  const sub: React.CSSProperties = { color: 'var(--text2, #9aa6bb)' }
  const head: React.CSSProperties = { fontWeight: 800, fontSize: 'var(--fs-xs)', letterSpacing: '.08em', textTransform: 'uppercase', margin: '0 0 var(--sp-2)', ...sub }
  const p = parsePrice(price)

  const submit = async () => {
    if (!chosen.length) { toast.error('Choisis au moins une carte.'); return }
    if (p == null) { toast.error('Indique un prix valide.'); return }
    if (p >= total) { toast.error(`Ton offre doit être inférieure au prix demandé (${fmtPrice(total)}).`); return }
    setBusy(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/offers', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` }, body: JSON.stringify({ sellerId, cardId: chosen[0].id, cardIds: chosen.map(c => c.id), price: p, message }) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(json.error || 'Envoi impossible.'); setBusy(false); return }
      toast.success(chosen.length > 1 ? 'Offre groupée envoyée.' : 'Offre envoyée.')
      onCreated()
    } catch { toast.error('Connexion impossible. Réessaie.'); setBusy(false) }
  }

  return (
    <ModalShell title={`💶 Offre à ${sellerName}`} onClose={onClose} maxWidth={620} side={<SellerWindow sellerId={sellerId} fallbackName={sellerName} />}
      footer={<>
        <button type="button" onClick={submit} disabled={busy || !chosen.length} className="btn-main btn-primary">{busy ? 'Envoi…' : chosen.length > 1 ? `Envoyer l’offre (${chosen.length} cartes)` : 'Envoyer l’offre'}</button>
        <button type="button" onClick={onClose} disabled={busy} className="da-confirm-btn">Annuler</button>
      </>}>
      <div className="om-main">
        <div>
          <p style={{ fontSize: 'var(--fs-sm)', margin: '0 0 var(--sp-4)', lineHeight: 1.5, ...sub }}>Choisis une ou plusieurs cartes et propose un prix pour le tout. {sellerName} a {OFFER_TTL_HOURS} h pour accepter, refuser ou te répondre par un autre prix. Aucun paiement sur Memorabilius : la suite se règle entre vous.</p>

          <div style={head}>1 · Cartes {chosen.length > 0 && <span style={{ color: '#2f6bff' }}>({chosen.length} choisie{chosen.length > 1 ? 's' : ''})</span>}</div>
          {cards === null ? <div style={{ fontSize: 'var(--fs-sm)', ...sub }}>Chargement…</div> : cards.length === 0 ? (
            <div style={{ fontSize: 'var(--fs-sm)', ...sub }}>Ce membre n’a aucune carte à vendre avec un prix affiché.</div>
          ) : (
            <div className="om-cards">
              {cards.map(c => {
                const on = picked.includes(c.id)
                return (
                  <button key={c.id} type="button" className={`om-tile${on ? ' on' : ''}`} onClick={() => toggle(c.id)} aria-pressed={on} title={c.nom}>
                    {c.image_recto ? <img src={c.image_recto} alt="" /> : <div className="om-ph" />}
                    <span className="om-ck">✓</span>
                    <span className="om-pr">{fmtPrice(Number(c.prix_vente))}</span>
                    <span className="om-nm">{c.nom}</span>
                  </button>
                )
              })}
            </div>
          )}
          {chosen.length > 0 && (
            <div className="om-total"><span>Prix demandé{chosen.length > 1 ? ` · ${chosen.length} cartes` : ''}</span><b>{fmtPrice(total)}</b></div>
          )}

          <div style={{ ...head, marginTop: 'var(--sp-4)' }}>2 · Ton offre{chosen.length > 1 ? ' pour le tout' : ''}</div>
          <div className="om-disc" role="group" aria-label="Remise rapide">
            {DISCOUNTS.map(d => (
              <button key={d} type="button" className={discount === d ? 'on' : ''} onClick={() => applyDiscount(d)}>−{d} %</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
            <input inputMode="decimal" value={price} onChange={e => { setPrice(e.target.value); setDiscount(null) }} placeholder={total ? `ton prix (moins de ${fmtPrice(total)})` : 'Prix en €'} aria-label="Prix proposé en euros" style={{ flex: 1 }} />
            <span style={{ fontWeight: 800 }}>€</span>
          </div>
          {p != null && total > 0 && p < total && (
            <div style={{ fontSize: 'var(--fs-xs)', marginTop: 6, ...sub }}>Soit {Math.round((1 - p / total) * 100)} % de moins que le prix demandé.</div>
          )}
          <input value={message} onChange={e => setMessage(e.target.value.slice(0, 300))} placeholder="Un petit mot (facultatif)" aria-label="Message au vendeur" style={{ marginTop: 'var(--sp-2)' }} />
        </div>
      </div>
    </ModalShell>
  )
}

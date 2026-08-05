'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import CardValueModule from './CardValueModule'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const BRAND = '#003DA6'

export default function CardSharePage({ cardId }: { cardId: string }) {
  const [card, setCard]       = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [flipped, setFlipped] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: c } = await supabase
        .from('cartes_manuelles')
        .select('nom, equipe, annee, marque, collection, variation, num, rc, auto, patch, grade, image_recto, image_verso, is_horizontal, user_id')
        .eq('id', cardId)
        .single()

      if (!c) { setLoading(false); return }
      setCard(c)

      const { data: p } = await supabase
        .from('profiles')
        .select('display_name, avatar_url, slug, couleur_bordure')
        .eq('id', c.user_id)
        .single()
      setProfile(p)
      setLoading(false)
    }
    load()
  }, [cardId])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <div style={{ width: 36, height: 36, border: '3px solid #e2e8f0', borderTopColor: BRAND, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  if (!card) return (
    <div style={{ textAlign: 'center', padding: 80 }}>
      <p style={{ color: '#94a3b8', fontSize: 18, marginBottom: 16 }}>Carte introuvable</p>
      <Link href="/" style={{ color: BRAND, fontWeight: 700 }}>Retour à l'accueil</Link>
    </div>
  )

  const accent   = profile?.couleur_bordure || BRAND
  const hasVerso = !!card.image_verso
  const isH      = !!card.is_horizontal
  const galLink  = `/galerie/${profile?.slug || card.user_id}`

  const tags: { label: string; bg: string }[] = []
  if (card.rc)    tags.push({ label: 'RC',    bg: '#e67e22' })
  if (card.auto)  tags.push({ label: 'AUTO',  bg: '#2e7d32' })
  if (card.patch) tags.push({ label: 'PATCH', bg: '#1976d2' })
  if (card.num)   tags.push({ label: card.num, bg: '#7b1fa2' })

  const infoRows = [
    ['Année',         card.annee],
    ['Marque',        card.marque],
    ['Collection',    card.collection],
    ['Numérotation',  card.num],
  ].filter(([, v]) => v) as [string, string][]

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', fontFamily: 'system-ui, sans-serif' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      {/* Header */}
      <div style={{ background: accent, padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <img src="/memorabilius-logo.png" alt="Memorabilius" height={28} style={{ display: 'block' }} />
        </Link>
        {profile && (
          <Link href={galLink} style={{ color: 'white', fontSize: 13, fontWeight: 700, textDecoration: 'none', opacity: 0.9 }}>
            Galerie de {profile.display_name} →
          </Link>
        )}
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '28px 16px 60px' }}>

        {/* Card flip */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
          <div
            onClick={() => hasVerso && setFlipped(f => !f)}
            style={{
              width: isH ? '100%' : 220,
              maxWidth: '100%',
              aspectRatio: isH ? '3.5 / 2.5' : '2.5 / 3.5',
              perspective: '1000px',
              cursor: hasVerso ? 'pointer' : 'default',
            }}
          >
            <div style={{
              position: 'relative', width: '100%', height: '100%',
              transformStyle: 'preserve-3d',
              transition: 'transform 0.6s cubic-bezier(0.4,0,0.2,1)',
              transform: flipped ? 'rotateY(180deg)' : 'none',
              borderRadius: 14,
              boxShadow: `0 20px 56px ${accent}55, 0 4px 16px rgba(0,0,0,0.2)`,
            }}>
              <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', borderRadius: 14, overflow: 'hidden' }}>
                <img src={card.image_recto} alt={card.nom} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
              {hasVerso && (
                <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)', borderRadius: 14, overflow: 'hidden' }}>
                  <img src={card.image_verso} alt={`${card.nom} verso`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </div>
              )}
            </div>
          </div>
          {hasVerso && (
            <div style={{ marginTop: 10, fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 5 }}>
              ↔ Appuyez pour retourner
            </div>
          )}
        </div>

        {/* Card info */}
        <div style={{ background: 'white', borderRadius: 16, padding: '22px 24px', boxShadow: '0 1px 6px rgba(0,0,0,0.07)', marginBottom: 12 }}>
          {card.equipe && (
            <div style={{ color: accent, fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
              {card.equipe}
            </div>
          )}
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 8px', lineHeight: 1.2, color: '#0f172a' }}>{card.nom}</h1>
          {card.variation && (
            <div style={{ fontSize: 13, color: accent, fontStyle: 'italic', marginBottom: 12 }}>{card.variation}</div>
          )}

          {tags.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
              {tags.map(tag => (
                <span key={tag.label} style={{ fontSize: 11, fontWeight: 900, padding: '4px 9px', borderRadius: 6, background: tag.bg, color: 'white' }}>
                  {tag.label}
                </span>
              ))}
            </div>
          )}

          {infoRows.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px', paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
              {infoRows.map(([label, value]) => (
                <div key={label}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>{value}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* eBay prices */}
        <div style={{ background: 'white', borderRadius: 16, padding: '20px 24px', boxShadow: '0 1px 6px rgba(0,0,0,0.07)', marginBottom: 12 }}>
          <CardValueModule
            cardName={card.nom}
            set={`${card.marque || ''} ${card.collection || ''}`.trim()}
            year={card.annee || ''}
            num={card.num || ''}
            variant={card.variation}
            rc={card.rc}
            auto={card.auto}
            patch={card.patch}
            grade={card.grade}
            accent={accent}
            img={card.image_recto}
          />
        </div>

        {/* Collector */}
        {profile && (
          <Link href={galLink} style={{ textDecoration: 'none', display: 'block', marginBottom: 20 }}>
            <div style={{
              background: 'white', borderRadius: 16, padding: '14px 18px',
              boxShadow: '0 1px 6px rgba(0,0,0,0.07)',
              display: 'flex', alignItems: 'center', gap: 14,
              border: '2px solid transparent', transition: 'border-color 0.2s',
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = accent }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'transparent' }}
            >
              <img
                src={profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.display_name || 'U')}&background=003DA6&color=fff&size=64`}
                style={{ width: 42, height: 42, borderRadius: '50%', border: `2px solid ${accent}`, flexShrink: 0, objectFit: 'cover' }}
                alt={profile.display_name}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 2 }}>Collectionneur</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile.display_name}</div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: accent, flexShrink: 0 }}>Voir la galerie →</span>
            </div>
          </Link>
        )}

        {/* CTA */}
        <div style={{ background: accent, borderRadius: 16, padding: '24px 20px', textAlign: 'center', color: 'white' }}>
          <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 6 }}>Collectionnez et partagez vos cartes</div>
          <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 18 }}>Scanner IA · Galerie 3D · Échanges — 100% gratuit</div>
          <Link href="/sinscrire" style={{
            display: 'inline-block', background: 'white', color: accent,
            borderRadius: 10, padding: '10px 28px', fontWeight: 900, fontSize: 14, textDecoration: 'none',
          }}>
            Rejoindre Memorabilius
          </Link>
        </div>
      </div>
    </div>
  )
}

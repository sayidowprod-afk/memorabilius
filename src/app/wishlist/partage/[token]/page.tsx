import type { Metadata } from 'next'
import Link from 'next/link'
import { createServerServiceClient } from '@/lib/supabaseServer'
import CardTagBadges from '@/components/CardTagBadges'

// Wishlist d'un membre partagée par lien (lecture seule, sans connexion). Jamais indexée.
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Wishlist partagée | Memorabilius', robots: { index: false, follow: false } }

type Item = { id: string; nom: string; equipe?: string | null; annee: string | null; marque: string | null; collection: string | null; variation: string | null; num: string | null; rc: boolean | null; auto: boolean | null; patch: boolean | null; notes: string | null }

export default async function SharedWishlistPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = createServerServiceClient()
  let owner: { id: string; display_name: string | null; avatar_url: string | null; slug: string | null } | null = null
  let items: Item[] = []
  if (token && token.length >= 16 && token.length <= 64) {
    const { data: share } = await supabase.from('wishlist_shares').select('user_id').eq('token', token).maybeSingle()
    if (share?.user_id) {
      const [{ data: p }, { data: w }] = await Promise.all([
        supabase.from('profiles').select('id, display_name, avatar_url, slug').eq('id', share.user_id).maybeSingle(),
        supabase.from('wishlist').select('id, nom, equipe, annee, marque, collection, variation, num, rc, auto, patch, notes').eq('user_id', share.user_id).order('created_at', { ascending: false }),
      ])
      owner = p ?? null
      items = (w ?? []) as Item[]
    }
  }

  if (!owner) {
    return (
      <main style={{ maxWidth: 640, margin: '60px auto', padding: '0 16px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 'clamp(2rem, 4.5vw, 2.75rem)' }}>Lien introuvable</h1>
        <p style={{ color: 'var(--text2, #666)' }}>Cette wishlist n’est plus partagée, ou le lien est incorrect.</p>
        <Link href="/" style={{ textDecoration: 'underline' }}>Retour à l’accueil</Link>
      </main>
    )
  }

  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: '30px 16px 60px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22, flexWrap: 'wrap' }}>
        {owner.avatar_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={owner.avatar_url} alt="" width={52} height={52} style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--text, #fff)' }} />
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ font: '800 12px system-ui, sans-serif', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--text2, #666)' }}>Wishlist de</div>
          <h1 style={{ fontSize: 'clamp(2rem, 4.5vw, 2.75rem)', margin: 0, lineHeight: 1 }}>{owner.display_name || 'Collectionneur'}</h1>
        </div>
        <Link href={`/galerie/${owner.slug || owner.id}`} className="btn-main btn-secondary" style={{ marginLeft: 'auto', padding: '10px 16px', fontSize: 13 }}>Voir sa galerie</Link>
      </div>
      <p style={{ color: 'var(--text2, #666)', margin: '0 0 18px' }}>{items.length} carte{items.length > 1 ? 's' : ''} recherchée{items.length > 1 ? 's' : ''}. Tu en as une ? Écris-lui depuis sa galerie.</p>
      {items.length === 0 && <p>Cette wishlist est vide pour le moment.</p>}
      <div style={{ display: 'grid', gap: 10 }}>
        {items.map(item => (
          <div key={item.id} style={{ border: '2px solid var(--border, #243063)', background: 'var(--card-bg, transparent)', padding: '14px 18px' }}>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 3 }}>{item.nom || item.equipe}</div>
            <div style={{ fontSize: 13, color: 'var(--text2, #666)', marginBottom: 6 }}>{[item.nom ? item.equipe : null, item.annee, item.marque, item.collection, item.variation].filter(Boolean).join(' · ')}</div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}><CardTagBadges rc={!!item.rc} auto={!!item.auto} patch={!!item.patch} num={item.num || ''} size="md" /></div>
            {item.notes && <div style={{ fontSize: 13, marginTop: 6, fontStyle: 'italic', color: 'var(--text2, #666)' }}>« {item.notes} »</div>}
          </div>
        ))}
      </div>
    </main>
  )
}

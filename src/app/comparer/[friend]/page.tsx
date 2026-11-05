'use client'
// Compare ma galerie avec celle d'un autre membre : ce que j'ai et qu'il cherche, ce qu'il a et que je cherche, et les cartes en commun.
import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type C = { id: string; nom: string; annee: string | null; marque: string | null; collection: string | null; variation: string | null; num: string | null; image: string | null }
type Result = {
  friend: { id: string; display_name: string | null; avatar_url: string | null; slug: string | null }
  counts: { mine: number; theirs: number; myWishlist: number }
  iHave: C[]; iHaveTotal: number; theyHave: C[]; theyHaveTotal: number; common: C[]; commonTotal: number
}

function Tile({ c }: { c: C }) {
  return (
    <div className="da-cmp-tile">
      {c.image
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={c.image} alt={c.nom} loading="lazy" />
        : <div className="da-cmp-ph">?</div>}
      <div className="da-cmp-n">{c.nom}</div>
      <div className="da-cmp-s">{[c.annee, c.marque, c.collection, c.variation].filter(Boolean).join(' · ')}</div>
    </div>
  )
}

function Section({ title, hint, list, total, empty }: { title: string; hint: string; list: C[]; total: number; empty: string }) {
  return (
    <section className="da-cmp-sec">
      <div className="da-cmp-head"><h2>{title}</h2><span className="da-cmp-count">{total}</span></div>
      <p className="da-cmp-hint">{hint}</p>
      {list.length === 0 ? <div className="da-cmp-empty">{empty}</div> : (
        <div className="da-cmp-grid">{list.map(c => <Tile key={c.id} c={c} />)}</div>
      )}
      {total > list.length && <p className="da-cmp-hint">… et {total - list.length} autre{total - list.length > 1 ? 's' : ''}.</p>}
    </section>
  )
}

export default function ComparerPage({ params }: { params: Promise<{ friend: string }> }) {
  const { friend } = use(params)
  const router = useRouter()
  const [res, setRes] = useState<Result | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/connexion'); return }
      try {
        const r = await fetch(`/api/comparer?friend=${encodeURIComponent(friend)}`, { headers: { Authorization: `Bearer ${session.access_token}` } })
        const d = await r.json().catch(() => ({}))
        if (!alive) return
        if (r.status === 404) setErr('Ce membre est introuvable.')
        else if (r.status === 400) setErr('C’est ta propre galerie : choisis un autre membre à comparer.')
        else if (!r.ok) setErr('La comparaison a échoué, réessaie dans un instant.')
        else setRes(d as Result)
      } catch { if (alive) setErr('La comparaison a échoué, réessaie dans un instant.') }
    })()
    return () => { alive = false }
  }, [friend, router])

  if (err) return <main className="da-cmp"><h1>Comparer</h1><p>{err}</p><Link href="/annuaire" style={{ textDecoration: 'underline' }}>Retour à l’annuaire</Link></main>
  if (!res) return <main className="da-cmp"><h1>Comparer</h1><div className="da-cmp-load"><div className="sk" /><div className="sk" /><div className="sk" />Comparaison en cours… (jusqu’à quelques secondes pour de grosses collections)</div></main>

  const name = res.friend.display_name || 'Ce membre'
  return (
    <main className="da-cmp">
      <div className="da-cmp-top">
        {res.friend.avatar_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={res.friend.avatar_url} alt="" width={52} height={52} className="da-cmp-av" />
        )}
        <div style={{ minWidth: 0 }}>
          <div className="da-cmp-kicker">Comparer avec</div>
          <h1>{name}</h1>
        </div>
        <Link href={`/galerie/${res.friend.slug || res.friend.id}`} className="btn-main btn-secondary" style={{ marginLeft: 'auto', padding: '10px 16px', fontSize: 13 }}>Voir sa galerie</Link>
      </div>
      <p className="da-cmp-hint">Ta galerie : {res.counts.mine.toLocaleString('fr-FR')} cartes · la sienne : {res.counts.theirs.toLocaleString('fr-FR')} cartes (cartes privées exclues).</p>

      <Section title="Tu as, il cherche" hint={`Tes cartes qui correspondent à la wishlist de ${name} : de quoi lui proposer un échange.`} list={res.iHave} total={res.iHaveTotal} empty="Aucune de tes cartes ne correspond à sa wishlist." />
      <Section title="Il a, tu cherches" hint={`Ses cartes qui correspondent à ta wishlist${res.counts.myWishlist === 0 ? ' (ta wishlist est vide : ajoute-y des cartes)' : ''}.`} list={res.theyHave} total={res.theyHaveTotal} empty="Aucune de ses cartes ne correspond à ta wishlist." />
      <Section title="En commun" hint="Cartes identiques dans vos deux galeries." list={res.common} total={res.commonTotal} empty="Aucune carte identique pour le moment." />
      <p className="da-cmp-hint" style={{ marginTop: 22 }}>Seules les cartes qui correspondent sont affichées : la wishlist complète de l’autre membre reste privée.</p>
    </main>
  )
}

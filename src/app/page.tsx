import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default async function Home() {
  const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true })
  const total = count ?? 0

  return (
    <div>
      {/* Hero */}
      <section style={{
        textAlign: 'center',
        padding: '80px 20px',
        background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
        borderRadius: 20,
        marginBottom: 40,
      }}>
        <h1 style={{ fontSize: '3.5rem', fontWeight: 900, color: '#121212', marginBottom: 20, lineHeight: 1 }}>
          Exposez votre passion en 3D.
        </h1>
        <p style={{ fontSize: '1.2rem', color: '#666', maxWidth: 600, margin: '0 auto 30px' }}>
          La plateforme ultime pour les collectionneurs de cartes de Sports. Gérez votre inventaire via Google Sheets et partagez votre galerie interactive avec le monde entier.
        </p>
        <div style={{ display: 'flex', gap: 15, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/sinscrire" className="btn-main btn-primary">Créer ma galerie</Link>
          <Link href="/annuaire" className="btn-main btn-secondary">Explorer les collections</Link>
        </div>
      </section>

      {/* Tutoriel */}
      <div className="section-title">Comment ça marche ?</div>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 25, marginBottom: 60 }}>
        {[
          {
            n: 1, title: 'Préparez votre Google Sheet',
            desc: 'Utilisez notre modèle pré-rempli pour lister vos cartes (photos, noms, variations). C\'est votre base de données personnelle.',
            link: 'https://docs.google.com/spreadsheets/d/1_3HVVrWiKq8IVO0x2_AIrhkiJBY3p-wAuAxXO7Eb8N8/copy',
            linkText: '📄 Créer ma copie du modèle →'
          },
          {
            n: 2, title: 'Publiez au format CSV',
            desc: 'Dans Google Sheets, allez dans Fichier > Partager > Publier sur le Web. Choisissez le format "Valeurs séparées par des virgules (.csv)".',
          },
          {
            n: 3, title: 'Liez et admirez',
            desc: 'Collez votre lien CSV dans votre profil Memorabilius. Votre galerie 3D interactive est générée instantanément.',
            link: '/sinscrire', linkText: 'S\'inscrire maintenant →'
          },
        ].map(s => (
          <div key={s.n} style={{ background: 'white', padding: 30, borderRadius: 15, border: '1px solid #eee', position: 'relative', transition: '0.3s' }}>
            <div style={{
              position: 'absolute', top: -15, left: 20,
              background: '#003DA6', color: 'white', width: 35, height: 35,
              borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 900, fontSize: 18,
            }}>{s.n}</div>
            <h4 style={{ margin: '15px 0 10px', fontWeight: 800, fontSize: 18 }}>{s.title}</h4>
            <p style={{ fontSize: 14, color: '#777', lineHeight: 1.5 }}>{s.desc}</p>
            {s.link && <a href={s.link} style={{ color: '#003DA6', fontWeight: 700, fontSize: 13, display: 'inline-block', marginTop: 10 }}>{s.linkText}</a>}
          </div>
        ))}
      </section>

      {/* Stats */}
      <div className="section-title">En chiffres</div>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20, marginBottom: 50 }}>
        {[
          { val: total, label: 'Collectionneurs' },
          { val: '+300', label: 'Cartes répertoriées' },
          { val: '100%', label: 'Interactif & 3D' },
        ].map(s => (
          <div key={s.label} style={{ background: 'white', padding: 30, borderRadius: 15, textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '2.5rem', fontWeight: 900, color: '#003DA6' }}>{s.val}</h3>
            <p style={{ color: '#999', textTransform: 'uppercase', fontSize: 12, fontWeight: 700, marginTop: 5 }}>{s.label}</p>
          </div>
        ))}
      </section>
    </div>
  )
}

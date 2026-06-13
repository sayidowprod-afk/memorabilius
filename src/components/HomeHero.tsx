import Link from 'next/link'

// Server Component — HTML généré côté serveur, zéro JS client nécessaire
// La langue côté serveur est toujours le français (localStorage lu après hydratation)
const steps = [
  { n: 1, title: 'Créez votre inventaire', desc: "Utilisez notre template Google Sheets pour cataloguer vos cartes avec photos, variantes, grades et numérotations.", link: 'https://docs.google.com/spreadsheets', linkText: 'Voir le template →' },
  { n: 2, title: 'Publiez en CSV', desc: 'Dans Google Sheets : Fichier > Partager > Publier sur le web > Format CSV. Copiez le lien généré.', link: '/tuto', linkText: 'Voir le tutoriel →' },
  { n: 3, title: 'Liez et admirez', desc: 'Collez votre lien CSV dans votre profil Memorabilius. Votre galerie 3D interactive est générée instantanément.', link: '/sinscrire', linkText: "S'inscrire maintenant →" },
  { n: 4, title: 'Partagez', desc: "Partagez votre galerie unique avec la communauté et explorez les collections des autres collectionneurs.", link: '/annuaire', linkText: "Voir l'annuaire →" },
]

export default function HomeHero({ total, totalCartes }: { total: number; totalCartes: number }) {
  return (
    <>
      <section style={{
        textAlign: 'center', padding: '60px 20px',
        background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
        borderRadius: 20, marginBottom: 40,
        contain: 'layout style',
      }}>
        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 900, color: '#121212', marginBottom: 20, lineHeight: 1 }}>
          Exposez votre passion en 3D.
        </h1>
        <p style={{ fontSize: '1.2rem', color: '#666', maxWidth: 600, margin: '0 auto 30px' }}>
          La plateforme ultime pour les collectionneurs de cartes de Sports.
        </p>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/sinscrire" className="btn-main btn-primary">Créer ma galerie</Link>
          <Link href="/annuaire" className="btn-main btn-secondary">Voir l&apos;annuaire</Link>
        </div>
        <div style={{ display: 'flex', gap: 40, justifyContent: 'center', marginTop: 40, flexWrap: 'wrap' }}>
          {[
            { val: total, label: 'Collectionneurs' },
            { val: totalCartes.toLocaleString('fr-FR'), label: 'Cartes répertoriées' },
            { val: '100%', label: '100% Interactif & 3D' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32, fontWeight: 900, color: '#003DA6' }}>{s.val}</div>
              <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, marginBottom: 60 }}>
        {steps.map(s => (
          <div key={s.n} style={{ background: 'white', borderRadius: 16, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#003DA6', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 16, marginBottom: 12 }}>{s.n}</div>
            <h3 style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>{s.title}</h3>
            <p style={{ color: '#666', fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>{s.desc}</p>
            <a href={s.link} style={{ color: '#003DA6', fontWeight: 700, fontSize: 13 }}>{s.linkText}</a>
          </div>
        ))}
      </section>
    </>
  )
}

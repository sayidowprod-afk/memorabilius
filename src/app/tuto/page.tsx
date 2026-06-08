import Link from 'next/link'

export default function Tuto() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      <h1 style={{ fontWeight: 900, fontSize: 32, marginBottom: 8 }}>Comment créer votre galerie</h1>
      <p style={{ color: '#666', marginBottom: 40, fontSize: 16 }}>Suivez ces 4 étapes simples pour lier votre collection Google Sheets à Memorabilius.</p>

      {[
        {
          n: 1, title: 'Créez votre compte Memorabilius',
          desc: 'Inscrivez-vous gratuitement avec votre email et choisissez un pseudo.',
          link: '/sinscrire', linkText: '👉 Créer mon compte →'
        },
        {
          n: 2, title: 'Préparez votre Google Sheet',
          desc: 'Utilisez notre modèle pré-rempli. Complétez chaque colonne sans modifier l\'en-tête. Renseignez les URLs de vos scans (utilisez ImgBB, sélectionnez "Lien Direct").',
          link: 'https://docs.google.com/spreadsheets/d/1_3HVVrWiKq8IVO0x2_AIrhkiJBY3p-wAuAxXO7Eb8N8/copy',
          linkText: '👉 Obtenir la feuille Google Sheets',
          tip: '💡 Je conseille ImgBB pour l\'hébergement de vos scans. Rognez vos cartes et sélectionnez bien "Lien Direct"',
          download: 'https://memorabilius.fr/wp-content/uploads/2026/05/Memorabilius-WinMac_.zip',
          downloadText: '💾 Télécharger le programme d\'automatisation d\'importation des scans'
        },
        {
          n: 3, title: 'Obtenez votre lien CSV',
          desc: 'Dans Google Sheets : Fichier / Partager / Publier sur le web → choisissez "Valeurs séparées par des virgules (.CSV)".',
        },
        {
          n: 4, title: 'Collez le lien dans votre profil',
          desc: 'Rendez-vous dans votre profil Memorabilius, collez le lien CSV. Votre galerie est générée instantanément !',
          link: '/profil', linkText: '👉 Aller dans mon profil →'
        },
      ].map(step => (
        <div key={step.n} style={{ background: 'white', borderRadius: 16, padding: 32, marginBottom: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.06)', borderLeft: '4px solid #003DA6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
            <div style={{ background: '#003DA6', color: 'white', width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 20, flexShrink: 0 }}>
              {step.n}
            </div>
            <h2 style={{ fontWeight: 900, fontSize: 20 }}>{step.title}</h2>
          </div>
          <p style={{ color: '#555', lineHeight: 1.7, marginBottom: step.link || step.tip ? 16 : 0 }}>{step.desc}</p>
          {step.tip && <div style={{ background: '#fffbf0', border: '1px solid #ffe082', borderRadius: 8, padding: 12, fontSize: 13, color: '#7a6000', marginBottom: 12 }}>{step.tip}</div>}
          {step.link && <a href={step.link} target={step.link.startsWith('http') ? '_blank' : undefined} style={{ display: 'inline-block', background: '#003DA6', color: 'white', padding: '10px 20px', borderRadius: 8, fontWeight: 700, fontSize: 14, marginBottom: step.download ? 12 : 0 }}>{step.linkText}</a>}
          {step.download && (
            <div style={{ marginTop: 12 }}>
              <a href={step.download} style={{ display: 'inline-block', background: '#f0f0f0', color: '#333', padding: '10px 20px', borderRadius: 8, fontWeight: 700, fontSize: 13 }}>{step.downloadText}</a>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

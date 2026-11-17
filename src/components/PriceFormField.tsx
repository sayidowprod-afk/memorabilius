'use client'
import { parsePrice } from '@/lib/marketplace'

// Champ « Prix » des formulaires Ajouter / Modifier une carte : toujours affiché, même si la carte n'est pas en vente.
//  - Public : prix affiché en étiquette sur la carte, la carte est marquée « Vente/Trade » ;
//  - Privé  : valeur estimée que toi seul vois (alimente tes statistiques), aucune étiquette.
// Un prix non valide (vide, négatif, zéro, pas un nombre) n'est pas enregistré et est signalé ici.
export default function PriceFormField({ value, onChange, isPublic, onPublicChange }: { value: string; onChange: (v: string) => void; isPublic: boolean; onPublicChange: (v: boolean) => void }) {
  const invalid = value.trim() !== '' && parsePrice(value) === null
  return (
    <div style={{ padding: '12px 14px', border: `2px solid ${isPublic ? '#003DA6' : '#d8dde8'}`, borderRadius: 10, background: isPublic ? '#f0f4ff' : 'transparent' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
        <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#003DA6', flex: 1 }}>🏷️ Prix (facultatif)</label>
        <div role="group" aria-label="Visibilité du prix" style={{ display: 'flex', border: '2px solid #003DA6' }}>
          {([[true, '🌐 Public'], [false, '🔒 Privé']] as const).map(([k, label]) => (
            <button key={String(k)} type="button" aria-pressed={isPublic === k} onClick={() => onPublicChange(k)}
              style={{ padding: '5px 12px', border: 'none', fontWeight: 800, fontSize: 12, cursor: 'pointer', background: isPublic === k ? '#003DA6' : 'transparent', color: isPublic === k ? '#fff' : '#003DA6' }}>{label}</button>
          ))}
        </div>
      </div>
      <div style={{ position: 'relative' }}>
        <input
          type="text" inputMode="decimal" value={value} onChange={e => onChange(e.target.value)} placeholder="ex : 25"
          style={{ width: '100%', padding: '8px 30px 8px 12px', borderRadius: 8, border: `1.5px solid ${invalid ? '#e74c3c' : '#b9c8ee'}`, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
        />
        <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontWeight: 800, color: '#777' }}>€</span>
      </div>
      <div style={{ fontSize: 11, color: '#777', marginTop: 5 }}>
        {isPublic ? 'Public : étiquette de prix sur la carte, la carte est marquée Vente/Trade.' : 'Privé : valeur estimée visible par toi seul, la carte n’est pas en vente.'}
      </div>
      {invalid && (
        <div style={{ fontSize: 11, color: '#e74c3c', marginTop: 4 }}>
          Prix non enregistré : entre un nombre supérieur à 0 (ex : 25 ou 24,50).
        </div>
      )}
    </div>
  )
}

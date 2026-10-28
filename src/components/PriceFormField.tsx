'use client'
import { parsePrice } from '@/lib/marketplace'

// Champ « Prix » des formulaires Ajouter / Modifier une carte, affiché sous l'interrupteur « Disponible à la vente / trade ».
// Facultatif ; un prix non valide (vide, négatif, zéro, pas un nombre) n'est pas enregistré et est signalé ici.
export default function PriceFormField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const invalid = value.trim() !== '' && parsePrice(value) === null
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#003DA6', display: 'block', marginBottom: 4 }}>
        🏷️ Prix (facultatif) — étiquette sur la carte
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type="text" inputMode="decimal" value={value} onChange={e => onChange(e.target.value)} placeholder="ex : 25"
          style={{ width: '100%', padding: '8px 30px 8px 12px', borderRadius: 8, border: `1.5px solid ${invalid ? '#e74c3c' : '#b9c8ee'}`, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
        />
        <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontWeight: 800, color: '#777' }}>€</span>
      </div>
      {invalid && (
        <div style={{ fontSize: 11, color: '#e74c3c', marginTop: 4 }}>
          Prix non enregistré : entre un nombre supérieur à 0 (ex : 25 ou 24,50).
        </div>
      )}
    </div>
  )
}

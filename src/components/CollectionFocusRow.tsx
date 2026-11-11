'use client'
// Réglage « Je collectionne : Sport / TCG / Les deux » (colonne profiles.collection_focus). « Sport » par défaut : rien ne change pour les membres actuels.
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import { useLang } from '@/lib/LangContext'
import { tcgLabel } from '@/lib/tcgGames'
import { rememberCollectionFocus } from '@/lib/useCollectionFocus'

type Focus = 'sport' | 'tcg' | 'both'

export default function CollectionFocusRow({ row, rowLabel, rowSub }: { row: React.CSSProperties; rowLabel: React.CSSProperties; rowSub: React.CSSProperties }) {
  const { user } = useAuth()
  const { lang } = useLang()
  const [focus, setFocus] = useState<Focus>('sport')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('collection_focus').eq('id', user.id).single().then(({ data, error }) => {
      const f = error ? null : (data as { collection_focus?: string } | null)?.collection_focus
      if (f === 'sport' || f === 'tcg' || f === 'both') setFocus(f)
    })
  }, [user])

  if (!user) return null
  const save = async (f: Focus) => {
    setFocus(f); setMsg('')
    const { error } = await supabase.from('profiles').update({ collection_focus: f }).eq('id', user.id)
    if (error) setMsg('Pas encore disponible : la mise à jour de la base (migration TCG) n’est pas appliquée.')
    else rememberCollectionFocus(user.id, f)
  }
  const opts: [Focus, string][] = [['sport', '🏀 ' + tcgLabel('sport', lang)], ['tcg', '🎴 ' + tcgLabel('tcg', lang)], ['both', tcgLabel('both', lang)]]
  return (
    <div style={{ ...row, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div style={{ minWidth: 0, flex: '1 1 220px' }}>
        <div style={rowLabel}>{tcgLabel('focus', lang)}</div>
        <div style={rowSub}>{tcgLabel('focusSub', lang)}</div>
        {msg && <div style={{ ...rowSub, color: '#c0392b' }}>{msg}</div>}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {opts.map(([id, label]) => (
          <button key={id} type="button" onClick={() => save(id)} aria-pressed={focus === id}
            style={{ padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 13,
              background: focus === id ? '#003DA6' : '#f0f0f0', color: focus === id ? '#fff' : '#333' }}>{label}</button>
        ))}
      </div>
    </div>
  )
}

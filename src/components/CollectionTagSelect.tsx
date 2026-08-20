'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'

interface Props {
  userId: string
  value: string
  onChange: (tag: string) => void
  style?: React.CSSProperties
}

export default function CollectionTagSelect({ userId, value, onChange, style }: Props) {
  const { dark } = useTheme()
  const [tags, setTags] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const [newTag, setNewTag] = useState('')

  useEffect(() => {
    const load = async () => {
      const [{ data: manuelles }, { data: csvTags }, { data: colls }, { data: settings }] = await Promise.all([
        supabase.from('cartes_manuelles').select('collection_tag').eq('user_id', userId).not('collection_tag', 'is', null),
        supabase.from('carte_tags').select('collection_tag').eq('user_id', userId),
        supabase.from('card_collections').select('collection').eq('user_id', userId),
        // collection_tab_settings n'est liée à aucune carte (clé (user_id, tag) seule)
        // — seule source qui garde trace d'une collection fraîchement créée mais encore
        // vide (aucune carte ne lui a été rattachée), voir la persistance dans "+ Nouvelle"
        // ci-dessous.
        supabase.from('collection_tab_settings').select('tag').eq('user_id', userId),
      ])
      const all = [
        ...((manuelles || []).map((r: any) => r.collection_tag)),
        ...((csvTags || []).map((r: any) => r.collection_tag)),
        ...((colls || []).map((r: any) => r.collection)),
        ...((settings || []).map((r: any) => r.tag)),
      ].filter(Boolean)
      setTags([...new Set(all)].sort())
    }
    load()
  }, [userId])

  // "+ Nouvelle" ne devait persister le nom de la collection nulle part avant que la
  // carte en cours de saisie soit effectivement enregistrée (juste un état React local
  // + le champ collection_tag du formulaire) — si l'utilisateur abandonnait cette carte
  // (validation bloquante, avertissement doublon ignoré, navigation ailleurs...), la
  // collection "créée" disparaissait purement et simplement, jamais écrite en base.
  // collection_tab_settings ne requiert pas de carte (clé (user_id, tag) seule) : on y
  // enregistre la collection tout de suite, indépendamment du sort de la carte.
  const persistNewTag = async (tag: string) => {
    await supabase.from('collection_tab_settings')
      .upsert({ user_id: userId, tag, color: '#003DA6', position: 999 }, { onConflict: 'user_id,tag', ignoreDuplicates: true })
  }

  const borderColor = dark ? '#444' : '#ddd'
  const bg = dark ? '#2a2a2a' : 'white'
  const textColor = dark ? '#fff' : '#111'

  if (creating) {
    return (
      <div style={{ display: 'flex', gap: 6, ...style }}>
        <input
          autoFocus
          value={newTag}
          onChange={e => setNewTag(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && newTag.trim()) {
              const tag = newTag.trim()
              onChange(tag)
              setTags(prev => [...new Set([...prev, tag])].sort())
              setCreating(false)
              setNewTag('')
              persistNewTag(tag)
            }
            if (e.key === 'Escape') { setCreating(false); setNewTag('') }
          }}
          placeholder="Nom de la collection…"
          style={{ flex: 1, background: bg, color: textColor, borderColor }}
        />
        <button
          type="button"
          onClick={() => {
            if (newTag.trim()) {
              const tag = newTag.trim()
              onChange(tag)
              setTags(prev => [...new Set([...prev, tag])].sort())
              persistNewTag(tag)
            }
            setCreating(false)
            setNewTag('')
          }}
          style={{ background: '#003DA6', color: 'white', border: 'none', borderRadius: 8, padding: '0 14px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
        >
          OK
        </button>
        <button
          type="button"
          onClick={() => { setCreating(false); setNewTag('') }}
          style={{ background: dark ? '#333' : '#f0f0f0', color: textColor, border: 'none', borderRadius: 8, padding: '0 10px', cursor: 'pointer', fontSize: 13 }}
        >
          ✕
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 6, ...style }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ flex: 1, background: bg, color: textColor, borderColor, borderRadius: 8, padding: '8px 10px', border: `1px solid ${borderColor}`, fontSize: 13 }}
      >
        <option value="">— Aucune collection —</option>
        {tags.map(tag => (
          <option key={tag} value={tag}>{tag}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => setCreating(true)}
        style={{ background: dark ? '#333' : '#f0f0f0', color: dark ? '#ddd' : '#555', border: `1px solid ${borderColor}`, borderRadius: 8, padding: '0 12px', fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}
      >
        + Nouvelle
      </button>
    </div>
  )
}

'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'

interface Props {
  userId: string
  cardKey: string            // image_recto de la carte
  value: string[]            // collections actuelles de la carte
  allTags: string[]          // toutes les collections connues (pour proposer)
  onChange: (next: string[]) => void
}

// Éditeur d'appartenance multi-collections d'une carte. Écrit directement dans
// card_collections (une ligne par appartenance) et remonte la nouvelle liste.
export default function CollectionMultiSelect({ userId, cardKey, value, allTags, onChange }: Props) {
  const { dark } = useTheme()
  const [busy, setBusy] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newTag, setNewTag] = useState('')

  const border = dark ? '#444' : '#ddd'
  const textColor = dark ? '#eee' : '#333'

  const toggle = async (tag: string) => {
    if (busy || !tag) return
    setBusy(true)
    const has = value.includes(tag)
    try {
      if (has) {
        await supabase.from('card_collections').delete()
          .eq('user_id', userId).eq('card_key', cardKey).eq('collection', tag)
        onChange(value.filter(t => t !== tag))
      } else {
        await supabase.from('card_collections')
          .upsert({ user_id: userId, card_key: cardKey, collection: tag }, { onConflict: 'user_id,card_key,collection' })
        onChange([...value, tag])
      }
    } finally { setBusy(false) }
  }

  const addNew = async () => {
    const tag = newTag.trim()
    setNewTag(''); setCreating(false)
    if (tag && !value.includes(tag)) await toggle(tag)
  }

  const options = [...new Set([...allTags, ...value])].sort((a, b) => a.localeCompare(b))

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
      {options.map(tag => {
        const active = value.includes(tag)
        return (
          <button key={tag} type="button" onClick={() => toggle(tag)} disabled={busy}
            style={{
              padding: '5px 11px', borderRadius: 16, fontSize: 12, fontWeight: 700, cursor: busy ? 'wait' : 'pointer',
              border: active ? '1.5px solid #003DA6' : `1.5px solid ${border}`,
              background: active ? '#003DA6' : 'transparent',
              color: active ? '#fff' : textColor,
            }}>
            {active ? '✓ ' : ''}{tag}
          </button>
        )
      })}
      {creating ? (
        <input autoFocus value={newTag}
          onChange={e => setNewTag(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addNew(); if (e.key === 'Escape') { setCreating(false); setNewTag('') } }}
          onBlur={addNew}
          placeholder="Nom…"
          style={{ padding: '5px 10px', borderRadius: 16, fontSize: 12, border: `1.5px solid ${border}`, background: dark ? '#2a2a2a' : 'white', color: textColor, outline: 'none', width: 120 }} />
      ) : (
        <button type="button" onClick={() => setCreating(true)}
          style={{ padding: '5px 11px', borderRadius: 16, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: `1.5px dashed ${border}`, background: 'transparent', color: dark ? '#aaa' : '#777' }}>
          + Nouvelle
        </button>
      )}
    </div>
  )
}

'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// 897 · @mentions : quand on tape « @Lu » dans un commentaire, une liste propose les membres ; choisir un membre insère « @Pseudo ».
// Le membre mentionné reçoit une notification (voir /api/mention-notify).
export const MENTION_RE = /@([\p{L}\p{N}_.-]{2,30})/gu
export const mentionTokenOf = (displayName: string) => displayName.trim().replace(/\s+/g, '_')

/** Texte d'un commentaire avec les @pseudo mis en valeur. */
export function renderWithMentions(text: string, accent: string): React.ReactNode[] {
  const out: React.ReactNode[] = []
  let last = 0, k = 0
  for (const m of text.matchAll(MENTION_RE)) {
    const at = m.index ?? 0
    if (at > last) out.push(text.slice(last, at))
    out.push(<b key={k++} style={{ color: accent }}>{m[0]}</b>)
    last = at + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

interface Sugg { id: string; display_name: string; avatar_url: string | null }

export default function MentionSuggest({ value, caret, onPick, dark, border }: { value: string; caret: number; onPick: (next: string, caretAt: number) => void; dark: boolean; border: string }) {
  const [list, setList] = useState<Sugg[]>([])
  const before = value.slice(0, caret)
  const m = before.match(/(?:^|\s)@([\p{L}\p{N}_.-]{0,30})$/u)
  const q = m ? m[1] : null

  useEffect(() => {
    if (q === null || q.length < 1) { setList([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('profiles').select('id, display_name, avatar_url').ilike('display_name', q.replace(/[%_,()]/g, ' ') + '%').limit(6)
      setList((data || []) as Sugg[])
    }, 200)
    return () => clearTimeout(t)
  }, [q])

  if (q === null || !list.length) return null
  const pick = (s: Sugg) => {
    const start = before.length - q.length - 1            // position du « @ »
    const ins = '@' + mentionTokenOf(s.display_name) + ' '
    onPick(value.slice(0, start) + ins + value.slice(caret), start + ins.length)
  }
  return (
    <div role="listbox" style={{ position: 'absolute', zIndex: 20, left: 0, right: 0, top: '100%', marginTop: 2, background: dark ? '#222' : '#fff', border: '1px solid ' + border, boxShadow: '0 8px 22px rgba(0,0,0,.2)', maxHeight: 220, overflowY: 'auto' }}>
      {list.map(s => (
        <button key={s.id} type="button" role="option" aria-selected={false} onMouseDown={e => { e.preventDefault(); pick(s) }}
          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 10px', border: 0, background: 'none', color: 'inherit', cursor: 'pointer', textAlign: 'left', fontSize: 14 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {s.avatar_url ? <img src={s.avatar_url} alt="" style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }} /> : <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#2f6bff', display: 'inline-block' }} />}
          <span style={{ fontWeight: 700 }}>{s.display_name}</span>
        </button>
      ))}
    </div>
  )
}

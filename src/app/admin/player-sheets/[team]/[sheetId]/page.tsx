'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { SPORTS_TEAMS, teamLogoUrl } from '@/lib/sportsTeams'
import { useTheme } from '@/lib/ThemeContext'
import Card3DInline from '@/components/Card3DInline'
import type { CardSearchResult } from '@/app/api/admin/player-sheets-card-search/route'

interface Sheet {
  id: string; player_name: string
  card_id: string | null
  card_image_recto: string | null; card_image_recto_hd: string | null
  card_image_verso: string | null; card_image_verso_hd: string | null
  card_is_horizontal: boolean
  stat_saison: string | null; stat_poste: string | null; stat_country: string | null; stat_age: string | null
  stat_matches: string | null; stat_minutes: string | null
  stat_points: string | null; stat_rebonds: string | null; stat_passes: string | null; stat_autres: string | null
  notes: string | null
}

// Token capturé une fois expire au bout d'1h -- toujours en récupérer un
// frais avant d'écrire (même piège que admin/live-quiz).
async function freshToken(): Promise<string | null> {
  return (await supabase.auth.getSession()).data.session?.access_token ?? null
}

// Code ISO 3166-1 alpha-2 -> emoji drapeau (paire de symboles indicateurs
// régionaux), même technique que admin/stats.
function countryFlag(code: string | null | undefined): string | null {
  const c = (code || '').trim().toUpperCase()
  if (c.length !== 2) return null
  return [...c].map(ch => String.fromCodePoint(ch.charCodeAt(0) + 127397)).join('')
}

export default function PlayerSheetEditorPage() {
  const { team: teamAbbr, sheetId } = useParams<{ team: string; sheetId: string }>()
  const router = useRouter()
  const { dark } = useTheme()
  const team = SPORTS_TEAMS.find(t => t.sport === 'nba' && t.abbr === teamAbbr)

  const [ready, setReady] = useState(false)
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerQuery, setPickerQuery] = useState('')
  const [pickerResults, setPickerResults] = useState<CardSearchResult[]>([])
  const [pickerLoading, setPickerLoading] = useState(false)
  const pickerTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/connexion'); return }
      const { data: p } = await supabase.from('profiles').select('is_admin').eq('id', session.user.id).single()
      if (!p?.is_admin) { router.replace('/'); return }
      const { data } = await supabase.from('player_sheets').select('*').eq('id', sheetId).single()
      if (!data) { router.replace(`/admin/player-sheets/${teamAbbr}`); return }
      setSheet(data)
      setReady(true)
    })
  }, [sheetId])

  const patch = (fields: Partial<Sheet>) => setSheet(s => s ? { ...s, ...fields } : s)

  const save = async () => {
    if (!sheet) return
    setSaving(true)
    const { id, ...rest } = sheet
    await supabase.from('player_sheets').update({ ...rest, updated_at: new Date().toISOString() }).eq('id', id)
    setSaving(false)
    setSavedAt(Date.now())
  }

  const openPicker = () => { setPickerOpen(true); setPickerQuery(''); setPickerResults([]) }

  useEffect(() => {
    if (!pickerOpen) return
    if (pickerTimer.current) clearTimeout(pickerTimer.current)
    const q = pickerQuery.trim()
    if (q.length < 2) { setPickerResults([]); setPickerLoading(false); return }
    setPickerLoading(true)
    pickerTimer.current = setTimeout(async () => {
      const tok = await freshToken()
      if (!tok) { setPickerLoading(false); return }
      const res = await fetch(`/api/admin/player-sheets-card-search?q=${encodeURIComponent(q)}`, {
        headers: { Authorization: `Bearer ${tok}` },
      })
      const json = await res.json().catch(() => ({ results: [] }))
      setPickerResults(json.results || [])
      setPickerLoading(false)
    }, 350)
  }, [pickerQuery, pickerOpen])

  const pickCard = (c: CardSearchResult) => {
    patch({
      card_id: c.manuelle_id,
      card_image_recto: c.image_recto, card_image_recto_hd: c.image_recto_hd || c.image_recto,
      card_image_verso: c.image_verso, card_image_verso_hd: c.image_verso_hd || c.image_verso,
      card_is_horizontal: c.is_horizontal,
    })
    setPickerOpen(false)
  }

  if (!ready || !sheet) return <div style={{ padding: 40, textAlign: 'center' }}>Chargement...</div>
  if (!team) return <div style={{ padding: 40, textAlign: 'center' }}>Équipe inconnue.</div>

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${dark ? '#333' : '#ddd'}`,
    background: dark ? '#1a1a1a' : '#fff', color: 'inherit', fontSize: 14, boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = { fontSize: 11.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, color: '#888', marginBottom: 5, display: 'block' }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 4px' }}>
      <Link href={`/admin/player-sheets/${teamAbbr}`} style={{ fontSize: 13, color: '#888', textDecoration: 'none' }}>← {team.name}</Link>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, margin: '10px 0 20px',
        padding: '14px 18px', borderRadius: 14, background: team.color, color: '#fff',
      }}>
        <img src={teamLogoUrl(team)} alt="" style={{ width: 36, height: 36, objectFit: 'contain' }} />
        {countryFlag(sheet.stat_country) && <span style={{ fontSize: 22 }}>{countryFlag(sheet.stat_country)}</span>}
        <input
          value={sheet.player_name}
          onChange={e => patch({ player_name: e.target.value })}
          style={{
            flex: 1, background: 'transparent', border: 'none', color: '#fff', fontWeight: 900, fontSize: 22,
            outline: 'none',
          }}
        />
        {sheet.card_image_recto && (
          <Link href={`/admin/player-sheets/${teamAbbr}/${sheetId}/presenter`} target="_blank" style={{
            padding: '9px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.6)', background: 'transparent',
            color: '#fff', fontWeight: 800, fontSize: 13.5, textDecoration: 'none', whiteSpace: 'nowrap',
          }}>
            🎬 Présentation
          </Link>
        )}
        <button onClick={save} disabled={saving} style={{
          padding: '9px 18px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.9)',
          color: team.color, fontWeight: 800, fontSize: 13.5, cursor: 'pointer',
        }}>
          {saving ? 'Sauvegarde...' : savedAt ? '✓ Sauvegardé' : 'Sauvegarder'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) minmax(280px, 1fr)', gap: 28 }}>
        {/* Gauche : carte 3D */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, paddingTop: 10 }}>
          {sheet.card_image_recto ? (
            <Card3DInline
              front={sheet.card_image_recto_hd || sheet.card_image_recto}
              back={sheet.card_image_verso_hd || sheet.card_image_verso || undefined}
              isHorizontal={sheet.card_is_horizontal}
              accent={team.color}
            />
          ) : (
            <div style={{
              width: 'min(70vw, 340px)', aspectRatio: '2.5 / 3.5', borderRadius: 10,
              border: `2px dashed ${dark ? '#333' : '#ddd'}`, display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: '#888', fontSize: 13.5, textAlign: 'center', padding: 20,
            }}>
              Aucune carte choisie
            </div>
          )}
          <button onClick={openPicker} style={{
            padding: '9px 18px', borderRadius: 20, border: `1px solid ${team.color}`, background: 'transparent',
            color: team.color, fontWeight: 800, fontSize: 13.5, cursor: 'pointer',
          }}>
            {sheet.card_image_recto ? '↻ Changer de carte' : '+ Choisir une carte'}
          </button>
        </div>

        {/* Droite : stats + notes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><span style={labelStyle}>Expérience</span><input style={inputStyle} value={sheet.stat_saison || ''} onChange={e => patch({ stat_saison: e.target.value })} placeholder="8e saison NBA" /></div>
            <div><span style={labelStyle}>Poste</span><input style={inputStyle} value={sheet.stat_poste || ''} onChange={e => patch({ stat_poste: e.target.value })} placeholder="Meneur" /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <span style={labelStyle}>Pays</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {countryFlag(sheet.stat_country) && <span style={{ fontSize: 20 }}>{countryFlag(sheet.stat_country)}</span>}
                <input
                  style={inputStyle} value={sheet.stat_country || ''} maxLength={2}
                  onChange={e => patch({ stat_country: e.target.value.toUpperCase() })}
                  placeholder="US, FR, CA..."
                />
              </div>
            </div>
            <div><span style={labelStyle}>Âge</span><input style={inputStyle} value={sheet.stat_age || ''} onChange={e => patch({ stat_age: e.target.value })} placeholder="27 ans" /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><span style={labelStyle}>Matchs joués</span><input style={inputStyle} value={sheet.stat_matches || ''} onChange={e => patch({ stat_matches: e.target.value })} placeholder="62" /></div>
            <div><span style={labelStyle}>Minutes / match</span><input style={inputStyle} value={sheet.stat_minutes || ''} onChange={e => patch({ stat_minutes: e.target.value })} placeholder="31.5" /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div><span style={labelStyle}>Points</span><input style={inputStyle} value={sheet.stat_points || ''} onChange={e => patch({ stat_points: e.target.value })} placeholder="24.3" /></div>
            <div><span style={labelStyle}>Rebonds</span><input style={inputStyle} value={sheet.stat_rebonds || ''} onChange={e => patch({ stat_rebonds: e.target.value })} placeholder="5.1" /></div>
            <div><span style={labelStyle}>Passes</span><input style={inputStyle} value={sheet.stat_passes || ''} onChange={e => patch({ stat_passes: e.target.value })} placeholder="7.8" /></div>
          </div>
          <div><span style={labelStyle}>Autres stats</span><input style={inputStyle} value={sheet.stat_autres || ''} onChange={e => patch({ stat_autres: e.target.value })} placeholder="3pts: 38% · Contres: 0.4" /></div>
          <div>
            <span style={labelStyle}>Notes / infos libres</span>
            <textarea
              value={sheet.notes || ''} onChange={e => patch({ notes: e.target.value })}
              rows={8} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
              placeholder="Anecdotes, transferts, contexte pour l'émission..."
            />
          </div>
        </div>
      </div>

      {pickerOpen && (
        <div onClick={() => setPickerOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: '100%', maxWidth: 700, maxHeight: '82vh', overflow: 'auto', borderRadius: 16,
            background: dark ? '#1a1a1a' : '#fff', padding: 18,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontWeight: 900, fontSize: 17 }}>Choisir une carte</div>
              <button onClick={() => setPickerOpen(false)} style={{ border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer', color: 'inherit' }}>✕</button>
            </div>
            <input
              autoFocus value={pickerQuery} onChange={e => setPickerQuery(e.target.value)}
              placeholder="Rechercher dans toutes les cartes du site (2 lettres min.)..." style={{ ...inputStyle, marginBottom: 14 }}
            />
            {pickerQuery.trim().length < 2 ? (
              <div style={{ textAlign: 'center', padding: 30, color: '#888', fontSize: 13.5 }}>Tape un nom de joueur, d'équipe ou de marque...</div>
            ) : pickerLoading ? (
              <div style={{ textAlign: 'center', padding: 30, color: '#888' }}>Recherche...</div>
            ) : pickerResults.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: '#888' }}>Aucune carte trouvée.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10 }}>
                {pickerResults.map(c => (
                  <button key={c.key} onClick={() => pickCard(c)} style={{
                    padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left',
                  }}>
                    <div style={{
                      aspectRatio: c.is_horizontal ? '5 / 3.5' : '2.5 / 3.5', borderRadius: 8, overflow: 'hidden',
                      border: `1px solid ${dark ? '#333' : '#eee'}`, marginBottom: 4, background: dark ? '#111' : '#f5f5f5',
                    }}>
                      <img src={c.image_recto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: dark ? '#ddd' : '#333', lineHeight: 1.25 }}>{c.label}</div>
                    <div style={{ fontSize: 10, color: '#999', lineHeight: 1.25 }}>{c.sub}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

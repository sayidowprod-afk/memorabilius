'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'
import { toast } from '@/lib/toast'
import { uploadGuideImage } from '@/lib/guideUpload'
import { sportEmoji } from '@/lib/sportEmoji'
import type { GuideBlock, PyramidRow, InsertCard, OddsTable } from '@/lib/guideBlockTypes'
import PyramidBlock, { rowBackground } from '@/components/guide-blocks/PyramidBlock'
import InsertGridBlock from '@/components/guide-blocks/InsertGridBlock'
import GuideEditor from '@/components/GuideEditor'

interface Props {
  blocks: GuideBlock[]
  onChange: (blocks: GuideBlock[]) => void
}

// Éditeur admin des blocs riches additionnels d'un guide (pyramide de variations,
// grille d'inserts + odds, setlist embarquée) — s'ajoutent après le texte Tiptap,
// jamais entremêlés dedans. Voir src/lib/guideBlockTypes.ts pour les formes de données
// et src/app/guides/[slug]/page.tsx + src/components/guide-blocks/* pour le rendu public.
export default function GuideBlocksEditor({ blocks, onChange }: Props) {
  const { dark } = useTheme()
  const border = dark ? '#2a2a2a' : '#eee'
  const text = dark ? '#e0e0e0' : '#222'
  const sub = dark ? '#999' : '#666'
  const cardBg = dark ? '#1a1a1a' : '#fafafa'

  const updateAt = (i: number, b: GuideBlock) => onChange(blocks.map((x, idx) => (idx === i ? b : x)))
  const removeAt = (i: number) => onChange(blocks.filter((_, idx) => idx !== i))
  const duplicateAt = (i: number) => {
    const copy = JSON.parse(JSON.stringify(blocks[i])) as GuideBlock
    onChange([...blocks.slice(0, i + 1), copy, ...blocks.slice(i + 1)])
  }
  const moveAt = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= blocks.length) return
    const next = [...blocks]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  const addBtnStyle: React.CSSProperties = {
    padding: '9px 14px', borderRadius: 8, border: `1.5px solid #003DA6`, background: dark ? '#1a1a1a' : 'white',
    color: '#003DA6', fontWeight: 700, fontSize: 13, cursor: 'pointer',
  }
  const smallBtn: React.CSSProperties = {
    padding: '5px 9px', borderRadius: 6, border: `1px solid ${border}`, background: cardBg, color: text,
    fontWeight: 700, fontSize: 12, cursor: 'pointer',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {blocks.map((b, i) => (
        <div key={i} style={{ border: `1px solid ${border}`, borderRadius: 10, padding: 14, background: cardBg }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: sub, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              {BLOCK_LABELS[b.type]}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" style={smallBtn} disabled={i === 0} onClick={() => moveAt(i, -1)}>↑</button>
              <button type="button" style={smallBtn} disabled={i === blocks.length - 1} onClick={() => moveAt(i, 1)}>↓</button>
              <button type="button" style={smallBtn} onClick={() => duplicateAt(i)} title="Dupliquer ce bloc">⧉ Dupliquer</button>
              <button type="button" style={{ ...smallBtn, color: '#e74c3c', borderColor: '#e74c3c' }} onClick={() => removeAt(i)}>Supprimer</button>
            </div>
          </div>

          {b.type === 'text' && <TextEditor block={b} onChange={nb => updateAt(i, nb)} />}
          {b.type === 'image' && <ImageEditor block={b} onChange={nb => updateAt(i, nb)} dark={dark} />}
          {b.type === 'text_image' && <TextImageEditor block={b} onChange={nb => updateAt(i, nb)} dark={dark} />}
          {b.type === 'pyramid' && <PyramidEditor block={b} onChange={nb => updateAt(i, nb)} dark={dark} />}
          {b.type === 'insert_grid' && <InsertGridEditor block={b} onChange={nb => updateAt(i, nb)} dark={dark} />}
          {b.type === 'setlist_embed' && <SetlistEmbedEditor block={b} onChange={nb => updateAt(i, nb)} dark={dark} />}
        </div>
      ))}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" style={addBtnStyle} onClick={() => onChange([...blocks, { type: 'text', html: '' }])}>+ Texte</button>
        <button type="button" style={addBtnStyle} onClick={() => onChange([...blocks, { type: 'image', src: '', caption: '' }])}>+ Image</button>
        <button type="button" style={addBtnStyle} onClick={() => onChange([...blocks, { type: 'text_image', html: '', image: '', imagePosition: 'left' }])}>+ Texte + image</button>
        <button type="button" style={addBtnStyle} onClick={() => onChange([...blocks, { type: 'pyramid', rows: [] }])}>+ Pyramide</button>
        <button type="button" style={addBtnStyle} onClick={() => onChange([...blocks, { type: 'insert_grid', cards: [], oddsTable: { columns: [], rows: [] }, players: [] }])}>+ Grille inserts</button>
        <button type="button" style={addBtnStyle} onClick={() => onChange([...blocks, { type: 'setlist_embed', setId: 0 }])}>+ Setlist</button>
      </div>
    </div>
  )
}

const BLOCK_LABELS: Record<GuideBlock['type'], string> = {
  text: '📝 Texte',
  image: '🖼️ Image',
  text_image: '📰 Texte + image',
  pyramid: '🔺 Pyramide de variations',
  insert_grid: '🎴 Grille inserts',
  setlist_embed: '📋 Setlist embarquée',
}

function fieldStyle(dark: boolean): React.CSSProperties {
  return {
    padding: '7px 10px', borderRadius: 6, border: `1px solid ${dark ? '#333' : '#ddd'}`,
    background: dark ? '#2a2a2a' : 'white', color: dark ? '#e0e0e0' : '#222', fontSize: 13,
  }
}

// --- Texte --------------------------------------------------------------------

function TextEditor({ block, onChange }: { block: Extract<GuideBlock, { type: 'text' }>; onChange: (b: GuideBlock) => void }) {
  return <GuideEditor content={block.html} onChange={html => onChange({ ...block, html })} />
}

// --- Image seule ----------------------------------------------------------------

function ImageEditor({ block, onChange, dark }: { block: Extract<GuideBlock, { type: 'image' }>; onChange: (b: GuideBlock) => void; dark: boolean }) {
  const [uploading, setUploading] = useState(false)
  const f = fieldStyle(dark)

  const upload = async (file: File) => {
    setUploading(true)
    const url = await uploadGuideImage(file, 'blocks/')
    setUploading(false)
    if (url) onChange({ ...block, src: url })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {block.src && <img src={block.src} alt="" style={{ maxWidth: 320, borderRadius: 8, display: 'block' }} />}
      <label style={{ ...f, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
        {uploading ? '...' : block.src ? 'Changer l\'image' : 'Choisir une image'}
        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const file = e.target.files?.[0]; if (file) upload(file) }} />
      </label>
      <input style={f} placeholder="Légende (optionnelle)" value={block.caption || ''} onChange={e => onChange({ ...block, caption: e.target.value })} />
    </div>
  )
}

// --- Texte + image côte à côte --------------------------------------------------

function TextImageEditor({ block, onChange, dark }: { block: Extract<GuideBlock, { type: 'text_image' }>; onChange: (b: GuideBlock) => void; dark: boolean }) {
  const [uploading, setUploading] = useState(false)
  const f = fieldStyle(dark)

  const upload = async (file: File) => {
    setUploading(true)
    const url = await uploadGuideImage(file, 'blocks/')
    setUploading(false)
    if (url) onChange({ ...block, image: url })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {block.image && <img src={block.image} alt="" style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 6 }} />}
        <label style={{ ...f, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {uploading ? '...' : block.image ? 'Changer l\'image' : 'Choisir une image'}
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const file = e.target.files?.[0]; if (file) upload(file) }} />
        </label>
        <select style={f} value={block.imagePosition} onChange={e => onChange({ ...block, imagePosition: e.target.value as 'left' | 'right' })}>
          <option value="left">Image à gauche</option>
          <option value="right">Image à droite</option>
        </select>
      </div>
      <GuideEditor content={block.html} onChange={html => onChange({ ...block, html })} />
    </div>
  )
}

// --- Pyramide ---------------------------------------------------------------

function PyramidEditor({ block, onChange, dark }: { block: Extract<GuideBlock, { type: 'pyramid' }>; onChange: (b: GuideBlock) => void; dark: boolean }) {
  const [uploading, setUploading] = useState<{ i: number; field: 'patternImage' | 'cardImage' } | null>(null)
  const [showTemplates, setShowTemplates] = useState(false)
  const f = fieldStyle(dark)

  const onSaveTemplate = async (rows: PyramidRow[]) => {
    const name = window.prompt('Nom du modèle (ex: "Refractor 2026")')
    if (!name || !name.trim()) return
    const { error } = await supabase.from('pyramid_templates').insert({ name: name.trim(), rows })
    if (error) toast.error(error.message)
    else toast.success('Modèle sauvegardé')
  }

  const updateRow = (i: number, patch: Partial<PyramidRow>) => {
    onChange({ ...block, rows: block.rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) })
  }
  const removeRow = (i: number) => onChange({ ...block, rows: block.rows.filter((_, idx) => idx !== i) })
  const addRow = () => onChange({ ...block, rows: [...block.rows, { name: '', printRun: '', patternImage: '', cardImage: '' }] })

  const uploadRowImage = async (i: number, field: 'patternImage' | 'cardImage', file: File) => {
    setUploading({ i, field })
    const url = await uploadGuideImage(file, 'pyramid/')
    setUploading(null)
    if (url) updateRow(i, { [field]: url } as Partial<PyramidRow>)
  }

  const imgBtn = (row: PyramidRow, i: number, field: 'patternImage' | 'cardImage', label: string) => (
    <label style={{ ...f, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
      {row[field] ? <img src={row[field]} alt="" style={{ width: 24, height: 24, objectFit: 'cover', borderRadius: 3 }} /> : null}
      {uploading?.i === i && uploading.field === field ? '...' : label}
      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const file = e.target.files?.[0]; if (file) uploadRowImage(i, field, file) }} />
    </label>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={{ fontSize: 11, color: dark ? '#888' : '#999', margin: '0 0 4px' }}>
        Ordre = de la plus rare (en haut) à la plus commune (en bas). "Motif" = texture de fond de la barre, "Carte" = exemple révélé au survol.
      </p>
      {block.rows.map((row, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 6, borderBottom: `1px solid ${dark ? '#2a2a2a' : '#eee'}` }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px auto auto auto', gap: 6, alignItems: 'center' }}>
            <input style={f} placeholder="Nom de la variation" value={row.name} onChange={e => updateRow(i, { name: e.target.value })} />
            <input style={f} placeholder="Print run" value={row.printRun} onChange={e => updateRow(i, { printRun: e.target.value })} />
            {imgBtn(row, i, 'patternImage', 'Motif')}
            {imgBtn(row, i, 'cardImage', 'Carte')}
            <button type="button" onClick={() => removeRow(i)} style={{ border: 'none', background: 'none', color: '#e74c3c', cursor: 'pointer', fontWeight: 700 }}>✕</button>
          </div>
          {row.patternImage && (
            <div style={{ display: 'grid', gridTemplateColumns: '52px 26px 1fr 100px 18px', gap: 6, alignItems: 'center', paddingLeft: 4 }}>
              <div className="pyramid-swatch" style={{
                width: 52, height: 52, borderRadius: 6, border: `1px solid ${dark ? '#333' : '#ddd'}`,
                cursor: 'zoom-in', position: 'relative', ...rowBackground(row, dark ? '#2a2a2a' : '#f0f0f0'),
              }}>
                <div className="pyramid-swatch-zoom" style={{ ...rowBackground(row, dark ? '#2a2a2a' : '#f0f0f0') }} />
              </div>
              <input type="color" value={row.patternColor || '#ffffff'} onChange={e => updateRow(i, { patternColor: e.target.value })}
                style={{ width: 26, height: 26, padding: 0, border: `1px solid ${dark ? '#333' : '#ddd'}`, borderRadius: 4, cursor: 'pointer' }} />
              <select value={row.patternBlendMode || 'multiply'} onChange={e => updateRow(i, { patternBlendMode: e.target.value as PyramidRow['patternBlendMode'] })} style={{ ...f, padding: '4px 6px', fontSize: 11 }}>
                <option value="normal">Normal</option>
                <option value="multiply">Multiply</option>
                <option value="screen">Screen</option>
                <option value="overlay">Overlay</option>
                <option value="darken">Darken</option>
                <option value="lighten">Lighten</option>
                <option value="color-dodge">Color dodge</option>
                <option value="color-burn">Color burn</option>
                <option value="hard-light">Hard light</option>
                <option value="soft-light">Soft light</option>
                <option value="difference">Difference</option>
                <option value="exclusion">Exclusion</option>
                <option value="hue">Hue</option>
                <option value="saturation">Saturation</option>
                <option value="color">Color</option>
                <option value="luminosity">Luminosity</option>
              </select>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input type="range" min={0} max={100} value={row.patternOpacity ?? 100}
                  onChange={e => updateRow(i, { patternOpacity: Number(e.target.value) })}
                  style={{ width: 52, cursor: 'pointer' }} />
                <span style={{ fontSize: 10, color: dark ? '#888' : '#999', minWidth: 26 }}>{row.patternOpacity ?? 100}%</span>
              </span>
              {row.patternColor ? (
                <button type="button" onClick={() => updateRow(i, { patternColor: undefined, patternOpacity: undefined })}
                  title="Retirer la teinte" style={{ border: 'none', background: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                  ✕
                </button>
              ) : <span />}
            </div>
          )}
        </div>
      ))}
      <button type="button" onClick={addRow} style={{ alignSelf: 'flex-start', ...f, cursor: 'pointer', fontWeight: 700 }}>+ Ajouter une ligne</button>

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button type="button" onClick={() => onSaveTemplate(block.rows)} disabled={block.rows.length === 0}
          style={{ ...f, cursor: block.rows.length ? 'pointer' : 'default', fontWeight: 700, opacity: block.rows.length ? 1 : 0.5 }}>
          💾 Sauvegarder comme modèle
        </button>
        <button type="button" onClick={() => setShowTemplates(v => !v)} style={{ ...f, cursor: 'pointer', fontWeight: 700 }}>
          📂 Charger un modèle
        </button>
      </div>
      {showTemplates && <PyramidTemplatePicker dark={dark} onPick={rows => { onChange({ ...block, rows }); setShowTemplates(false) }} onClose={() => setShowTemplates(false)} />}

      {block.rows.length > 0 && (
        <div style={{ marginTop: 10, padding: 14, borderRadius: 8, border: `1px dashed ${dark ? '#333' : '#ddd'}` }}>
          <p style={{ fontSize: 10, fontWeight: 800, color: dark ? '#888' : '#999', textTransform: 'uppercase', margin: '0 0 8px' }}>Aperçu</p>
          <PyramidBlock rows={block.rows} />
        </div>
      )}

      <style>{`
        .pyramid-swatch-zoom {
          position: absolute; top: 0; left: 100%; margin-left: 8px; width: 140px; height: 140px;
          border-radius: 8px; border: 2px solid #003DA6; box-shadow: 0 8px 24px rgba(0,0,0,0.4);
          opacity: 0; pointer-events: none; transform: scale(0.9); transform-origin: left center;
          transition: opacity 0.12s, transform 0.12s; z-index: 20;
        }
        .pyramid-swatch:hover .pyramid-swatch-zoom { opacity: 1; transform: scale(1); }
      `}</style>
    </div>
  )
}

interface PyramidTemplate { id: number; name: string; rows: PyramidRow[] }

function PyramidTemplatePicker({ dark, onPick, onClose }: { dark: boolean; onPick: (rows: PyramidRow[]) => void; onClose: () => void }) {
  const [templates, setTemplates] = useState<PyramidTemplate[] | null>(null)
  const f = fieldStyle(dark)

  useEffect(() => {
    supabase.from('pyramid_templates').select('id, name, rows').order('name').then(({ data }) => setTemplates(data || []))
  }, [])

  const remove = async (id: number) => {
    if (!confirm('Supprimer ce modèle ?')) return
    await supabase.from('pyramid_templates').delete().eq('id', id)
    setTemplates(prev => prev?.filter(t => t.id !== id) || [])
  }

  return (
    <div style={{ border: `1px solid ${dark ? '#333' : '#ddd'}`, borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {templates === null ? (
        <span style={{ fontSize: 12, color: dark ? '#888' : '#999' }}>Chargement...</span>
      ) : templates.length === 0 ? (
        <span style={{ fontSize: 12, color: dark ? '#888' : '#999' }}>Aucun modèle sauvegardé pour l'instant.</span>
      ) : (
        templates.map(t => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button type="button" onClick={() => onPick(t.rows)} style={{ ...f, flex: 1, textAlign: 'left', cursor: 'pointer' }}>
              {t.name} <span style={{ color: dark ? '#888' : '#999' }}>({t.rows.length} lignes)</span>
            </button>
            <button type="button" onClick={() => remove(t.id)} style={{ border: 'none', background: 'none', color: '#e74c3c', cursor: 'pointer', fontWeight: 700 }}>✕</button>
          </div>
        ))
      )}
      <button type="button" onClick={onClose} style={{ alignSelf: 'flex-start', border: 'none', background: 'none', color: dark ? '#888' : '#999', cursor: 'pointer', fontSize: 12 }}>Fermer</button>
    </div>
  )
}

// --- Grille inserts -----------------------------------------------------------

function InsertGridEditor({ block, onChange, dark }: { block: Extract<GuideBlock, { type: 'insert_grid' }>; onChange: (b: GuideBlock) => void; dark: boolean }) {
  const [uploading, setUploading] = useState<number | null>(null)
  const f = fieldStyle(dark)

  const updateCard = (i: number, patch: Partial<InsertCard>) => {
    onChange({ ...block, cards: block.cards.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) })
  }
  const removeCard = (i: number) => onChange({ ...block, cards: block.cards.filter((_, idx) => idx !== i) })
  const addCard = () => onChange({ ...block, cards: [...block.cards, { name: '', image: '', printRun: '' }] })

  const uploadCardImage = async (i: number, file: File) => {
    setUploading(i)
    const url = await uploadGuideImage(file, 'inserts/')
    setUploading(null)
    if (url) updateCard(i, { image: url })
  }

  const table = block.oddsTable

  const setTable = (t: OddsTable) => onChange({ ...block, oddsTable: t })

  const addColumn = () => {
    const columns = [...table.columns, '']
    const rows = table.rows.map(r => ({ ...r, values: [...r.values, ''] }))
    setTable({ columns, rows })
  }
  const renameColumn = (ci: number, name: string) => {
    setTable({ ...table, columns: table.columns.map((c, idx) => (idx === ci ? name : c)) })
  }
  const removeColumn = (ci: number) => {
    setTable({
      columns: table.columns.filter((_, idx) => idx !== ci),
      rows: table.rows.map(r => ({ ...r, values: r.values.filter((_, idx) => idx !== ci) })),
    })
  }
  const addRow = () => setTable({ ...table, rows: [...table.rows, { label: '', values: table.columns.map(() => '') }] })
  const updateRowLabel = (ri: number, label: string) => {
    setTable({ ...table, rows: table.rows.map((r, idx) => (idx === ri ? { ...r, label } : r)) })
  }
  const updateCell = (ri: number, ci: number, value: string) => {
    setTable({ ...table, rows: table.rows.map((r, idx) => (idx === ri ? { ...r, values: r.values.map((v, cidx) => (cidx === ci ? value : v)) } : r)) })
  }
  const removeRow = (ri: number) => setTable({ ...table, rows: table.rows.filter((_, idx) => idx !== ri) })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <p style={{ fontSize: 11, fontWeight: 800, color: dark ? '#888' : '#999', margin: '0 0 6px', textTransform: 'uppercase' }}>Largeur</p>
        <select value={block.width || 'full'} onChange={e => onChange({ ...block, width: e.target.value as 'full' | 'half' | 'third' })} style={f}>
          <option value="full">Pleine largeur</option>
          <option value="half">Moitié (2 côte à côte)</option>
          <option value="third">Tiers (3 côte à côte)</option>
        </select>
        <p style={{ fontSize: 10, color: dark ? '#888' : '#999', margin: '4px 0 0' }}>
          Les blocs "grille inserts" en moitié/tiers consécutifs se placent automatiquement côte à côte à l'affichage.
        </p>
      </div>
      <div>
        <p style={{ fontSize: 11, fontWeight: 800, color: dark ? '#888' : '#999', margin: '0 0 6px', textTransform: 'uppercase' }}>Cartes</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {block.cards.map((card, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 6, alignItems: 'center' }}>
              <input style={f} placeholder="Nom" value={card.name} onChange={e => updateCard(i, { name: e.target.value })} />
              <input style={f} placeholder="Print run (optionnel)" value={card.printRun || ''} onChange={e => updateCard(i, { printRun: e.target.value })} />
              <label style={{ ...f, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                {card.image ? <img src={card.image} alt="" style={{ width: 24, height: 34, objectFit: 'cover', borderRadius: 3 }} /> : (uploading === i ? '...' : 'Image')}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const file = e.target.files?.[0]; if (file) uploadCardImage(i, file) }} />
              </label>
              <button type="button" onClick={() => removeCard(i)} style={{ border: 'none', background: 'none', color: '#e74c3c', cursor: 'pointer', fontWeight: 700 }}>✕</button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addCard} style={{ marginTop: 6, ...f, cursor: 'pointer', fontWeight: 700 }}>+ Ajouter une carte</button>
      </div>

      <div>
        <p style={{ fontSize: 11, fontWeight: 800, color: dark ? '#888' : '#999', margin: '0 0 6px', textTransform: 'uppercase' }}>
          Tableau odds (colonnes = ex. Holo/Platinum, lignes = ex. Hobby/Jumbo/Value)
        </p>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {table.columns.map((col, ci) => (
            <div key={ci} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input style={{ ...f, width: 110 }} placeholder="Colonne" value={col} onChange={e => renameColumn(ci, e.target.value)} />
              <button type="button" onClick={() => removeColumn(ci)} style={{ border: 'none', background: 'none', color: '#e74c3c', cursor: 'pointer', fontWeight: 700 }}>✕</button>
            </div>
          ))}
          <button type="button" onClick={addColumn} style={{ ...f, cursor: 'pointer', fontWeight: 700 }}>+ Colonne</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {table.rows.map((row, ri) => (
            <div key={ri} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <input style={{ ...f, width: 110 }} placeholder="Ligne (ex: Hobby)" value={row.label} onChange={e => updateRowLabel(ri, e.target.value)} />
              {table.columns.map((_, ci) => (
                <input key={ci} style={{ ...f, width: 90 }} placeholder="Valeur" value={row.values[ci] || ''} onChange={e => updateCell(ri, ci, e.target.value)} />
              ))}
              <button type="button" onClick={() => removeRow(ri)} style={{ border: 'none', background: 'none', color: '#e74c3c', cursor: 'pointer', fontWeight: 700 }}>✕</button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addRow} style={{ marginTop: 6, ...f, cursor: 'pointer', fontWeight: 700 }}>+ Ajouter une ligne</button>
      </div>

      <div>
        <p style={{ fontSize: 11, fontWeight: 800, color: dark ? '#888' : '#999', margin: '0 0 6px', textTransform: 'uppercase' }}>Joueurs présents (un par ligne)</p>
        <textarea
          style={{ ...f, width: '100%', minHeight: 100, resize: 'vertical', boxSizing: 'border-box' }}
          placeholder={'Nikola Jokić\nLuka Dončić\n...'}
          value={block.players.join('\n')}
          onChange={e => onChange({ ...block, players: e.target.value.split('\n') })}
          onBlur={e => onChange({ ...block, players: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) })}
        />
      </div>

      {(block.cards.length > 0 || table.rows.length > 0 || block.players.length > 0) && (
        <div style={{ padding: 14, borderRadius: 8, border: `1px dashed ${dark ? '#333' : '#ddd'}` }}>
          <p style={{ fontSize: 10, fontWeight: 800, color: dark ? '#888' : '#999', textTransform: 'uppercase', margin: '0 0 8px' }}>Aperçu</p>
          <InsertGridBlock cards={block.cards} oddsTable={table} players={block.players} />
        </div>
      )}
    </div>
  )
}

// --- Setlist embarquée --------------------------------------------------------

function SetlistEmbedEditor({ block, onChange, dark }: { block: Extract<GuideBlock, { type: 'setlist_embed' }>; onChange: (b: GuideBlock) => void; dark: boolean }) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<{ id: number; name: string; year: number | null; sport: string | null }[]>([])
  const [selectedName, setSelectedName] = useState('')
  const f = fieldStyle(dark)

  const runSearch = async (q: string) => {
    setSearch(q)
    if (q.trim().length < 2) { setResults([]); return }
    const { data } = await supabase.from('card_sets').select('id, name, year, sport').ilike('name', `%${q}%`).limit(10)
    setResults(data || [])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {block.setId > 0 && selectedName ? (
        <div style={{ ...f, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{selectedName}</span>
          <button type="button" onClick={() => { onChange({ ...block, setId: 0 }); setSelectedName('') }} style={{ border: 'none', background: 'none', color: '#e74c3c', cursor: 'pointer', fontWeight: 700 }}>✕</button>
        </div>
      ) : (
        <>
          <input style={f} placeholder="Rechercher un set (ex: 2024-25 Panini Mosaic)" value={search} onChange={e => runSearch(e.target.value)} />
          {results.length > 0 && (
            <div style={{ border: `1px solid ${dark ? '#333' : '#ddd'}`, borderRadius: 6, overflow: 'hidden' }}>
              {results.map(r => {
                const emoji = sportEmoji(r.sport)
                const label = `${emoji ? `${emoji} ` : ''}${r.name}${r.year ? ` (${r.year})` : ''}`
                return (
                  <button key={r.id} type="button" onClick={() => { onChange({ ...block, setId: r.id }); setSelectedName(label); setResults([]) }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', border: 'none', borderBottom: `1px solid ${dark ? '#333' : '#eee'}`, background: dark ? '#2a2a2a' : 'white', color: dark ? '#e0e0e0' : '#222', cursor: 'pointer', fontSize: 13 }}>
                    {label}
                  </button>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

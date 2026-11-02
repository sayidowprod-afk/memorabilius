'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { withTimeout } from '@/lib/withTimeout'
import EnvoisGradationView, { STATUTS, type CarteChoix, type Envoi, type EnvoiCarte, type EnvoiDraft, type Statut } from '@/components/EnvoisGradationView'

// Suivi des envois en gradation : lecture et écriture directes (chaque membre ne voit et ne modifie que ses lignes : RLS).
// Quand un envoi est retourné, « Reporter les notes » écrit la note et le n° de certificat sur les fiches de la collection.
type EnvoiRow = Omit<Envoi, 'cartes'>

export default function SuiviGradation() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [uid, setUid] = useState<string | null>(null)
  const [envois, setEnvois] = useState<Envoi[]>([])
  const [msg, setMsg] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const load = useCallback(async (u: string) => {
    const [{ data: e, error }, { data: c }] = await Promise.all([
      supabase.from('envois_gradation').select('*').eq('user_id', u).order('created_at', { ascending: false }).limit(300),
      supabase.from('envois_gradation_cartes').select('*').eq('user_id', u).order('created_at', { ascending: true }).limit(3000),
    ])
    if (error) { setMsg(/envois_gradation|schema cache|permission/.test(error.message) ? 'Migration 20261105 à appliquer dans Supabase.' : 'Chargement impossible.'); return }
    const byEnvoi = new Map<string, EnvoiCarte[]>()
    for (const k of (c as Array<EnvoiCarte & { envoi_id: string }>) || []) {
      const l = byEnvoi.get(k.envoi_id) || []
      l.push(k); byEnvoi.set(k.envoi_id, l)
    }
    setEnvois(((e as Array<EnvoiRow>) || []).map(x => ({ ...x, cartes: byEnvoi.get(x.id) || [] })))
  }, [])

  useEffect(() => {
    (async () => {
      try {
        await withTimeout((async () => {
          const { data: { session } } = await supabase.auth.getSession()
          if (!session) { router.replace('/connexion'); return }
          setUid(session.user.id)
          await load(session.user.id)
        })(), 15000, undefined)
      } finally { setLoading(false) }
    })()
  }, [router, load])
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(id) }, [])

  const dbErr = (m: string) => (/envois_gradation|schema cache/.test(m) ? 'Migration 20261105 à appliquer dans Supabase.' : 'Enregistrement impossible.')

  const onSave = async (d: EnvoiDraft): Promise<string | null> => {
    if (!uid) return 'Session expirée.'
    const fields = { societe: d.societe, reference: d.reference, service: d.service, statut: d.statut, date_envoi: d.date_envoi, date_reception: d.date_reception,
      date_retour_estimee: d.date_retour_estimee, date_retour: d.date_retour, cout_total: d.cout_total, suivi_aller: d.suivi_aller, suivi_retour: d.suivi_retour, notes: d.notes, updated_at: new Date().toISOString() }
    let envoiId = d.id
    if (envoiId) {
      const { error } = await supabase.from('envois_gradation').update(fields).eq('id', envoiId).eq('user_id', uid)
      if (error) return dbErr(error.message)
    } else {
      const { data, error } = await supabase.from('envois_gradation').insert({ ...fields, user_id: uid }).select('id').single()
      if (error || !data) return dbErr(error?.message || '')
      envoiId = data.id as string
    }
    // cartes : on retire celles supprimées, on met à jour les existantes, on ajoute les nouvelles
    const { data: before } = await supabase.from('envois_gradation_cartes').select('id').eq('envoi_id', envoiId).eq('user_id', uid)
    const keep = new Set(d.cartes.filter(c => !c.id.startsWith('new-')).map(c => c.id))
    const gone = ((before as Array<{ id: string }>) || []).map(b => b.id).filter(id => !keep.has(id))
    if (gone.length) await supabase.from('envois_gradation_cartes').delete().in('id', gone).eq('user_id', uid)
    for (const c of d.cartes) {
      const row = { titre: c.titre.trim().slice(0, 200), photo_url: c.photo_url, carte_id: c.carte_id, valeur_declaree: c.valeur_declaree, note_obtenue: c.note_obtenue, numero_cert: c.numero_cert }
      const { error } = c.id.startsWith('new-')
        ? await supabase.from('envois_gradation_cartes').insert({ ...row, envoi_id: envoiId, user_id: uid })
        : await supabase.from('envois_gradation_cartes').update(row).eq('id', c.id).eq('user_id', uid)
      if (error) return dbErr(error.message)
    }
    await load(uid)
    return null
  }

  const onDelete = async (id: string) => { if (!uid) return; await supabase.from('envois_gradation').delete().eq('id', id).eq('user_id', uid); await load(uid) }

  // « Marquer … » : change le statut et renseigne la date correspondante (aujourd'hui) si elle est vide
  const onStatus = async (e: Envoi, s: Statut): Promise<string | null> => {
    if (!uid) return 'Session expirée.'
    const dateKey = STATUTS.find(x => x.k === s)?.date
    const patch: Record<string, unknown> = { statut: s, updated_at: new Date().toISOString() }
    if (dateKey && !e[dateKey]) patch[dateKey as string] = new Date().toISOString().slice(0, 10)
    const { error } = await supabase.from('envois_gradation').update(patch).eq('id', e.id).eq('user_id', uid)
    if (error) return dbErr(error.message)
    await load(uid)
    return null
  }

  // note obtenue -> fiche de la carte (grade « PSA 9 », n° de certificat)
  const onApply = async (e: Envoi): Promise<string | null> => {
    if (!uid) return 'Session expirée.'
    const list = e.cartes.filter(c => c.carte_id && c.note_obtenue)
    if (!list.length) return 'Aucune carte reliée à ta collection avec une note.'
    for (const c of list) {
      const grade = /^\d/.test(c.note_obtenue!) ? `${e.societe} ${c.note_obtenue}` : c.note_obtenue!
      const { error } = await supabase.from('cartes_manuelles').update({ grade, ...(c.numero_cert ? { cert_number: c.numero_cert } : {}) }).eq('id', c.carte_id!).eq('user_id', uid)
      if (error) return 'Impossible de mettre à jour une fiche : ' + error.message
    }
    return null
  }

  const onSearch = async (q: string): Promise<CarteChoix[]> => {
    if (!uid) return []
    const safe = q.replace(/[%_\\]/g, ' ').trim()
    const { data } = await supabase.from('cartes_manuelles').select('id, nom, annee, collection, image_recto').eq('user_id', uid).ilike('nom', `%${safe}%`).limit(8)
    return ((data as CarteChoix[]) || []).map(c => ({ ...c, id: String(c.id) }))
  }

  return <EnvoisGradationView loading={loading} envois={envois} now={now} msg={msg} onSave={onSave} onDelete={onDelete} onStatus={onStatus} onApply={onApply} onSearch={onSearch} />
}

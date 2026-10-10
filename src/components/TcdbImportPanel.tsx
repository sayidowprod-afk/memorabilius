'use client'
import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Result {
  kind: string; title: string; dryRun: boolean; totalLines: number; owned: number; matched: number; alreadyHad: number; imported: number
  sets?: { name: string; count: number }[]
  setMissing?: { set: string; count: number }[]
  unmatched: number; unmatchedSamples?: string[]; nameMismatch?: number
  error?: string
}

// Import d'une collection TCDB depuis son PDF imprimable : on analyse d'abord (rien n'est ecrit), puis on confirme.
export default function TcdbImportPanel({ onImported }: { onImported?: () => void }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState<Result | null>(null)
  const [done, setDone] = useState(false)
  const file = useRef<File | null>(null)
  const input = useRef<HTMLInputElement>(null)

  const send = async (dryRun: boolean) => {
    if (!file.current) return
    setBusy(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const fd = new FormData()
      fd.append('file', file.current)
      fd.append('dryRun', dryRun ? 'true' : 'false')
      const r = await fetch('/api/tcdb-import', { method: 'POST', headers: { Authorization: `Bearer ${session?.access_token}` }, body: fd })
      const j = await r.json().catch(() => ({ error: 'Réponse invalide du serveur.' }))
      if (!r.ok) setRes({ error: j.error || 'Erreur pendant l’import.' } as Result)
      else { setRes(j); if (!dryRun) { setDone(true); onImported?.() } }
    } catch { setRes({ error: 'Connexion impossible, réessaie.' } as Result) }
    setBusy(false)
  }

  return (
    <div className="tcdb-imp">
      <button type="button" className="tcdb-imp-open" onClick={() => setOpen(o => !o)}>{open ? '✕ Fermer' : '⬆ Importer depuis TCDB (PDF)'}</button>
      {open && (
        <div className="tcdb-imp-body">
          <p className="tcdb-imp-help">Sur TCDB, ouvre ta collection ou un set, clique sur <b>Print</b> / imprimer, enregistre en PDF (« Collection Print », « Your Collection »), puis dépose-le ici. Les cartes retrouvées sont cochées à la main dans tes setlists et ne seront jamais effacées par la synchro.</p>
          <input ref={input} type="file" accept="application/pdf,.pdf" onChange={e => { file.current = e.target.files?.[0] || null; setRes(null); setDone(false); if (file.current) send(true) }} />
          {busy && <p className="tcdb-imp-help">Analyse en cours…</p>}
          {res?.error && <p className="tcdb-imp-err">{res.error}</p>}
          {res && !res.error && (
            <div className="tcdb-imp-res">
              <b className="da-display">{res.title}</b>
              <div>{res.owned.toLocaleString()} cartes possédées lues · <b>{res.matched.toLocaleString()}</b> retrouvées dans nos setlists{res.alreadyHad ? ` (dont ${res.alreadyHad.toLocaleString()} déjà cochées)` : ''}</div>
              {(res.sets?.length ?? 0) > 0 && <div className="tcdb-imp-list">{res.sets!.slice(0, 8).map(s => <span key={s.name}>{s.name} · {s.count}</span>)}{res.sets!.length > 8 && <span>+ {res.sets!.length - 8} autres sets</span>}</div>}
              {(res.setMissing?.length ?? 0) > 0 && (
                <div className="tcdb-imp-warn">
                  <b>{res.setMissing!.reduce((n, s) => n + s.count, 0).toLocaleString()} cartes dans des sets pas encore sur Memorabilius</b> (ils seront importables quand on les ajoutera) :
                  <div className="tcdb-imp-list">{res.setMissing!.slice(0, 8).map(s => <span key={s.set}>{s.set} · {s.count}</span>)}{res.setMissing!.length > 8 && <span>+ {res.setMissing!.length - 8} autres</span>}</div>
                </div>
              )}
              {res.unmatched > 0 && <div className="tcdb-imp-warn">{res.unmatched.toLocaleString()} cartes non reconnues dans des sets existants (numéro ou parallèle introuvable), laissées de côté.</div>}
              {done
                ? <div className="tcdb-imp-ok">✓ {res.imported.toLocaleString()} cartes cochées dans tes setlists.</div>
                : res.matched > 0 && <button type="button" className="tcdb-imp-go" disabled={busy} onClick={() => send(false)}>Importer {res.matched.toLocaleString()} cartes</button>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

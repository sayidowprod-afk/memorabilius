// Brouillon de l'ajout en lot, gardé sur l'appareil (IndexedDB) : si la page se ferme ou plante en plein lot,
// les cartes pas encore ajoutées sont retrouvées au retour. Rien n'est envoyé nulle part.
// Une entrée = une carte du lot (ses photos), plus un petit enregistrement de réglages (collection, à vendre…).
import type { Quad } from '@/lib/perspectiveCrop'

export type DraftEntry = {
  recto: File; verso: File | null
  rawRecto?: File; rawVerso?: File
  quadRecto?: Quad; quadVerso?: Quad
  cropped?: boolean; weak?: boolean; skip?: boolean
  check?: { recto?: boolean; verso?: boolean }
  tag?: string
}
export type DraftMeta = { collectionTag: string; forSale: boolean; useAI: boolean; autoCorners: boolean; total: number; done: number; savedAt: number }

const DB = 'memorabilius-lot-draft'
const STORE = 'kv'

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    if (typeof indexedDB === 'undefined') return rej(new Error('indexedDB indisponible'))
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => { r.result.createObjectStore(STORE) }
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
}
async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest | void): Promise<T | undefined> {
  const db = await open()
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, mode)
    const req = fn(t.objectStore(STORE))
    t.oncomplete = () => { db.close(); res(req ? (req.result as T) : undefined) }
    t.onerror = () => { db.close(); rej(t.error) }
    t.onabort = () => { db.close(); rej(t.error) }
  })
}

const entryKey = (userId: string, id: number) => `${userId}:e:${String(id).padStart(8, '0')}` // zéros devant : les cartes reviennent dans l'ordre
const metaKey = (userId: string) => `${userId}:meta`

export const draftPut = (userId: string, id: number, e: DraftEntry) => tx('readwrite', s => { s.put(e, entryKey(userId, id)) }).catch(() => {})
export const draftDelete = (userId: string, id: number) => tx('readwrite', s => { s.delete(entryKey(userId, id)) }).catch(() => {})
export const draftPutMeta = (userId: string, m: DraftMeta) => tx('readwrite', s => { s.put(m, metaKey(userId)) }).catch(() => {})

export async function draftLoad(userId: string): Promise<{ meta: DraftMeta | null; entries: DraftEntry[] }> {
  try {
    const db = await open()
    return await new Promise((res, rej) => {
      const t = db.transaction(STORE, 'readonly'); const s = t.objectStore(STORE)
      const range = IDBKeyRange.bound(`${userId}:`, `${userId}:￿`)
      const keys = s.getAllKeys(range), vals = s.getAll(range)
      t.oncomplete = () => {
        db.close()
        const entries: DraftEntry[] = []; let meta: DraftMeta | null = null
        ;(keys.result as string[]).forEach((k, i) => { if (k.endsWith(':meta')) meta = vals.result[i] as DraftMeta; else entries.push(vals.result[i] as DraftEntry) })
        res({ meta, entries })
      }
      t.onerror = () => { db.close(); rej(t.error) }
    })
  } catch { return { meta: null, entries: [] } }
}

export async function draftClear(userId: string) {
  try {
    const db = await open()
    await new Promise<void>(res => {
      const t = db.transaction(STORE, 'readwrite')
      t.objectStore(STORE).delete(IDBKeyRange.bound(`${userId}:`, `${userId}:￿`))
      t.oncomplete = () => { db.close(); res() }; t.onerror = () => { db.close(); res() }; t.onabort = () => { db.close(); res() }
    })
  } catch { /* rien */ }
}

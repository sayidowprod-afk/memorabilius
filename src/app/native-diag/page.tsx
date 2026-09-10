'use client'
import { useState } from 'react'
import { Capacitor } from '@capacitor/core'

type StepResult = { label: string; status: 'pending' | 'ok' | 'fail' | 'timeout'; ms?: number; detail?: string }

// Page de diagnostic temporaire -- isole chaque appel natif (Filesystem,
// App, Network) avec son propre timeout court, pour savoir PRECISEMENT
// lequel bloque sur un appareil donne (signale : "Timeout (ecriture
// fichier)" persistant sur un Nothing Phone 2a, meme apres avoir desactive
// l'optimisation de batterie et reduit la taille des morceaux ecrits).
// A retirer une fois le diagnostic termine.
async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`timeout ${ms}ms`)), ms)),
  ])
}

export default function NativeDiagPage() {
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<StepResult[]>([])

  const run = async () => {
    setRunning(true)
    const steps: StepResult[] = []
    setResults([...steps])

    const record = async (label: string, fn: () => Promise<any>, timeoutMs: number) => {
      const r: StepResult = { label, status: 'pending' }
      steps.push(r)
      setResults([...steps])
      const start = performance.now()
      try {
        const detail = await withTimeout(fn(), timeoutMs)
        r.status = 'ok'
        r.ms = Math.round(performance.now() - start)
        r.detail = typeof detail === 'string' ? detail : JSON.stringify(detail)
      } catch (e: any) {
        r.ms = Math.round(performance.now() - start)
        r.status = /^timeout/.test(e?.message || '') ? 'timeout' : 'fail'
        r.detail = e?.message || String(e)
      }
      setResults([...steps])
    }

    await record('Capacitor.isNativePlatform()', async () => Capacitor.isNativePlatform(), 2000)

    if (Capacitor.isNativePlatform()) {
      await record('App.getInfo()', async () => {
        const { App } = await import('@capacitor/app')
        return App.getInfo()
      }, 8000)

      await record('Network.getStatus()', async () => {
        const { Network } = await import('@capacitor/network')
        return Network.getStatus()
      }, 8000)

      await record('Filesystem.stat(Cache)', async () => {
        const { Filesystem, Directory } = await import('@capacitor/filesystem')
        return Filesystem.stat({ path: '.', directory: Directory.Cache })
      }, 10000)

      await record('Filesystem.writeFile (100 o, Cache)', async () => {
        const { Filesystem, Directory } = await import('@capacitor/filesystem')
        const tiny = btoa('x'.repeat(100))
        const res = await Filesystem.writeFile({ path: 'diag-test.txt', data: tiny, directory: Directory.Cache })
        return res.uri
      }, 15000)

      await record('Filesystem.writeFile (2 Mo, Cache)', async () => {
        const { Filesystem, Directory } = await import('@capacitor/filesystem')
        const big = btoa('x'.repeat(1_500_000)) // ~2 Mo une fois encode en base64
        const res = await Filesystem.writeFile({ path: 'diag-test-big.txt', data: big, directory: Directory.Cache })
        return res.uri
      }, 30000)

      await record('Filesystem.deleteFile (nettoyage)', async () => {
        const { Filesystem, Directory } = await import('@capacitor/filesystem')
        await Filesystem.deleteFile({ path: 'diag-test.txt', directory: Directory.Cache }).catch(() => {})
        await Filesystem.deleteFile({ path: 'diag-test-big.txt', directory: Directory.Cache }).catch(() => {})
        return 'ok'
      }, 8000)
    }

    setRunning(false)
  }

  const copyResults = () => {
    const text = results.map(r => `${r.status === 'ok' ? '✅' : r.status === 'timeout' ? '⏱️' : '❌'} ${r.label} — ${r.ms}ms${r.detail ? ` — ${r.detail}` : ''}`).join('\n')
    navigator.clipboard?.writeText(text).catch(() => {})
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a14', color: '#fff', padding: 24, fontFamily: 'monospace' }}>
      <h1 style={{ fontSize: 18, marginBottom: 4 }}>Diagnostic natif</h1>
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 20 }}>
        Page temporaire de test — isole chaque appel natif pour trouver lequel bloque.
      </p>
      <button
        onClick={run}
        disabled={running}
        style={{ background: '#003DA6', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 20px', fontWeight: 700, fontSize: 14, cursor: running ? 'default' : 'pointer', opacity: running ? 0.6 : 1, marginBottom: 20 }}
      >
        {running ? '⏳ En cours...' : '▶ Lancer le diagnostic'}
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {results.map((r, i) => (
          <div key={i} style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', fontSize: 13 }}>
            <div>
              {r.status === 'pending' ? '⏳' : r.status === 'ok' ? '✅' : r.status === 'timeout' ? '⏱️' : '❌'}{' '}
              <strong>{r.label}</strong>{r.ms !== undefined ? ` — ${r.ms}ms` : ''}
            </div>
            {r.detail && <div style={{ color: 'rgba(255,255,255,0.5)', marginTop: 4, wordBreak: 'break-all' }}>{r.detail}</div>}
          </div>
        ))}
      </div>

      {results.length > 0 && !running && (
        <button
          onClick={copyResults}
          style={{ marginTop: 20, background: 'rgba(255,255,255,0.09)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
        >
          📋 Copier les résultats
        </button>
      )}
    </div>
  )
}

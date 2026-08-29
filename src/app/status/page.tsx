'use client'
import { useEffect, useState } from 'react'
import { useTheme } from '@/lib/ThemeContext'

interface StatusResult {
  ok: boolean
  checks: Record<string, boolean>
  checkedAt: string
}

const CHECK_LABELS: Record<string, string> = {
  api: 'API',
  database: 'Base de données',
}

export default function StatusPage() {
  const { dark } = useTheme()
  const [result, setResult] = useState<StatusResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const check = async () => {
    setLoading(true)
    setError(false)
    try {
      const r = await fetch('/api/status', { cache: 'no-store' })
      const data = await r.json()
      setResult(data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    check()
    const interval = setInterval(check, 60_000)
    return () => clearInterval(interval)
  }, [])

  const overallOk = result?.ok && !error

  return (
    <div style={{ maxWidth: 560, margin: '40px auto', padding: '0 16px' }}>
      <h1 style={{ fontWeight: 900, fontSize: 26, marginBottom: 6 }}>Statut de Memorabilius</h1>
      <p style={{ color: dark ? '#999' : '#666', fontSize: 14, marginBottom: 24 }}>
        Vérification en direct, actualisée automatiquement toutes les minutes.
      </p>

      <div style={{
        background: dark ? '#1e1e1e' : 'white', borderRadius: 16, padding: 24,
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)', marginBottom: 20,
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <div style={{
          width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
          background: loading ? '#ccc' : overallOk ? '#2ecc71' : '#e74c3c',
        }} />
        <div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>
            {loading ? 'Vérification…' : overallOk ? 'Tous les systèmes fonctionnent' : 'Un problème est en cours'}
          </div>
          {result && !loading && (
            <div style={{ fontSize: 12, color: dark ? '#999' : '#888' }}>
              Dernière vérification : {new Date(result.checkedAt).toLocaleTimeString('fr-FR')}
            </div>
          )}
        </div>
      </div>

      {result && (
        <div style={{ background: dark ? '#1e1e1e' : 'white', borderRadius: 16, padding: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
          {Object.entries(result.checks).map(([key, ok]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `1px solid ${dark ? '#2a2a2a' : '#f5f5f5'}` }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{CHECK_LABELS[key] || key}</span>
              <span style={{ fontWeight: 700, fontSize: 13, color: ok ? '#2ecc71' : '#e74c3c' }}>{ok ? '● Opérationnel' : '● Indisponible'}</span>
            </div>
          ))}
        </div>
      )}

      <p style={{ fontSize: 12, color: dark ? '#777' : '#aaa', marginTop: 20, textAlign: 'center' }}>
        Un problème persistant ? <a href="mailto:contact@memorabilius.fr" style={{ color: '#003DA6' }}>contact@memorabilius.fr</a>
      </p>
    </div>
  )
}

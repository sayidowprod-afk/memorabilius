'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface Stats { total: number; rc: number; auto: number; num: number; patch: number }
interface Collector { id: string; display_name: string; avatar_url: string; lien_csv: string; stats?: Stats }

export default function Annuaire() {
  const [collectors, setCollectors] = useState<Collector[]>([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<'display_name' | 'total' | 'rc' | 'auto' | 'num' | 'patch'>('total')
  const [sortAsc, setSortAsc] = useState(false)
  const [teamFilter, setTeamFilter] = useState<string>('')
  const [teams, setTeams] = useState<any[]>([])

  useEffect(() => {
    loadData()
    supabase.from('teams').select('id, name').then(({ data }) => setTeams(data || []))
  }, [])

  const loadData = async () => {
    const { data: profiles } = await supabase.from('profiles').select('id, display_name, avatar_url, lien_csv').not('lien_csv', 'is', null).neq('lien_csv', '')
    if (!profiles) { setLoading(false); return }

    const withStats = await Promise.all(profiles.map(async p => {
      try {
        const r = await fetch(p.lien_csv + '&t=' + Date.now())
        const t = await r.text()
        const lines = t.split(/\r?\n/).slice(1)
        let stats: Stats = { total: 0, rc: 0, auto: 0, num: 0, patch: 0 }
        lines.forEach(line => {
          const c = line.split(',')
          if (!c[0] || c[0].length < 10) return
          stats.total++
          if (c[10]?.toLowerCase().includes('oui')) stats.rc++
          if (c[9]?.toLowerCase().includes('oui')) stats.auto++
          if (c[11]?.toLowerCase().includes('oui')) stats.patch++
          if (c[8]?.trim()) stats.num++
        })
        return { ...p, stats }
      } catch { return { ...p, stats: { total: 0, rc: 0, auto: 0, num: 0, patch: 0 } } }
    }))
    setCollectors(withStats)
    setLoading(false)
  }

  const sorted = [...collectors].sort((a, b) => {
    if (sortKey === 'display_name') return sortAsc ? (a.display_name || '').localeCompare(b.display_name || '') : (b.display_name || '').localeCompare(a.display_name || '')
    const av = (a.stats?.[sortKey] || 0) as number
    const bv = (b.stats?.[sortKey] || 0) as number
    return sortAsc ? av - bv : bv - av
  })

  const handleSort = (k: typeof sortKey) => {
    if (sortKey === k) setSortAsc(!sortAsc)
    else { setSortKey(k); setSortAsc(false) }
  }

  const th = (k: typeof sortKey, label: string) => (
    <th onClick={() => handleSort(k)} style={{ background: '#fdfdfd', padding: '18px 15px', textAlign: 'left', fontSize: 11, textTransform: 'uppercase', color: '#999', borderBottom: '2px solid #f0f0f0', cursor: 'pointer', whiteSpace: 'nowrap' }}>
      {label}{sortKey === k ? (sortAsc ? ' ↑' : ' ↓') : ''}
    </th>
  )

  const badge = (val: number, bg: string, color: string) => (
    <span style={{ padding: '6px 12px', borderRadius: 6, fontWeight: 900, fontSize: 13, display: 'inline-block', minWidth: 40, textAlign: 'center', background: bg, color }}>{val}</span>
  )

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      <h1 style={{ fontWeight: 900, fontSize: 28, marginBottom: 24 }}>Annuaire des collectionneurs</h1>

      <div style={{ marginBottom: 16 }}>
        <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)} style={{ width: 'auto', minWidth: 200 }}>
          <option value="">Toutes les teams</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {loading ? <p style={{ textAlign: 'center', padding: 60, color: '#bbb' }}>Chargement des collections...</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
            <thead><tr>
              {th('display_name', 'Collectionneur')}
              {th('total', 'Total')}
              {th('rc', 'RC')}
              {th('auto', 'Auto')}
              {th('num', '# Num')}
              {th('patch', 'Patch')}
            </tr></thead>
            <tbody>
              {sorted.map(c => (
                <tr key={c.id}>
                  <td style={{ padding: 15, borderBottom: '1px solid #f5f5f5' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
                      <img src={c.avatar_url || `https://ui-avatars.com/api/?name=${c.display_name}&background=003DA6&color=fff`} style={{ width: 42, height: 42, borderRadius: '50%', border: '2px solid #eee', objectFit: 'cover' }} alt={c.display_name} />
                      <Link href={`/galerie/${c.id}`} style={{ fontWeight: 800, color: '#121212' }}>{c.display_name || 'Collectionneur'}</Link>
                    </div>
                  </td>
                  <td style={{ padding: 15, borderBottom: '1px solid #f5f5f5' }}>{badge(c.stats?.total || 0, '#f0f0f0', '#333')}</td>
                  <td style={{ padding: 15, borderBottom: '1px solid #f5f5f5' }}>{badge(c.stats?.rc || 0, '#fff3e0', '#e67e22')}</td>
                  <td style={{ padding: 15, borderBottom: '1px solid #f5f5f5' }}>{badge(c.stats?.auto || 0, '#e8f5e9', '#2e7d32')}</td>
                  <td style={{ padding: 15, borderBottom: '1px solid #f5f5f5' }}>{badge(c.stats?.num || 0, '#f5f5f5', '#444')}</td>
                  <td style={{ padding: 15, borderBottom: '1px solid #f5f5f5' }}>{badge(c.stats?.patch || 0, '#e3f2fd', '#1976d2')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

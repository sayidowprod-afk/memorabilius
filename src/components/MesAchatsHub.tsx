'use client'
import { useState, type ReactNode } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import MesAchats from '@/components/MesAchatsPage'
import MesVentes from '@/components/MesVentesPage'
import SuiviGradation from '@/components/SuiviGradationPage'

// Page unique « Mes achats » à onglets : Achats, Ventes, Gradation. L'onglet actif est dans l'adresse (?onglet=ventes), ce qui
// permet de partager ou d'ajouter un lien direct. Un onglet déjà ouvert reste en mémoire (masqué) : on ne recharge pas ses
// données ni la synchronisation eBay à chaque changement d'onglet.
export type Tab = 'achats' | 'ventes' | 'gradation'
const TABS: Array<{ k: Tab; icon: string; label: string }> = [
  { k: 'achats', icon: '🛒', label: 'Achats' },
  { k: 'ventes', icon: '💰', label: 'Ventes' },
  { k: 'gradation', icon: '📮', label: 'Suivi gradation' },
]
const fromParam = (v: string | null): Tab => (v === 'ventes' || v === 'gradation' ? v : 'achats')

// `panels` sert uniquement aux essais en local (contenus factices) ; en production, ce sont les vraies pages.
export default function MesAchatsHub({ panels }: { panels?: Record<Tab, ReactNode> }) {
  const content: Record<Tab, ReactNode> = panels ?? { achats: <MesAchats />, ventes: <MesVentes />, gradation: <SuiviGradation /> }
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const tab = fromParam(params.get('onglet'))
  const [seen, setSeen] = useState<Set<Tab>>(() => new Set([tab]))
  // l'onglet affiché est toujours gardé en mémoire (au premier rendu, l'adresse peut ne pas encore être lue)
  if (!seen.has(tab)) setSeen(s => new Set(s).add(tab))

  const go = (t: Tab) => {
    setSeen(s => (s.has(t) ? s : new Set(s).add(t)))
    const p = new URLSearchParams(params.toString())
    if (t === 'achats') p.delete('onglet'); else p.set('onglet', t)
    const qs = p.toString()
    router.replace(`${pathname}${qs ? '?' + qs : ''}`, { scroll: false })
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="mh-bar">
        <div className="mh-tabs" role="tablist" aria-label="Mes achats, ventes et gradation">
          {TABS.map(t => (
            <button key={t.k} type="button" role="tab" id={`mh-tab-${t.k}`} aria-selected={tab === t.k} aria-controls={`mh-panel-${t.k}`}
              className={`mh-tab${tab === t.k ? ' on' : ''}`} onClick={() => go(t.k)}>
              <span aria-hidden="true">{t.icon}</span> {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mh-panels">
        {(seen.has('achats') || tab === 'achats') && <div id="mh-panel-achats" role="tabpanel" aria-labelledby="mh-tab-achats" hidden={tab !== 'achats'}>{content.achats}</div>}
        {(seen.has('ventes') || tab === 'ventes') && <div id="mh-panel-ventes" role="tabpanel" aria-labelledby="mh-tab-ventes" hidden={tab !== 'ventes'}>{content.ventes}</div>}
        {(seen.has('gradation') || tab === 'gradation') && <div id="mh-panel-gradation" role="tabpanel" aria-labelledby="mh-tab-gradation" hidden={tab !== 'gradation'}>{content.gradation}</div>}
      </div>
    </>
  )
}

const CSS = `
.mh-bar { max-width: 980px; margin: 24px auto 0; padding: 0 16px; box-sizing: border-box; }
.mh-tabs { display: flex; border: 3px solid var(--border); background: var(--bg2); }
.mh-tab { flex: 1; background: transparent; border: 0; color: var(--text2); font: 800 13px system-ui, sans-serif; letter-spacing: .06em; text-transform: uppercase; padding: 13px 10px; cursor: pointer; border-right: 3px solid var(--border); }
.mh-tab:last-child { border-right: 0; }
.mh-tab.on { background: #2f6bff; color: #fff; }
.mh-tab:focus-visible { outline: 3px solid #ffd98a; outline-offset: -3px; }
.mh-panels .ma-wrap { margin-top: 22px; }
@media (max-width: 520px) { .mh-tab { font-size: 10.5px; padding: 10px 3px; line-height: 1.2; letter-spacing: .03em; } }
`

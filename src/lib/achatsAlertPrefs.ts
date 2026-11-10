// Préférences d'alertes de « Mes achats » : quelles alertes recevoir et plage « ne pas déranger » (le push est coupé,
// la cloche reste). Partagé entre la page (réglages) et le serveur (envoi des alertes).
export type AlertKind = 'surenchere' | 'fin1h' | 'fin5min' | 'resultat' | 'seuil' | 'limite'
  | 'vente_enchere' | 'vente_suivi' | 'vente_fin' | 'vente_resultat' | 'vente_expedition' // « Mes ventes » : mes annonces eBay

export type AlertPrefs = Record<AlertKind, boolean> & { nuit: boolean; nuitDebut: number; nuitFin: number }

export const DEFAULT_PREFS: AlertPrefs = {
  surenchere: true, fin1h: true, fin5min: true, resultat: true, seuil: true, limite: true,
  vente_enchere: true, vente_suivi: true, vente_fin: true, vente_resultat: true, vente_expedition: true,
  nuit: false, nuitDebut: 23, nuitFin: 8,
}

export const ALERT_LABELS: Array<{ kind: AlertKind; label: string; sub: string; group?: 'achat' | 'vente' }> = [
  { kind: 'surenchere', label: 'Surenchère', sub: 'Quelqu’un dépasse ton enchère' },
  { kind: 'fin1h', label: 'Fin dans 1 h', sub: 'Une enchère ou un article suivi se termine bientôt' },
  { kind: 'fin5min', label: 'Dernière minute', sub: 'Rappel environ 5 min avant la fin de tes enchères' },
  { kind: 'resultat', label: 'Résultat', sub: 'Enchère gagnée ou perdue' },
  { kind: 'seuil', label: 'Prix sous ton seuil', sub: 'Un article suivi passe sous le prix que tu as fixé' },
  { kind: 'limite', label: 'Limite approchée', sub: 'Une enchère atteint 90 % de ta limite perso' },
  { kind: 'vente_enchere', label: 'Nouvelle enchère sur mon annonce', sub: 'Quelqu’un enchérit sur une de tes annonces eBay', group: 'vente' },
  { kind: 'vente_suivi', label: 'Nouveaux suiveurs', sub: 'Des personnes se mettent à suivre une de tes annonces', group: 'vente' },
  { kind: 'vente_fin', label: 'Fin dans 1 h', sub: 'Une de tes annonces se termine bientôt', group: 'vente' },
  { kind: 'vente_resultat', label: 'Résultat d’une annonce', sub: 'Vendue (à qui, à quel prix) ou terminée sans acheteur', group: 'vente' },
  { kind: 'vente_expedition', label: 'Colis à expédier', sub: 'Une vente payée depuis plus de 2 jours n’est pas expédiée', group: 'vente' },
]

export function normPrefs(raw: unknown): AlertPrefs {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const hour = (v: unknown, d: number) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 23 ? v : d)
  const out = { ...DEFAULT_PREFS }
  for (const k of ['surenchere', 'fin1h', 'fin5min', 'resultat', 'seuil', 'limite', 'vente_enchere', 'vente_suivi', 'vente_fin', 'vente_resultat', 'vente_expedition', 'nuit'] as const) if (typeof o[k] === 'boolean') out[k] = o[k] as boolean
  out.nuitDebut = hour(o.nuitDebut, DEFAULT_PREFS.nuitDebut)
  out.nuitFin = hour(o.nuitFin, DEFAULT_PREFS.nuitFin)
  return out
}

// Heure de Paris (les membres sont en France pour l'essentiel)
export function parisHour(d = new Date()): number {
  return Number(new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', hour12: false, timeZone: 'Europe/Paris' }).format(d)) % 24
}

export function inQuietHours(p: AlertPrefs, d = new Date()): boolean {
  if (!p.nuit) return false
  const h = parisHour(d)
  return p.nuitDebut === p.nuitFin ? false : p.nuitDebut < p.nuitFin ? h >= p.nuitDebut && h < p.nuitFin : h >= p.nuitDebut || h < p.nuitFin
}

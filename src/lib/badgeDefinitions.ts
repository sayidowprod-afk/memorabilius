export type BadgeTier = {
  id: string
  threshold: number
  label: string
}

export type BadgeCategory = {
  id: string
  emoji: string
  label: string
  statKey: 'stat_total' | 'stat_rc' | 'stat_patch' | 'stat_num' | 'mois_count' | 'views_count' | 'teams_count'
  unit: string
  tiers: BadgeTier[]
}

export const BADGE_CATEGORIES: BadgeCategory[] = [
  {
    id: 'cartes', emoji: '🃏', label: 'Collection', statKey: 'stat_total', unit: 'cartes',
    tiers: [
      { id: 'cartes_100',  threshold: 100,  label: '100'   },
      { id: 'cartes_500',  threshold: 500,  label: '500'   },
      { id: 'cartes_1000', threshold: 1000, label: '1 000' },
      { id: 'cartes_2000', threshold: 2000, label: '2 000' },
      { id: 'cartes_5000', threshold: 5000, label: '5 000' },
    ],
  },
  {
    id: 'rc', emoji: '⭐', label: 'Rookie Cards', statKey: 'stat_rc', unit: 'RC',
    tiers: [
      { id: 'rc_100',  threshold: 100,  label: '100'   },
      { id: 'rc_250',  threshold: 250,  label: '250'   },
      { id: 'rc_500',  threshold: 500,  label: '500'   },
      { id: 'rc_1000', threshold: 1000, label: '1 000' },
    ],
  },
  {
    id: 'patch', emoji: '🩹', label: 'Patches', statKey: 'stat_patch', unit: 'patches',
    tiers: [
      { id: 'patch_100',  threshold: 100,  label: '100'   },
      { id: 'patch_250',  threshold: 250,  label: '250'   },
      { id: 'patch_500',  threshold: 500,  label: '500'   },
      { id: 'patch_1000', threshold: 1000, label: '1 000' },
    ],
  },
  {
    id: 'num', emoji: '🔢', label: 'Numérotées', statKey: 'stat_num', unit: 'numérotées',
    tiers: [
      { id: 'num_100',  threshold: 100,  label: '100'   },
      { id: 'num_250',  threshold: 250,  label: '250'   },
      { id: 'num_500',  threshold: 500,  label: '500'   },
      { id: 'num_1000', threshold: 1000, label: '1 000' },
    ],
  },
  {
    id: 'mois', emoji: '🏆', label: 'Collectionneur du mois', statKey: 'mois_count', unit: 'fois champion',
    tiers: [
      { id: 'mois_1', threshold: 1, label: '1×' },
      { id: 'mois_3', threshold: 3, label: '3×' },
      { id: 'mois_6', threshold: 6, label: '6×' },
    ],
  },
  {
    id: 'views', emoji: '👁️', label: 'Populaire', statKey: 'views_count', unit: 'vues',
    tiers: [
      { id: 'views_100',  threshold: 100,  label: '100'   },
      { id: 'views_500',  threshold: 500,  label: '500'   },
      { id: 'views_1000', threshold: 1000, label: '1 000' },
    ],
  },
  {
    id: 'teams', emoji: '🤝', label: 'Communauté', statKey: 'teams_count', unit: 'équipe(s)',
    tiers: [
      { id: 'teams_1', threshold: 1, label: '1' },
      { id: 'teams_3', threshold: 3, label: '3' },
      { id: 'teams_5', threshold: 5, label: '5' },
    ],
  },
]

// 5+4+4+4+3+3+3 = 26
export const TOTAL_BADGES = BADGE_CATEGORIES.reduce((s, c) => s + c.tiers.length, 0)

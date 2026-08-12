-- Recalcul one-shot des sous-stats depuis cartes_manuelles
-- Corrige la dérive causée par card-added qui n'incrémentait que stats_total.
-- Cible uniquement les profils sans CSV (lien_csv IS NULL) : toutes leurs
-- cartes sont dans cartes_manuelles, la source est donc fiable et complète.
-- Pour les profils avec CSV, relancer /api/recalcul-stats manuellement.

WITH manual_stats AS (
  SELECT
    user_id,
    COUNT(*)::int                                                    AS total,
    COUNT(*) FILTER (WHERE rc    = true)::int                        AS rc,
    COUNT(*) FILTER (WHERE auto  = true)::int                        AS auto,
    COUNT(*) FILTER (WHERE patch = true)::int                        AS patch,
    COUNT(*) FILTER (WHERE num IS NOT NULL AND num != '')::int        AS num
  FROM public.cartes_manuelles
  GROUP BY user_id
)
UPDATE public.profiles p
SET
  stats_total      = ms.total,
  stats_rc         = ms.rc,
  stats_auto       = ms.auto,
  stats_patch      = ms.patch,
  stats_num        = ms.num,
  stats_updated_at = now()
FROM manual_stats ms
WHERE p.id = ms.user_id
  AND (p.lien_csv IS NULL OR p.lien_csv = '');

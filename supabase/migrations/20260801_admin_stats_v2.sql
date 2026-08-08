-- admin_stats v3 : ajout coût Gemini, top users, rétention D7, classeurs, trades, RC/auto/patch
CREATE OR REPLACE FUNCTION admin_stats()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
AS $$
WITH
  user_daily AS (
    SELECT date_trunc('day', created_at AT TIME ZONE 'UTC')::date AS day, count(*)::int AS cnt
    FROM profiles
    GROUP BY day
  ),
  card_daily AS (
    SELECT date_trunc('day', created_at AT TIME ZONE 'UTC')::date AS day, count(*)::int AS cnt
    FROM cartes_manuelles
    GROUP BY day
  ),
  top_users AS (
    SELECT
      p.id,
      COALESCE(NULLIF(p.display_name, ''), split_part(p.email, '@', 1)) AS name,
      p.stats_total AS card_count
    FROM profiles p
    ORDER BY p.stats_total DESC NULLS LAST
    LIMIT 10
  ),
  retention AS (
    -- Utilisateurs qui ont ajouté au moins 1 carte dans les 7j après inscription
    SELECT count(DISTINCT p.id)::int AS retained
    FROM profiles p
    WHERE EXISTS (
      SELECT 1 FROM cartes_manuelles c
      WHERE c.user_id = p.id
        AND c.created_at <= p.created_at + interval '7 days'
    )
    AND p.created_at <= now() - interval '7 days'
  )
SELECT jsonb_build_object(
  -- Existant
  'total_users',           (SELECT count(*)::int FROM profiles),
  'today_users',           (SELECT count(*)::int FROM profiles WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'UTC')),
  'week_users',            (SELECT count(*)::int FROM profiles WHERE created_at >= now() - interval '7 days'),
  'month_users',           (SELECT count(*)::int FROM profiles WHERE created_at >= now() - interval '30 days'),
  'oldest_user',           (SELECT min(created_at) FROM profiles),
  'total_cards',           (SELECT COALESCE(SUM(stats_total), 0)::int FROM profiles),
  'total_cards_manual',    (SELECT count(*)::int FROM cartes_manuelles),
  'today_cards',           (SELECT count(*)::int FROM cartes_manuelles WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'UTC')),
  'week_cards',            (SELECT count(*)::int FROM cartes_manuelles WHERE created_at >= now() - interval '7 days'),
  'month_cards',           (SELECT count(*)::int FROM cartes_manuelles WHERE created_at >= now() - interval '30 days'),
  'oldest_card',           (SELECT min(created_at) FROM cartes_manuelles),
  'active_users_week',     (SELECT count(DISTINCT user_id)::int FROM cartes_manuelles WHERE created_at >= now() - interval '7 days'),
  'active_users_month',    (SELECT count(DISTINCT user_id)::int FROM cartes_manuelles WHERE created_at >= now() - interval '30 days'),
  'user_daily',            (SELECT coalesce(jsonb_agg(jsonb_build_object('day', day, 'count', cnt) ORDER BY day), '[]') FROM user_daily),
  'card_daily',            (SELECT coalesce(jsonb_agg(jsonb_build_object('day', day, 'count', cnt) ORDER BY day), '[]') FROM card_daily),

  -- Nouveau : IA / coûts
  'total_scans',           (SELECT count(*)::int FROM ai_scan_events),
  'scans_today',           (SELECT count(*)::int FROM ai_scan_events WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'UTC')),
  'scans_week',            (SELECT count(*)::int FROM ai_scan_events WHERE created_at >= now() - interval '7 days'),
  'scans_month',           (SELECT count(*)::int FROM ai_scan_events WHERE created_at >= now() - interval '30 days'),
  'estimated_cost_eur',    (SELECT round((count(*) * 0.002)::numeric, 2) FROM ai_scan_events),

  -- Nouveau : collection quality
  'cards_with_rc',         (SELECT count(*)::int FROM cartes_manuelles WHERE rc = true),
  'cards_with_auto',       (SELECT count(*)::int FROM cartes_manuelles WHERE auto = true),
  'cards_with_patch',      (SELECT count(*)::int FROM cartes_manuelles WHERE patch = true),
  'cards_with_num',        (SELECT count(*)::int FROM cartes_manuelles WHERE num IS NOT NULL AND num <> ''),
  'cards_with_photo',      (SELECT count(*)::int FROM cartes_manuelles WHERE image_recto IS NOT NULL),

  -- Nouveau : engagement
  'total_binders',         (SELECT count(*)::int FROM binders),
  'total_trade_offers',    (SELECT count(*)::int FROM trade_offers),
  'trade_offers_accepted', (SELECT count(*)::int FROM trade_offers WHERE status = 'accepted'),
  'trade_offers_pending',  (SELECT count(*)::int FROM trade_offers WHERE status = 'pending'),

  -- Nouveau : rétention D7
  'retention_d7_count',    (SELECT retained FROM retention),
  'retention_d7_base',     (SELECT count(*)::int FROM profiles WHERE created_at <= now() - interval '7 days'),

  -- Nouveau : top utilisateurs
  'top_users',             (SELECT coalesce(jsonb_agg(jsonb_build_object('name', name, 'cards', card_count)), '[]') FROM top_users)
);
$$;

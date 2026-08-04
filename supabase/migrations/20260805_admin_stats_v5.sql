-- admin_stats v5 : correction coût Gemini (gemini-2.5-flash, thinkingBudget:0)
-- Réel : ~1 200 tokens input + 300 output ≈ €0,00020/scan
-- Remplace le forfait 0,002/scan (10× trop élevé)
CREATE OR REPLACE FUNCTION admin_stats()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
AS $$
WITH
  user_daily AS (
    SELECT date_trunc('day', created_at AT TIME ZONE 'UTC')::date AS day, count(*)::int AS cnt
    FROM profiles GROUP BY day
  ),
  card_daily AS (
    SELECT date_trunc('day', created_at AT TIME ZONE 'UTC')::date AS day, count(*)::int AS cnt
    FROM cartes_manuelles GROUP BY day
  ),
  top_users AS (
    SELECT
      COALESCE(NULLIF(p.display_name, ''), split_part(p.email, '@', 1)) AS name,
      p.stats_total AS card_count
    FROM profiles p
    ORDER BY p.stats_total DESC NULLS LAST
    LIMIT 10
  ),
  retention AS (
    SELECT count(DISTINCT p.id)::int AS retained
    FROM profiles p
    WHERE EXISTS (
      SELECT 1 FROM cartes_manuelles c
      WHERE c.user_id = p.id AND c.created_at <= p.created_at + interval '7 days'
    )
    AND p.created_at <= now() - interval '7 days'
  ),
  retention_d30 AS (
    SELECT count(DISTINCT p.id)::int AS retained
    FROM profiles p
    WHERE EXISTS (
      SELECT 1 FROM cartes_manuelles c
      WHERE c.user_id = p.id AND c.created_at <= p.created_at + interval '30 days'
    )
    AND p.created_at <= now() - interval '30 days'
  ),
  prev_retention AS (
    SELECT count(DISTINCT p.id)::int AS retained
    FROM profiles p
    WHERE EXISTS (
      SELECT 1 FROM cartes_manuelles c
      WHERE c.user_id = p.id AND c.created_at <= p.created_at + interval '7 days'
    )
    AND p.created_at BETWEEN now() - interval '60 days' AND now() - interval '30 days'
  ),
  churn AS (
    SELECT
      count(DISTINCT c.user_id)::int AS total_prev,
      count(DISTINCT c.user_id) FILTER (
        WHERE NOT EXISTS (
          SELECT 1 FROM cartes_manuelles c2
          WHERE c2.user_id = c.user_id AND c2.created_at >= now() - interval '30 days'
        )
      )::int AS churned
    FROM cartes_manuelles c
    WHERE c.created_at BETWEEN now() - interval '60 days' AND now() - interval '30 days'
  ),
  prev_churn AS (
    SELECT
      count(DISTINCT c.user_id)::int AS total_prev,
      count(DISTINCT c.user_id) FILTER (
        WHERE NOT EXISTS (
          SELECT 1 FROM cartes_manuelles c2
          WHERE c2.user_id = c.user_id
            AND c2.created_at BETWEEN now() - interval '60 days' AND now() - interval '30 days'
        )
      )::int AS churned
    FROM cartes_manuelles c
    WHERE c.created_at BETWEEN now() - interval '90 days' AND now() - interval '60 days'
  ),
  top_corrections AS (
    SELECT jsonb_agg(jsonb_build_object('field', field, 'count', cnt) ORDER BY cnt DESC) AS arr
    FROM (
      SELECT unnest(corrected_fields) AS field, count(*)::int AS cnt
      FROM training_data
      WHERE corrected = true AND cardinality(corrected_fields) > 0
      GROUP BY field ORDER BY cnt DESC LIMIT 6
    ) sub
  ),
  top_marques AS (
    SELECT jsonb_agg(jsonb_build_object('marque', marque, 'count', cnt) ORDER BY cnt DESC) AS arr
    FROM (
      SELECT marque, count(*)::int AS cnt
      FROM cartes_manuelles
      WHERE marque IS NOT NULL AND marque <> ''
      GROUP BY marque ORDER BY cnt DESC LIMIT 5
    ) sub
  ),
  activation AS (
    SELECT percentile_cont(0.5) WITHIN GROUP (
      ORDER BY EXTRACT(EPOCH FROM (first_card - p.created_at)) / 86400
    )::numeric AS median_days
    FROM profiles p
    JOIN (
      SELECT user_id, min(created_at) AS first_card
      FROM cartes_manuelles GROUP BY user_id
    ) fc ON fc.user_id = p.id
    WHERE fc.first_card >= p.created_at
  )
SELECT
  jsonb_build_object(
    'total_users',            (SELECT count(*)::int FROM profiles),
    'today_users',            (SELECT count(*)::int FROM profiles WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'UTC')),
    'week_users',             (SELECT count(*)::int FROM profiles WHERE created_at >= now() - interval '7 days'),
    'month_users',            (SELECT count(*)::int FROM profiles WHERE created_at >= now() - interval '30 days'),
    'oldest_user',            (SELECT min(created_at) FROM profiles),
    'total_cards',            (SELECT COALESCE(SUM(stats_total), 0)::int FROM profiles),
    'total_cards_manual',     (SELECT count(*)::int FROM cartes_manuelles),
    'today_cards',            (SELECT count(*)::int FROM cartes_manuelles WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'UTC')),
    'week_cards',             (SELECT count(*)::int FROM cartes_manuelles WHERE created_at >= now() - interval '7 days'),
    'month_cards',            (SELECT count(*)::int FROM cartes_manuelles WHERE created_at >= now() - interval '30 days'),
    'oldest_card',            (SELECT min(created_at) FROM cartes_manuelles),
    'active_users_week',      (SELECT count(DISTINCT user_id)::int FROM cartes_manuelles WHERE created_at >= now() - interval '7 days'),
    'active_users_month',     (SELECT count(DISTINCT user_id)::int FROM cartes_manuelles WHERE created_at >= now() - interval '30 days'),
    'user_daily',             (SELECT coalesce(jsonb_agg(jsonb_build_object('day', day, 'count', cnt) ORDER BY day), '[]') FROM user_daily),
    'card_daily',             (SELECT coalesce(jsonb_agg(jsonb_build_object('day', day, 'count', cnt) ORDER BY day), '[]') FROM card_daily),

    -- gemini-2.5-flash, thinkingBudget:0 → ~€0,00020/scan
    'total_scans',            (SELECT count(*)::int FROM ai_scan_events),
    'scans_today',            (SELECT count(*)::int FROM ai_scan_events WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'UTC')),
    'scans_week',             (SELECT count(*)::int FROM ai_scan_events WHERE created_at >= now() - interval '7 days'),
    'scans_month',            (SELECT count(*)::int FROM ai_scan_events WHERE created_at >= now() - interval '30 days'),
    'estimated_cost_eur',     (SELECT round((count(*) * 0.00020)::numeric, 4) FROM ai_scan_events),

    'scan_total_training',    (SELECT count(*)::int FROM training_data WHERE gemini_output IS NOT NULL),
    'scan_corrected_count',   (SELECT count(*)::int FROM training_data WHERE corrected = true),
    'top_corrected_fields',   (SELECT coalesce(arr, '[]') FROM top_corrections),

    'cards_with_rc',          (SELECT count(*)::int FROM cartes_manuelles WHERE rc = true),
    'cards_with_auto',        (SELECT count(*)::int FROM cartes_manuelles WHERE auto = true),
    'cards_with_patch',       (SELECT count(*)::int FROM cartes_manuelles WHERE patch = true),
    'cards_with_num',         (SELECT count(*)::int FROM cartes_manuelles WHERE num IS NOT NULL AND num <> ''),
    'cards_with_photo',       (SELECT count(*)::int FROM cartes_manuelles WHERE image_recto IS NOT NULL),
    'avg_card_completeness',  (
      SELECT round(avg(
        (CASE WHEN nom        IS NOT NULL AND nom        <> '' THEN 1 ELSE 0 END +
         CASE WHEN annee      IS NOT NULL AND annee      <> '' THEN 1 ELSE 0 END +
         CASE WHEN marque     IS NOT NULL AND marque     <> '' THEN 1 ELSE 0 END +
         CASE WHEN collection IS NOT NULL AND collection <> '' THEN 1 ELSE 0 END +
         CASE WHEN equipe     IS NOT NULL AND equipe     <> '' THEN 1 ELSE 0 END +
         CASE WHEN image_recto IS NOT NULL THEN 1 ELSE 0 END
        )::float / 6 * 100
      )::numeric, 1) FROM cartes_manuelles
    ),
    'top_marques',            (SELECT coalesce(arr, '[]') FROM top_marques),

    'total_binders',          (SELECT count(*)::int FROM binders),
    'total_trade_offers',     (SELECT count(*)::int FROM trade_offers),
    'trade_offers_accepted',  (SELECT count(*)::int FROM trade_offers WHERE status = 'accepted'),
    'trade_offers_pending',   (SELECT count(*)::int FROM trade_offers WHERE status = 'pending')
  )
  ||
  jsonb_build_object(
    'funnel_registered',      (SELECT count(*)::int FROM profiles),
    'funnel_scanned',         (SELECT count(DISTINCT user_id)::int FROM ai_scan_events),
    'funnel_first_card',      (SELECT count(*)::int FROM profiles WHERE stats_total > 0),

    'retention_d7_count',     (SELECT retained FROM retention),
    'retention_d7_base',      (SELECT count(*)::int FROM profiles WHERE created_at <= now() - interval '7 days'),
    'prev_retention_d7_count',(SELECT retained FROM prev_retention),
    'prev_retention_d7_base', (SELECT count(*)::int FROM profiles WHERE created_at BETWEEN now() - interval '60 days' AND now() - interval '30 days'),
    'retention_d30_count',    (SELECT retained FROM retention_d30),
    'retention_d30_base',     (SELECT count(*)::int FROM profiles WHERE created_at <= now() - interval '30 days'),
    'dau',                    (SELECT count(DISTINCT user_id)::int FROM cartes_manuelles WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'UTC')),
    'prev_mau',               (SELECT count(DISTINCT user_id)::int FROM cartes_manuelles WHERE created_at BETWEEN now() - interval '60 days' AND now() - interval '30 days'),
    'churn_count',            (SELECT churned FROM churn),
    'churn_base',             (SELECT total_prev FROM churn),
    'prev_churn_count',       (SELECT churned FROM prev_churn),
    'prev_churn_base',        (SELECT total_prev FROM prev_churn),

    'activation_delay_median',(SELECT round(median_days, 1) FROM activation),
    'donor_count',            (SELECT count(*)::int FROM profiles WHERE is_donor = true),
    'top_users',              (SELECT coalesce(jsonb_agg(jsonb_build_object('name', name, 'cards', card_count)), '[]') FROM top_users)
  );
$$;

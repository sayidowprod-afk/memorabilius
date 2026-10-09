-- admin_stats v6 : meme resultat (memes cles) mais bien plus rapide.
-- Probleme : la page /admin/stats renvoyait "Erreur 500" -- la fonction depassait le
-- statement_timeout (code 57014, ~8 s) car cartes_manuelles (> 100 000 lignes) etait
-- parcourue une vingtaine de fois, dont 4 sous-requetes EXISTS correlees par profil.
--
-- Ici :
--  * index sur les colonnes de date / utilisateur ;
--  * UNE passe sur cartes_manuelles pour tous les compteurs ;
--  * UNE passe "par utilisateur" (premiere / derniere carte + fenetres) pour la
--    retention, l'activation et le churn (au lieu de 4 EXISTS correles) ;
--  * une passe sur ai_scan_events et une sur training_data ;
--  * completude moyenne estimee sur un echantillon de 3 % des cartes.

CREATE INDEX IF NOT EXISTS cartes_manuelles_created_at_idx   ON cartes_manuelles (created_at);
CREATE INDEX IF NOT EXISTS cartes_manuelles_user_created_idx ON cartes_manuelles (user_id, created_at);
CREATE INDEX IF NOT EXISTS ai_scan_events_created_at_idx     ON ai_scan_events (created_at);
CREATE INDEX IF NOT EXISTS profiles_created_at_idx           ON profiles (created_at);

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
  -- une seule passe sur cartes_manuelles pour tous les compteurs
  cm AS (
    SELECT
      count(*)::int                                                                          AS total_manual,
      count(*) FILTER (WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'UTC'))::int AS today_cards,
      count(*) FILTER (WHERE created_at >= now() - interval '7 days')::int                   AS week_cards,
      count(*) FILTER (WHERE created_at >= now() - interval '30 days')::int                  AS month_cards,
      min(created_at)                                                                        AS oldest_card,
      count(DISTINCT user_id) FILTER (WHERE created_at >= now() - interval '7 days')::int    AS active_week,
      count(DISTINCT user_id) FILTER (WHERE created_at >= now() - interval '30 days')::int   AS active_month,
      count(DISTINCT user_id) FILTER (WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'UTC'))::int AS dau,
      count(DISTINCT user_id) FILTER (WHERE created_at BETWEEN now() - interval '60 days' AND now() - interval '30 days')::int AS prev_mau,
      count(*) FILTER (WHERE rc = true)::int                                                 AS with_rc,
      count(*) FILTER (WHERE auto = true)::int                                               AS with_auto,
      count(*) FILTER (WHERE patch = true)::int                                              AS with_patch,
      count(*) FILTER (WHERE num IS NOT NULL AND num <> '')::int                             AS with_num,
      count(*) FILTER (WHERE image_recto IS NOT NULL)::int                                   AS with_photo
    FROM cartes_manuelles
  ),
  -- une seule passe "par utilisateur" : premiere / derniere carte + presence dans chaque fenetre
  u AS (
    SELECT
      user_id,
      min(created_at) AS first_card,
      max(created_at) AS last_card,
      bool_or(created_at BETWEEN now() - interval '60 days' AND now() - interval '30 days') AS in_w1,
      bool_or(created_at BETWEEN now() - interval '90 days' AND now() - interval '60 days') AS in_w2
    FROM cartes_manuelles
    GROUP BY user_id
  ),
  ret AS (
    SELECT
      count(*) FILTER (WHERE u.first_card <= p.created_at + interval '7 days'  AND p.created_at <= now() - interval '7 days')::int  AS d7,
      count(*) FILTER (WHERE u.first_card <= p.created_at + interval '30 days' AND p.created_at <= now() - interval '30 days')::int AS d30,
      count(*) FILTER (WHERE u.first_card <= p.created_at + interval '7 days'
                         AND p.created_at BETWEEN now() - interval '60 days' AND now() - interval '30 days')::int AS prev_d7
    FROM profiles p
    JOIN u ON u.user_id = p.id
  ),
  churn AS (
    SELECT
      count(*) FILTER (WHERE in_w1)::int                          AS total_prev,
      count(*) FILTER (WHERE in_w1 AND last_card < now() - interval '30 days')::int AS churned
    FROM u
  ),
  prev_churn AS (
    SELECT
      count(*) FILTER (WHERE in_w2)::int                          AS total_prev,
      count(*) FILTER (WHERE in_w2 AND NOT in_w1)::int            AS churned
    FROM u
  ),
  activation AS (
    SELECT percentile_cont(0.5) WITHIN GROUP (
      ORDER BY EXTRACT(EPOCH FROM (u.first_card - p.created_at)) / 86400
    )::numeric AS median_days
    FROM profiles p
    JOIN u ON u.user_id = p.id
    WHERE u.first_card >= p.created_at
  ),
  pr AS (
    SELECT
      count(*)::int                                                                          AS total_users,
      count(*) FILTER (WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'UTC'))::int AS today_users,
      count(*) FILTER (WHERE created_at >= now() - interval '7 days')::int                   AS week_users,
      count(*) FILTER (WHERE created_at >= now() - interval '30 days')::int                  AS month_users,
      min(created_at)                                                                        AS oldest_user,
      COALESCE(SUM(stats_total), 0)::int                                                     AS total_cards,
      count(*) FILTER (WHERE stats_total > 0)::int                                           AS with_cards,
      count(*) FILTER (WHERE is_donor = true)::int                                           AS donors,
      count(*) FILTER (WHERE created_at <= now() - interval '7 days')::int                   AS base_d7,
      count(*) FILTER (WHERE created_at <= now() - interval '30 days')::int                  AS base_d30,
      count(*) FILTER (WHERE created_at BETWEEN now() - interval '60 days' AND now() - interval '30 days')::int AS base_prev_d7
    FROM profiles
  ),
  sc AS (
    SELECT
      count(*)::int                                                                           AS total_scans,
      count(*) FILTER (WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'UTC'))::int  AS scans_today,
      count(*) FILTER (WHERE created_at >= now() - interval '7 days')::int                    AS scans_week,
      count(*) FILTER (WHERE created_at >= date_trunc('month', now() AT TIME ZONE 'UTC'))::int AS scans_month,
      count(DISTINCT user_id)::int                                                            AS scanners
    FROM ai_scan_events
  ),
  td AS (
    SELECT
      count(*) FILTER (WHERE gemini_output IS NOT NULL)::int AS total_training,
      count(*) FILTER (WHERE corrected = true)::int          AS corrected_count
    FROM training_data
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
  completeness AS (
    SELECT round(avg(
      (CASE WHEN nom        IS NOT NULL AND nom        <> '' THEN 1 ELSE 0 END +
       CASE WHEN annee      IS NOT NULL AND annee      <> '' THEN 1 ELSE 0 END +
       CASE WHEN marque     IS NOT NULL AND marque     <> '' THEN 1 ELSE 0 END +
       CASE WHEN collection IS NOT NULL AND collection <> '' THEN 1 ELSE 0 END +
       CASE WHEN equipe     IS NOT NULL AND equipe     <> '' THEN 1 ELSE 0 END +
       CASE WHEN image_recto IS NOT NULL THEN 1 ELSE 0 END
      )::float / 6 * 100
    )::numeric, 1) AS v
    FROM cartes_manuelles TABLESAMPLE SYSTEM (3)
  ),
  bi AS (
    SELECT
      (SELECT count(*)::int FROM binders)                                              AS total_binders,
      (SELECT count(*)::int FROM trade_offers)                                         AS total_trade_offers,
      (SELECT count(*)::int FROM trade_offers WHERE status = 'accepted')               AS accepted,
      (SELECT count(*)::int FROM trade_offers WHERE status = 'pending')                AS pending
  )
SELECT
  jsonb_build_object(
    'total_users',            (SELECT total_users FROM pr),
    'today_users',            (SELECT today_users FROM pr),
    'week_users',             (SELECT week_users FROM pr),
    'month_users',            (SELECT month_users FROM pr),
    'oldest_user',            (SELECT oldest_user FROM pr),
    'total_cards',            (SELECT total_cards FROM pr),
    'total_cards_manual',     (SELECT total_manual FROM cm),
    'today_cards',            (SELECT today_cards FROM cm),
    'week_cards',             (SELECT week_cards FROM cm),
    'month_cards',            (SELECT month_cards FROM cm),
    'oldest_card',            (SELECT oldest_card FROM cm),
    'active_users_week',      (SELECT active_week FROM cm),
    'active_users_month',     (SELECT active_month FROM cm),
    'user_daily',             (SELECT coalesce(jsonb_agg(jsonb_build_object('day', day, 'count', cnt) ORDER BY day), '[]') FROM user_daily),
    'card_daily',             (SELECT coalesce(jsonb_agg(jsonb_build_object('day', day, 'count', cnt) ORDER BY day), '[]') FROM card_daily),

    -- gemini-2.5-flash, thinkingBudget:0 -> 0,00013 EUR/scan mesure
    'total_scans',            (SELECT total_scans FROM sc),
    'scans_today',            (SELECT scans_today FROM sc),
    'scans_week',             (SELECT scans_week FROM sc),
    'scans_month',            (SELECT scans_month FROM sc),
    'estimated_cost_eur',     (SELECT round((total_scans * 0.00013)::numeric, 4) FROM sc),
    'cost_month_eur',         (SELECT round((scans_month * 0.00013)::numeric, 4) FROM sc),

    'scan_total_training',    (SELECT total_training FROM td),
    'scan_corrected_count',   (SELECT corrected_count FROM td),
    'top_corrected_fields',   (SELECT coalesce(arr, '[]') FROM top_corrections),

    'cards_with_rc',          (SELECT with_rc FROM cm),
    'cards_with_auto',        (SELECT with_auto FROM cm),
    'cards_with_patch',       (SELECT with_patch FROM cm),
    'cards_with_num',         (SELECT with_num FROM cm),
    'cards_with_photo',       (SELECT with_photo FROM cm),
    'avg_card_completeness',  (SELECT coalesce(v, 0) FROM completeness),
    'top_marques',            (SELECT coalesce(arr, '[]') FROM top_marques),

    'total_binders',          (SELECT total_binders FROM bi),
    'total_trade_offers',     (SELECT total_trade_offers FROM bi),
    'trade_offers_accepted',  (SELECT accepted FROM bi),
    'trade_offers_pending',   (SELECT pending FROM bi)
  )
  ||
  jsonb_build_object(
    'funnel_registered',      (SELECT total_users FROM pr),
    'funnel_scanned',         (SELECT scanners FROM sc),
    'funnel_first_card',      (SELECT with_cards FROM pr),

    'retention_d7_count',     (SELECT d7 FROM ret),
    'retention_d7_base',      (SELECT base_d7 FROM pr),
    'prev_retention_d7_count',(SELECT prev_d7 FROM ret),
    'prev_retention_d7_base', (SELECT base_prev_d7 FROM pr),
    'retention_d30_count',    (SELECT d30 FROM ret),
    'retention_d30_base',     (SELECT base_d30 FROM pr),
    'dau',                    (SELECT dau FROM cm),
    'prev_mau',               (SELECT prev_mau FROM cm),
    'churn_count',            (SELECT churned FROM churn),
    'churn_base',             (SELECT total_prev FROM churn),
    'prev_churn_count',       (SELECT churned FROM prev_churn),
    'prev_churn_base',        (SELECT total_prev FROM prev_churn),

    'activation_delay_median',(SELECT round(median_days, 1) FROM activation),
    'donor_count',            (SELECT donors FROM pr),
    'top_users',              (SELECT coalesce(jsonb_agg(jsonb_build_object('name', name, 'cards', card_count)), '[]') FROM top_users)
  );
$$;

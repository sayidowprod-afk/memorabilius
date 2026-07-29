-- RPC admin : toutes les stats en un seul appel SQL (pas de limite pagination)
-- Appelée uniquement depuis l'API route avec le service role key
-- v2 : total_cards = SUM(stats_total) toutes sources (CSV inclus), + total_cards_manual
CREATE OR REPLACE FUNCTION admin_stats()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
AS $$
WITH
  user_daily AS (
    SELECT date_trunc('day', created_at AT TIME ZONE 'UTC')::date AS day, count(*)::int AS cnt
    FROM profiles
    WHERE created_at >= now() - interval '30 days'
    GROUP BY day
  ),
  card_daily AS (
    SELECT date_trunc('day', created_at AT TIME ZONE 'UTC')::date AS day, count(*)::int AS cnt
    FROM cartes_manuelles
    WHERE created_at >= now() - interval '30 days'
    GROUP BY day
  )
SELECT jsonb_build_object(
  'total_users',         (SELECT count(*)::int FROM profiles),
  'today_users',         (SELECT count(*)::int FROM profiles WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'UTC')),
  'week_users',          (SELECT count(*)::int FROM profiles WHERE created_at >= now() - interval '7 days'),
  'month_users',         (SELECT count(*)::int FROM profiles WHERE created_at >= now() - interval '30 days'),
  'oldest_user',         (SELECT min(created_at) FROM profiles),
  'total_cards',         (SELECT COALESCE(SUM(stats_total), 0)::int FROM profiles),
  'total_cards_manual',  (SELECT count(*)::int FROM cartes_manuelles),
  'today_cards',         (SELECT count(*)::int FROM cartes_manuelles WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'UTC')),
  'week_cards',          (SELECT count(*)::int FROM cartes_manuelles WHERE created_at >= now() - interval '7 days'),
  'month_cards',         (SELECT count(*)::int FROM cartes_manuelles WHERE created_at >= now() - interval '30 days'),
  'oldest_card',         (SELECT min(created_at) FROM cartes_manuelles),
  'active_users_week',   (SELECT count(DISTINCT user_id)::int FROM cartes_manuelles WHERE created_at >= now() - interval '7 days'),
  'active_users_month',  (SELECT count(DISTINCT user_id)::int FROM cartes_manuelles WHERE created_at >= now() - interval '30 days'),
  'user_daily',          (SELECT coalesce(jsonb_agg(jsonb_build_object('day', day, 'count', cnt) ORDER BY day), '[]') FROM user_daily),
  'card_daily',          (SELECT coalesce(jsonb_agg(jsonb_build_object('day', day, 'count', cnt) ORDER BY day), '[]') FROM card_daily)
);
$$;

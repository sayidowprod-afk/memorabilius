-- Backfill XP rétroactif — à exécuter APRÈS 20260819_xp_events.sql.
-- Sans ça, le passage au système événementiel remet tout le monde à 0/niveau 1
-- du jour au lendemain. Reconstitue l'XP que chaque compte aurait gagné si le
-- barème actuel (voir src/lib/xp.ts) avait toujours existé, à partir des
-- données déjà en base : cartes (avec leurs flags rc/auto/patch/num), badges
-- actuellement débloqués, teams rejointes, échanges acceptés, likes reçus,
-- meilleur streak jamais atteint.
--
-- Idempotent : chaque bloc vérifie l'absence d'un événement 'backfill_*'
-- avant d'écrire, donc relancer ce script ne double pas l'XP.

-- Cartes : même barème que xpForCard() côté app (+1 base, +3 RC, +5 auto,
-- +5 patch, +3 numérotée, cumulables).
INSERT INTO xp_events (user_id, type, amount, meta)
SELECT cm.user_id, 'backfill_cards',
  SUM(1
      + (CASE WHEN cm.rc    THEN 3 ELSE 0 END)
      + (CASE WHEN cm.auto  THEN 5 ELSE 0 END)
      + (CASE WHEN cm.patch THEN 5 ELSE 0 END)
      + (CASE WHEN cm.num IS NOT NULL AND cm.num <> '' THEN 3 ELSE 0 END))::int,
  '{"backfill": true}'::jsonb
FROM cartes_manuelles cm
WHERE NOT EXISTS (SELECT 1 FROM xp_events e WHERE e.user_id = cm.user_id AND e.type = 'backfill_cards')
GROUP BY cm.user_id;

-- Teams rejointes
INSERT INTO xp_events (user_id, type, amount, meta)
SELECT tm.user_id, 'backfill_teams', COUNT(*)::int * 20, '{"backfill": true}'::jsonb
FROM team_members tm
WHERE NOT EXISTS (SELECT 1 FROM xp_events e WHERE e.user_id = tm.user_id AND e.type = 'backfill_teams')
GROUP BY tm.user_id;

-- Échanges conclus (compte pour les deux parties d'un échange accepté)
INSERT INTO xp_events (user_id, type, amount, meta)
SELECT t.uid, 'backfill_trades', COUNT(*)::int * 10, '{"backfill": true}'::jsonb
FROM (
  SELECT sender_id AS uid FROM trade_offers WHERE status = 'accepted'
  UNION ALL
  SELECT receiver_id AS uid FROM trade_offers WHERE status = 'accepted'
) t
WHERE NOT EXISTS (SELECT 1 FROM xp_events e WHERE e.user_id = t.uid AND e.type = 'backfill_trades')
GROUP BY t.uid;

-- Likes reçus (pas de plafond ici, contrairement au flux temps réel : c'est
-- de l'historique déjà accumulé, pas du farming à venir)
INSERT INTO xp_events (user_id, type, amount, meta)
SELECT cl.gallery_user_id, 'backfill_likes', COUNT(*)::int * 2, '{"backfill": true}'::jsonb
FROM card_likes cl
WHERE NOT EXISTS (SELECT 1 FROM xp_events e WHERE e.user_id = cl.gallery_user_id AND e.type = 'backfill_likes')
GROUP BY cl.gallery_user_id;

-- Paliers de streak déjà atteints (sur longest_streak, pas le streak courant)
INSERT INTO xp_events (user_id, type, amount, meta)
SELECT p.id, 'backfill_streak',
  CASE WHEN p.longest_streak >= 100 THEN 160
       WHEN p.longest_streak >= 30  THEN 60
       WHEN p.longest_streak >= 7   THEN 10
       ELSE 0 END,
  jsonb_build_object('longest_streak', p.longest_streak)
FROM profiles p
WHERE COALESCE(p.longest_streak, 0) >= 7
  AND NOT EXISTS (SELECT 1 FROM xp_events e WHERE e.user_id = p.id AND e.type = 'backfill_streak');

-- Badges actuellement débloqués → +15 chacun, et on les marque comme "vus"
-- dans profiles.xp_badges_seen pour que checkAndAwardBadgeXP() ne les
-- recompte pas au prochain ajout de carte. Boucle nécessaire ici car les
-- paliers franchis dépendent des seuils par catégorie (voir badgeDefinitions.ts).
DO $$
DECLARE
  p RECORD;
  b RECORD;
  v_cat RECORD;
  v_badge_ids TEXT[];
  i INT;
BEGIN
  FOR p IN
    SELECT pr.id FROM profiles pr
    WHERE NOT EXISTS (SELECT 1 FROM xp_events e WHERE e.user_id = pr.id AND e.type = 'backfill_badges')
  LOOP
    SELECT * INTO b FROM get_user_badge_data(p.id) LIMIT 1;
    CONTINUE WHEN b IS NULL;

    v_badge_ids := ARRAY[]::TEXT[];
    FOR v_cat IN SELECT * FROM (VALUES
      ('cartes', b.stat_total,       ARRAY[100,250,500,750,1000,1500,2000,2500,5000]),
      ('rc',     b.stat_rc,          ARRAY[25,50,75,100,250,500,750,1000]),
      ('patch',  b.stat_patch,       ARRAY[25,50,75,100,250,500,750,1000]),
      ('num',    b.stat_num,         ARRAY[25,50,75,100,250,500,750,1000]),
      ('mois',   b.mois_count,       ARRAY[1,3,6,10,20]),
      ('views',  b.views_count::int, ARRAY[100,500,1000]),
      ('teams',  b.teams_count,      ARRAY[1])
    ) AS t(cat_id, val, thresholds)
    LOOP
      FOR i IN 1 .. array_length(v_cat.thresholds, 1) LOOP
        IF v_cat.val >= v_cat.thresholds[i] THEN
          v_badge_ids := array_append(v_badge_ids, v_cat.cat_id || '_' || v_cat.thresholds[i]);
        END IF;
      END LOOP;
    END LOOP;

    IF array_length(v_badge_ids, 1) > 0 THEN
      INSERT INTO xp_events(user_id, type, amount, meta)
        VALUES (p.id, 'backfill_badges', array_length(v_badge_ids, 1) * 15, jsonb_build_object('badge_ids', v_badge_ids));
      UPDATE profiles SET xp_badges_seen = (
        SELECT ARRAY(SELECT DISTINCT unnest(xp_badges_seen || v_badge_ids))
      ) WHERE id = p.id;
    END IF;
  END LOOP;
END $$;

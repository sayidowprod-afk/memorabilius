WITH counts AS (
  SELECT nom, norm_player_name(nom) AS name_key, count(*) AS c
  FROM cartes_manuelles
  WHERE nom IS NOT NULL
  GROUP BY nom
),
ranked AS (
  SELECT name_key, nom, c, row_number() OVER (PARTITION BY name_key ORDER BY c DESC, nom ASC) AS rn
  FROM counts
)
INSERT INTO player_card_counts (name_key, display_name, card_count)
SELECT ranked.name_key, ranked.nom, (SELECT sum(c) FROM counts c2 WHERE c2.name_key = ranked.name_key)
FROM ranked
WHERE rn = 1
ON CONFLICT (name_key) DO UPDATE SET display_name = EXCLUDED.display_name, card_count = EXCLUDED.card_count;

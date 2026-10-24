TRUNCATE player_card_counts;

WITH split AS (
  SELECT split_player_names(nom) AS nm
  FROM cartes_manuelles
  WHERE nom IS NOT NULL
),
counts AS (
  SELECT nm, norm_player_name(nm) AS name_key, count(*) AS c
  FROM split
  GROUP BY nm
),
ranked AS (
  SELECT name_key, nm, c, row_number() OVER (PARTITION BY name_key ORDER BY c DESC, nm ASC) AS rn
  FROM counts
)
INSERT INTO player_card_counts (name_key, display_name, card_count)
SELECT ranked.name_key, ranked.nm, (SELECT sum(c) FROM counts c2 WHERE c2.name_key = ranked.name_key)
FROM ranked
WHERE rn = 1
ON CONFLICT (name_key) DO UPDATE SET display_name = EXCLUDED.display_name, card_count = EXCLUDED.card_count;

INSERT INTO player_card_counts (player_name, card_count)
SELECT nom, count(*) FROM cartes_manuelles
WHERE nom IS NOT NULL
GROUP BY nom
ON CONFLICT (player_name) DO UPDATE SET card_count = EXCLUDED.card_count;

INSERT INTO player_card_counts (player_name, card_count)
SELECT player_name, count(*) FROM card_set_entries
WHERE player_name IS NOT NULL
GROUP BY player_name
ON CONFLICT (player_name) DO UPDATE SET card_count = EXCLUDED.card_count;

-- checkAndAwardBadgeXP (src/lib/xp.ts) fait un lecture-modification-écriture sur
-- profiles.xp_badges_seen pour savoir quels paliers ont déjà été récompensés —
-- pas atomique : deux actions qui déclenchent toutes les deux un check de badge
-- presque en même temps (ex: ajouter une carte + être accepté dans une team)
-- peuvent lire le même tableau "seen" avant qu'aucune n'écrive, et toutes les
-- deux verser les 15 XP du même palier. Index unique partiel en dernier
-- rempart, même principe que xp_events_weekly_challenge_unique.
CREATE UNIQUE INDEX IF NOT EXISTS xp_events_badge_unique
  ON xp_events (user_id, (meta->>'badge_id'))
  WHERE type = 'badge_unlocked';

-- La récompense du défi hebdomadaire (voir awardChallengeXPIfNeeded dans
-- src/lib/xp.ts) était protégée contre le double versement par un simple
-- SELECT-puis-INSERT côté application, sans contrainte en base — deux appels
-- concurrents à /api/challenge-complete (ex: le dashboard qui re-déclenche
-- l'appel à chaque montage tant que le défi reste complété) pouvaient tous
-- les deux passer le SELECT avant qu'aucun INSERT n'ait eu lieu, doublant
-- l'XP versée pour la même semaine.
--
-- Index unique partiel sur (user_id, meta->>'week') pour les lignes de type
-- 'weekly_challenge' : la base elle-même refuse maintenant un doublon, quel
-- que soit le timing des requêtes concurrentes.
CREATE UNIQUE INDEX IF NOT EXISTS xp_events_weekly_challenge_unique
  ON xp_events (user_id, (meta->>'week'))
  WHERE type = 'weekly_challenge';

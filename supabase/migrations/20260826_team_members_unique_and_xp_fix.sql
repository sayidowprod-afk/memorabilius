-- team_members n'a aucune contrainte unique sur (team_id, user_id) — l'ancienne
-- contrainte a été explicitement supprimée (20260810_team_members_multi_team.sql)
-- pour permettre le multi-équipe, sans jamais la remplacer par une contrainte
-- composite. team-accept/route.ts fait un check-then-insert classique (même
-- forme que le bug déjà corrigé sur le défi hebdomadaire) : deux requêtes
-- concurrentes (double-tap sur "Accepter") peuvent toutes les deux lire
-- "pas encore membre" avant qu'aucune n'écrive, créer 2 lignes team_members
-- pour le même (team, user), et verser 2x les 20 XP de "team_joined".
CREATE UNIQUE INDEX IF NOT EXISTS team_members_team_user_unique ON team_members (team_id, user_id);

-- La policy SELECT "Voir ses candidatures" ne permettait en realite qu'aux
-- fondateurs/admins de la team de voir les lignes de team_candidatures --
-- jamais au candidat lui-meme, malgre son nom. Consequence : le client ne
-- pouvait jamais retrouver sa propre candidature "en_attente" apres un
-- rechargement (RLS filtrait silencieusement la ligne), le bouton "Rejoindre"
-- redevenait donc disponible alors qu'une candidature existait deja, menant
-- a une erreur de contrainte unique au clic ("duplicate key value violates
-- unique constraint team_candidatures_team_id_user_id_key").
DROP POLICY IF EXISTS "Voir ses candidatures" ON team_candidatures;
CREATE POLICY "Voir ses candidatures" ON team_candidatures
  FOR SELECT USING (
    auth.uid() = user_id
    OR auth.uid() = (SELECT teams.created_by FROM teams WHERE teams.id = team_candidatures.team_id)
    OR EXISTS (SELECT 1 FROM team_members WHERE team_members.team_id = team_candidatures.team_id AND team_members.user_id = auth.uid() AND team_members.role = 'admin')
  );

-- Le bouton "Quitter" est masqué pour le fondateur côté UI (teams/[teamId]/page.tsx),
-- mais la policy RLS DELETE sur team_members autorise n'importe quel membre à
-- supprimer SA PROPRE ligne (auth.uid() = user_id), fondateur inclus — un appel
-- direct au client Supabase (devtools, ou un futur bug UI) pouvait donc faire
-- partir un fondateur sans que teams.created_by ne soit jamais mis à jour,
-- laissant un fondateur fantôme (droits d'édition/validation de candidatures
-- pour toujours, invisible dans la liste des membres) — même défaut que celui
-- déjà corrigé pour la suppression de compte, ici déclenché par "quitter"
-- plutôt que par la suppression du compte.
--
-- Trigger plutôt que code applicatif : s'applique quel que soit le chemin
-- d'appel (UI actuelle, API, ou un appel direct au client comme ci-dessus),
-- pas seulement le bouton "Quitter" d'aujourd'hui.
CREATE OR REPLACE FUNCTION transfer_team_ownership_on_leave()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next_owner UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM teams WHERE id = OLD.team_id AND created_by = OLD.user_id) THEN
    SELECT user_id INTO v_next_owner
      FROM team_members WHERE team_id = OLD.team_id AND user_id <> OLD.user_id
      ORDER BY joined_at ASC LIMIT 1;
    IF v_next_owner IS NOT NULL THEN
      UPDATE teams SET created_by = v_next_owner WHERE id = OLD.team_id;
    ELSE
      DELETE FROM teams WHERE id = OLD.team_id;
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_team_member_leave ON team_members;
CREATE TRIGGER on_team_member_leave
  AFTER DELETE ON team_members
  FOR EACH ROW
  EXECUTE FUNCTION transfer_team_ownership_on_leave();

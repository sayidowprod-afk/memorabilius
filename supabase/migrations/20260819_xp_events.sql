-- Système XP événementiel — remplace l'ancien calcul dérivé
-- (stats_total*2 + badges*15 + teams*20, recalculé à chaque affichage) par un
-- journal d'événements : chaque gain est écrit une fois au moment de l'action
-- et n'est jamais recalculé. Avantage principal : l'XP ne redescend plus
-- jamais (supprimer une carte en double ou quitter une team ne faisait déjà
-- rien à stats_total à long terme, mais avec l'ancien système ça faisait
-- perdre des niveaux immédiatement, ce qui est un mauvais ressenti pour une
-- progression de type jeu).
--
-- Écriture réservée au service role (routes API), donc pas de policy INSERT
-- pour authenticated/anon : un utilisateur ne peut pas s'auto-attribuer d'XP.
CREATE TABLE IF NOT EXISTS xp_events (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  amount     INT NOT NULL,
  meta       JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS xp_events_user_idx ON xp_events(user_id);
CREATE INDEX IF NOT EXISTS xp_events_user_type_created_idx ON xp_events(user_id, type, created_at DESC);

ALTER TABLE xp_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "xp_events_select" ON xp_events
  FOR SELECT USING (auth.uid() = user_id);

-- Cache des paliers de badges déjà récompensés en XP, pour ne les compter
-- qu'une fois même si plusieurs actions font franchir le même palier
-- (ex: ajouter une carte peut faire franchir un palier RC et un palier
-- collection en même temps).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS xp_badges_seen TEXT[] NOT NULL DEFAULT '{}';

-- SECURITY DEFINER pour rester lisible publiquement (niveau affiché sur la
-- galerie de n'importe quel collectionneur), comme get_user_badge_data.
CREATE OR REPLACE FUNCTION get_user_xp_total(p_user_id UUID)
RETURNS INT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(SUM(amount), 0)::INT FROM xp_events WHERE user_id = p_user_id;
$$;

GRANT EXECUTE ON FUNCTION get_user_xp_total(uuid) TO anon, authenticated;

-- Paliers de streak : XP versé une fois par palier atteint (peut se
-- redéclencher si le streak retombe puis remonte, ce qui est voulu — ça
-- récompense le fait de reprendre l'habitude).
CREATE OR REPLACE FUNCTION bump_streak(p_user_id UUID)
RETURNS TABLE(current_streak INT, longest_streak INT) AS $$
DECLARE
  v_last DATE;
  v_current INT;
  v_longest INT;
  v_milestone_xp INT;
BEGIN
  SELECT p.last_activity_date, p.current_streak, p.longest_streak
    INTO v_last, v_current, v_longest
    FROM profiles p WHERE p.id = p_user_id;

  IF v_last = CURRENT_DATE THEN
    RETURN QUERY SELECT v_current, v_longest;
    RETURN;
  ELSIF v_last = CURRENT_DATE - INTERVAL '1 day' THEN
    v_current := COALESCE(v_current, 0) + 1;
  ELSE
    v_current := 1;
  END IF;

  v_longest := GREATEST(COALESCE(v_longest, 0), v_current);

  UPDATE profiles SET current_streak = v_current, longest_streak = v_longest, last_activity_date = CURRENT_DATE
    WHERE id = p_user_id;

  v_milestone_xp := CASE v_current WHEN 7 THEN 10 WHEN 30 THEN 50 WHEN 100 THEN 100 ELSE NULL END;
  IF v_milestone_xp IS NOT NULL THEN
    INSERT INTO xp_events(user_id, type, amount, meta)
      VALUES (p_user_id, 'streak_milestone', v_milestone_xp, jsonb_build_object('streak', v_current));
  END IF;

  RETURN QUERY SELECT v_current, v_longest;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

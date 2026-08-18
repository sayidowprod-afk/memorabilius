-- Streak quotidien : jours consécutifs d'activité (ouverture du dashboard).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_streak INT NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS longest_streak INT NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_activity_date DATE;

-- Logique atomique côté DB (évite les races si plusieurs onglets/appels en
-- parallèle) : incrémente si la dernière activité était hier, reset à 1 si
-- l'écart est de plus d'un jour, ne fait rien si déjà compté aujourd'hui.
CREATE OR REPLACE FUNCTION bump_streak(p_user_id UUID)
RETURNS TABLE(current_streak INT, longest_streak INT) AS $$
DECLARE
  v_last DATE;
  v_current INT;
  v_longest INT;
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

  RETURN QUERY SELECT v_current, v_longest;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

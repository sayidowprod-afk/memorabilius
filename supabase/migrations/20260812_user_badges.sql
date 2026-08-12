-- Table des badges débloqués par utilisateur
CREATE TABLE IF NOT EXISTS public.user_badges (
  user_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_id  text NOT NULL,
  earned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, badge_id)
);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_badges_read" ON public.user_badges FOR SELECT USING (true);

-- Calcule et stocke les badges d'un utilisateur (idempotent — ON CONFLICT DO NOTHING)
CREATE OR REPLACE FUNCTION compute_user_badges(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_total int    := 0; v_rc    int    := 0;
  v_patch int    := 0; v_num   int    := 0;
  v_mois  int    := 0; v_views bigint := 0;
  v_teams int    := 0;
  v_new   text[] := ARRAY[]::text[];
BEGIN
  SELECT COALESCE(stats_total,0), COALESCE(stats_rc,0),
         COALESCE(stats_patch,0), COALESCE(stats_num,0)
  INTO v_total, v_rc, v_patch, v_num
  FROM profiles WHERE id = p_user_id;

  SELECT COUNT(*)::int INTO v_mois
  FROM badges WHERE user_id = p_user_id AND type = 'collectionneur_du_mois';

  SELECT COUNT(*) INTO v_views
  FROM page_views WHERE path LIKE '/galerie/' || p_user_id::text || '%';

  SELECT COUNT(*)::int INTO v_teams
  FROM team_members WHERE user_id = p_user_id;

  -- Cartes totales
  IF v_total >= 100   THEN v_new := v_new || 'cartes_100';  END IF;
  IF v_total >= 500   THEN v_new := v_new || 'cartes_500';  END IF;
  IF v_total >= 1000  THEN v_new := v_new || 'cartes_1000'; END IF;
  IF v_total >= 2000  THEN v_new := v_new || 'cartes_2000'; END IF;
  IF v_total >= 5000  THEN v_new := v_new || 'cartes_5000'; END IF;
  -- RC
  IF v_rc >= 100  THEN v_new := v_new || 'rc_100';  END IF;
  IF v_rc >= 250  THEN v_new := v_new || 'rc_250';  END IF;
  IF v_rc >= 500  THEN v_new := v_new || 'rc_500';  END IF;
  IF v_rc >= 1000 THEN v_new := v_new || 'rc_1000'; END IF;
  -- Patch
  IF v_patch >= 100  THEN v_new := v_new || 'patch_100';  END IF;
  IF v_patch >= 250  THEN v_new := v_new || 'patch_250';  END IF;
  IF v_patch >= 500  THEN v_new := v_new || 'patch_500';  END IF;
  IF v_patch >= 1000 THEN v_new := v_new || 'patch_1000'; END IF;
  -- Numérotées
  IF v_num >= 100  THEN v_new := v_new || 'num_100';  END IF;
  IF v_num >= 250  THEN v_new := v_new || 'num_250';  END IF;
  IF v_num >= 500  THEN v_new := v_new || 'num_500';  END IF;
  IF v_num >= 1000 THEN v_new := v_new || 'num_1000'; END IF;
  -- Collectionneur du mois
  IF v_mois >= 1 THEN v_new := v_new || 'mois_1'; END IF;
  IF v_mois >= 3 THEN v_new := v_new || 'mois_3'; END IF;
  IF v_mois >= 6 THEN v_new := v_new || 'mois_6'; END IF;
  -- Populaire
  IF v_views >= 100  THEN v_new := v_new || 'views_100';  END IF;
  IF v_views >= 500  THEN v_new := v_new || 'views_500';  END IF;
  IF v_views >= 1000 THEN v_new := v_new || 'views_1000'; END IF;
  -- Communauté
  IF v_teams >= 1 THEN v_new := v_new || 'teams_1'; END IF;
  IF v_teams >= 3 THEN v_new := v_new || 'teams_3'; END IF;
  IF v_teams >= 5 THEN v_new := v_new || 'teams_5'; END IF;

  IF array_length(v_new, 1) > 0 THEN
    INSERT INTO user_badges(user_id, badge_id)
    SELECT p_user_id, unnest(v_new)
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

-- Retourne les badges + valeurs actuelles pour les progress bars
CREATE OR REPLACE FUNCTION get_user_badge_data(p_user_id uuid)
RETURNS TABLE(
  earned_badges text[],
  stat_total    int,
  stat_rc       int,
  stat_patch    int,
  stat_num      int,
  mois_count    int,
  views_count   bigint,
  teams_count   int
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    ARRAY(SELECT badge_id FROM user_badges WHERE user_id = p_user_id),
    COALESCE(p.stats_total,  0)::int,
    COALESCE(p.stats_rc,     0)::int,
    COALESCE(p.stats_patch,  0)::int,
    COALESCE(p.stats_num,    0)::int,
    (SELECT COUNT(*)::int  FROM badges      WHERE user_id = p_user_id AND type = 'collectionneur_du_mois'),
    (SELECT COUNT(*)       FROM page_views  WHERE path LIKE '/galerie/' || p_user_id::text || '%'),
    (SELECT COUNT(*)::int  FROM team_members WHERE user_id = p_user_id)
  FROM profiles p WHERE p.id = p_user_id;
$$;

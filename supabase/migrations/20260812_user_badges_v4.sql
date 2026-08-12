-- v4 : grants d'exécution + paliers 25/50/75 pour rc/patch/num + exception handling

-- Grants manquants (cause probable des badges non affichés)
GRANT EXECUTE ON FUNCTION compute_user_badges(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_user_badge_data(uuid) TO anon, authenticated;

-- Accès en écriture à user_badges pour la fonction SECURITY DEFINER
GRANT INSERT ON TABLE public.user_badges TO anon, authenticated;

CREATE OR REPLACE FUNCTION compute_user_badges(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_total int := 0; v_rc int := 0;
  v_patch int := 0; v_num int := 0;
  v_mois  int := 0; v_views bigint := 0;
  v_teams int := 0;
  v_new   text[] := ARRAY[]::text[];
BEGIN
  SELECT COALESCE(stats_total,0), COALESCE(stats_rc,0),
         COALESCE(stats_patch,0), COALESCE(stats_num,0)
  INTO v_total, v_rc, v_patch, v_num
  FROM profiles WHERE id = p_user_id;

  BEGIN
    SELECT COUNT(*)::int INTO v_mois FROM badges
    WHERE user_id = p_user_id AND type = 'collectionneur_du_mois';
  EXCEPTION WHEN OTHERS THEN v_mois := 0; END;

  BEGIN
    SELECT COUNT(*) INTO v_views FROM page_views
    WHERE path LIKE '/galerie/' || p_user_id::text || '%';
  EXCEPTION WHEN OTHERS THEN v_views := 0; END;

  BEGIN
    SELECT COUNT(*)::int INTO v_teams FROM team_members WHERE user_id = p_user_id;
  EXCEPTION WHEN OTHERS THEN v_teams := 0; END;

  -- Cartes totales
  IF v_total >= 100   THEN v_new := v_new || 'cartes_100';  END IF;
  IF v_total >= 500   THEN v_new := v_new || 'cartes_500';  END IF;
  IF v_total >= 1000  THEN v_new := v_new || 'cartes_1000'; END IF;
  IF v_total >= 2000  THEN v_new := v_new || 'cartes_2000'; END IF;
  IF v_total >= 5000  THEN v_new := v_new || 'cartes_5000'; END IF;
  -- RC
  IF v_rc >= 25   THEN v_new := v_new || 'rc_25';   END IF;
  IF v_rc >= 50   THEN v_new := v_new || 'rc_50';   END IF;
  IF v_rc >= 75   THEN v_new := v_new || 'rc_75';   END IF;
  IF v_rc >= 100  THEN v_new := v_new || 'rc_100';  END IF;
  IF v_rc >= 250  THEN v_new := v_new || 'rc_250';  END IF;
  IF v_rc >= 500  THEN v_new := v_new || 'rc_500';  END IF;
  IF v_rc >= 750  THEN v_new := v_new || 'rc_750';  END IF;
  IF v_rc >= 1000 THEN v_new := v_new || 'rc_1000'; END IF;
  -- Patch
  IF v_patch >= 25   THEN v_new := v_new || 'patch_25';   END IF;
  IF v_patch >= 50   THEN v_new := v_new || 'patch_50';   END IF;
  IF v_patch >= 75   THEN v_new := v_new || 'patch_75';   END IF;
  IF v_patch >= 100  THEN v_new := v_new || 'patch_100';  END IF;
  IF v_patch >= 250  THEN v_new := v_new || 'patch_250';  END IF;
  IF v_patch >= 500  THEN v_new := v_new || 'patch_500';  END IF;
  IF v_patch >= 750  THEN v_new := v_new || 'patch_750';  END IF;
  IF v_patch >= 1000 THEN v_new := v_new || 'patch_1000'; END IF;
  -- Numérotées
  IF v_num >= 25   THEN v_new := v_new || 'num_25';   END IF;
  IF v_num >= 50   THEN v_new := v_new || 'num_50';   END IF;
  IF v_num >= 75   THEN v_new := v_new || 'num_75';   END IF;
  IF v_num >= 100  THEN v_new := v_new || 'num_100';  END IF;
  IF v_num >= 250  THEN v_new := v_new || 'num_250';  END IF;
  IF v_num >= 500  THEN v_new := v_new || 'num_500';  END IF;
  IF v_num >= 750  THEN v_new := v_new || 'num_750';  END IF;
  IF v_num >= 1000 THEN v_new := v_new || 'num_1000'; END IF;
  -- Collectionneur du mois
  IF v_mois >= 1  THEN v_new := v_new || 'mois_1';  END IF;
  IF v_mois >= 3  THEN v_new := v_new || 'mois_3';  END IF;
  IF v_mois >= 6  THEN v_new := v_new || 'mois_6';  END IF;
  IF v_mois >= 10 THEN v_new := v_new || 'mois_10'; END IF;
  IF v_mois >= 20 THEN v_new := v_new || 'mois_20'; END IF;
  -- Populaire
  IF v_views >= 100  THEN v_new := v_new || 'views_100';  END IF;
  IF v_views >= 500  THEN v_new := v_new || 'views_500';  END IF;
  IF v_views >= 1000 THEN v_new := v_new || 'views_1000'; END IF;
  -- Communauté
  IF v_teams >= 1 THEN v_new := v_new || 'teams_1'; END IF;

  IF array_length(v_new, 1) > 0 THEN
    INSERT INTO user_badges(user_id, badge_id)
    SELECT p_user_id, unnest(v_new)
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

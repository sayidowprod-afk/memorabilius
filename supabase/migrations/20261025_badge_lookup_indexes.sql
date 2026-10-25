-- Suite de l'audit perf avec l'assistant Supabase (pg_stat_statements) :
-- get_user_badge_data (appelee a chaque affichage de badges/profil) n'avait
-- aucun index exploitable pour ses 3 sous-requetes, forcant un scan complet
-- a chaque fois.
CREATE INDEX IF NOT EXISTS idx_badges_user_type ON public.badges (user_id, type);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON public.team_members (user_id);
-- text_pattern_ops : la fonction filtre par prefixe (LIKE '/galerie/<id>%'),
-- un index btree standard ne sert pas ce pattern.
CREATE INDEX IF NOT EXISTS idx_page_views_path_pattern ON public.page_views (path text_pattern_ops);

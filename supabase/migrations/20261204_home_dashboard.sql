-- Accueil des membres : le cœur du tableau de bord en UNE requête au lieu de cinq (profil, dernières cartes, cartes de la semaine, XP, décompte).
-- « security invoker » : les règles de sécurité habituelles s'appliquent comme pour les requêtes directes (aucun accès de plus).
-- Le site retombe sur les requêtes séparées tant que cette fonction n'existe pas.
-- Retour en arrière : drop function public.get_home_dashboard(uuid, timestamptz);
create or replace function public.get_home_dashboard(p_user_id uuid, p_week_start timestamptz)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'profile',   (select to_jsonb(p) from (select display_name, avatar_url, stats_total, stats_auto, lien_csv from public.profiles where id = p_user_id) p),
    'lastCards', (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb)
                  from (select image_recto, nom from public.cartes_manuelles where user_id = p_user_id and image_recto is not null order by created_at desc limit 24) c),
    'weekCards', (select coalesce(jsonb_agg(to_jsonb(w)), '[]'::jsonb)
                  from (select rc, auto, patch, num from public.cartes_manuelles where user_id = p_user_id and created_at >= p_week_start) w),
    'liveCount', (select count(*) from public.cartes_manuelles where user_id = p_user_id),
    'xpTotal',   public.get_user_xp_total(p_user_id)
  )
$$;
grant execute on function public.get_home_dashboard(uuid, timestamptz) to authenticated;

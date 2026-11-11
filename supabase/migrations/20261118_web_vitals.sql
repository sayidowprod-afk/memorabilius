-- Mesures de vitesse chez les vrais membres (temps d'affichage, réactivité, stabilité), par page et par appareil.
-- Échantillonnées (1 visite sur 5), envoyées une seule fois à la fermeture de la page, directement à Supabase : aucune fonction Vercel supplémentaire.
-- Les lignes de plus de 30 jours sont supprimées automatiquement à chaque consultation de la page admin.
-- À appliquer dans le SQL editor de Supabase. Sans elle, le site continue de fonctionner (les mesures sont simplement perdues).

create table if not exists public.web_vitals (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  page text not null check (char_length(page) <= 120),
  metric text not null check (metric in ('LCP', 'INP', 'CLS', 'TTFB', 'FCP')),
  value double precision not null check (value >= 0 and value < 600000),
  device text not null check (device in ('mobile', 'desktop', 'app')),
  nav_type text
);
create index if not exists web_vitals_created_idx on public.web_vitals (created_at);
create index if not exists web_vitals_page_metric_idx on public.web_vitals (page, metric, created_at);

alter table public.web_vitals enable row level security;
drop policy if exists "mesures : envoi par tout visiteur" on public.web_vitals;
create policy "mesures : envoi par tout visiteur" on public.web_vitals for insert to anon, authenticated with check (true);
-- pas de lecture directe : seul l'administrateur lit, via la fonction ci-dessous

-- depuis le 30 octobre 2026, une nouvelle table n'a plus de droits automatiques sur l'API : on les donne explicitement
grant insert on public.web_vitals to anon, authenticated;
grant select, insert, update, delete on public.web_vitals to service_role;

-- Résumé pour la page admin : médiane (p50) et 75e centile (p75) par page / appareil / mesure sur les p_days derniers jours.
create or replace function public.web_vitals_summary(p_days integer default 7)
returns table (page text, device text, metric text, n bigint, p50 double precision, p75 double precision)
language plpgsql security definer set search_path = public as $$
begin
  if not coalesce((select is_admin from public.profiles where id = auth.uid()), false) then
    raise exception 'réservé aux administrateurs';
  end if;
  delete from public.web_vitals where created_at < now() - interval '30 days';
  return query
    select v.page, v.device, v.metric, count(*)::bigint,
           percentile_cont(0.5) within group (order by v.value),
           percentile_cont(0.75) within group (order by v.value)
    from public.web_vitals v
    where v.created_at >= now() - make_interval(days => greatest(1, least(p_days, 30)))
    group by v.page, v.device, v.metric
    order by count(*) desc;
end $$;
revoke all on function public.web_vitals_summary(integer) from public, anon;
grant execute on function public.web_vitals_summary(integer) to authenticated;

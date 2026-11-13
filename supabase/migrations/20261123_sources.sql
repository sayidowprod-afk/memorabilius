-- D'où viennent les visiteurs et les inscrits : la source d'arrivée (lien de campagne ?src=… ou site d'origine) est gardée avec chaque page vue,
-- et la première source d'un membre est retenue à son inscription. À appliquer dans le SQL editor de Supabase.
-- Sans elle, le suivi des pages vues continue comme avant ; seule la page admin « Audience » n'affichera pas les sources.

alter table public.page_views add column if not exists src text;
alter table public.page_views add column if not exists referrer text;
create index if not exists idx_page_views_src on public.page_views (src, created_at desc) where src is not null;

create table if not exists public.user_sources (
  user_id uuid primary key references auth.users(id) on delete cascade,
  src text not null,
  referrer text,
  landing text,
  created_at timestamptz not null default now()
);
alter table public.user_sources enable row level security;
-- aucune lecture par l'API publique : seul le serveur (clé de service) lit et écrit

-- depuis le 30 octobre 2026, une nouvelle table n'a plus de droits automatiques sur l'API : on les donne explicitement
grant select, insert, update, delete on public.user_sources to service_role;

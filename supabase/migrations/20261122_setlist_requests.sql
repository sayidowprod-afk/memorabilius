-- Suivi des demandes de setlist : chaque demande a un état (demandée, en cours, ajoutée, refusée) visible par les membres,
-- un « Moi aussi » (votes) pour savoir quels sets sont les plus attendus, et une notification quand la setlist est ajoutée.
-- À appliquer dans le SQL editor de Supabase. Sans elle, la page Setlist n’affiche simplement pas la liste des demandes.

create table if not exists public.setlist_requests (
  id uuid primary key default gen_random_uuid(),
  sport text not null,
  name text not null,
  name_key text not null,                                   -- nom normalisé (minuscules, sans accents ni ponctuation) pour regrouper les demandes identiques
  link text,
  status text not null default 'demandee' check (status in ('demandee', 'en_cours', 'ajoutee', 'refusee')),
  set_id text,                                              -- renseigné quand la setlist est ajoutée (lien depuis la notification)
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists setlist_requests_status_idx on public.setlist_requests (status, created_at desc);
create unique index if not exists setlist_requests_sport_key_open_idx on public.setlist_requests (sport, name_key) where status in ('demandee', 'en_cours');

create table if not exists public.setlist_request_votes (
  request_id uuid not null references public.setlist_requests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (request_id, user_id)
);
create index if not exists setlist_request_votes_user_idx on public.setlist_request_votes (user_id);

alter table public.setlist_requests enable row level security;
alter table public.setlist_request_votes enable row level security;
drop policy if exists "demandes setlist : lecture" on public.setlist_requests;
create policy "demandes setlist : lecture" on public.setlist_requests for select to authenticated using (status <> 'refusee' or created_by = auth.uid());
drop policy if exists "votes setlist : lecture des siens" on public.setlist_request_votes;
create policy "votes setlist : lecture des siens" on public.setlist_request_votes for select to authenticated using (user_id = auth.uid());
-- l'écriture passe par le serveur (clé de service) : c'est lui qui regroupe les demandes identiques et compte les « Moi aussi »

-- depuis le 30 octobre 2026, une nouvelle table n'a plus de droits automatiques sur l'API : on les donne explicitement
grant select on public.setlist_requests to authenticated;
grant select on public.setlist_request_votes to authenticated;
grant select, insert, update, delete on public.setlist_requests to service_role;
grant select, insert, update, delete on public.setlist_request_votes to service_role;

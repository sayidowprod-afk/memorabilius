-- 948 · Signalement d'une mauvaise photo de setlist : un membre signale, à 2 membres différents la photo est retirée de la ligne.
-- 939 · Calendrier de publication (admin) : une ligne par jour et par créneau, avec son statut.
-- À appliquer dans le SQL editor de Supabase. Sans elle, ces deux fonctions affichent simplement « indisponible ».

create table if not exists public.setlist_photo_reports (
  id bigserial primary key,
  entry_id bigint not null,
  image_url text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (entry_id, image_url, user_id)
);
create index if not exists idx_setlist_photo_reports_entry on public.setlist_photo_reports (entry_id, image_url);
alter table public.setlist_photo_reports enable row level security;
-- aucune lecture publique : seul le serveur (clé de service) lit et écrit

create table if not exists public.pub_calendar (
  day date not null,
  slot text not null,
  status text not null default 'planned' check (status in ('planned','ready','posted','skipped')),
  note text,
  updated_at timestamptz not null default now(),
  primary key (day, slot)
);
alter table public.pub_calendar enable row level security;

-- depuis le 30 octobre 2026, une nouvelle table n'a plus de droits automatiques sur l'API : on les donne explicitement
grant select, insert, update, delete on public.setlist_photo_reports to service_role;
grant usage, select on sequence public.setlist_photo_reports_id_seq to service_role;
grant select, insert, update, delete on public.pub_calendar to service_role;

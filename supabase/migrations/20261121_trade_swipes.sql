-- Swipe d'échanges : chaque membre fait défiler les cartes « à échanger » des autres et glisse à droite (j'aime) ou à gauche (je passe).
-- Un « j'aime » reste invisible : il n'y a un « match » que si l'autre membre a aussi aimé une de MES cartes. Alors l'offre s'ouvre préparée.
-- À appliquer dans le SQL editor de Supabase. Sans elle, l'onglet Swipe indique que la fonction n'est pas encore disponible.

create table if not exists public.trade_swipes (
  user_id uuid not null references auth.users(id) on delete cascade,   -- celui qui glisse
  card_id uuid not null,                                                -- la carte vue (cartes_manuelles.id)
  owner_id uuid not null references auth.users(id) on delete cascade,   -- propriétaire de la carte vue
  liked boolean not null,
  created_at timestamptz not null default now(),
  primary key (user_id, card_id)
);
-- retrouver vite « qui a aimé une de mes cartes » (calcul du match)
create index if not exists trade_swipes_owner_liked_idx on public.trade_swipes (owner_id, user_id) where liked;
create index if not exists trade_swipes_user_created_idx on public.trade_swipes (user_id, created_at desc);

alter table public.trade_swipes enable row level security;
drop policy if exists "swipes : lecture de ses propres glissements" on public.trade_swipes;
create policy "swipes : lecture de ses propres glissements" on public.trade_swipes for select to authenticated using (user_id = auth.uid());
-- l'écriture passe par le serveur (clé de service) : c'est lui qui calcule les matchs, personne ne lit les « j'aime » des autres

-- depuis le 30 octobre 2026, une nouvelle table n'a plus de droits automatiques sur l'API : on les donne explicitement
grant select on public.trade_swipes to authenticated;
grant select, insert, update, delete on public.trade_swipes to service_role;

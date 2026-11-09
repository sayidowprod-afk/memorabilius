-- Carte du jour : le résultat du tirage est rangé une fois par jour (le calcul lit ~20 000 cartes, 6 à 8 s de base de données).
-- Seul le serveur (service_role) y accède : RLS activé, aucune policy publique.
create table if not exists public.carte_du_jour (
  day text primary key,                       -- AAAA-MM-JJ, fuseau de Paris
  card_id uuid not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.carte_du_jour enable row level security;
-- depuis le 30 octobre 2026, une nouvelle table n'a plus de droits automatiques sur l'API : on les donne explicitement
grant select, insert, update, delete on public.carte_du_jour to service_role;

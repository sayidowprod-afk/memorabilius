-- Decks de cartes à jouer : le membre colle sa liste (« 4 Dracaufeu ex », « 1 Lightning Bolt »…) et le site compare avec sa galerie : « il me manque N cartes ».
-- À appliquer dans le SQL editor de Supabase. Sans elle, la page « Mes decks » indique que la fonction n'est pas encore disponible.

create table if not exists public.tcg_decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nom text not null check (char_length(nom) between 1 and 80),
  jeu text,
  liste text not null check (char_length(liste) <= 8000),
  created_at timestamptz not null default now()
);
create index if not exists tcg_decks_user_idx on public.tcg_decks (user_id, created_at desc);

alter table public.tcg_decks enable row level security;
drop policy if exists "decks : lecture par le propriétaire" on public.tcg_decks;
drop policy if exists "decks : ajout par le propriétaire" on public.tcg_decks;
drop policy if exists "decks : modification par le propriétaire" on public.tcg_decks;
drop policy if exists "decks : suppression par le propriétaire" on public.tcg_decks;
create policy "decks : lecture par le propriétaire" on public.tcg_decks for select to authenticated using (user_id = auth.uid());
create policy "decks : ajout par le propriétaire" on public.tcg_decks for insert to authenticated with check (user_id = auth.uid());
create policy "decks : modification par le propriétaire" on public.tcg_decks for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "decks : suppression par le propriétaire" on public.tcg_decks for delete to authenticated using (user_id = auth.uid());

-- depuis le 30 octobre 2026, une nouvelle table n'a plus de droits automatiques sur l'API : on les donne explicitement
grant select, insert, update, delete on public.tcg_decks to authenticated;
grant select, insert, update, delete on public.tcg_decks to service_role;

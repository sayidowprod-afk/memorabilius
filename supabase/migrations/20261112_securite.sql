-- Correctifs de l'audit de sécurité du 2026-11-07 (relançable sans risque).

-- ── 1. Profils : plus personne ne peut modifier le profil des autres, ni ses propres colonnes privilégiées ─────────
-- Avant : la règle « Update stats profiles » (UPDATE, rôle public, using true / with check true) laissait n'importe qui modifier
-- n'importe quel profil, y compris is_admin. Les statistiques sont écrites par le serveur (clé de service), qui ignore ces règles.
drop policy if exists "Update stats profiles" on public.profiles;

create or replace function public.protect_profile_privileged()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    new.is_admin := old.is_admin;
    new.is_donor := old.is_donor;
    new.is_demo := old.is_demo;
    new.stats_total := old.stats_total;
  end if;
  return new;
end $$;

drop trigger if exists protect_profile_privileged on public.profiles;
create trigger protect_profile_privileged before update on public.profiles
for each row execute function public.protect_profile_privileged();

-- ── 2. Anti-bruteforce de la connexion : verrouillage par adresse IP (et non plus par e-mail seul) ──────────────────
alter table public.login_attempts add column if not exists ip text;
create index if not exists login_attempts_email_ip_created_idx on public.login_attempts (email, ip, created_at desc);

-- ── 3. Prix cible de la wishlist : table privée (la wishlist elle-même est publique) ────────────────────────────────
-- wishlist_id est un texte (sans clé étrangère) pour ne pas dépendre du type de wishlist.id ; la ligne est supprimée par l'appli
-- avec la carte de wishlist, et avec le compte (on delete cascade sur user_id).
create table if not exists public.wishlist_prix_cible (
  wishlist_id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  prix numeric(10, 2) not null check (prix > 0 and prix <= 100000),
  created_at timestamptz not null default now()
);
alter table public.wishlist_prix_cible enable row level security;
drop policy if exists "prix cible : propriétaire" on public.wishlist_prix_cible;
create policy "prix cible : propriétaire" on public.wishlist_prix_cible for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.wishlist_prix_cible to authenticated;
grant all on public.wishlist_prix_cible to service_role;

-- reprise des prix déjà saisis dans l'ancienne colonne publique, puis suppression de cette colonne
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'wishlist' and column_name = 'prix_cible') then
    insert into public.wishlist_prix_cible (wishlist_id, user_id, prix)
      select id::text, user_id, prix_cible from public.wishlist where prix_cible is not null
      on conflict do nothing;
    alter table public.wishlist drop column prix_cible;
  end if;
end $$;

-- ── 4. Cartes réservées : un simple oui/non public (l'acheteur n'est plus lisible par tous) ─────────────────────────
alter table public.cartes_manuelles add column if not exists reservee boolean not null default false;
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cartes_manuelles' and column_name = 'reservee_pour') then
    update public.cartes_manuelles set reservee = true where reservee_pour is not null;
    alter table public.cartes_manuelles drop column reservee_pour;
    alter table public.cartes_manuelles drop column if exists reservee_at;
  end if;
end $$;

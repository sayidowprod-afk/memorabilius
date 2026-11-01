-- « Mes achats » : suivi de colis, notes et étiquettes perso, valeur estimée, limites / seuils d'alerte, réception,
-- lien vers la carte créée dans la collection, budgets annuel et par source, objectif d'épargne, préférences d'alertes.
-- À appliquer dans le SQL editor de Supabase. Les colonnes sont toutes facultatives : le site continue de marcher sans.

alter table public.achats_membre
  add column if not exists suivi_numero text,
  add column if not exists transporteur text,
  add column if not exists notes text,
  add column if not exists tags text[] not null default '{}',
  add column if not exists valeur_estimee numeric(12, 2),
  add column if not exists limite_perso numeric(12, 2),
  add column if not exists seuil_alerte numeric(12, 2),
  add column if not exists alerte_limite_envoyee boolean not null default false,
  add column if not exists alerte_seuil_envoyee boolean not null default false,
  add column if not exists alerte_5min_envoyee boolean not null default false,
  add column if not exists recu_at timestamptz,
  add column if not exists carte_id text;

-- Budgets : le mensuel devient facultatif (on peut ne fixer qu'un budget annuel ou par source) + objectif d'épargne.
alter table public.budgets_achats alter column mensuel drop not null;
alter table public.budgets_achats
  add column if not exists annuel numeric(10, 2) check (annuel >= 0),
  add column if not exists budget_ebay numeric(10, 2) check (budget_ebay >= 0),
  add column if not exists budget_vinted numeric(10, 2) check (budget_vinted >= 0),
  add column if not exists objectif_nom text,
  add column if not exists objectif_cible numeric(10, 2) check (objectif_cible >= 0),
  add column if not exists objectif_epargne numeric(10, 2) not null default 0 check (objectif_epargne >= 0),
  add column if not exists objectif_mensuel numeric(10, 2) check (objectif_mensuel >= 0);

-- Préférences d'alertes (quelles alertes recevoir, ne pas déranger la nuit). Une ligne par membre, modifiable par lui seul.
create table if not exists public.alertes_achats_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  prefs jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.alertes_achats_prefs enable row level security;

drop policy if exists "alertes_achats_prefs select own" on public.alertes_achats_prefs;
create policy "alertes_achats_prefs select own" on public.alertes_achats_prefs
  for select using ((select auth.uid()) = user_id);

drop policy if exists "alertes_achats_prefs insert own" on public.alertes_achats_prefs;
create policy "alertes_achats_prefs insert own" on public.alertes_achats_prefs
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "alertes_achats_prefs update own" on public.alertes_achats_prefs;
create policy "alertes_achats_prefs update own" on public.alertes_achats_prefs
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

grant select, insert, update on public.alertes_achats_prefs to authenticated;
grant all on public.alertes_achats_prefs to service_role;

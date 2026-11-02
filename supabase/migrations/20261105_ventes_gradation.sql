-- Mes ventes (eBay importé + saisie manuelle) et suivi des envois en gradation.
-- À appliquer dans le SQL editor de Supabase. Toutes les tables ont des GRANT explicites (plus d'auto-grant API depuis le 2026-10-30).

-- ── Ventes ────────────────────────────────────────────────────────────────────────────────────────────────────────
-- Une ligne par commande vendue. Les ventes eBay sont importées par le serveur (service role) ; les autres sont saisies
-- à la main. Les membres n'écrivent pas directement : tout passe par /api/ventes (validé côté serveur).
create table if not exists public.ventes_membre (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null default 'autre' check (source in ('ebay', 'vinted', 'autre')),
  ref text not null,
  titre text,
  photo_url text,
  acheteur text,
  devise text not null default 'EUR',
  prix numeric(12, 2),            -- prix des articles
  port_facture numeric(12, 2),    -- port payé par l'acheteur
  total_encaisse numeric(12, 2),  -- ce que l'acheteur a payé en tout
  frais numeric(12, 2),           -- frais de la plateforme (commission, frais de paiement)
  cout_port numeric(12, 2),       -- ce que le vendeur a réellement payé pour expédier
  cout_achat numeric(12, 2),      -- ce que la carte avait coûté (pour le profit réalisé)
  achat_id uuid,                  -- achat de « Mes achats » relié (facultatif)
  carte_id text,                  -- carte de la collection reliée (facultatif)
  notes text,
  vendu_at timestamptz,
  paye_at timestamptz,
  expedie_at timestamptz,
  order_id text,
  lien text,
  lien_commande text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source, ref)
);
create index if not exists ventes_membre_user_date_idx on public.ventes_membre (user_id, vendu_at desc);

alter table public.ventes_membre enable row level security;
drop policy if exists "ventes_membre select own" on public.ventes_membre;
create policy "ventes_membre select own" on public.ventes_membre for select using ((select auth.uid()) = user_id);
grant select on public.ventes_membre to authenticated;
grant all on public.ventes_membre to service_role;

-- dernière lecture des ventes eBay (limite la fréquence des appels à eBay) : colonne réservée au serveur
alter table public.ebay_connexions add column if not exists ventes_synchro_at timestamptz;

-- ── Envois en gradation ───────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.envois_gradation (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  societe text not null default 'PSA',
  reference text,                                   -- n° de dossier / de commande chez la société
  service text,                                     -- niveau de service (Value, Regular, Express…)
  statut text not null default 'prepare' check (statut in ('prepare', 'envoye', 'recu', 'en_grading', 'retourne', 'termine')),
  date_envoi date,
  date_reception date,                              -- reçu par la société
  date_retour_estimee date,
  date_retour date,                                 -- revenu chez le membre
  cout_total numeric(10, 2) check (cout_total >= 0),
  suivi_aller text,
  suivi_retour text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists envois_gradation_user_idx on public.envois_gradation (user_id, created_at desc);

create table if not exists public.envois_gradation_cartes (
  id uuid primary key default gen_random_uuid(),
  envoi_id uuid not null references public.envois_gradation(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  carte_id text,                                    -- carte de la collection (facultatif)
  titre text not null,
  photo_url text,
  valeur_declaree numeric(10, 2) check (valeur_declaree >= 0),
  note_obtenue text,                                -- ex. « 9 », « 9.5 », « Authentique »
  numero_cert text,
  created_at timestamptz not null default now()
);
create index if not exists envois_gradation_cartes_envoi_idx on public.envois_gradation_cartes (envoi_id);

alter table public.envois_gradation enable row level security;
alter table public.envois_gradation_cartes enable row level security;
drop policy if exists "envois_gradation own" on public.envois_gradation;
create policy "envois_gradation own" on public.envois_gradation for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "envois_gradation_cartes own" on public.envois_gradation_cartes;
create policy "envois_gradation_cartes own" on public.envois_gradation_cartes for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.envois_gradation to authenticated;
grant select, insert, update, delete on public.envois_gradation_cartes to authenticated;
grant all on public.envois_gradation to service_role;
grant all on public.envois_gradation_cartes to service_role;

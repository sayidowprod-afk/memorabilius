-- Livraison entre membres : une fois d'accord (par messages), l'acheteur indique son mode de livraison et son adresse ;
-- le vendeur prépare l'envoi chez le transporteur (La Poste / Mondial Relay) et renseigne le numéro de suivi.
-- AUCUN paiement sur le site. Le prix et les frais d'envoi se règlent entre membres, hors Memorabilius.
--
-- Écriture réservée au service role (routes /api/shipments) : les règles métier (qui peut faire quoi, validation de
-- l'adresse, cartes appartenant bien au vendeur) sont appliquées côté serveur. Lecture : acheteur et vendeur uniquement.
-- Les adresses sont des données personnelles : effacées par l'API 30 jours après la livraison ou l'annulation.
create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  cards jsonb not null default '[]'::jsonb,         -- [{ id, nom, annee, marque, image, prix }] (copie au moment de la demande)
  note text,                                        -- description libre (autre carte, lot...)
  declared_value numeric(12,2),                     -- somme des prix des cartes choisies
  carrier text not null check (carrier in ('laposte_lettre_suivie', 'laposte_colissimo', 'mondial_relay')),
  delivery_mode text not null check (delivery_mode in ('home', 'relay')),
  recipient_name text,
  address_line1 text,
  address_line2 text,
  postal_code text,
  city text,
  country text not null default 'FR',
  phone text,
  relay_label text,                                 -- point relais / point de retrait choisi (nom, adresse, identifiant)
  status text not null default 'requested' check (status in ('requested', 'shipped', 'delivered', 'cancelled')),
  tracking_number text,
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (buyer_id <> seller_id)
);

create index if not exists shipments_buyer_idx on public.shipments (buyer_id, created_at desc);
create index if not exists shipments_seller_idx on public.shipments (seller_id, created_at desc);
create index if not exists shipments_status_idx on public.shipments (status, updated_at);

alter table public.shipments enable row level security;

drop policy if exists "shipments select parties" on public.shipments;
create policy "shipments select parties" on public.shipments
  for select using ((select auth.uid()) = buyer_id or (select auth.uid()) = seller_id);

-- GRANT explicites (plus d'auto-grant API sur les nouvelles tables public) : lecture pour les membres connectés,
-- tout pour le service role (les écritures passent par les routes serveur).
grant select on public.shipments to authenticated;
grant all on public.shipments to service_role;

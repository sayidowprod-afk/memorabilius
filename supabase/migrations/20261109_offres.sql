-- Offres de prix sur une carte à vendre : l'acheteur propose un prix, le vendeur accepte, refuse ou contre-propose.
-- AUCUN paiement sur le site : une offre acceptée ouvre simplement la suite entre membres (messages, livraison).
-- Écriture réservée au service role (routes /api/offers) : toutes les règles (qui peut faire quoi, expiration, limite d'offres
-- ouvertes) sont appliquées côté serveur. Lecture : acheteur et vendeur uniquement.
create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  card_id text not null,                              -- id de la carte du vendeur (cartes_manuelles)
  card jsonb not null default '{}'::jsonb,            -- copie au moment de l'offre : { id, nom, annee, marque, image, prix }
  price numeric(10,2) not null check (price > 0),      -- prix proposé par l'acheteur
  counter_price numeric(10,2) check (counter_price > 0), -- contre-proposition du vendeur
  message text,
  status text not null default 'pending' check (status in ('pending', 'countered', 'accepted', 'refused', 'cancelled')),
  expires_at timestamptz not null,                    -- 48 h après la dernière réponse attendue
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (buyer_id <> seller_id)
);

create index if not exists offers_buyer_idx on public.offers (buyer_id, created_at desc);
create index if not exists offers_seller_idx on public.offers (seller_id, created_at desc);

alter table public.offers enable row level security;

drop policy if exists "offers select parties" on public.offers;
create policy "offers select parties" on public.offers
  for select using ((select auth.uid()) = buyer_id or (select auth.uid()) = seller_id);

-- GRANT explicites (plus d'auto-grant API sur les nouvelles tables public) : lecture pour les membres connectés,
-- tout pour le service role (les écritures passent par les routes serveur).
grant select on public.offers to authenticated;
grant all on public.offers to service_role;

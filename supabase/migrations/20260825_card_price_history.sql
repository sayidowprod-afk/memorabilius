-- Historique de prix "maison" : l'API eBay basique (Finding/Marketplace
-- Insights) ne fournit pas de tendance historique et est souvent bloquee
-- depuis Vercel (403/418) -- voir commentaires dans /api/ebay-sold. On
-- construit donc notre propre historique en enregistrant un point par jour
-- et par carte a chaque fois qu'un prix mediane est obtenu avec succes.
-- L'historique demarre a partir d'aujourd'hui, pas de retroactivite possible.
create table if not exists card_price_history (
  id bigint generated always as identity primary key,
  card_key text not null,
  snapshot_date date not null default current_date,
  median_price numeric not null,
  sample_type text not null check (sample_type in ('sold', 'active')),
  created_at timestamptz not null default now(),
  unique (card_key, snapshot_date)
);
create index if not exists card_price_history_card_key_idx on card_price_history (card_key, snapshot_date);

alter table card_price_history enable row level security;
create policy "card_price_history_select_all" on card_price_history for select using (true);

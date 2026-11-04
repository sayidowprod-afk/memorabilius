-- Stats « marché des cartes » d'une fiche joueur (catalogue mondial TCDB + annonces eBay), mises en cache sur la fiche.
alter table player_sheets add column if not exists card_market jsonb;
alter table player_sheets add column if not exists card_market_at timestamptz;

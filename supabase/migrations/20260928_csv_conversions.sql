-- Trace chaque conversion "cartes CSV -> cartes manuelles" (voir
-- /api/convert-csv-cards) pour permettre un revert : quel lien_csv avait le
-- profil avant, et quelles lignes cartes_manuelles ont ete creees par cette
-- conversion precise (pas "toutes les cartes du user", au cas ou il en aurait
-- ajoute d'autres a la main entre-temps).
create table if not exists csv_conversions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lien_csv text not null,
  card_ids uuid[] not null,
  created_at timestamptz not null default now(),
  reverted_at timestamptz
);

create index if not exists csv_conversions_user_idx on csv_conversions(user_id, created_at desc);

-- Pas de policy authenticated : uniquement accedee via le service role dans
-- l'API (meme modele que le reste des routes qui verifient user.id a la main).
alter table csv_conversions enable row level security;

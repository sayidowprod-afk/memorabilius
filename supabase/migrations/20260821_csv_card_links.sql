-- Table de correspondance "URL longue -> id court" pour les cartes CSV
-- (pas de ligne cartes_manuelles pour elles, donc pas d'UUID a utiliser dans
-- /s/{id} comme pour les cartes ajoutees manuellement). Permet de generer un
-- lien court /c/{id} au lieu de /galerie/{userId}?card={url complete encodee}.
create table if not exists csv_card_links (
  id bigserial primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  image_url text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists csv_card_links_user_url_idx
  on csv_card_links (user_id, image_url);

-- Jeu "devine le joueur" pour une émission : signature rognée affichée seule,
-- la carte complète (photo HD + nom) révélée ensuite par le présentateur.
-- Table de préparation/curation séparée des cartes elles-mêmes : une carte
-- source (cartes_manuelles) peut être retirée/modifiée sans casser le jeu une
-- fois la ligne créée ici (image_recto et nom dupliqués au moment de l'ajout).
create table if not exists autograph_quiz_cards (
  id uuid primary key default gen_random_uuid(),
  source_card_id uuid references cartes_manuelles(id) on delete set null,
  player_name text not null,
  team text,
  image_recto text not null,
  -- Rectangle de rognage de la signature, fractions 0..1 de l'image (comme
  -- detect-corners) -- indépendant de la résolution réelle de l'image.
  crop_x numeric not null,
  crop_y numeric not null,
  crop_w numeric not null,
  crop_h numeric not null,
  approved boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists autograph_quiz_cards_approved_idx on autograph_quiz_cards (approved, position);

alter table autograph_quiz_cards enable row level security;

-- Admin uniquement (préparation avant émission, pas une fonctionnalité publique) --
-- même garde que les autres tables admin de l'app : email whitelist côté API route
-- (service role), donc RLS ferme tout par défaut ici et les routes /api/admin/*
-- passent par la clé service role qui bypass RLS.
create policy "autograph_quiz_cards_no_public_access" on autograph_quiz_cards
  for all using (false);

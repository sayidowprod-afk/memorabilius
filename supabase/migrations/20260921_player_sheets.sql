-- Fiches joueurs pour les revues d'équipe en émission (admin uniquement) --
-- carte 3D + stats manuelles par joueur, groupées par équipe NBA.
-- Snapshot des images de la carte au moment du choix (plutôt qu'une simple
-- FK) pour que la fiche reste affichable même si la carte est modifiée ou
-- retirée de la galerie plus tard.

create table if not exists player_sheets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  team_abbr text not null,
  player_name text not null,
  card_id uuid references cartes_manuelles(id) on delete set null,
  card_image_recto text,
  card_image_recto_hd text,
  card_image_verso text,
  card_image_verso_hd text,
  card_is_horizontal boolean not null default false,
  stat_saison text,
  stat_poste text,
  stat_country text,
  stat_age text,
  stat_matches text,
  stat_minutes text,
  stat_points text,
  stat_rebonds text,
  stat_passes text,
  stat_autres text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists player_sheets_team_idx on player_sheets(team_abbr);

alter table player_sheets enable row level security;

create policy "admins manage player sheets"
  on player_sheets for all
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin));

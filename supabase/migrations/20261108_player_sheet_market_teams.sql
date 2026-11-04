-- Équipes dont on veut les stats cartes (fiches joueurs, podcast) : seules les équipes cochées sont calculées.
create table if not exists player_sheet_market_teams (
  team_abbr text primary key,
  created_at timestamptz not null default now()
);

alter table player_sheet_market_teams enable row level security;

create policy "admins manage market teams"
  on player_sheet_market_teams for all
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.is_admin));

-- Depuis le 30/10/2026 Supabase n'accorde plus l'accès API automatiquement aux nouvelles tables.
grant select, insert, delete on player_sheet_market_teams to authenticated;
grant all on player_sheet_market_teams to service_role;

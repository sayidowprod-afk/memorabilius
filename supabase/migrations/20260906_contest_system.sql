-- Concours hebdomadaire automatise sur le bot Discord (theme -> vote theme ->
-- participations -> vote participations -> gagnant), pilote par
-- src/app/api/discord/route.ts (commandes + boutons) et
-- src/app/api/contest/tick/route.ts (cron externe, voir .github/workflows).
-- Ecrit/lu uniquement via ces routes (service role) -- pas de policy RLS pour
-- anon/authenticated, aucune donnee ici n'est exposee cote client.

create table if not exists contest_themes (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  active boolean not null default true,
  times_used int not null default 0,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists contest_weeks (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique,
  status text not null default 'theme_voting' check (status in ('theme_voting', 'submission_open', 'entry_voting', 'closed')),
  theme_option_ids uuid[] not null default '{}',
  theme_vote_channel_id text,
  theme_vote_message_id text,
  winning_theme_id uuid references contest_themes(id),
  entry_vote_started_at timestamptz,
  winning_entry_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists contest_theme_votes (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references contest_weeks(id) on delete cascade,
  theme_id uuid not null references contest_themes(id) on delete cascade,
  discord_user_id text not null,
  created_at timestamptz not null default now(),
  unique (week_id, discord_user_id)
);

create table if not exists contest_entries (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references contest_weeks(id) on delete cascade,
  discord_user_id text not null,
  discord_username text,
  image_url text not null,
  message_id text,
  created_at timestamptz not null default now(),
  unique (week_id, discord_user_id)
);

alter table contest_weeks
  add constraint contest_weeks_winning_entry_fk
  foreign key (winning_entry_id) references contest_entries(id);

create table if not exists contest_entry_votes (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references contest_weeks(id) on delete cascade,
  entry_id uuid not null references contest_entries(id) on delete cascade,
  discord_user_id text not null,
  created_at timestamptz not null default now(),
  unique (week_id, discord_user_id)
);

create index if not exists contest_entry_votes_entry_idx on contest_entry_votes (entry_id);
create index if not exists contest_theme_votes_theme_idx on contest_theme_votes (theme_id);
create index if not exists contest_entries_week_idx on contest_entries (week_id);

alter table contest_themes enable row level security;
alter table contest_weeks enable row level security;
alter table contest_theme_votes enable row level security;
alter table contest_entries enable row level security;
alter table contest_entry_votes enable row level security;

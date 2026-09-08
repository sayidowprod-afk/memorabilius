-- Anniversaires NBA (All-Stars, actuels + passes) postes automatiquement par
-- le bot Discord (voir src/app/api/cron/nba-birthday/route.ts). Alimente via
-- scripts/backfill-nba-allstar-birthdays.js (source: liste Wikipedia des
-- All-Stars NBA + date de naissance/photo ESPN). Ecrit/lu uniquement en
-- service role -- pas de policy RLS anon/authenticated, rien n'est expose
-- cote client.

create table if not exists nba_allstar_birthdays (
  id uuid primary key default gen_random_uuid(),
  player_name text not null unique,
  birth_date date not null,
  -- Colonnes derivees (mois/jour) plutot que EXTRACT() a chaque requete --
  -- le cron quotidien filtre dessus directement via des .eq() Supabase JS
  -- simples, pas besoin d'une fonction RPC pour ca.
  birth_month int not null,
  birth_day int not null,
  all_star_count int not null default 1,
  headshot_url text,
  created_at timestamptz not null default now()
);

create index if not exists nba_allstar_birthdays_month_day_idx on nba_allstar_birthdays (birth_month, birth_day);

-- Un seul post par jour calendaire (Paris) -- garde l'idempotence si le cron
-- est redeclenche plusieurs fois le meme jour (retry, appel manuel de test...)
-- et memorise l'etat d'attente pendant qu'un choix admin est en cours (voir
-- handleBirthdayComponent dans src/app/api/discord/route.ts).
create table if not exists nba_birthday_posts (
  post_date date primary key,
  status text not null default 'awaiting_admin' check (status in ('posted', 'awaiting_admin', 'none')),
  thread_id text,
  message_id text,
  chosen_player_id uuid references nba_allstar_birthdays(id),
  created_at timestamptz not null default now()
);

alter table nba_allstar_birthdays enable row level security;
alter table nba_birthday_posts enable row level security;

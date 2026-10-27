-- Picks du module Pronos (accueil) : persiste le choix de l'utilisateur par
-- match pour qu'il survive au refresh / reconnexion. match_id est l'id
-- composite "{sport}-{apiId}" renvoyé par /api/pronos/matches (ex: "nba-401909277").
--
-- Écriture réservée au service role (routes /api/pronos/pick et /resolve) :
-- la règle "pas de pick sur un match déjà commencé" est appliquée côté
-- serveur, donc aucune policy INSERT/UPDATE/DELETE pour les clients --
-- sinon un utilisateur pourrait écrire un pick sur un match terminé et
-- toucher l'XP. Les picks sont purgés par /resolve 8 jours après le coup
-- d'envoi (inutile de les garder au-delà).
create table if not exists public.pronos_picks (
  user_id uuid not null references auth.users(id) on delete cascade,
  match_id text not null,
  pick text not null check (pick in ('left', 'right')),
  kickoff_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, match_id)
);

create index if not exists pronos_picks_kickoff_idx on public.pronos_picks (kickoff_at);

alter table public.pronos_picks enable row level security;

drop policy if exists "pronos_picks select own" on public.pronos_picks;
create policy "pronos_picks select own" on public.pronos_picks
  for select using ((select auth.uid()) = user_id);

grant select on public.pronos_picks to authenticated;

-- XP : un seul versement par (user, match), même si /resolve est rappelée
-- en parallèle (même principe que xp_events_weekly_challenge_unique).
create unique index if not exists xp_events_pronos_win_unique
  on public.xp_events (user_id, (meta->>'match_id'))
  where type = 'pronos_win';

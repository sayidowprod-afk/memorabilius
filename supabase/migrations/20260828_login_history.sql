-- Historique des connexions reussies, affiche dans Parametres > Securite.
-- Ecrit uniquement par la route API (service role) qui lit l'IP cote
-- serveur -- jamais fournie par le client, pour eviter qu'un utilisateur
-- puisse falsifier son propre historique.
create table if not exists login_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists login_history_user_created_idx on login_history (user_id, created_at desc);

alter table login_history enable row level security;

-- Chacun ne peut lire que ses propres connexions -- l'insert reste reserve
-- au service role (aucune policy insert pour anon/authenticated).
create policy "login_history_select_own" on login_history
  for select using (auth.uid() = user_id);

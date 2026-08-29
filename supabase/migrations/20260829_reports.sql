-- Signalement d'utilisateur (distinct du blocage, qui n'existe pas encore).
-- Ecrit uniquement par la route API (service role) -- pas de policy
-- insert/select pour anon/authenticated, consultation via le dashboard
-- Supabase directement (pas d'interface admin dediee, comme user_feedback).
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_user_id uuid references auth.users(id) on delete cascade,
  context text,
  reason text not null,
  message text,
  created_at timestamptz not null default now()
);

create index if not exists reports_created_idx on reports (created_at desc);

alter table reports enable row level security;

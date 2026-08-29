-- Canal "Signaler un bug / suggestion" depuis /parametres. Ecrit uniquement
-- par la route API (service role) -- pas de policy insert/select pour
-- anon/authenticated, la consultation se fait directement via le dashboard
-- Supabase (pas d'interface admin dediee pour l'instant, inutile vu le
-- volume attendu).
create table if not exists user_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text,
  type text not null check (type in ('bug', 'suggestion')),
  message text not null,
  page_url text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists user_feedback_created_idx on user_feedback (created_at desc);

alter table user_feedback enable row level security;

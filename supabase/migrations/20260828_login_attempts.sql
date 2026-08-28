-- Verrouillage anti-bruteforce sur /connexion : trace uniquement les echecs
-- de connexion (email + horodatage), jamais le mot de passe. Lu/ecrit
-- exclusivement par la route API cote serveur (service role, qui contourne
-- RLS) -- RLS reste actif sans aucune policy pour interdire tout acces
-- direct (anon/authenticated) a cette table.
create table if not exists login_attempts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  created_at timestamptz not null default now()
);

create index if not exists login_attempts_email_created_idx on login_attempts (email, created_at desc);

alter table login_attempts enable row level security;

-- Purge best-effort des lignes de plus de 24h pour ne pas laisser la table
-- grossir indefiniment (pas besoin d'historique au-dela de la fenetre de
-- verrouillage de 15 min).
create index if not exists login_attempts_created_idx on login_attempts (created_at);

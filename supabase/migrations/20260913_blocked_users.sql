-- Audit communautaire du 13/09 : aucun mecanisme de blocage n'existait --
-- un utilisateur harcele en messagerie ne pouvait que signaler (ReportButton),
-- ce qui n'empeche rien immediatement. Ajoute une table de blocage simple
-- (bloqueur -> bloque) + met a jour les policies concernees pour qu'un
-- utilisateur bloque ne puisse plus envoyer de message a celui qui l'a
-- bloque, et que chacun ne voie que ses propres blocages.

create table if not exists public.blocked_users (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id)
);

alter table public.blocked_users enable row level security;

create policy "Voir ses blocages" on public.blocked_users
  for select using (auth.uid() = blocker_id);

create policy "Bloquer quelqu'un" on public.blocked_users
  for insert with check (auth.uid() = blocker_id and blocker_id <> blocked_id);

create policy "Debloquer quelqu'un" on public.blocked_users
  for delete using (auth.uid() = blocker_id);

-- Remplace la policy INSERT existante sur messages pour refuser l'envoi dans
-- les 2 sens des qu'un blocage existe entre les 2 utilisateurs (bloquer
-- quelqu'un coupe la conversation entierement, pas juste ses messages
-- entrants -- comportement attendu d'un "bloquer" classique).
drop policy if exists "Envoyer un message" on public.messages;
create policy "Envoyer un message" on public.messages
  for insert with check (
    auth.uid() = from_user_id
    and not exists (
      select 1 from public.blocked_users
      where (blocker_id = to_user_id and blocked_id = from_user_id)
         or (blocker_id = from_user_id and blocked_id = to_user_id)
    )
  );

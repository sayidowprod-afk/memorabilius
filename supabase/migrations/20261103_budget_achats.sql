-- Budget mensuel d'achats (tracker de dépenses de « Mes achats »). Une ligne par membre, lisible et modifiable
-- uniquement par lui (RLS). GRANT explicites (plus d'auto-grant API sur les nouvelles tables public).
create table if not exists public.budgets_achats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  mensuel numeric(10, 2) not null check (mensuel >= 0),
  updated_at timestamptz not null default now()
);

alter table public.budgets_achats enable row level security;

drop policy if exists "budgets_achats select own" on public.budgets_achats;
create policy "budgets_achats select own" on public.budgets_achats
  for select using ((select auth.uid()) = user_id);

drop policy if exists "budgets_achats insert own" on public.budgets_achats;
create policy "budgets_achats insert own" on public.budgets_achats
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "budgets_achats update own" on public.budgets_achats;
create policy "budgets_achats update own" on public.budgets_achats
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "budgets_achats delete own" on public.budgets_achats;
create policy "budgets_achats delete own" on public.budgets_achats
  for delete using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.budgets_achats to authenticated;
grant all on public.budgets_achats to service_role;

-- Messages : « supprimer une conversation » = la masquer POUR SOI seulement.
-- Rien n'est effacé de `messages` (l'autre personne garde tout, les offres
-- d'échange liées aussi). On retient l'instant du masquage : la conversation
-- disparaît de la liste et l'historique antérieur n'est plus affiché ; elle
-- réapparaît (avec les seuls nouveaux messages) si un message plus récent arrive.
create table if not exists public.hidden_conversations (
  user_id uuid not null references auth.users(id) on delete cascade,
  other_id uuid not null references auth.users(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (user_id, other_id)
);

alter table public.hidden_conversations enable row level security;

drop policy if exists "hidden_conversations select own" on public.hidden_conversations;
create policy "hidden_conversations select own" on public.hidden_conversations
  for select using ((select auth.uid()) = user_id);

drop policy if exists "hidden_conversations insert own" on public.hidden_conversations;
create policy "hidden_conversations insert own" on public.hidden_conversations
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "hidden_conversations update own" on public.hidden_conversations;
create policy "hidden_conversations update own" on public.hidden_conversations
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- GRANT explicites (plus d'auto-grant API sur les nouvelles tables public).
grant select, insert, update on public.hidden_conversations to authenticated;

-- L'heure du masquage vient de la base (now()), jamais de l'horloge du client :
-- une horloge en avance cacherait sinon les nouveaux messages.
create or replace function public.hide_conversation(p_other uuid)
returns void
language sql
security invoker
set search_path = public
as $$
  insert into public.hidden_conversations (user_id, other_id, hidden_at)
  values (auth.uid(), p_other, now())
  on conflict (user_id, other_id) do update set hidden_at = now();
$$;

grant execute on function public.hide_conversation(uuid) to authenticated;

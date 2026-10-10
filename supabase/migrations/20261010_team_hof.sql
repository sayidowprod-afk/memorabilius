-- Hall of fame de team : une place par membre, il y choisit une carte de sa collection (instantane image + nom).
create table if not exists public.team_hof (
  team_id integer not null references public.teams(id) on delete cascade,
  user_id uuid not null,
  card_key text,
  image text not null,
  nom text not null,
  annee text,
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

alter table public.team_hof enable row level security;

drop policy if exists "team_hof lecture" on public.team_hof;
create policy "team_hof lecture" on public.team_hof for select using (true);

drop policy if exists "team_hof ecriture membre" on public.team_hof;
create policy "team_hof ecriture membre" on public.team_hof for insert
  with check (auth.uid() = user_id and exists (select 1 from public.team_members m where m.team_id = team_hof.team_id and m.user_id = auth.uid()));

drop policy if exists "team_hof maj membre" on public.team_hof;
create policy "team_hof maj membre" on public.team_hof for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "team_hof suppression" on public.team_hof;
create policy "team_hof suppression" on public.team_hof for delete using (auth.uid() = user_id);

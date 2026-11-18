-- Packs : 1 pack gratuit par heure (10 en réserve au maximum), tiré dans TOUTES les cartes de la base qui ont une photo (aucune collection virtuelle : ce sont de vraies cartes à découvrir).
-- PRÉREQUIS (à lancer seul, avant ce fichier, car « concurrently » ne passe pas dans un bloc) :
--   create index concurrently if not exists idx_cse_with_image on public.card_set_entries (id) where image_url is not null;
-- Puis lancer ce fichier, puis : select public.rebuild_pack_pool();   (à relancer de temps en temps pour ajouter les nouvelles photos)
set statement_timeout = 0;

-- ── 1. Le « pot » de cartes tirables : une ligne par carte qui a une photo ───────────────────────────────────────────────
create table if not exists public.pack_pool (
  entry_id    bigint primary key,
  set_id      integer not null,
  card_number text,
  player_name text not null,
  team        text,
  variation   text,
  is_rc       boolean not null default false,
  is_auto     boolean not null default false,
  image_url   text not null,
  set_name    text,
  set_year    integer,
  set_brand   text,
  sport       text,
  credit_user uuid,          -- membre qui a envoyé la photo (affiché en crédit)
  series_size integer,       -- nombre de cartes de la même série dans le set (plus c'est petit, plus c'est rare)
  score       integer not null default 0,   -- plus il est haut, plus la carte est rare
  rarity      smallint not null,
  rid         bigserial
);
alter table public.pack_pool add column if not exists score integer not null default 0;
create index if not exists idx_pack_pool_rarity on public.pack_pool (rarity, rid);
alter table public.pack_pool enable row level security;   -- lecture réservée au serveur (service role)

-- Raretés (règles du site) :
--   1 Commune      = carte de base
--   2 Peu commune  = base rookie (RC) (et insert / parallèle simple, sans critère)
--   3 Rare         = numérotée OU patch OU rookie en insert / parallèle
--   4 Épique       = signée, OU deux critères parmi (signée, patch, numérotée, RC)
--   5 Légendaire   = numérotée sous /15 (/15 et moins : /10, /5, /1…)
-- « Numérotée » : le tirage n'est pas dans la checklist, on le lit sur les cartes des membres reliées à cette série (champ num « 07/25 » -> 25).
-- Une série dont aucun membre n'a relié de carte numérotée compte comme parallèle simple (peu commune) : la rareté s'affine toute seule quand les membres relient leurs cartes.
alter table public.pack_pool add column if not exists print_run integer;
alter table public.pack_pool add column if not exists is_patch boolean not null default false;
create or replace function public.rebuild_pack_pool() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  with src as (
    select e.id as entry_id, e.set_id, e.card_number, e.player_name, e.team, e.variation,
           coalesce(e.is_rc, false) as is_rc, coalesce(e.is_auto, false) as is_auto, e.image_url
    from public.card_set_entries e where e.image_url is not null
    union
    select e.id, e.set_id, e.card_number, e.player_name, e.team, e.variation,
           coalesce(e.is_rc, false), coalesce(e.is_auto, false), ei.image_url
    from (select distinct on (entry_id) entry_id, image_url from public.entry_images order by entry_id, created_at desc) ei
    join public.card_set_entries e on e.id = ei.entry_id
    where e.image_url is null
  ), ok as (
    select s.* from src s
    where s.image_url like '%/storage/v1/object/public/%'   -- uniquement les photos hébergées chez nous (les cartes venues d'un CSV, sur ibb/postimg/catbox, chargent mal)
      and s.player_name is not null
      and not exists (select 1 from public.cartes_privees x where x.card_key = s.image_url)
  ), sz as (
    select e.set_id, e.variation, count(*)::integer as n
    from public.card_set_entries e
    where e.set_id in (select distinct set_id from ok)
    group by e.set_id, e.variation
  ), runs as (   -- tirage d'une série, lu sur les cartes numérotées des membres (« 07/25 » -> 25)
    select e.set_id, e.variation, min((substring(c.num from '/\s*(\d+)\s*$'))::integer) as run
    from public.cartes_manuelles c
    join public.card_set_entries e on e.id = c.set_entry_id
    where c.set_entry_id is not null and c.num ~ '/\s*\d{1,3}\s*$' and e.variation is not null
      and e.set_id in (select distinct set_id from ok)
    group by e.set_id, e.variation
  ), imgruns as (   -- ce que dit la carte du membre dont vient la photo (« 07/25 » -> 25, patch, signée, rookie) : le plus fiable, même si la photo est reliée à une mauvaise ligne de la checklist
    select c.image_recto,
           min((substring(c.num from '/\s*(\d+)\s*$'))::integer) filter (where c.num ~ '/\s*\d{1,3}\s*$') as run,
           bool_or(coalesce(c.patch, false)) as patch, bool_or(coalesce(c.auto, false)) as auto, bool_or(coalesce(c.rc, false)) as rc
    from public.cartes_manuelles c
    where c.image_recto in (select image_url from ok)
    group by c.image_recto
  ), f as (
    select o.entry_id, o.set_id, o.card_number, o.player_name, o.team, o.variation, o.image_url, z.n as series_size,
           (o.is_rc or coalesce(ir.rc, false)) as is_rc,
           case when ir.run is not null then ir.run when o.variation is not null then r.run end as run,
           (coalesce(o.variation ~* '(patch|jersey|relic|memorabilia|swatch|fabric|remnant|woven|logoman)', false) or coalesce(ir.patch, false)) as is_patch,
           (o.is_auto or coalesce(ir.auto, false) or coalesce(o.variation ~* '(auto|signature|signed|\mink\M)', false)) as auto_eff   -- signée : case cochée, carte du membre, ou nom de série
    from ok o
    left join sz z on z.set_id = o.set_id and z.variation is not distinct from o.variation
    left join runs r on r.set_id = o.set_id and r.variation is not distinct from o.variation
    left join imgruns ir on ir.image_recto = o.image_url
  ), f2 as (select f.*, (f.run is not null) as is_num from f
  )
  insert into public.pack_pool (entry_id, set_id, card_number, player_name, team, variation, is_rc, is_auto, image_url,
                                set_name, set_year, set_brand, sport, credit_user, series_size, print_run, is_patch, score, rarity)
  select f.entry_id, f.set_id, f.card_number, f.player_name, f.team, f.variation, f.is_rc, f.auto_eff, f.image_url,
         cs.name, cs.year, cs.brand, cs.sport,
         nullif(substring(f.image_url from '/cartes/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/'), '')::uuid,
         f.series_size, f.run, f.is_patch,
         f.auto_eff::int + f.is_patch::int + f.is_num::int,
         (case
            when f.is_num and f.run <= 15 then 5
            when f.auto_eff or (f.is_patch::int + f.is_num::int + f.is_rc::int) >= 2 then 4
            when f.is_num or f.is_patch or (f.is_rc and f.variation is not null) then 3
            when f.is_rc or f.variation is not null then 2
            else 1 end)::smallint
  from f2 f
  join public.card_sets cs on cs.id = f.set_id
  on conflict (entry_id) do update set
    image_url = excluded.image_url, team = excluded.team, variation = excluded.variation, is_rc = excluded.is_rc, is_auto = excluded.is_auto,
    set_name = excluded.set_name, set_year = excluded.set_year, set_brand = excluded.set_brand, sport = excluded.sport,
    credit_user = excluded.credit_user, series_size = excluded.series_size, print_run = excluded.print_run, is_patch = excluded.is_patch, score = excluded.score, rarity = excluded.rarity;
  -- une photo retirée ou passée en privé sort du pot
  delete from public.pack_pool p where not exists (select 1 from public.card_set_entries e where e.id = p.entry_id and e.image_url is not null)
    and not exists (select 1 from public.entry_images i where i.entry_id = p.entry_id);
  delete from public.pack_pool where image_url not like '%/storage/v1/object/public/%';
  select count(*) into n from public.pack_pool;
  return n;
end $$;
revoke all on function public.rebuild_pack_pool() from public, anon, authenticated;
grant execute on function public.rebuild_pack_pool() to service_role;

-- ── 2. État de chaque membre : réserve de packs, garantie, nombre de packs ouverts ───────────────────────────────────────────
create table if not exists public.user_packs (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  last_free  date,
  pity       integer not null default 0,
  opened     integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.user_packs enable row level security;
drop policy if exists "packs_own_select" on public.user_packs;
create policy "packs_own_select" on public.user_packs for select using ((select auth.uid()) = user_id);
-- aucune écriture directe : tout passe par le serveur (fonctions ci-dessous, service role uniquement)

-- Réserve de packs : 1 pack gagné par heure, 10 maximum en réserve. Calcul « paresseux » à chaque lecture (pas de tâche planifiée).
alter table public.user_packs add column if not exists stock integer not null default 10;           -- packs en réserve (10 au départ : la réserve est pleine)
alter table public.user_packs alter column stock set default 10;
alter table public.user_packs add column if not exists stock_at timestamptz not null default now(); -- repère de l'heure en cours de décompte

-- p_use = true : prend un pack s'il y en a un ; false : lit seulement l'état. Renvoie {ok, stock, next} (next = heure du prochain pack, null si la réserve est pleine)
create or replace function public.pack_stock(p_user uuid, p_use boolean default false, p_max integer default 10) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.user_packs%rowtype; gained integer; avail integer; ref timestamptz; nxt timestamptz;
begin
  insert into public.user_packs (user_id) values (p_user) on conflict do nothing;
  select * into r from public.user_packs where user_id = p_user for update;
  gained := greatest(0, floor(extract(epoch from (now() - r.stock_at)) / 3600)::integer);
  avail := least(p_max, r.stock + gained);
  ref := case when avail >= p_max then now() else r.stock_at + gained * interval '1 hour' end;
  if p_use then
    if avail < 1 then
      update public.user_packs set stock = 0, stock_at = ref where user_id = p_user;
      return jsonb_build_object('ok', false, 'stock', 0, 'next', ref + interval '1 hour');
    end if;
    avail := avail - 1;                                 -- la réserve n'est plus pleine : le décompte repart de maintenant si elle l'était
  end if;
  update public.user_packs set stock = avail, stock_at = ref where user_id = p_user;
  nxt := case when avail >= p_max then null else ref + interval '1 hour' end;
  return jsonb_build_object('ok', true, 'stock', avail, 'next', nxt);
end $$;

-- rend un pack (tirage raté)
create or replace function public.pack_refund(p_user uuid, p_max integer default 10) returns void
language sql security definer set search_path = public as $$
  update public.user_packs set stock = least(p_max, stock + 1) where user_id = p_user
$$;

create or replace function public.pack_finish(p_user uuid, p_pity integer) returns void
language sql security definer set search_path = public as $$
  update public.user_packs set pity = p_pity, opened = opened + 1 where user_id = p_user
$$;

-- infos du pot : nombre de cartes par rareté
create or replace function public.pack_pool_info() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'total', (select count(*) from public.pack_pool),
    'rarity', (select coalesce(jsonb_object_agg(rarity::text, n), '{}'::jsonb) from (select rarity, count(*) n from public.pack_pool group by rarity) r))
$$;

revoke all on function public.pack_stock(uuid, boolean, integer) from public, anon, authenticated;
revoke all on function public.pack_refund(uuid, integer) from public, anon, authenticated;
revoke all on function public.pack_finish(uuid, integer) from public, anon, authenticated;
revoke all on function public.pack_pool_info() from public, anon, authenticated;
grant execute on function public.pack_stock(uuid, boolean, integer) to service_role;
grant execute on function public.pack_refund(uuid, integer) to service_role;
grant execute on function public.pack_finish(uuid, integer) to service_role;
grant execute on function public.pack_pool_info() to service_role;


-- ── 4. Historique des cartes tirées (pour « Mes cartes tirées » : tri, filtres, doublons) ─────────────────────────────────
create table if not exists public.user_pack_cards (
  user_id  uuid   not null references auth.users(id) on delete cascade,
  entry_id bigint not null,
  qty      integer not null default 1,
  first_at timestamptz not null default now(),
  last_at  timestamptz not null default now(),
  primary key (user_id, entry_id)
);
alter table public.user_pack_cards add column if not exists shared_at timestamptz;   -- carte déjà partagée sur Discord
create index if not exists idx_user_pack_cards_recent on public.user_pack_cards (user_id, last_at desc);
alter table public.user_pack_cards enable row level security;
drop policy if exists "pack_cards_own_select" on public.user_pack_cards;
create policy "pack_cards_own_select" on public.user_pack_cards for select using ((select auth.uid()) = user_id);

create or replace function public.pack_record(p_user uuid, p_ids bigint[]) returns void
language sql security definer set search_path = public as $$
  insert into public.user_pack_cards (user_id, entry_id, qty)
  select p_user, x.id, count(*) from unnest(p_ids) as x(id) group by x.id
  on conflict (user_id, entry_id) do update set qty = public.user_pack_cards.qty + excluded.qty, last_at = now()
$$;

create or replace function public.pack_inventory(p_user uuid) returns setof jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', p.entry_id, 'setId', p.set_id, 'qty', c.qty, 'first', c.first_at, 'last', c.last_at, 'rarity', p.rarity, 'player', p.player_name,
           'team', p.team, 'number', p.card_number, 'variation', p.variation, 'rc', p.is_rc, 'auto', p.is_auto, 'patch', p.is_patch, 'run', p.print_run, 'img', p.image_url,
           'set', p.set_name, 'year', p.set_year, 'brand', p.set_brand, 'sport', p.sport, 'credit', p.credit_user)
  from public.user_pack_cards c join public.pack_pool p on p.entry_id = c.entry_id
  where c.user_id = p_user
  order by c.last_at desc
  limit 5000
$$;

revoke all on function public.pack_record(uuid, bigint[]) from public, anon, authenticated;
revoke all on function public.pack_inventory(uuid) from public, anon, authenticated;
grant execute on function public.pack_record(uuid, bigint[]) to service_role;
grant execute on function public.pack_inventory(uuid) to service_role;

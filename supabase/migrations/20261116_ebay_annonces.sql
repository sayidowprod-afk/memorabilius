-- Alertes sur MES annonces eBay (côté vendeur) : nouvelle enchère, nouveaux suiveurs, fin dans 1 h, résultat d'une enchère terminée,
-- et rappel « colis à expédier ». Une ligne par annonce suivie ; elle sert à comparer l'état d'une lecture à l'autre.
-- À appliquer dans le SQL editor de Supabase. Sans elle, le site continue de fonctionner (les alertes de vente sont simplement inactives).

create table if not exists public.ebay_annonces (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null,
  titre text,
  photo_url text,
  enchere boolean not null default false,
  devise text,
  prix_actuel numeric(12, 2),
  nb_encheres integer,
  nb_suivis integer,
  fin_at timestamptz,
  lien text,
  statut text not null default 'active' check (statut in ('active', 'vendue', 'invendue')),
  prix_final numeric(12, 2),
  acheteur text,
  alerte_fin_envoyee boolean not null default false,
  vu_at timestamptz not null default now(),
  maj_at timestamptz not null default now(),
  primary key (user_id, item_id)
);
create index if not exists ebay_annonces_user_statut on public.ebay_annonces (user_id, statut);

alter table public.ebay_annonces enable row level security;
drop policy if exists "annonces eBay : lecture par leur auteur" on public.ebay_annonces;
create policy "annonces eBay : lecture par leur auteur" on public.ebay_annonces for select to authenticated using (auth.uid() = user_id);

-- depuis le 30 octobre 2026, une nouvelle table n'a plus de droits automatiques sur l'API : on les donne explicitement
grant select on public.ebay_annonces to authenticated;
grant select, insert, update, delete on public.ebay_annonces to service_role;

-- dernière lecture des annonces d'un membre (pour espacer les lectures de ceux qui n'ont rien en vente)
alter table public.ebay_connexions add column if not exists annonces_synchro_at timestamptz;
-- identifiant de l'annonce eBay d'une vente : relie une enchère terminée à sa vente (la synchronisation l'envoyait déjà, la table n'avait pas la colonne)
alter table public.ventes_membre add column if not exists item_id text;
create index if not exists ventes_membre_item_idx on public.ventes_membre (user_id, item_id);
-- dernier rappel « à expédier » envoyé pour une vente (un rappel par jour au plus)
alter table public.ventes_membre add column if not exists alerte_expedition_at timestamptz;

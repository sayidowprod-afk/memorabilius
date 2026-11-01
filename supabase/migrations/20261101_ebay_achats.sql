-- Achats, enchères et articles suivis des membres, importés automatiquement depuis leur compte eBay
-- (page « Mes achats »). Pensé pour accueillir plus tard d'autres sources (Vinted) : colonne `source`.
--
-- ebay_connexions : une ligne par membre qui a connecté son compte eBay. Le jeton eBay (chiffré AES-256-GCM côté serveur,
--   clé EBAY_TOKEN_KEY) n'est JAMAIS lisible par un membre : seules les colonnes d'état sont accordées à `authenticated`.
-- achats_membre : les achats / enchères / suivis, écrits uniquement par le serveur (service role), lisibles par leur propriétaire.
--
-- GRANT explicites (plus d'auto-grant API sur les nouvelles tables public).

create table if not exists public.ebay_connexions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ebay_user_id text,                                  -- pseudo eBay (sert aux notifications de suppression de compte)
  token_chiffre text,                                 -- jeton Auth'n'Auth chiffré (v1.iv.tag.contenu) -- jamais exposé
  token_expire_at timestamptz,
  statut text not null default 'en_attente' check (statut in ('en_attente', 'connecte', 'expire')),
  session_id text,                                    -- session eBay en cours de connexion (éphémère)
  etat text,                                          -- jeton anti-falsification du retour eBay (éphémère)
  session_cree_at timestamptz,
  connecte_at timestamptz,
  derniere_synchro_at timestamptz,
  derniere_erreur text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ebay_connexions_etat_idx on public.ebay_connexions (etat) where etat is not null;
create index if not exists ebay_connexions_ebay_user_idx on public.ebay_connexions (lower(ebay_user_id));
create index if not exists ebay_connexions_synchro_idx on public.ebay_connexions (statut, derniere_synchro_at);

alter table public.ebay_connexions enable row level security;

drop policy if exists "ebay_connexions select own" on public.ebay_connexions;
create policy "ebay_connexions select own" on public.ebay_connexions
  for select using ((select auth.uid()) = user_id);

-- Colonnes d'état seulement : token_chiffre, session_id et etat ne sont accordés à personne d'autre que le service role.
grant select (user_id, ebay_user_id, token_expire_at, statut, connecte_at, derniere_synchro_at, derniere_erreur)
  on public.ebay_connexions to authenticated;
grant all on public.ebay_connexions to service_role;


create table if not exists public.achats_membre (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null default 'ebay' check (source in ('ebay', 'vinted')),
  type text not null check (type in ('achat', 'enchere', 'suivi')),
  ref text not null,                                  -- eBay : « itemId » (enchère, suivi) ou « itemId-transactionId » (achat)
  item_id text,
  transaction_id text,
  order_id text,
  titre text,
  photo_url text,                                     -- version grande (nette)
  photo_mini text,                                    -- version miniature fournie par eBay (repli si la grande échoue)
  site text,                                          -- site eBay de l'annonce (France, US, Germany...)
  type_annonce text,                                  -- Chinese (enchère), FixedPriceItem (achat immédiat)...
  vendeur text,
  vendeur_note integer,
  devise text,
  prix numeric(12, 2),                                -- achat : prix payé pour l'article
  frais_port numeric(12, 2),
  prix_actuel numeric(12, 2),                         -- enchère / suivi : prix courant
  ma_mise_max numeric(12, 2),
  en_tete boolean,
  nb_encheres integer,
  fin_at timestamptz,                                 -- fin de l'enchère
  achete_at timestamptz,
  paye_at timestamptz,
  expedie_at timestamptz,
  statut_commande text,
  lien text,                                          -- page de l'annonce sur eBay
  lien_commande text,                                 -- page de la commande sur eBay (suivi du colis)
  alerte_fin_envoyee boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source, type, ref)
);

create index if not exists achats_membre_user_idx on public.achats_membre (user_id, type, updated_at desc);
create index if not exists achats_membre_fin_idx on public.achats_membre (fin_at) where type in ('enchere', 'suivi');

alter table public.achats_membre enable row level security;

drop policy if exists "achats_membre select own" on public.achats_membre;
create policy "achats_membre select own" on public.achats_membre
  for select using ((select auth.uid()) = user_id);

grant select on public.achats_membre to authenticated;
grant all on public.achats_membre to service_role;

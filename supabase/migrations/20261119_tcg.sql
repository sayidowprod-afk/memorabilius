-- Cartes à jouer / TCG (Pokémon, Magic, Yu-Gi-Oh!, Lorcana, One Piece…) à côté des cartes de sport.
-- Une carte TCG réutilise les colonnes existantes : nom (nom), extension (collection), numéro dans l'extension (card_number),
-- finition (variation : Holo, Reverse, Foil, Alt Art…), éditeur (marque), année (annee), gradation (grade, cert_number).
-- On ajoute seulement ce qui manque. Toutes les colonnes sont facultatives : une carte de sport ne change pas (jeu vide).
-- À appliquer dans le SQL editor de Supabase. Sans elle, le site continue de fonctionner (les champs TCG sont ignorés à l'enregistrement).

alter table public.cartes_manuelles add column if not exists jeu text;       -- pokemon, mtg, yugioh, lorcana, onepiece… ; vide = carte de sport
alter table public.cartes_manuelles add column if not exists rarete text;    -- Commune, Rare, Ultra rare, Mythique…
alter table public.cartes_manuelles add column if not exists langue text;    -- FR, EN, JP, DE…
alter table public.cartes_manuelles add column if not exists edition text;   -- 1re édition, Illimitée…
alter table public.cartes_manuelles add column if not exists etat text;      -- MT, NM, EX, GD, LP, PL, PO (échelle de Cardmarket)
alter table public.cartes_manuelles add column if not exists tcg_ref text;   -- identifiant dans la base externe (TCGdex pour Pokémon, Scryfall pour Magic) : prix et progression

-- Petit index partiel : seules les cartes TCG y figurent (très peu de lignes), il accélère le filtre « TCG » et les listes par jeu
create index if not exists idx_cartes_manuelles_jeu on public.cartes_manuelles (jeu, user_id) where jeu is not null;

-- Ce que collectionne le membre : sport (par défaut, rien ne change pour les membres actuels), tcg, ou les deux
alter table public.profiles add column if not exists collection_focus text not null default 'sport';
alter table public.profiles drop constraint if exists profiles_collection_focus_check;
alter table public.profiles add constraint profiles_collection_focus_check check (collection_focus in ('sport', 'tcg', 'both'));

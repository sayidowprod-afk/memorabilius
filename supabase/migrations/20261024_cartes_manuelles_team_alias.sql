-- L'app Android (hors de ce depot) interroge l'API REST avec la colonne
-- anglaise "team" au lieu de "equipe", ce qui generait en continu des
-- erreurs Postgres 42703 ("column cartes_manuelles.team does not exist") --
-- 99% des requetes Postgres loggees sur le projet, CPU sature en continu.
-- Colonne generee en lecture seule, simple alias de equipe : corrige
-- immediatement toutes les sources (y compris les apps mobiles deja
-- installees qui ne seront pas mises a jour tout de suite), sans toucher
-- au code existant qui utilise deja "equipe". Les GRANT existants sur la
-- table (deja en place avant le 2026-10-30, cf. memoire GRANT obligatoire)
-- couvrent automatiquement cette nouvelle colonne, pas besoin d'y retoucher.
alter table public.cartes_manuelles
  add column if not exists team text generated always as (equipe) stored;

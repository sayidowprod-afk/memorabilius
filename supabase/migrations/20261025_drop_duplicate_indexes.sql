-- Nettoyage trouve par l'audit perf (indexes dupliques = espace disque +
-- surcout en ecriture pour zero benefice, aucun risque a les retirer).
-- cartes_manuelles : deux index strictement identiques sur created_at.
DROP INDEX IF EXISTS public.cartes_manuelles_created_at_idx;
-- page_views : index simple redondant avec un index composite qui commence
-- par la meme colonne (le composite sert deja les deux usages).
DROP INDEX IF EXISTS public.page_views_country_idx;
DROP INDEX IF EXISTS public.page_views_created_at_idx;

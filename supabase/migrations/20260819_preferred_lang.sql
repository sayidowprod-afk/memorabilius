-- Langue préférée synchronisée depuis LangContext.tsx (localStorage côté
-- client) — nécessaire pour que les notifications push envoyées côté serveur
-- (crons, routes API) puissent s'adresser à chaque destinataire dans la
-- bonne langue, ce que localStorage seul ne permet pas.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_lang TEXT NOT NULL DEFAULT 'fr';

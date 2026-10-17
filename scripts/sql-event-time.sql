-- Heure optionnelle pour les evenements (en plus de la date) -- permet au
-- compte a rebours (EventClock.tsx) de viser l'heure reelle de l'evenement
-- plutot que minuit ce jour-la. Format "HH:MM", nullable (evenements existants
-- sans heure continuent de viser minuit, comportement inchange).
--
-- end_date optionnelle -- certains evenements durent plusieurs jours (salons,
-- pop-up...) ; nullable, absente = evenement d'un seul jour (date).
-- A executer dans Supabase SQL Editor.

ALTER TABLE events ADD COLUMN IF NOT EXISTS time text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS end_date date;
ALTER TABLE event_requests ADD COLUMN IF NOT EXISTS time text;
ALTER TABLE event_requests ADD COLUMN IF NOT EXISTS end_date date;

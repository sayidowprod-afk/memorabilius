-- Pronos : ajoute le choix « match nul » (football, NHL) aux pronostics.
-- La contrainte d'origine n'autorisait que 'left' / 'right'. Pas de nouvelle
-- table : aucun GRANT à ajouter. Idempotent.
alter table public.pronos_picks drop constraint if exists pronos_picks_pick_check;
alter table public.pronos_picks
  add constraint pronos_picks_pick_check check (pick in ('left', 'right', 'draw'));

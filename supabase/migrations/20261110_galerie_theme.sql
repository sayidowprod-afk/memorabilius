-- Thème de galerie (fond dessiné en CSS, choisi par le membre). Colonne texte nullable : null = pas de thème.
-- La table profiles existe déjà : ses droits (lecture publique, modification par le propriétaire) s'appliquent à la nouvelle colonne.
alter table public.profiles add column if not exists galerie_theme text;
alter table public.profiles drop constraint if exists profiles_galerie_theme_check;
alter table public.profiles add constraint profiles_galerie_theme_check
  check (galerie_theme is null or galerie_theme in ('equipe', 'bois', 'marbre', 'tapis', 'neon', 'ardoise', 'parquet', 'pelouse', 'baseball', 'glace', 'terre', 'piste', 'tatami', 'etoiles', 'aurore', 'coucher', 'ocean', 'beton', 'synthwave', 'carbone', 'cuir', 'vestiaire', 'balle-basket', 'balle-baseball', 'balle-tennis', 'balle-football', 'balle-hockey', 'balle-golf', 'balle-volley'));

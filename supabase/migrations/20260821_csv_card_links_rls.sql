-- La table csv_card_links doit être lisible publiquement (sans être connecté) :
-- /c/{id} sert justement à générer l'aperçu de partage (og:image) pour des
-- visiteurs anonymes qui cliquent un lien partagé. Les écritures passent
-- uniquement par la route API (service role key), donc pas de policy insert
-- nécessaire côté client.
alter table csv_card_links enable row level security;

create policy "csv_card_links_public_read" on csv_card_links
  for select using (true);

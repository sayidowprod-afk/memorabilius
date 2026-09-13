-- Audit communautaire du 13/09 : message-notify / comment-notify / like-notify
-- se contentaient de verifier qu'un evenement recent (< 30s) existait, sans
-- jamais le lier precisement a l'appel ni marquer qu'il avait deja ete
-- notifie -- un client pouvait donc rejouer l'appel plusieurs fois dans la
-- fenetre de 30s pour spammer des push identiques a partir d'une seule
-- action reelle. Ajoute une colonne de marquage par table, utilisee par les
-- routes API en verification+ecriture atomique (UPDATE ... WHERE
-- notified_push_at IS NULL) pour garantir qu'un evenement ne declenche
-- jamais plus d'un push.

alter table public.messages add column if not exists notified_push_at timestamptz;
alter table public.card_likes add column if not exists notified_push_at timestamptz;
alter table public.galerie_comments add column if not exists notified_push_at timestamptz;

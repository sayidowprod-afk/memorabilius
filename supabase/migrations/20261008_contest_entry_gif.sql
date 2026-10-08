-- GIF tournant (recto/verso) d'une participation au concours, genere et stocke
-- au moment de la participation (voir postConcoursParticipationPublic dans
-- api/discord/route.ts) pour que le vote des participations l'affiche au lieu
-- du seul recto -- sans avoir a regenerer des dizaines de GIF le jour du vote.
-- Null pour une participation par photo (rien a faire tourner) ou si la
-- generation a echoue : le vote retombe alors sur image_url comme avant.
alter table discord_contest_entries add column if not exists gif_url text;

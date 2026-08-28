-- Preferences de notifications par canal (jusqu'ici tout-ou-rien : seul le
-- systeme d'autorisation OS existait, aucun controle fin cote utilisateur).
-- Correspond aux memes canaux que PushPayload.channelId (pushNotify.ts).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notif_pref_messages boolean NOT NULL DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notif_pref_trades boolean NOT NULL DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notif_pref_wishlist boolean NOT NULL DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notif_pref_community boolean NOT NULL DEFAULT true;

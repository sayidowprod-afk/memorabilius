-- Cache persistant des photos de joueurs (ESPN/NBA CDN/Wikipedia), partage
-- entre toutes les pages qui en affichent (page joueur, recherche, checklist,
-- objectifs...). Remplace le cache en memoire (Map) de /api/player-photos,
-- qui ne survit quasiment jamais entre deux invocations serverless sur
-- Vercel (cold start frequent) -- chaque page rechargeait donc les photos a
-- chaque fois au lieu de les avoir "en direct", meme avec un cache de 24h
-- en intention. Une vraie table survit aux cold starts et aux redeploiements.
CREATE TABLE IF NOT EXISTS player_photo_cache (
  sport       text NOT NULL,
  player_name text NOT NULL,
  photo_url   text,
  fetched_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (sport, player_name)
);

GRANT SELECT, INSERT, UPDATE ON player_photo_cache TO anon, authenticated;

-- Compteur léger pour limiter le débit d'appels aux routes IA (Gemini) coûteuses
-- (detect-corners, scan-card), afin qu'un compte authentifié ne puisse pas spammer
-- des appels et faire gonfler la facture de l'API.

CREATE TABLE IF NOT EXISTS ai_scan_events (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_scan_events_user_time ON ai_scan_events(user_id, created_at);

-- Purge légère : pas besoin de garder l'historique au-delà de la fenêtre de contrôle
-- (fait au niveau applicatif via une suppression best-effort, pas de cron nécessaire ici)
